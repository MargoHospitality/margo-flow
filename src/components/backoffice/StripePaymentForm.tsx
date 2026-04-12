import { FormEvent, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import type { Stripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Button } from '@/components/ui/button';
import { Loader2, LockKeyhole } from 'lucide-react';

interface StripePaymentFormProps {
  stripePromise: Promise<Stripe | null>;
  clientSecret: string;
  amountLabel: string;
  disabled?: boolean;
  onFinalize: () => Promise<void>;
}

interface StripeCheckoutInnerProps {
  amountLabel: string;
  disabled?: boolean;
  onFinalize: () => Promise<void>;
}

function StripeCheckoutInner({ amountLabel, disabled, onFinalize }: StripeCheckoutInnerProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetryingFinalize, setIsRetryingFinalize] = useState(false);
  const [hasConfirmedPayment, setHasConfirmedPayment] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!stripe || !elements || disabled) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (result.error) {
      setErrorMessage(result.error.message || 'Payment failed');
      setIsSubmitting(false);
      return;
    }

    setHasConfirmedPayment(true);

    try {
      await onFinalize();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Card charged, but Cloudbeds sync failed. Retry the sync below without charging again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRetryFinalize() {
    setIsRetryingFinalize(true);
    setErrorMessage(null);

    try {
      await onFinalize();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Card charged, but Cloudbeds sync failed. Retry the sync below without charging again.',
      );
    } finally {
      setIsRetryingFinalize(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!hasConfirmedPayment ? (
        <div className="rounded-lg border border-border/60 bg-background p-4">
          <PaymentElement />
        </div>
      ) : (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          The card payment has already been confirmed with Stripe. If Cloudbeds sync fails, use the retry button below.
        </div>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {!hasConfirmedPayment ? (
        <Button type="submit" className="w-full" disabled={!stripe || !elements || isSubmitting || disabled}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
          Charge {amountLabel}
        </Button>
      ) : (
        <Button type="button" className="w-full" onClick={handleRetryFinalize} disabled={isRetryingFinalize || disabled}>
          {isRetryingFinalize ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
          Retry Cloudbeds sync
        </Button>
      )}
    </form>
  );
}

export function StripePaymentForm({
  stripePromise,
  clientSecret,
  amountLabel,
  disabled,
  onFinalize,
}: StripePaymentFormProps) {
  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#0f766e',
      },
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <StripeCheckoutInner amountLabel={amountLabel} disabled={disabled} onFinalize={onFinalize} />
    </Elements>
  );
}
