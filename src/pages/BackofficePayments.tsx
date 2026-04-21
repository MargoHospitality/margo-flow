import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { CalendarIcon, ArrowLeft, CreditCard, Loader2, Search, Shield, BadgeCheck, MessageSquareText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { StripePaymentForm } from '@/components/backoffice/StripePaymentForm';
import { cn } from '@/lib/utils';
import margoflowLogo from '@/assets/margoflow-logo.png';
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

interface CreatePaymentIntentResponse {
  success: boolean;
  clientSecret: string;
  paymentId: string;
  amount: number;
  currency: string;
}

interface FinalizePaymentResponse {
  success: boolean;
  paymentId: string;
  paymentIntentId: string;
  cloudbedsLogged: boolean;
  amount: number;
  currency: string;
}

const PAYMENT_DRAFT_STORAGE_KEY = 'margo-flow:backoffice-payments:draft';

interface PaymentDraft {
  selectedRiadId: string;
  reservationId: string;
  checkInDate: string | null;
  reservation: ReservationLookup | null;
  amountInput: string;
  motoEnabled: boolean;
  clientSecret: string;
  paymentId: string;
}

export default function BackofficePayments() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isManager, isSuperAdmin, isActive } = useAuth();
  const [settings, setSettings] = useState<PaymentSetting[]>([]);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [selectedRiadId, setSelectedRiadId] = useState('');
  const [reservationId, setReservationId] = useState('');
  const [checkInDate, setCheckInDate] = useState<Date | undefined>(undefined);
  const [reservation, setReservation] = useState<ReservationLookup | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [motoEnabled, setMotoEnabled] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isPreparingPayment, setIsPreparingPayment] = useState(false);
  const [isFinalizingPayment, setIsFinalizingPayment] = useState(false);
  const [clientSecret, setClientSecret] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [lastSuccess, setLastSuccess] = useState<FinalizePaymentResponse | null>(null);
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
      if (typeof draft.motoEnabled === 'boolean') setMotoEnabled(draft.motoEnabled);
      if (draft.clientSecret) setClientSecret(draft.clientSecret);
      if (draft.paymentId) setPaymentId(draft.paymentId);
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
    const setting = settings.find((item) => item.riad_id === selectedRiadId);
    const previousSelectedRiadId = previousSelectedRiadIdRef.current;
    const hasChangedProperty = Boolean(previousSelectedRiadId) && previousSelectedRiadId !== selectedRiadId;

    if (hasChangedProperty) {
      setReservation(null);
      setAmountInput('');
      setClientSecret('');
      setPaymentId('');
      setLastSuccess(null);
    }

    previousSelectedRiadIdRef.current = selectedRiadId;

    if (!setting?.stripe_publishable_key) {
      setStripePromise(null);
      return;
    }

    setStripePromise(loadStripe(setting.stripe_publishable_key));
  }, [selectedRiadId, settings]);

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
      motoEnabled,
      clientSecret,
      paymentId,
    };

    const isEmptyDraft = !selectedRiadId
      && !reservationId
      && !checkInDate
      && !reservation
      && !amountInput
      && !motoEnabled
      && !clientSecret
      && !paymentId;

    if (isEmptyDraft) {
      window.sessionStorage.removeItem(PAYMENT_DRAFT_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(PAYMENT_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [amountInput, checkInDate, clientSecret, motoEnabled, paymentId, reservation, reservationId, selectedRiadId]);

  const selectedSetting = useMemo(
    () => settings.find((item) => item.riad_id === selectedRiadId) ?? null,
    [selectedRiadId, settings],
  );

  const parsedAmount = Number.parseFloat(amountInput.replace(',', '.'));
  const amountIsValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const amountLabel = amountIsValid ? `${parsedAmount.toFixed(2)} MAD` : '0.00 MAD';

  async function fetchPaymentStatus(currentPaymentId: string) {
    const { data, error } = await supabase
      .from('reservation_payments')
      .select('id, amount, currency_code, stripe_payment_intent_id, cloudbeds_logged')
      .eq('id', currentPaymentId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async function lookupReservation() {
    if (!selectedSetting?.riad || !reservationId.trim() || !checkInDate) {
      toast.error('Select a property, reservation ID, and check-in date');
      return;
    }

    setIsLookingUp(true);
    try {
      const checkInDateIso = format(checkInDate, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('reservations')
        .select('reservation_id, guest_first_name, guest_last_name, check_in_date, check_out_date, status, property_id, riad_id')
        .eq('riad_id', selectedSetting.riad.id)
        .eq('reservation_id', reservationId.trim())
        .eq('check_in_date', checkInDateIso)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error('No reservation found for this property / ID / check-in combination');
        setReservation(null);
        return;
      }

      setReservation(data as ReservationLookup);
      setClientSecret('');
      setPaymentId('');
      setLastSuccess(null);
      toast.success('Reservation found');
    } catch (error) {
      console.error('Reservation lookup failed:', error);
      toast.error('Failed to load reservation');
    } finally {
      setIsLookingUp(false);
    }
  }

  async function preparePayment() {
    if (!selectedSetting?.riad || !reservation || !checkInDate || !amountIsValid) {
      toast.error('Find a reservation and enter a valid amount first');
      return;
    }

    setIsPreparingPayment(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-stripe-payment-intent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            riad_id: selectedSetting.riad.id,
            reservation_id: reservation.reservation_id,
            check_in_date: reservation.check_in_date,
            amount: parsedAmount,
            moto: motoEnabled,
          }),
        },
      );

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to prepare payment');
      }

      const payload = result as CreatePaymentIntentResponse;
      setClientSecret(payload.clientSecret);
      setPaymentId(payload.paymentId);
      setLastSuccess(null);
      toast.success('Payment form ready');
    } catch (error) {
      console.error('Payment preparation failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to prepare payment');
    } finally {
      setIsPreparingPayment(false);
    }
  }

  async function finalizePayment() {
    if (!paymentId) {
      throw new Error('Missing payment reference');
    }

    setIsFinalizingPayment(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      let lastError: Error | null = null;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/finalize-stripe-payment`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ payment_id: paymentId }),
            },
          );

          const result = await response.json();
          if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to finalize payment');
          }

          setLastSuccess(result as FinalizePaymentResponse);
          setClientSecret('');
          setPaymentId('');
          setAmountInput('');
          window.sessionStorage.removeItem(PAYMENT_DRAFT_STORAGE_KEY);
          toast.success('Payment charged and posted to Cloudbeds');
          return;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Failed to finalize payment');

          if (attempt === 0) {
            await new Promise((resolve) => window.setTimeout(resolve, 1200));
          }
        }
      }

      const paymentStatus = await fetchPaymentStatus(paymentId);
      if (paymentStatus?.cloudbeds_logged && paymentStatus.stripe_payment_intent_id) {
        const recoveredSuccess: FinalizePaymentResponse = {
          success: true,
          paymentId: paymentStatus.id,
          paymentIntentId: paymentStatus.stripe_payment_intent_id,
          cloudbedsLogged: true,
          amount: Number(paymentStatus.amount),
          currency: paymentStatus.currency_code,
        };

        setLastSuccess(recoveredSuccess);
        setClientSecret('');
        setPaymentId('');
        setAmountInput('');
        window.sessionStorage.removeItem(PAYMENT_DRAFT_STORAGE_KEY);
        toast.success('Payment charged and posted to Cloudbeds');
        return;
      }

      throw lastError || new Error('Failed to finalize payment');
    } finally {
      setIsFinalizingPayment(false);
    }
  }

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
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            to="/backoffice"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <img
            src={margoflowLogo}
            alt="MargoFlow"
            className="h-8 md:h-10 object-contain"
          />
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <Link to="/admin">
                <Button variant="ghost" size="sm">
                  <Shield className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Admin</span>
                </Button>
              </Link>
            )}
            <Link to="/backoffice/reviews">
              <Button variant="ghost" size="sm">
                <MessageSquareText className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Reviews</span>
              </Button>
            </Link>
            <Badge variant="outline" className="hidden sm:inline-flex">
              <CreditCard className="mr-2 h-3.5 w-3.5" />
              Payments
            </Badge>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Reservation Lookup</CardTitle>
                <CardDescription>
                  Pick a payment-enabled property, then retrieve the reservation already synced from Cloudbeds.
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

                <Button onClick={lookupReservation} disabled={isLookingUp || !selectedRiadId || !reservationId.trim() || !checkInDate}>
                  {isLookingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Find reservation
                </Button>
              </CardContent>
            </Card>

            {reservation && selectedSetting?.riad && (
              <Card>
                <CardHeader>
                  <CardTitle>Reservation Ready</CardTitle>
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
                    <Label>Amount to charge (MAD)</Label>
                    <Input
                      inputMode="decimal"
                      value={amountInput}
                      onChange={(event) => {
                        setAmountInput(event.target.value);
                        setClientSecret('');
                        setPaymentId('');
                        setLastSuccess(null);
                      }}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">
                      This property posts the payment to Cloudbeds with method <strong>{selectedSetting.cloudbeds_payment_method}</strong>.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="moto-mode">MOTO mode</Label>
                        <p className="text-xs text-muted-foreground">
                          Enable this only for remote MOTO payments. Leave it off for the standard SCA / 3DS flow.
                        </p>
                      </div>
                      <Switch
                        id="moto-mode"
                        checked={motoEnabled}
                        onCheckedChange={setMotoEnabled}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Current mode: <strong>{motoEnabled ? 'MOTO' : 'SCA / 3DS'}</strong>
                    </p>
                  </div>

                  <Button onClick={preparePayment} disabled={isPreparingPayment || !amountIsValid || !selectedSetting.stripe_publishable_key}>
                    {isPreparingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                    Prepare secure payment form
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{selectedSetting?.payment_label || 'Card payment'}</CardTitle>
                <CardDescription>
                  Stripe handles the card details. Margo Flow only posts the successful payment to Cloudbeds afterward.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {settings.length === 0 && !isLoadingSettings && (
                  <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                    No payment-enabled properties are assigned to this account yet.
                  </div>
                )}

                {!clientSecret || !stripePromise ? (
                  <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                    Prepare a payment from the left side to load the Stripe form.
                  </div>
                ) : (
                  <StripePaymentForm
                    stripePromise={stripePromise}
                    clientSecret={clientSecret}
                    amountLabel={amountLabel}
                    disabled={isFinalizingPayment}
                    onFinalize={finalizePayment}
                  />
                )}

                {isFinalizingPayment && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Finalizing payment and posting it to Cloudbeds…
                  </div>
                )}
              </CardContent>
            </Card>

            {lastSuccess && (
              <Card className="border-emerald-200 bg-emerald-50/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-emerald-800">
                    <BadgeCheck className="h-5 w-5" />
                    Payment completed
                  </CardTitle>
                  <CardDescription className="text-emerald-900/80">
                    Stripe captured the card payment and Cloudbeds has been updated for the reservation.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-emerald-950">
                  <p><strong>Amount:</strong> {lastSuccess.amount.toFixed(2)} {lastSuccess.currency.toUpperCase()}</p>
                  <p><strong>Payment Intent:</strong> {lastSuccess.paymentIntentId}</p>
                  <p><strong>Cloudbeds sync:</strong> {lastSuccess.cloudbedsLogged ? 'Posted' : 'Pending'}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
