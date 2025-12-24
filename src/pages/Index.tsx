import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { ReservationEntry } from '@/components/guest/ReservationEntry';
import { TransportForm } from '@/components/guest/TransportForm';
import { ConfirmationScreen } from '@/components/guest/ConfirmationScreen';

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
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>('entry');
  const [riadWhatsapp, setRiadWhatsapp] = useState<string | undefined>();
  const [reservation, setReservation] = useState<ReservationData | null>(null);
  const [preselectedRiadId, setPreselectedRiadId] = useState<string | undefined>();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const riadId = params.get('riad');
    if (riadId) {
      setPreselectedRiadId(riadId);
    }
  }, []);

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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <pattern id="moroccan-pattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="1.5" fill="currentColor" />
              <path d="M0 10 L10 0 L20 10 L10 20 Z" fill="none" stroke="currentColor" strokeWidth="0.3" />
            </pattern>
            <rect x="0" y="0" width="100" height="100" fill="url(#moroccan-pattern)" className="text-primary-foreground" />
          </svg>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-primary-foreground">
            <h1 className="heading-display text-3xl md:text-4xl mb-2">{t('app_name')}</h1>
            <p className="text-primary-foreground/80">{t('welcome_title')}</p>
          </div>
        </div>
        <div className="h-48" />
      </div>

      {/* Content */}
      <div className="container max-w-lg mx-auto px-4 -mt-16 relative z-10 pb-12 flex-1">
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
            onBack={handleBack}
            onSuccess={handleSuccess}
          />
        )}
        
        {step === 'confirmation' && (
          <ConfirmationScreen />
        )}
      </div>

      {/* Footer with discreet staff access */}
      <footer className="border-t border-border py-6 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} {t('app_name')}</p>
          <Link 
            to="/auth" 
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors mt-2 inline-block"
          >
            Staff access
          </Link>
        </div>
      </footer>
    </div>
  );
}
