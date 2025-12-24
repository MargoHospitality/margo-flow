import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { ReservationEntry } from '@/components/guest/ReservationEntry';
import { TransportForm } from '@/components/guest/TransportForm';
import { ConfirmationScreen } from '@/components/guest/ConfirmationScreen';
import { LanguageSwitcher } from '@/components/guest/LanguageSwitcher';

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
      {/* Language switcher - top right */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher language={language} onToggle={toggleLanguage} />
      </div>

      {/* Main content */}
      <main className="flex-1 container max-w-lg mx-auto px-4 py-12">
        {/* Logo / Wordmark */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl text-primary">
            {t('app_name')}
          </h1>
        </div>

        {/* Introductory text */}
        {step === 'entry' && (
          <div className="mb-8 text-center space-y-3 text-muted-foreground">
            <p>{t('intro_line_1')}</p>
            <p>{t('intro_line_2')}</p>
            <p className="text-foreground font-medium">{t('intro_line_3')}</p>
          </div>
        )}

        {/* Form / Steps */}
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
      </main>

      {/* Footer with discreet staff access */}
      <footer className="border-t border-border py-6">
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
