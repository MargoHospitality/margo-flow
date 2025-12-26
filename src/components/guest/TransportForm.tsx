import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/useLanguage';
import { Loader2, AlertTriangle, Car, Check, ArrowLeft, Clock, Users, Calendar, Mail, Phone, Hash, MessageSquare } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
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
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [guestWhatsapp, setGuestWhatsapp] = useState<string>('');
  const [guestComment, setGuestComment] = useState<string>('');
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
      // Only fetch offers assigned to this specific property
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
            day_end_time,
            is_active
          )
        `)
        .eq('riad_id', reservation.riad_id)
        .eq('is_active', true);

      if (riadError) throw riadError;

      // Only show offers that are assigned AND active at the transport_offers level
      if (!riadOffers || riadOffers.length === 0) {
        // No offers assigned to this property
        setOffers([]);
      } else {
        const mappedOffers: TransportOffer[] = riadOffers
          .filter(ro => (ro.transport_offers as any).is_active) // Only active offers
          .map(ro => {
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

    // Validate email
    if (!guestEmail.trim()) {
      toast.error(`${t('guest_email_label')} ${t('required_field')}`);
      return;
    }

    // Validate WhatsApp
    if (!guestWhatsapp.trim()) {
      toast.error(`${t('guest_whatsapp_label')} ${t('required_field')}`);
      return;
    }

    for (const field of selectedOffer.fields_schema) {
      if (field.required && !dynamicFields[field.key]?.trim()) {
        toast.error(`${language === 'fr' ? field.label_fr : field.label} ${t('required_field')}`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payloadDetails = {
        ...dynamicFields,
        guest_email: guestEmail.trim(),
        guest_whatsapp: guestWhatsapp.trim(),
      };

      const { data: insertedData, error } = await supabase
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
          payload_details: payloadDetails,
          guest_comment: guestComment.trim() || null,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      // Get manager email for notification
      const { data: riadData } = await supabase
        .from('riads')
        .select('manager_email')
        .eq('id', reservation.riad_id)
        .single();

      // Send manager notification email
      if (riadData?.manager_email) {
        try {
          await supabase.functions.invoke('send-manager-notification', {
            body: {
              reservationId: reservation.reservation_id,
              propertyName: reservation.riad_name,
              guestName: `${reservation.guest_first_name || ''} ${reservation.guest_last_name}`.trim(),
              transportType: language === 'fr' && selectedOffer.name_fr ? selectedOffer.name_fr : selectedOffer.name,
              transportDate: format(parseISO(transportDate), 'PPP'),
              arrivalTime: transportTime,
              flightTrainNumber: dynamicFields.flight_number || dynamicFields.train_number,
              guestComment: guestComment.trim() || undefined,
              managerEmail: riadData.manager_email,
              appUrl: window.location.origin,
              requestId: insertedData.id,
            },
          });
        } catch (emailError) {
          console.error('Error sending manager notification:', emailError);
          // Don't fail the request if email fails
        }
      }

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
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-up">
      {/* Guest Info Summary */}
      <div className="card-elevated p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-status-confirmed/10 flex items-center justify-center flex-shrink-0">
            <Check className="h-5 w-5 text-status-confirmed" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">
              {reservation.guest_first_name} {reservation.guest_last_name}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {reservation.riad_name}
            </p>
            <p className="text-sm text-muted-foreground">
              {format(checkInDate, 'PPP')}
            </p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Hash className="h-3 w-3" />
              {reservation.reservation_id}
            </p>
          </div>
        </div>
      </div>

      {/* Late Booking Warning */}
      {isLateBooking && (
        <div className="rounded-2xl bg-status-pending/10 border border-status-pending/20 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-status-pending flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-status-pending-foreground">{t('late_booking_warning')}</p>
              {riadWhatsapp && (
                <a
                  href={`https://wa.me/${riadWhatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline mt-2 text-sm font-medium"
                >
                  {t('contact_whatsapp')}
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* No offers available message */}
      {offers.length === 0 && !isLoading && (
        <div className="card-elevated p-6 text-center">
          <p className="text-muted-foreground">
            {language === 'fr' 
              ? 'Aucune offre de transport disponible pour cette propriété.'
              : 'No transport offers available for this property.'}
          </p>
        </div>
      )}

      {/* Transport Form */}
      {offers.length > 0 && (
        <div className="card-elevated p-6 md:p-8">
          <h2 className="font-serif text-xl md:text-2xl text-foreground mb-6">
            {t('transport_details')}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Transport Type Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">{t('select_transport_type')}</Label>
              <div className="grid grid-cols-1 gap-3">
                {offers.map(offer => (
                  <button
                    key={offer.id}
                    type="button"
                    onClick={() => setSelectedOfferId(offer.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${
                      selectedOfferId === offer.id
                        ? 'border-primary bg-accent/50'
                        : 'border-border hover:border-primary/50 bg-background'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          selectedOfferId === offer.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        }`}>
                          <Car className="h-5 w-5" />
                        </div>
                        <span className="font-medium text-foreground">
                          {language === 'fr' && offer.name_fr ? offer.name_fr : offer.name}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {offer.day_price} MAD
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Date and Time Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {t('transport_date')}
                </Label>
                <Select value={transportDate} onValueChange={setTransportDate}>
                  <SelectTrigger className="h-14 rounded-xl border-2 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedDates.map(date => (
                      <SelectItem key={date} value={date}>
                        {format(parseISO(date), 'MMM d')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="transportTime" className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {t('transport_time')}
                </Label>
                <Input
                  id="transportTime"
                  type="time"
                  value={transportTime}
                  onChange={(e) => setTransportTime(e.target.value)}
                  className="input-mobile"
                  required
                />
              </div>
            </div>

            {/* Passengers */}
            <div className="space-y-2">
              <Label htmlFor="pax" className="text-sm font-medium text-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                {t('passengers')}
              </Label>
              <Input
                id="pax"
                type="number"
                min={1}
                max={10}
                value={pax}
                onChange={(e) => setPax(Math.max(1, parseInt(e.target.value) || 1))}
                className="input-mobile"
                required
              />
            </div>

            {/* Dynamic Fields */}
            {selectedOffer?.fields_schema.map(field => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key} className="text-sm font-medium text-foreground">
                  {language === 'fr' ? field.label_fr : field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                <Input
                  id={field.key}
                  type={field.type}
                  value={dynamicFields[field.key] || ''}
                  onChange={(e) => handleDynamicFieldChange(field.key, e.target.value)}
                  className="input-mobile"
                  required={field.required}
                />
              </div>
            ))}

            {/* Guest Contact Information */}
            <div className="space-y-4 p-4 rounded-xl bg-secondary/30 border border-border">
              <div>
                <h3 className="font-medium text-foreground">{t('guest_contact_title')}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t('guest_contact_explanation')}</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="guestEmail" className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {t('guest_email_label')}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="guestEmail"
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder={t('guest_email_placeholder')}
                  className="input-mobile"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="guestWhatsapp" className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {t('guest_whatsapp_label')}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="guestWhatsapp"
                  type="tel"
                  value={guestWhatsapp}
                  onChange={(e) => setGuestWhatsapp(e.target.value)}
                  placeholder={t('guest_whatsapp_placeholder')}
                  className="input-mobile"
                  required
                />
              </div>

              {/* Comment Field */}
              <div className="space-y-2">
                <Label htmlFor="guestComment" className="text-sm font-medium text-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  {t('guest_comment_label')}
                </Label>
                <Textarea
                  id="guestComment"
                  value={guestComment}
                  onChange={(e) => setGuestComment(e.target.value)}
                  placeholder={t('guest_comment_placeholder')}
                  className="min-h-[80px] rounded-xl"
                  maxLength={500}
                />
              </div>
            </div>

            {/* Price Summary */}
            {selectedOffer && (
              <div className="p-5 rounded-2xl bg-accent/50 border border-border">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-foreground">{t('total_price')}</span>
                  <span className="text-3xl font-serif font-semibold text-primary">
                    {computedPrice.toFixed(0)} MAD
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedOffer.payment_mode === 'at_riad' ? t('payment_at_riad') : t('payment_to_driver')}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onBack} 
                className="flex-1 h-14 rounded-xl text-base"
              >
                <ArrowLeft className="mr-2 h-5 w-5" />
                {t('back')}
              </Button>
              <Button
                type="submit"
                className="flex-1 h-14 rounded-xl text-base font-medium"
                disabled={isSubmitting || !selectedOfferId}
              >
                {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : t('submit')}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
