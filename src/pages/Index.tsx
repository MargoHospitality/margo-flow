import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Loader2 } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { ReservationEntry } from '@/components/guest/ReservationEntry';
import { TransportForm } from '@/components/guest/TransportForm';
import { ConfirmationScreen } from '@/components/guest/ConfirmationScreen';
import { LanguageSwitcher } from '@/components/guest/LanguageSwitcher';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import margoflowLogo from '@/assets/margoflow-logo.png';

type Step = 'entry' | 'form' | 'confirmation';

interface ReservationData {
  reservation_id: string;
  guest_first_name: string | null;
  guest_last_name: string;
  check_in_date: string;
  riad_id: string;
  riad_name: string;
}

export default function Index() {
  const { t, language, toggleLanguage } = useLanguage();
  const [step, setStep] = useState<Step>('entry');
  const [riadWhatsapp, setRiadWhatsapp] = useState<string | undefined>();
  const [reservation, setReservation] = useState<ReservationData | null>(null);
  const [preselectedRiadId, setPreselectedRiadId] = useState<string | undefined>();
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const [initialPax, setInitialPax] = useState<number | undefined>();

  // Store returnTo and token from URL params for redirecting back to Guest App
  const [returnParams, setReturnParams] = useState<{ returnTo?: string; token?: string }>({});

  // Auto-lookup reservation from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const riadParam = params.get('riad');
    const reservationParam = params.get('reservation');
    const checkinParam = params.get('checkin');
    const returnToParam = params.get('returnTo');
    const tokenParam = params.get('token');
    const paxParam = params.get('pax');

    // Store initial passenger count from URL
    if (paxParam) {
      const paxValue = parseInt(paxParam, 10);
      if (!isNaN(paxValue) && paxValue > 0 && paxValue <= 10) {
        setInitialPax(paxValue);
      }
    }

    // Store return params for later redirection
    if (returnToParam || tokenParam) {
      setReturnParams({ returnTo: returnToParam || undefined, token: tokenParam || undefined });
    }

    // If all 3 params present, auto-lookup reservation
    if (riadParam && reservationParam && checkinParam) {
      console.log('[Index] Auto-lookup with URL params:', { riadParam, reservationParam, checkinParam });
      autoLookupReservation(riadParam, reservationParam, checkinParam);
    } else if (riadParam) {
      // Only riad param - preselect for manual entry
      setPreselectedRiadId(riadParam);
    }
  }, []);

  async function autoLookupReservation(riadId: string, reservationId: string, checkInDate: string) {
    setIsAutoLoading(true);

    try {
      // First, get riad info (need UUID, not Cloudbeds ID)
      const { data: riadsData, error: riadsError } = await supabase.rpc('get_public_riads');
      
      if (riadsError) throw riadsError;

      // Find riad by Cloudbeds property ID or UUID
      const riad = riadsData?.find((r: any) => 
        r.cloudbeds_property_id === riadId || r.id === riadId
      );

      if (!riad) {
        console.error('[Index] Riad not found:', riadId);
        setPreselectedRiadId(riadId); // Fallback to manual entry
        setIsAutoLoading(false);
        return;
      }

      console.log('[Index] Found riad:', riad.name);

      // Lookup reservation
      const { data: rpcResult, error } = await supabase.rpc('lookup_reservation_public', {
        _reservation_id: reservationId,
        _riad_id: riad.id,
        _check_in_date: checkInDate,
      });

      if (error) throw error;

      let resolved = rpcResult && rpcResult.length > 0 ? {
        reservation_id: rpcResult[0].reservation_id,
        guest_first_name: rpcResult[0].guest_first_name,
        guest_last_name: rpcResult[0].guest_last_name,
        check_in_date: rpcResult[0].check_in_date,
        status: rpcResult[0].status,
        riad_id: rpcResult[0].riad_id,
        riads: { name: rpcResult[0].riad_name },
      } : null;

      // If not found locally, try Cloudbeds on-demand lookup
      if (!resolved) {
        console.log('[Index] Not found locally, trying Cloudbeds lookup...');
        const { data: lookupData, error: lookupError } = await supabase.functions.invoke('cloudbeds-lookup', {
          body: {
            reservation_id: reservationId,
            riad_id: riad.id,
            check_in_date: checkInDate,
          },
        });

        if (lookupError) {
          console.error('[Index] Cloudbeds lookup error:', lookupError);
        }

        if (lookupData?.found && lookupData?.reservation) {
          resolved = {
            reservation_id: lookupData.reservation.reservation_id,
            guest_first_name: lookupData.reservation.guest_first_name,
            guest_last_name: lookupData.reservation.guest_last_name,
            check_in_date: lookupData.reservation.check_in_date,
            status: lookupData.reservation.status,
            riad_id: lookupData.reservation.riad_id,
            riads: { name: lookupData.reservation.riad_name },
          } as any;
        }
      }

      if (!resolved) {
        console.error('[Index] Reservation not found');
        setPreselectedRiadId(riadId); // Fallback to manual entry
        setIsAutoLoading(false);
        return;
      }

      console.log('[Index] Reservation found, skipping to transport form');

      // Skip to transport form
      const reservationData: ReservationData = {
        reservation_id: resolved.reservation_id,
        guest_first_name: resolved.guest_first_name,
        guest_last_name: resolved.guest_last_name,
        check_in_date: resolved.check_in_date,
        riad_id: resolved.riad_id,
        riad_name: (resolved.riads as { name: string }).name,
      };

      setReservation(reservationData);
      setStep('form');
      setIsAutoLoading(false);
    } catch (error) {
      console.error('[Index] Auto-lookup error:', error);
      setPreselectedRiadId(riadId); // Fallback to manual entry
      setIsAutoLoading(false);
    }
  }

  const handleReservationFound = (res: ReservationData, whatsapp?: string) => {
    setReservation(res);
    setRiadWhatsapp(whatsapp);
    setStep('form');
  };

  const handleBack = () => {
    setReservation(null);
    setStep('entry');
  };

  const handleSuccess = () => {
    setStep('confirmation');
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header with language switcher and login */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="container max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link 
            to="/auth" 
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label={t('login')}
          >
            <User className="h-5 w-5 text-muted-foreground" />
          </Link>
          <img 
            src={margoflowLogo} 
            alt="MargoFlow" 
            className="h-8 md:h-10 object-contain"
          />
          <LanguageSwitcher language={language} onToggle={toggleLanguage} />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 container max-w-lg mx-auto px-4 py-6 md:py-10">
        {/* Auto-loading state */}
        {isAutoLoading && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground text-lg">{t('loading')}</p>
          </div>
        )}

        {/* Hero section - only on entry step */}
        {!isAutoLoading && step === 'entry' && (
          <div className="text-center mb-8 animate-fade-up">
            <h1 className="font-serif text-2xl md:text-3xl text-foreground mb-3">
              {t('intro_headline')}
            </h1>
            <p className="text-muted-foreground text-base md:text-lg leading-relaxed max-w-sm mx-auto">
              {t('intro_subline')}
            </p>
          </div>
        )}

        {/* Form / Steps */}
        {!isAutoLoading && (
          <div className="animate-fade-up delay-100">
            {step === 'entry' && (
              <ReservationEntry
                onReservationFound={handleReservationFound}
                preselectedRiadId={preselectedRiadId}
              />
            )}
            
            {step === 'form' && reservation && (
              <TransportForm
                reservation={reservation}
                riadWhatsapp={riadWhatsapp}
                initialPax={initialPax}
                onBack={handleBack}
                onSuccess={handleSuccess}
              />
            )}
            
            {step === 'confirmation' && (
              <ConfirmationScreen returnParams={returnParams} />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-4 mt-auto">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            {t('footer_copyright')}{' '}
            <a 
              href="https://www.margo-hospitality.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {t('footer_margo')}
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
