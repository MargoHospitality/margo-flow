import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  AlertTriangle,
  BadgeCheck,
  CalendarIcon,
  ExternalLink,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Send,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BackofficeHeader } from '@/components/backoffice/BackofficeHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PaymentSetting {
  id: string;
  riad_id: string;
  payment_label: string;
  stripe_publishable_key: string | null;
  cloudbeds_payment_method: string | null;
  cloudbeds_payment_description: string | null;
  riad: {
    id: string;
    name: string;
    cloudbeds_property_id: string | null;
  } | null;
}

interface ReservationLookup {
  reservation_id: string;
  guest_first_name: string | null;
  guest_last_name: string;
  check_in_date: string;
  check_out_date: string | null;
  status: string;
  property_id: string;
  riad_id: string | null;
}

interface ExistingPaymentLink {
  id: string;
  amount: number;
  currency_code: string;
  status: string;
  payment_flow: string;
  stripe_checkout_url: string | null;
  checkout_expires_at: string | null;
  client_whatsapp: string | null;
  link_last_sent_at: string | null;
  link_sent_count: number;
  cloudbeds_logged: boolean;
  created_at: string;
}

interface RecentPaymentActivity {
  id: string;
  amount: number;
  currency_code: string;
  reservation_id: string;
  status: string;
  payment_flow: string;
  checkout_expires_at: string | null;
  cloudbeds_logged: boolean;
  created_at: string;
  stripe_payment_method_summary: string | null;
  riads:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
  reservations:
    | {
        guest_first_name: string | null;
        guest_last_name: string;
      }
    | {
        guest_first_name: string | null;
        guest_last_name: string;
      }[]
    | null;
}

interface PaymentLookupResponse {
  success: boolean;
  data: {
    reservation: ReservationLookup;
    guestWhatsapp: string | null;
    guestEmail: string | null;
    suggestedAmount: number | null;
    existingPayments: ExistingPaymentLink[];
  };
}

interface PaymentLinkResponse {
  success: boolean;
  paymentId: string;
  paymentUrl: string;
  checkoutExpiresAt: string | null;
  clientWhatsapp?: string | null;
  whatsappSent?: boolean;
  whatsappError?: string | null;
  clientEmail?: string | null;
  emailSent?: boolean;
  emailError?: string | null;
}

const PAYMENT_DRAFT_STORAGE_KEY = 'margo-flow:backoffice-payments:draft';

interface PaymentDraft {
  selectedRiadId: string;
  reservationId: string;
  checkInDate: string | null;
  reservation: ReservationLookup | null;
  amountInput: string;
  guestWhatsapp: string;
  guestEmail: string;
}

function isLinkExpired(value: string | null) {
  return Boolean(value && new Date(value).getTime() <= Date.now());
}

function canResendLink(payment: ExistingPaymentLink) {
  if (payment.cloudbeds_logged || payment.status === 'checkout_completed') {
    return false;
  }

  return !isLinkExpired(payment.checkout_expires_at);
}

function formatPaymentStatus(payment: ExistingPaymentLink) {
  if (payment.cloudbeds_logged) return 'Paid and posted';
  if (payment.status === 'checkout_completed') return 'Paid';
  if (payment.status === 'checkout_expired' || isLinkExpired(payment.checkout_expires_at)) return 'Expired';
  if (payment.status === 'checkout_link_sent') return 'Link sent';
  if (payment.status === 'checkout_link_created') return 'Link created';
  if (payment.status === 'checkout_failed') return 'Creation failed';
  return payment.status.replaceAll('_', ' ');
}

function getPaymentStatusBadgeClass(payment: { cloudbeds_logged: boolean; status: string; checkout_expires_at: string | null }) {
  if (payment.cloudbeds_logged) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }

  if (payment.status === 'checkout_completed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }

  if (payment.status === 'checkout_link_sent') {
    return 'border-sky-200 bg-sky-50 text-sky-800';
  }

  if (payment.status === 'checkout_link_created') {
    return 'border-slate-200 bg-slate-50 text-slate-700';
  }

  if (payment.status === 'checkout_expired' || isLinkExpired(payment.checkout_expires_at)) {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }

  if (payment.status === 'checkout_failed' || payment.status === 'cloudbeds_failed') {
    return 'border-rose-200 bg-rose-50 text-rose-800';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function formatPaymentFlow(paymentFlow: string) {
  if (paymentFlow === 'email_link') return 'Email';
  if (paymentFlow === 'whatsapp_link') return 'WhatsApp';
  return paymentFlow.replaceAll('_', ' ');
}

function getRelationValue<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function getRecentPaymentGuestName(payment: RecentPaymentActivity) {
  const reservation = getRelationValue(payment.reservations);
  if (!reservation) return 'Guest unavailable';

  return [reservation.guest_first_name, reservation.guest_last_name]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    || reservation.guest_last_name
    || 'Guest unavailable';
}

export default function BackofficePayments() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isManager, isSuperAdmin, isActive, signOut } = useAuth();
  const [settings, setSettings] = useState<PaymentSetting[]>([]);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [selectedRiadId, setSelectedRiadId] = useState('');
  const [reservationId, setReservationId] = useState('');
  const [checkInDate, setCheckInDate] = useState<Date | undefined>(undefined);
  const [reservation, setReservation] = useState<ReservationLookup | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [guestWhatsapp, setGuestWhatsapp] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [existingPayments, setExistingPayments] = useState<ExistingPaymentLink[]>([]);
  const [recentPayments, setRecentPayments] = useState<RecentPaymentActivity[]>([]);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isLoadingRecentPayments, setIsLoadingRecentPayments] = useState(false);
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [resendingPaymentId, setResendingPaymentId] = useState<string | null>(null);
  const [showAllRecentPayments, setShowAllRecentPayments] = useState(false);
  const hasHydratedDraftRef = useRef(false);
  const previousSelectedRiadIdRef = useRef('');

  useEffect(() => {
    try {
      const storedDraft = window.sessionStorage.getItem(PAYMENT_DRAFT_STORAGE_KEY);
      if (!storedDraft) {
        hasHydratedDraftRef.current = true;
        return;
      }

      const draft = JSON.parse(storedDraft) as Partial<PaymentDraft>;
      if (draft.selectedRiadId) setSelectedRiadId(draft.selectedRiadId);
      if (draft.reservationId) setReservationId(draft.reservationId);
      if (draft.checkInDate) setCheckInDate(parseISO(draft.checkInDate));
      if (draft.reservation) setReservation(draft.reservation as ReservationLookup);
      if (draft.amountInput) setAmountInput(draft.amountInput);
      if (draft.guestWhatsapp) setGuestWhatsapp(draft.guestWhatsapp);
      if (draft.guestEmail) setGuestEmail(draft.guestEmail);
    } catch (error) {
      console.error('Failed to restore payment draft:', error);
      window.sessionStorage.removeItem(PAYMENT_DRAFT_STORAGE_KEY);
    } finally {
      hasHydratedDraftRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
    if (!authLoading && user && !isManager) {
      navigate('/auth');
    }
  }, [authLoading, isManager, navigate, user]);

  const fetchPaymentSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    try {
      const { data, error } = await supabase
        .from('riad_payment_settings')
        .select(`
          id,
          riad_id,
          payment_label,
          stripe_publishable_key,
          cloudbeds_payment_method,
          cloudbeds_payment_description,
          riad:riads (
            id,
            name,
            cloudbeds_property_id
          )
        `)
        .eq('is_enabled', true);

      if (error) throw error;

      const sorted = (data || [])
        .map((item) => ({
          ...item,
          riad: item.riad as PaymentSetting['riad'],
        }))
        .filter((item) => item.riad)
        .sort((a, b) => (a.riad?.name || '').localeCompare(b.riad?.name || ''));

      setSettings(sorted as PaymentSetting[]);
      if (sorted.length === 1) {
        setSelectedRiadId((current) => current || sorted[0].riad_id);
      }
    } catch (error) {
      console.error('Error fetching payment settings:', error);
      toast.error('Failed to load payment-enabled properties');
    } finally {
      setIsLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    if (user && isManager && isActive) {
      void fetchPaymentSettings();
    }
  }, [fetchPaymentSettings, isActive, isManager, user]);

  useEffect(() => {
    const previousSelectedRiadId = previousSelectedRiadIdRef.current;
    const hasChangedProperty = Boolean(previousSelectedRiadId) && previousSelectedRiadId !== selectedRiadId;

    if (hasChangedProperty) {
      setReservation(null);
      setAmountInput('');
      setGuestWhatsapp('');
      setGuestEmail('');
      setExistingPayments([]);
    }

    previousSelectedRiadIdRef.current = selectedRiadId;
  }, [selectedRiadId]);

  useEffect(() => {
    if (!hasHydratedDraftRef.current) {
      return;
    }

    const draft: PaymentDraft = {
      selectedRiadId,
      reservationId,
      checkInDate: checkInDate ? checkInDate.toISOString() : null,
      reservation,
      amountInput,
      guestWhatsapp,
      guestEmail,
    };

    const isEmptyDraft = !selectedRiadId
      && !reservationId
      && !checkInDate
      && !reservation
      && !amountInput
      && !guestWhatsapp
      && !guestEmail;

    if (isEmptyDraft) {
      window.sessionStorage.removeItem(PAYMENT_DRAFT_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(PAYMENT_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [amountInput, checkInDate, guestEmail, guestWhatsapp, reservation, reservationId, selectedRiadId]);

  const selectedSetting = useMemo(
    () => settings.find((item) => item.riad_id === selectedRiadId) ?? null,
    [selectedRiadId, settings],
  );

  const parsedAmount = Number.parseFloat(amountInput.replace(',', '.'));
  const amountIsValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const hasExistingLinks = existingPayments.length > 0;
  const visibleRecentPayments = showAllRecentPayments ? recentPayments : recentPayments.slice(0, 3);

  async function getAccessToken() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Authentication required');
    }

    return session.access_token;
  }

  const fetchRecentPayments = useCallback(async (notifyOnError = false) => {
    setIsLoadingRecentPayments(true);
    try {
      let query = supabase
        .from('reservation_payments')
        .select(`
          id,
          amount,
          currency_code,
          reservation_id,
          status,
          payment_flow,
          checkout_expires_at,
          cloudbeds_logged,
          created_at,
          stripe_payment_method_summary,
          riads:riads (
            name
          ),
          reservations:reservations (
            guest_first_name,
            guest_last_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (selectedRiadId) {
        query = query.eq('riad_id', selectedRiadId);
      }

      const { data, error } = await query;
      if (error) throw error;

      setRecentPayments((data || []) as RecentPaymentActivity[]);
    } catch (error) {
      console.error('Recent payments load failed:', error);
      if (notifyOnError) {
        toast.error('Failed to load recent payment activity');
      }
    } finally {
      setIsLoadingRecentPayments(false);
    }
  }, [selectedRiadId]);

  useEffect(() => {
    if (user && isManager && isActive) {
      void fetchRecentPayments();
    }
  }, [fetchRecentPayments, isActive, isManager, user]);

  useEffect(() => {
    setShowAllRecentPayments(false);
  }, [selectedRiadId]);

  async function lookupReservation(options?: { notify?: boolean; applySuggestedAmount?: boolean }) {
    if (!selectedSetting?.riad || !reservationId.trim() || !checkInDate) {
      toast.error('Select a property, reservation ID, and check-in date');
      return;
    }

    const shouldNotify = options?.notify ?? true;
    const applySuggestedAmount = options?.applySuggestedAmount ?? true;

    setIsLookingUp(true);
    try {
      const token = await getAccessToken();
      const checkInDateIso = format(checkInDate, 'yyyy-MM-dd');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payment-reservation-lookup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            riad_id: selectedSetting.riad.id,
            reservation_id: reservationId.trim(),
            check_in_date: checkInDateIso,
          }),
        },
      );

      const result = await response.json() as PaymentLookupResponse & { error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to load reservation');
      }

      setReservation(result.data.reservation);
      setExistingPayments(result.data.existingPayments ?? []);
      setGuestWhatsapp(result.data.guestWhatsapp ?? '');
      setGuestEmail(result.data.guestEmail ?? '');
      if (applySuggestedAmount) {
        setAmountInput(result.data.suggestedAmount !== null ? result.data.suggestedAmount.toFixed(2) : '');
      }

      if (shouldNotify) {
        toast.success('Reservation found');
      }
    } catch (error) {
      console.error('Reservation lookup failed:', error);
      setReservation(null);
      setExistingPayments([]);
      setGuestWhatsapp('');
      setGuestEmail('');
      if (shouldNotify) {
        toast.error(error instanceof Error ? error.message : 'Failed to load reservation');
      }
    } finally {
      setIsLookingUp(false);
    }
  }

  async function createWhatsappPaymentLink() {
    if (!selectedSetting?.riad || !reservation || !amountIsValid) {
      toast.error('Find a reservation and enter a valid amount first');
      return;
    }

    if (!guestWhatsapp.trim()) {
      toast.error('Enter the guest WhatsApp number before sending a payment link');
      return;
    }

    setIsSendingLink(true);
    try {
      const token = await getAccessToken();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-checkout-link`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            riad_id: selectedSetting.riad.id,
            reservation_id: reservation.reservation_id,
            check_in_date: reservation.check_in_date,
            amount: parsedAmount,
            client_whatsapp: guestWhatsapp,
            app_origin: window.location.origin,
          }),
        },
      );

      const result = await response.json() as PaymentLinkResponse & { error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create payment link');
      }

      setGuestWhatsapp(result.clientWhatsapp ?? guestWhatsapp);
      await lookupReservation({ notify: false, applySuggestedAmount: false });
      await fetchRecentPayments();

      if (result.whatsappSent) {
        toast.success(hasExistingLinks ? 'Additional payment link sent on WhatsApp' : 'Payment link sent on WhatsApp');
      } else {
        toast.error(result.whatsappError || 'Link created but WhatsApp sending failed');
      }
    } catch (error) {
      console.error('Payment link creation failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create payment link');
    } finally {
      setIsSendingLink(false);
    }
  }

  async function createEmailPaymentLink() {
    if (!selectedSetting?.riad || !reservation || !amountIsValid) {
      toast.error('Find a reservation and enter a valid amount first');
      return;
    }

    if (!guestEmail.trim()) {
      toast.error('Enter the guest email before sending a payment link');
      return;
    }

    setIsSendingEmail(true);
    try {
      const token = await getAccessToken();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-checkout-link-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            riad_id: selectedSetting.riad.id,
            reservation_id: reservation.reservation_id,
            check_in_date: reservation.check_in_date,
            amount: parsedAmount,
            client_email: guestEmail,
            app_origin: window.location.origin,
          }),
        },
      );

      const result = await response.json() as PaymentLinkResponse & { error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create payment email');
      }

      await lookupReservation({ notify: false, applySuggestedAmount: false });
      setGuestEmail(result.clientEmail ?? guestEmail);
      await fetchRecentPayments();

      if (result.emailSent) {
        toast.success(hasExistingLinks ? 'Additional payment link sent by email' : 'Payment link sent by email');
      } else {
        toast.error(result.emailError || 'Link created but email sending failed');
      }
    } catch (error) {
      console.error('Payment email creation failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create payment email');
    } finally {
      setIsSendingEmail(false);
    }
  }

  async function resendPaymentLink(existingPayment: ExistingPaymentLink) {
    if (!guestWhatsapp.trim()) {
      toast.error('Enter the guest WhatsApp number before resending a payment link');
      return;
    }

    setResendingPaymentId(existingPayment.id);
    try {
      const token = await getAccessToken();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-payment-link-whatsapp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            payment_id: existingPayment.id,
            client_whatsapp: guestWhatsapp,
          }),
        },
      );

      const result = await response.json() as PaymentLinkResponse & { error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to resend payment link');
      }

      setGuestWhatsapp(result.clientWhatsapp ?? guestWhatsapp);
      await lookupReservation({ notify: false, applySuggestedAmount: false });
      await fetchRecentPayments();

      if (result.whatsappSent) {
        toast.success('Payment link resent on WhatsApp');
      } else {
        toast.error(result.whatsappError || 'Link resend failed');
      }
    } catch (error) {
      console.error('Payment link resend failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to resend payment link');
    } finally {
      setResendingPaymentId(null);
    }
  }

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Account Deactivated</CardTitle>
            <CardDescription>This account cannot access manager payments right now.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <BackofficeHeader active="payments" isSuperAdmin={isSuperAdmin} onLogout={handleLogout} backTo="/backoffice" />

      <main className="flex-1 container mx-auto px-4 py-6">
        <div className={cn(
          'grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]',
          reservation && 'lg:items-stretch',
        )}>
          <div className={cn('space-y-6', reservation && 'lg:flex lg:h-full lg:flex-col')}>
            <Card>
                <CardHeader>
                  <CardTitle>Reservation Lookup</CardTitle>
                  <CardDescription>
                  Pick a payment-enabled property, then load the reservation to pull the live balance plus the guest WhatsApp and email details from Cloudbeds.
                  </CardDescription>
                </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Property</Label>
                    <Select value={selectedRiadId} onValueChange={setSelectedRiadId} disabled={isLoadingSettings || settings.length === 0}>
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingSettings ? 'Loading properties…' : 'Select a property'} />
                      </SelectTrigger>
                      <SelectContent>
                        {settings.map((item) => (
                          <SelectItem key={item.riad_id} value={item.riad_id}>
                            {item.riad?.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Reservation ID</Label>
                    <Input
                      value={reservationId}
                      onChange={(event) => setReservationId(event.target.value)}
                      placeholder="Cloudbeds reservation ID"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Check-in date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn('w-full justify-start text-left font-normal', !checkInDate && 'text-muted-foreground')}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {checkInDate ? format(checkInDate, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={checkInDate} onSelect={setCheckInDate} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <Button onClick={() => lookupReservation()} disabled={isLookingUp || !selectedRiadId || !reservationId.trim() || !checkInDate}>
                  {isLookingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Find reservation
                </Button>
              </CardContent>
            </Card>

            {reservation && selectedSetting?.riad && (
              <Card className="lg:flex-1">
                <CardHeader>
                  <CardTitle>Payment Link Preparation</CardTitle>
                  <CardDescription>
                    {reservation.guest_first_name ? `${reservation.guest_first_name} ` : ''}{reservation.guest_last_name} at {selectedSetting.riad.name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-border/60 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Reservation</p>
                      <p className="font-medium">{reservation.reservation_id}</p>
                    </div>
                    <div className="rounded-lg border border-border/60 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Stay status</p>
                      <p className="font-medium capitalize">{reservation.status.replace('_', ' ')}</p>
                    </div>
                    <div className="rounded-lg border border-border/60 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Check-in</p>
                      <p className="font-medium">{format(parseISO(reservation.check_in_date), 'PPP')}</p>
                    </div>
                    <div className="rounded-lg border border-border/60 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Check-out</p>
                      <p className="font-medium">{reservation.check_out_date ? format(parseISO(reservation.check_out_date), 'PPP') : '—'}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Amount to request (MAD)</Label>
                    <Input
                      inputMode="decimal"
                      value={amountInput}
                      onChange={(event) => setAmountInput(event.target.value)}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">
                      The balance is fetched live from Cloudbeds at lookup time, then stays editable here if the guest wants to split the payment or settle only part of the balance.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Guest WhatsApp</Label>
                    <Input
                      value={guestWhatsapp}
                      onChange={(event) => setGuestWhatsapp(event.target.value)}
                      placeholder="+212..."
                    />
                    <p className="text-xs text-muted-foreground">
                      We prefill the number we find in Cloudbeds, but the team can adjust it before sending.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Guest email</Label>
                    <Input
                      type="email"
                      value={guestEmail}
                      onChange={(event) => setGuestEmail(event.target.value)}
                      placeholder="guest@example.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use this fallback if the guest does not use WhatsApp. The email is also prefilled from Cloudbeds and stays editable.
                    </p>
                  </div>

                  {hasExistingLinks && (
                    <Alert className="border-amber-200 bg-amber-50/60 text-amber-950 [&>svg]:text-amber-700">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Existing payment links already found</AlertTitle>
                      <AlertDescription className="space-y-3">
                        <p>
                          A link has already been generated for this reservation. You can still send a new one if the guest wants to split the payment across multiple cards.
                        </p>
                        <div className="space-y-2">
                          {existingPayments.map((payment) => (
                            <div key={payment.id} className="rounded-md border border-amber-200 bg-white/80 p-3">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="space-y-1 text-sm">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium">{Number(payment.amount).toFixed(2)} {payment.currency_code}</span>
                                    <Badge variant="outline" className={getPaymentStatusBadgeClass(payment)}>
                                      {formatPaymentStatus(payment)}
                                    </Badge>
                                    <Badge variant="secondary">{formatPaymentFlow(payment.payment_flow)}</Badge>
                                  </div>
                                  <p>Created {format(parseISO(payment.created_at), 'PPP p')}</p>
                                  {payment.payment_flow === 'whatsapp_link' && (
                                    <p>WhatsApp: {payment.client_whatsapp || '—'}</p>
                                  )}
                                  <p>Sent count: {payment.link_sent_count}</p>
                                  {payment.checkout_expires_at && (
                                    <p>Expires {format(parseISO(payment.checkout_expires_at), 'PPP p')}</p>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {payment.stripe_checkout_url && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => window.open(payment.stripe_checkout_url!, '_blank', 'noopener,noreferrer')}
                                    >
                                      <ExternalLink className="mr-2 h-4 w-4" />
                                      Open link
                                    </Button>
                                  )}
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={payment.payment_flow !== 'whatsapp_link' || !canResendLink(payment) || resendingPaymentId === payment.id}
                                    onClick={() => void resendPaymentLink(payment)}
                                  >
                                    {resendingPaymentId === payment.id ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="mr-2 h-4 w-4" />
                                    )}
                                    Resend on WhatsApp
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button className="sm:flex-1" onClick={createWhatsappPaymentLink} disabled={isSendingLink || !amountIsValid || !guestWhatsapp.trim()}>
                      {isSendingLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      {hasExistingLinks ? 'Send additional WhatsApp payment link' : 'Send WhatsApp payment link'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="sm:flex-1"
                      onClick={createEmailPaymentLink}
                      disabled={isSendingEmail || !amountIsValid || !guestEmail.trim()}
                    >
                      {isSendingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                      {hasExistingLinks ? 'Send additional payment link by email' : 'Send by email instead'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className={cn('space-y-6', reservation && 'lg:flex lg:h-full lg:flex-col')}>
            <Card>
              <CardHeader>
                <CardTitle>{selectedSetting?.payment_label || 'Payment links'}</CardTitle>
                <CardDescription>
                  This screen now uses Stripe Checkout links sent through WhatsApp by default, with email as a fallback. Once the guest pays, Margo Flow posts the payment back into Cloudbeds automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {settings.length === 0 && !isLoadingSettings && (
                  <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                    No payment-enabled properties are assigned to this account yet.
                  </div>
                )}

                <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                  After the lookup, adjust the amount if needed, confirm the guest contact, then send the Stripe link through WhatsApp or by email when WhatsApp is not available. Existing links stay visible on the left so the team can resend one or send an additional link for split payments.
                </div>

                {reservation && (
                  <Alert className="border-emerald-200 bg-emerald-50/60 text-emerald-950 [&>svg]:text-emerald-700">
                    <BadgeCheck className="h-4 w-4" />
                    <AlertTitle>Link-only flow enabled</AlertTitle>
                    <AlertDescription>
                      Manual card entry is no longer exposed here. Every payment now starts from a Stripe Checkout link sent to the guest.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card className={cn(reservation && 'lg:flex-1')}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle>Latest payment activity</CardTitle>
                  <CardDescription>
                    Showing the latest {Math.min(3, recentPayments.length || 3)} entries {selectedSetting?.riad ? `for ${selectedSetting.riad.name}` : 'across your accessible properties'}.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void fetchRecentPayments(true)}
                  disabled={isLoadingRecentPayments}
                >
                  <RefreshCw className={cn('h-4 w-4', isLoadingRecentPayments && 'animate-spin')} />
                </Button>
              </CardHeader>
              <CardContent>
                {isLoadingRecentPayments ? (
                  <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading recent payments…
                  </div>
                ) : recentPayments.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                    No payment activity found yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleRecentPayments.map((payment) => {
                      const riad = getRelationValue(payment.riads);
                      return (
                        <div key={payment.id} className="rounded-lg border border-border/60 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">
                              {Number(payment.amount).toFixed(2)} {payment.currency_code}
                            </span>
                            <Badge variant="outline" className={getPaymentStatusBadgeClass(payment)}>
                              {formatPaymentStatus(payment)}
                            </Badge>
                            <Badge variant="secondary">{formatPaymentFlow(payment.payment_flow)}</Badge>
                          </div>
                          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                            <p>{riad?.name || 'Property unavailable'} • {payment.reservation_id}</p>
                            <p>{getRecentPaymentGuestName(payment)}</p>
                            <p>{format(parseISO(payment.created_at), 'PPP p')}</p>
                            {payment.stripe_payment_method_summary && (
                              <p>{payment.stripe_payment_method_summary}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {recentPayments.length > 3 && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowAllRecentPayments((current) => !current)}
                      >
                        {showAllRecentPayments ? 'Show fewer transactions' : `Show all ${recentPayments.length} transactions`}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
