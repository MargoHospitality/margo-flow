import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/useLanguage';
import { Loader2, AlertTriangle, Car, Check, ArrowLeft, Clock, Users, Calendar, Mail, Phone, Hash, MessageSquare, Gift } from 'lucide-react';
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
  initialPax?: number;
  onBack: () => void;
  onSuccess: () => void;
}

export function TransportForm({ reservation, riadWhatsapp, initialPax, onBack, onSuccess }: TransportFormProps) {
  const { t, language } = useLanguage();
  const [offers, setOffers] = useState<TransportOffer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string>('');
  const [transportDate, setTransportDate] = useState<string>(reservation.check_in_date);
  const [transportTime, setTransportTime] = useState<string>('10:00');
  const [pax, setPax] = useState<number>(initialPax || 2);
  const [dynamicFields, setDynamicFields] = useState<Record<string, string>>({});
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [guestWhatsapp, setGuestWhatsapp] = useState<string>('');
  const [guestComment, setGuestComment] = useState<string>('');
  const [isFreeTransfer, setIsFreeTransfer] = useState(false);
  const [showFreeTransferDialog, setShowFreeTransferDialog] = useState(false);
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

  // Auto-select first transport offer when available
  useEffect(() => {
    if (offers.length > 0 && !selectedOfferId) {
      setSelectedOfferId(offers[0].id);
    }
  }, [offers, selectedOfferId]);

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
    // If free transfer is selected, price is 0
    if (isFreeTransfer) return 0;
    
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
  }, [selectedOffer, transportTime, pax, isFreeTransfer]);

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
        language: language, // Store guest's language for notifications
      };

      // Submit transport request via Edge Function (includes rate limiting)
      const { data: response, error } = await supabase.functions.invoke('submit-transport-request', {
        body: {
          reservation_id: reservation.reservation_id,
          riad_id: reservation.riad_id,
          transport_offer_id: selectedOffer.id,
          transport_date: transportDate,
          transport_time: transportTime,
          pax: pax,
          computed_price: computedPrice,
          payment_mode: isFreeTransfer ? 'at_riad' : selectedOffer.payment_mode,
          payload_details: payloadDetails,
          guest_comment: guestComment.trim() || null,
          is_free_transfer: isFreeTransfer,
        }
      });

      if (error) throw error;

      // Check for rate limit exceeded response
      if (!response?.success) {
        if (response?.error?.includes('Rate limit exceeded')) {
          toast.error(t('rate_limit_exceeded') || 'Too many requests. Please try again in a few minutes.');
          return;
        }
        throw new Error(response?.error || 'Failed to submit transport request');
      }

      const insertedData = { id: response.data };

      // Determine if this is an urgent request (within 48 hours)
      const transportDateObj = parseISO(transportDate);
      const now = new Date();
      const hoursUntilTransport = (transportDateObj.getTime() - now.getTime()) / (1000 * 60 * 60);
      const isUrgent = hoursUntilTransport <= 48;

      // Send manager notification - edge function fetches manager contact info securely
      try {
        await supabase.functions.invoke('notify-manager', {
          body: {
            transportRequestId: insertedData.id,
            reservationId: reservation.reservation_id,
            riadId: reservation.riad_id,
            propertyName: reservation.riad_name,
            guestName: `${reservation.guest_first_name || ''} ${reservation.guest_last_name}`.trim(),
            transportType: language === 'fr' && selectedOffer.name_fr ? selectedOffer.name_fr : selectedOffer.name,
            transportDate: format(transportDateObj, 'PPP'),
            transportTime: transportTime,
            payloadDetails: dynamicFields,
            guestComment: guestComment.trim() || undefined,
            appUrl: window.location.origin,
            isUrgent,
            isFreeTransfer,
          },
        });
      } catch (notificationError) {
        console.error('Error sending manager notification:', notificationError);
        // Don't fail the request if notification fails
      }

      toast.success(t('request_submitted'));
      onSuccess();
    } catch (error) {
      console.error('Error submitting transport request:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(errorMessage || t('error'));
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
                  <SelectTrigger className="select-mobile">
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
                  type="text"
                  value={transportTime}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d:]/g, '');
                    if (value.length <= 5) setTransportTime(value);
                  }}
                  onBlur={(e) => {
                    const value = e.target.value.replace(/[^\d]/g, '');
                    if (value.length >= 3) {
                      const hours = value.slice(0, 2);
                      const minutes = value.slice(2, 4).padEnd(2, '0');
                      const formatted = `${hours}:${minutes}`;
                      setTransportTime(formatted);
                    }
                  }}
                  placeholder="10:00"
                  pattern="([01]?[0-9]|2[0-3]):[0-5][0-9]"
                  className="input-mobile text-center"
                  required
                />
              </div>
            </div>

            {/* Passengers with +/- buttons */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                {t('passengers')}
              </Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setPax(Math.max(1, pax - 1))}
                  disabled={pax <= 1}
                  className="h-14 w-14 rounded-xl border-2 shrink-0"
                >
                  <span className="text-2xl leading-none">−</span>
                </Button>
                <div className="flex-1 h-14 px-4 text-base rounded-xl border-2 border-input bg-background flex items-center justify-center">
                  <span className="text-base">{pax}</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setPax(Math.min(10, pax + 1))}
                  disabled={pax >= 10}
                  className="h-14 w-14 rounded-xl border-2 shrink-0"
                >
                  <span className="text-2xl leading-none">+</span>
                </Button>
              </div>
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

            {/* Free Transfer Checkbox */}
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="freeTransfer"
                  checked={isFreeTransfer}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      // Open confirmation dialog when trying to check
                      setShowFreeTransferDialog(true);
                    } else {
                      // Allow unchecking directly
                      setIsFreeTransfer(false);
                    }
                  }}
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label 
                    htmlFor="freeTransfer" 
                    className="text-sm font-medium text-foreground cursor-pointer flex items-center gap-2"
                  >
                    <Gift className="h-4 w-4 text-primary" />
                    {t('free_transfer_label')}
                  </Label>
                </div>
              </div>
            </div>
            
            {/* Free Transfer Confirmation Dialog */}
            <AlertDialog open={showFreeTransferDialog} onOpenChange={setShowFreeTransferDialog}>
              <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-lg">
                    <Gift className="h-5 w-5 text-primary" />
                    {language === 'fr' ? 'Transfert offert' : 'Complimentary Transfer'}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-base leading-relaxed pt-2">
                    {language === 'fr' 
                      ? "Le transfert gratuit s'applique uniquement à certaines réservations directes avec offres spéciales."
                      : "Free transfer only applies to certain direct bookings with special offers."}
                  </AlertDialogDescription>
                  <AlertDialogDescription className="text-base font-medium pt-3">
                    {language === 'fr'
                      ? "Confirmez-vous que votre réservation inclut un transfert offert ?"
                      : "Can you confirm that your booking includes a complimentary transfer?"}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                  <AlertDialogCancel 
                    onClick={() => setShowFreeTransferDialog(false)}
                    className="h-12 text-base"
                  >
                    {language === 'fr' ? 'Non, annuler' : 'No, cancel'}
                  </AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => {
                      setIsFreeTransfer(true);
                      setShowFreeTransferDialog(false);
                    }}
                    className="h-12 text-base"
                  >
                    {language === 'fr' ? 'Oui, je confirme' : 'Yes, I confirm'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Price Summary */}
            {selectedOffer && (
              <div className={`p-5 rounded-2xl border ${isFreeTransfer ? 'bg-status-confirmed/10 border-status-confirmed/30' : 'bg-accent/50 border-border'}`}>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-foreground">{t('total_price')}</span>
                  <span className={`text-3xl font-serif font-semibold ${isFreeTransfer ? 'text-status-confirmed' : 'text-primary'}`}>
                    {computedPrice.toFixed(0)} MAD
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {isFreeTransfer 
                    ? t('payment_complimentary')
                    : (selectedOffer.payment_mode === 'at_riad' ? t('payment_at_riad') : t('payment_to_driver'))
                  }
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
