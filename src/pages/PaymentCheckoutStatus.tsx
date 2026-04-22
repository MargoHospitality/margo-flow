import { BadgeCheck, CircleX } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function PaymentCheckoutStatus() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status');
  const isSuccess = status === 'success';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isSuccess ? (
              <BadgeCheck className="h-5 w-5 text-emerald-600" />
            ) : (
              <CircleX className="h-5 w-5 text-amber-600" />
            )}
            {isSuccess ? 'Payment received' : 'Payment not completed'}
          </CardTitle>
          <CardDescription>
            {isSuccess
              ? 'Thank you. Your card payment has been confirmed and our team is updating your reservation.'
              : 'This payment was cancelled or interrupted. You can return to the same WhatsApp link to try again if it is still valid.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            {isSuccess
              ? 'If you need help, reply to the WhatsApp conversation and the property team will assist you.'
              : 'If the link has expired, the property team can generate a new one for you.'}
          </p>
          <Button asChild className="w-full">
            <Link to="/">Return to Margo Flow</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
