import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { TransportForm } from '@/components/guest/TransportForm';
import { LanguageSwitcher } from '@/components/guest/LanguageSwitcher';
import { useLanguage } from '@/hooks/useLanguage';
import { Loader2 } from 'lucide-react';
import margoflowLogo from '@/assets/margoflow-logo.png';

interface ReservationData {
  reservation_id: string;
  guest_first_name: string | null;
  guest_last_name: string;
  check_in_date: string;
  riad_id: string;
  riad_name: string;
}

export default function Token() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { t, language, toggleLanguage } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reservation, setReservation] = useState<ReservationData | null>(null);
  const [riadWhatsapp, setRiadWhatsapp] = useState<string | undefined>();
  const [initialPax, setInitialPax] = useState<number | undefined>();

  useEffect(() => {
    // Read pax parameter from URL
    const params = new URLSearchParams(window.location.search);
    const paxParam = params.get('pax');
    if (paxParam) {
      const paxValue = parseInt(paxParam, 10);
      if (!isNaN(paxValue) && paxValue > 0 && paxValue <= 10) {
        setInitialPax(paxValue);
      }
    }

    const verifyToken = async () => {
      if (!token) {
        setError('Token manquant');
        setLoading(false);
        return;
      }

      try {
        // Vérifier le token via RPC
        const { data: tokenData, error: tokenError } = await supabase
          .rpc('verify_guest_token', { p_token: token });

        if (tokenError) throw tokenError;
        
        if (!tokenData?.valid) {
          setError(tokenData?.error || 'Token invalide ou expiré');
          setLoading(false);
          return;
        }

        // Récupérer les infos de la réservation (données fraîches)
        const { data: resData, error: resError } = await supabase
          .from('reservations')
          .select(`
            reservation_id,
            guest_first_name,
            guest_last_name,
            check_in_date,
            status,
            riad_id,
            riads (
              name,
              manager_whatsapp
            )
          `)
          .eq('reservation_id', tokenData.reservation_id)
          .single();

        if (resError) {
          console.error('Reservation lookup error:', resError);
          setError('Réservation non trouvée');
          setLoading(false);
          return;
        }
        
        if (!resData) {
          setError('Réservation non trouvée');
          setLoading(false);
          return;
        }

        // Check if reservation is cancelled
        if (resData.status === 'canceled' || resData.status === 'cancelled') {
          setError('Cette réservation a été annulée');
          setLoading(false);
          return;
        }

        // Construire l'objet ReservationData
        setReservation({
          reservation_id: resData.reservation_id,
          guest_first_name: resData.guest_first_name,
          guest_last_name: resData.guest_last_name,
          check_in_date: resData.check_in_date,
          riad_id: resData.riad_id,
          riad_name: (resData.riads as any)?.name || 'Unknown',
        });

        setRiadWhatsapp((resData.riads as any)?.manager_whatsapp);
        setLoading(false);

      } catch (err) {
        console.error('Token verification error:', err);
        setError('Erreur lors de la vérification du token');
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleBack = () => {
    navigate('/');
  };

  const handleSuccess = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <img 
            src={margoflowLogo} 
            alt="MargoFlow" 
            className="h-12 object-contain mx-auto mb-6"
          />
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-destructive mb-2">
              {t('error_title') || 'Erreur'}
            </h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="text-primary hover:underline"
            >
              {t('back_home') || 'Retour à l\'accueil'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="container max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="w-10"></div>
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
        {reservation && (
          <TransportForm
            reservation={reservation}
            riadWhatsapp={riadWhatsapp}
            initialPax={initialPax}
            onBack={handleBack}
            onSuccess={handleSuccess}
          />
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
