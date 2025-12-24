import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { ReservationEntry } from '@/components/guest/ReservationEntry';
import { TransportForm } from '@/components/guest/TransportForm';
import { ConfirmationScreen } from '@/components/guest/ConfirmationScreen';
import { LanguageSwitcher } from '@/components/guest/LanguageSwitcher';
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
      {/* Header with language switcher */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="container max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="w-10" /> {/* Spacer for centering */}
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
        {/* Hero section - only on entry step */}
        {step === 'entry' && (
          <div className="text-center mb-8 animate-fade-up">
            <h1 className="font-serif text-2xl md:text-3xl text-foreground mb-3">
              {t('intro_line_3')}
            </h1>
            <p className="text-muted-foreground text-base md:text-lg leading-relaxed max-w-sm mx-auto">
              {t('intro_line_1')}
            </p>
          </div>
        )}

        {/* Form / Steps */}
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
              onBack={handleBack}
              onSuccess={handleSuccess}
            />
          )}
          
          {step === 'confirmation' && (
            <ConfirmationScreen />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6 safe-bottom">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} {t('app_name')}
          </p>
          <Link 
            to="/auth" 
            className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors mt-2 inline-block"
          >
            Staff access
          </Link>
        </div>
      </footer>
    </div>
  );
}
