import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/hooks/useLanguage';
import { CheckCircle } from 'lucide-react';

export function ConfirmationScreen() {
  const { t } = useLanguage();

  return (
    <Card className="card-elevated animate-slide-up text-center">
      <CardHeader>
        <div className="mx-auto w-16 h-16 rounded-full bg-teal/10 flex items-center justify-center mb-4">
          <CheckCircle className="h-8 w-8 text-teal" />
        </div>
        <CardTitle className="heading-display text-2xl">{t('request_submitted')}</CardTitle>
        <CardDescription className="text-body text-base">
          {t('request_submitted_message')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-light/20 text-amber">
          <span className="w-2 h-2 rounded-full bg-amber animate-pulse" />
          {t('request_pending')}
        </div>
      </CardContent>
    </Card>
  );
}
