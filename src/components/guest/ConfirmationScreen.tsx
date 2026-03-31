import { useLanguage } from '@/hooks/useLanguage';
import { CheckCircle, ArrowLeft } from 'lucide-react';

interface ConfirmationScreenProps {
  returnParams?: { returnTo?: string; token?: string };
}

export function ConfirmationScreen({ returnParams }: ConfirmationScreenProps) {
  const { t } = useLanguage();

  const handleReturn = () => {
    if (returnParams?.token) {
      // Return to Guest App with token
      // Use production Guest App URL
      const guestAppUrl = 'https://app.margo-hospitality.com';
      
      // Determine return path based on origin
      // returnTo=checkin → return to check-in gate
      // returnTo=home or undefined → return to home
      const returnPath = returnParams.returnTo === 'checkin' ? '/checkin/transport' : '/';
      
      const params = new URLSearchParams({
        token: returnParams.token,
        from: 'margo-flow',
      });
      window.location.href = `${guestAppUrl}${returnPath}?${params.toString()}`;
    }
  };

  return (
    <div className="card-elevated p-8 text-center animate-scale-in">
      {/* Success icon */}
      <div className="mx-auto w-20 h-20 rounded-full bg-status-confirmed/10 flex items-center justify-center mb-6">
        <CheckCircle className="h-10 w-10 text-status-confirmed" />
      </div>
      
      {/* Title */}
      <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-3">
        {t('request_submitted')}
      </h2>
      
      {/* Description */}
      <p className="text-muted-foreground text-base leading-relaxed mb-6 max-w-sm mx-auto">
        {t('request_submitted_message')}
      </p>
      
      {/* Status badge */}
      <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full badge-pending mb-6">
        <span className="w-2 h-2 rounded-full bg-status-pending animate-pulse" />
        <span className="font-medium">{t('request_pending')}</span>
      </div>

      {/* Return button (if came from Guest App) */}
      {returnParams?.token && (
        <button
          onClick={handleReturn}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          {returnParams.returnTo === 'checkin' ? t('return_to_checkin') : t('return_to_guest_app')}
        </button>
      )}
    </div>
  );
}
