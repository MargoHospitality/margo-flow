import { useLanguage } from '@/hooks/useLanguage';
import { CheckCircle } from 'lucide-react';

export function ConfirmationScreen() {
  const { t } = useLanguage();

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
      <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full badge-pending">
        <span className="w-2 h-2 rounded-full bg-status-pending animate-pulse" />
        <span className="font-medium">{t('request_pending')}</span>
      </div>
    </div>
  );
}
