import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/useLanguage';
import { Loader2, AlertTriangle, Car, Check, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays, isToday, parseISO } from 'date-fns';

interface ReservationData {
  reservation_id: string;
  guest_first_name: string | null;
  guest_last_name: string;
  check_in_date: string;
  riad_id: string;
  riad_name: string;
}

interface TransportOffer {
  id: string;
  name: string;
  name_fr: string | null;
  type: string;
  fields_schema: FieldSchema[];
  day_price: number;
  night_price: number;
  base_pax: number;
  extra_pax_price: number;
  payment_mode: 'at_riad' | 'to_driver';
  day_start_time: string;
  day_end_time: string;
}

interface FieldSchema {
  key: string;
  label: string;
  label_fr: string;
  type: string;
  required: boolean;
}

interface TransportFormProps {
  reservation: ReservationData;
  riadWhatsapp?: string;
  onBack: () => void;
  onSuccess: () => void;
}

export function TransportForm({ reservation, riadWhatsapp, onBack, onSuccess }: TransportFormProps) {
  const { t, language } = useLanguage();
  const [offers, setOffers] = useState<TransportOffer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string>('');
  const [transportDate, setTransportDate] = useState<string>(reservation.check_in_date);
  const [transportTime, setTransportTime] = useState<string>('10:00');
  const [pax, setPax] = useState<number>(2);
  const [dynamicFields, setDynamicFields] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const checkInDate = parseISO(reservation.check_in_date);
  const allowedDates = [
    format(checkInDate, 'yyyy-MM-dd'),
    format(addDays(checkInDate, 1), 'yyyy-MM-dd'),
  ];

  const isLateBooking = transportDate && isToday(parseISO(transportDate));

  useEffect(() => {
    fetchTransportOffers();
  }, [reservation.riad_id]);

  async function fetchTransportOffers() {
    try {
      // Get riad-specific offers with overrides
      const { data: riadOffers, error: riadError } = await supabase
        .from('riad_transport_offers')
        .select(`
          is_active,
          override_day_price,
          override_night_price,
          override_base_pax,
          override_extra_pax_price,
          override_payment_mode,
          transport_offers!inner(
            id,
            name,
            name_fr,
            type,
            fields_schema,
            default_day_price,
            default_night_price,
            default_base_pax,
            default_extra_pax_price,
            default_payment_mode,
            day_start_time,
            day_end_time
          )
        `)
        .eq('riad_id', reservation.riad_id)
        .eq('is_active', true);

      if (riadError) throw riadError;

      // If no riad-specific offers, get all default offers
      if (!riadOffers || riadOffers.length === 0) {
        const { data: defaultOffers, error: defaultError } = await supabase
          .from('transport_offers')
          .select('*');

        if (defaultError) throw defaultError;

        const mappedOffers: TransportOffer[] = (defaultOffers || []).map(offer => ({
          id: offer.id,
          name: offer.name,
          name_fr: offer.name_fr,
          type: offer.type,
          fields_schema: (offer.fields_schema as unknown as FieldSchema[]) || [],
          day_price: Number(offer.default_day_price),
          night_price: Number(offer.default_night_price),
          base_pax: offer.default_base_pax,
          extra_pax_price: Number(offer.default_extra_pax_price),
          payment_mode: offer.default_payment_mode as 'at_riad' | 'to_driver',
          day_start_time: offer.day_start_time,
          day_end_time: offer.day_end_time,
        }));

        setOffers(mappedOffers);
      } else {
        const mappedOffers: TransportOffer[] = riadOffers.map(ro => {
          const offer = ro.transport_offers as any;
          return {
            id: offer.id,
            name: offer.name,
            name_fr: offer.name_fr,
            type: offer.type,
            fields_schema: (offer.fields_schema as unknown as FieldSchema[]) || [],
            day_price: ro.override_day_price ?? Number(offer.default_day_price),
            night_price: ro.override_night_price ?? Number(offer.default_night_price),
            base_pax: ro.override_base_pax ?? offer.default_base_pax,
            extra_pax_price: ro.override_extra_pax_price ?? Number(offer.default_extra_pax_price),
            payment_mode: (ro.override_payment_mode ?? offer.default_payment_mode) as 'at_riad' | 'to_driver',
            day_start_time: offer.day_start_time,
            day_end_time: offer.day_end_time,
          };
        });

        setOffers(mappedOffers);
      }
    } catch (error) {
      console.error('Error fetching transport offers:', error);
      toast.error(t('error'));
    } finally {
      setIsLoading(false);
    }
  }

  const selectedOffer = useMemo(
    () => offers.find(o => o.id === selectedOfferId),
    [offers, selectedOfferId]
  );

  const computedPrice = useMemo(() => {
    if (!selectedOffer || !transportTime) return 0;

    const timeValue = transportTime.replace(':', '');
    const dayStart = selectedOffer.day_start_time.replace(':', '');
    const dayEnd = selectedOffer.day_end_time.replace(':', '');

    const isNight = timeValue < dayStart || timeValue >= dayEnd;
    const basePrice = isNight ? selectedOffer.night_price : selectedOffer.day_price;

    if (pax <= selectedOffer.base_pax) {
      return basePrice;
    }

    const extraPax = pax - selectedOffer.base_pax;
    return basePrice + extraPax * selectedOffer.extra_pax_price;
  }, [selectedOffer, transportTime, pax]);

  const handleDynamicFieldChange = (key: string, value: string) => {
    setDynamicFields(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedOffer) {
      toast.error(t('select_transport_type'));
      return;
    }

    // Validate required dynamic fields
    for (const field of selectedOffer.fields_schema) {
      if (field.required && !dynamicFields[field.key]?.trim()) {
        toast.error(`${language === 'fr' ? field.label_fr : field.label} ${t('required_field')}`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('transport_requests')
        .insert({
          reservation_id: reservation.reservation_id,
          riad_id: reservation.riad_id,
          transport_offer_id: selectedOffer.id,
          transport_date: transportDate,
          transport_time: transportTime,
          pax,
          computed_price: computedPrice,
          payment_mode: selectedOffer.payment_mode,
          payload_details: dynamicFields,
          status: 'pending',
        });

      if (error) throw error;

      toast.success(t('request_submitted'));
      onSuccess();
    } catch (error) {
      console.error('Error submitting transport request:', error);
      toast.error(t('error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Guest Info Card */}
      <Card className="card-elevated">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Check className="h-5 w-5 text-teal" />
            {t('guest_info')}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p><strong>{reservation.guest_first_name} {reservation.guest_last_name}</strong></p>
          <p>{reservation.riad_name} · {format(checkInDate, 'PPP')}</p>
        </CardContent>
      </Card>

      {/* Late Booking Warning */}
      {isLateBooking && (
        <Alert className="border-amber bg-amber-light/10">
          <AlertTriangle className="h-4 w-4 text-amber" />
          <AlertTitle className="text-amber">{t('late_booking_warning')}</AlertTitle>
          <AlertDescription>
            {riadWhatsapp && (
              <a
                href={`https://wa.me/${riadWhatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline mt-2"
              >
                {t('contact_whatsapp')}
              </a>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Transport Form */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="heading-display text-xl">{t('transport_details')}</CardTitle>
          <CardDescription>{t('select_transport_type')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Transport Type */}
            <div className="space-y-2">
              <Label className="font-medium">{t('select_transport_type')}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {offers.map(offer => (
                  <button
                    key={offer.id}
                    type="button"
                    onClick={() => setSelectedOfferId(offer.id)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      selectedOfferId === offer.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Car className={`h-5 w-5 ${selectedOfferId === offer.id ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="font-medium">
                        {language === 'fr' && offer.name_fr ? offer.name_fr : offer.name}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      €{offer.day_price} - €{offer.night_price}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Transport Date */}
            <div className="space-y-2">
              <Label className="font-medium">{t('transport_date')}</Label>
              <Select value={transportDate} onValueChange={setTransportDate}>
                <SelectTrigger className="input-warm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowedDates.map(date => (
                    <SelectItem key={date} value={date}>
                      {format(parseISO(date), 'PPP')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Transport Time */}
            <div className="space-y-2">
              <Label htmlFor="transportTime" className="font-medium">{t('transport_time')}</Label>
              <Input
                id="transportTime"
                type="time"
                value={transportTime}
                onChange={(e) => setTransportTime(e.target.value)}
                className="input-warm"
                required
              />
            </div>

            {/* Passengers */}
            <div className="space-y-2">
              <Label htmlFor="pax" className="font-medium">{t('passengers')}</Label>
              <Input
                id="pax"
                type="number"
                min={1}
                max={10}
                value={pax}
                onChange={(e) => setPax(Math.max(1, parseInt(e.target.value) || 1))}
                className="input-warm"
                required
              />
            </div>

            {/* Dynamic Fields */}
            {selectedOffer?.fields_schema.map(field => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key} className="font-medium">
                  {language === 'fr' ? field.label_fr : field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                <Input
                  id={field.key}
                  type={field.type}
                  value={dynamicFields[field.key] || ''}
                  onChange={(e) => handleDynamicFieldChange(field.key, e.target.value)}
                  className="input-warm"
                  required={field.required}
                />
              </div>
            ))}

            {/* Price Summary */}
            {selectedOffer && (
              <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{t('total_price')}</span>
                  <span className="text-2xl font-display font-bold text-primary">
                    €{computedPrice.toFixed(2)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedOffer.payment_mode === 'at_riad' ? t('payment_at_riad') : t('payment_to_driver')}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onBack} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('back')}
              </Button>
              <Button
                type="submit"
                variant="warm"
                className="flex-1"
                disabled={isSubmitting || !selectedOfferId}
              >
                {isSubmitting ? <Loader2 className="animate-spin" /> : t('submit')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
