import { useState, useEffect } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { RiadSelector } from '@/components/guest/RiadSelector';
import { ReservationLookup } from '@/components/guest/ReservationLookup';
import { TransportForm } from '@/components/guest/TransportForm';
import { ConfirmationScreen } from '@/components/guest/ConfirmationScreen';
import { supabase } from '@/integrations/supabase/client';

type Step = 'riad' | 'lookup' | 'form' | 'confirmation';

interface ReservationData {
  reservation_id: string;
  guest_first_name: string | null;
  guest_last_name: string;
  check_in_date: string;
  riad_id: string;
  riad_name: string;
}

export default function GuestApp() {
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>('riad');
  const [selectedRiadId, setSelectedRiadId] = useState<string | null>(null);
  const [riadWhatsapp, setRiadWhatsapp] = useState<string | undefined>();
  const [reservation, setReservation] = useState<ReservationData | null>(null);

  useEffect(() => {
    // Check URL for riad parameter
    const params = new URLSearchParams(window.location.search);
    const riadId = params.get('riad');
    if (riadId) {
      handleRiadSelect(riadId);
    }
  }, []);

  const handleRiadSelect = async (riadId: string, whatsapp?: string) => {
    setSelectedRiadId(riadId);
    
    // Fetch riad whatsapp if not provided
    if (!whatsapp) {
      const { data } = await supabase
        .from('riads')
        .select('manager_whatsapp')
        .eq('id', riadId)
        .single();
      setRiadWhatsapp(data?.manager_whatsapp || undefined);
    } else {
      setRiadWhatsapp(whatsapp);
    }
    
    setStep('lookup');
  };

  const handleReservationFound = (res: ReservationData) => {
    setReservation(res);
    setStep('form');
  };

  const handleBack = () => {
    setReservation(null);
    setStep('lookup');
  };

  const handleSuccess = () => {
    setStep('confirmation');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Decorative header */}
      <div className="gradient-hero h-48 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <pattern id="moroccan" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="1.5" fill="currentColor" />
              <path d="M0 10 L10 0 L20 10 L10 20 Z" fill="none" stroke="currentColor" strokeWidth="0.3" />
            </pattern>
            <rect x="0" y="0" width="100" height="100" fill="url(#moroccan)" className="text-primary-foreground/30" />
          </svg>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-primary-foreground">
            <h1 className="heading-display text-3xl md:text-4xl mb-2">{t('app_name')}</h1>
            <p className="text-primary-foreground/80">{t('welcome_title')}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-lg mx-auto px-4 -mt-16 relative z-10 pb-12">
        {step === 'riad' && (
          <RiadSelector onSelect={handleRiadSelect} />
        )}
        
        {step === 'lookup' && selectedRiadId && (
          <ReservationLookup
            riadId={selectedRiadId}
            onReservationFound={handleReservationFound}
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
    </div>
  );
}
