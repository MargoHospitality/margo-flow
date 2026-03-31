import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/useLanguage';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

interface ReservationData {
  reservation_id: string;
  guest_first_name: string | null;
  guest_last_name: string;
  check_in_date: string;
  riad_id: string;
  riad_name: string;
}

interface ReservationLookupProps {
  riadId?: string;
  cloudbedsPropertyId?: string;
  onReservationFound: (reservation: ReservationData) => void;
}

export function ReservationLookup({ riadId, cloudbedsPropertyId, onReservationFound }: ReservationLookupProps) {
  const { t } = useLanguage();
  const [reservationId, setReservationId] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reservationId.trim()) {
      toast.error(t('required_field'));
      return;
    }

    if (!checkInDate) {
      toast.error(t('check_in_date_required') || 'Check-in date is required');
      return;
    }

    setIsLoading(true);

    try {
      // Use security definer function to validate reservation exists (no PII exposed)
      const { data: validationData, error: validationError } = await supabase.rpc(
        'validate_reservation_exists',
        { _reservation_id: reservationId.trim() }
      );

      if (validationError) throw validationError;

      // If found locally via security function
      if (validationData && validationData.length > 0) {
        const reservation = validationData[0];
        
        // Check if check-in date matches
        if (reservation.check_in_date !== checkInDate) {
          toast.error(t('check_in_date_mismatch') || 'The check-in date does not match our records.');
          return;
        }

        // Check if riad matches (if specified)
        if (riadId && reservation.riad_id !== riadId) {
          toast.error(t('reservation_not_found'));
          return;
        }

        // Check if reservation is still valid
        if (reservation.status === 'canceled' || reservation.status === 'no_show') {
          toast.error(t('reservation_invalid'));
          return;
        }

        // Check if transport request already exists using security function
        const { data: existingRequests } = await supabase.rpc(
          'get_transport_request_by_reservation',
          { _reservation_id: reservationId.trim() }
        );

        const hasActiveRequest = existingRequests?.some(
          (req: any) => req.status === 'pending' || req.status === 'confirmed'
        );

        if (hasActiveRequest) {
          toast.error(t('existing_request'));
          return;
        }

        // Get riad name using public function
        const { data: riadData } = await supabase.rpc(
          'get_public_riad',
          { _riad_id: reservation.riad_id }
        );

        const riadName = riadData?.[0]?.name || 'Unknown';

        // Note: Guest name not available via public function for security
        // The Cloudbeds lookup or edge function will provide full data
        onReservationFound({
          reservation_id: reservationId.trim(),
          guest_first_name: null,
          guest_last_name: 'Guest',
          check_in_date: reservation.check_in_date,
          riad_id: reservation.riad_id,
          riad_name: riadName,
        });
        return;
      }

      // Not found locally - try Cloudbeds on-demand lookup
      console.log('Attempting Cloudbeds on-demand lookup...');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cloudbeds-lookup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reservation_id: reservationId.trim(),
            check_in_date: checkInDate,
            property_id: cloudbedsPropertyId || undefined,
          }),
        }
      );

      const lookupResult = await response.json();
      console.log('Cloudbeds lookup result:', lookupResult);

      if (lookupResult.rate_limited) {
        toast.error(t('rate_limited') || `Too many attempts. Please wait ${lookupResult.retry_after} seconds.`);
        return;
      }

      if (lookupResult.captcha_required) {
        toast.error(t('verification_required') || 'Verification required. Please try again.');
        return;
      }

      if (lookupResult.found && lookupResult.reservation) {
        const cbRes = lookupResult.reservation;
        
        // Check if reservation is still valid
        if (cbRes.status === 'canceled' || cbRes.status === 'no_show') {
          toast.error(t('reservation_invalid'));
          return;
        }

        // Check if transport request already exists
        const { data: existingRequest } = await supabase
          .from('transport_requests')
          .select('id, status')
          .eq('reservation_id', cbRes.reservation_id)
          .in('status', ['pending', 'confirmed'])
          .maybeSingle();

        if (existingRequest) {
          toast.error(t('existing_request'));
          return;
        }

        onReservationFound({
          reservation_id: cbRes.reservation_id,
          guest_first_name: cbRes.guest_first_name,
          guest_last_name: cbRes.guest_last_name,
          check_in_date: cbRes.check_in_date,
          riad_id: cbRes.riad_id,
          riad_name: cbRes.riad_name,
        });
        return;
      }

      // Show specific error or generic not found
      if (lookupResult.error) {
        console.log('Cloudbeds lookup error:', lookupResult.error);
        if (lookupResult.error === 'Check-in date does not match') {
          toast.error(t('check_in_date_mismatch') || 'The check-in date does not match our records. Please verify and try again.');
        } else {
          toast.error(t('reservation_not_found'));
        }
      } else {
        toast.error(t('reservation_not_found'));
      }
    } catch (error) {
      console.error('Error looking up reservation:', error);
      toast.error(t('error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="card-elevated animate-fade-in">
      <CardHeader className="text-center">
        <CardTitle className="heading-display text-2xl">{t('reservation_lookup')}</CardTitle>
        <CardDescription className="text-body">
          {t('welcome_subtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="reservationId" className="font-medium">
              {t('reservation_id_label')}
            </Label>
            <Input
              id="reservationId"
              type="text"
              value={reservationId}
              onChange={(e) => setReservationId(e.target.value)}
              placeholder={t('reservation_id_placeholder')}
              className="input-warm"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="checkInDate" className="font-medium">
              {t('check_in_date_label') || 'Check-in Date'}
            </Label>
            <Input
              id="checkInDate"
              type="date"
              value={checkInDate}
              onChange={(e) => setCheckInDate(e.target.value)}
              className="input-warm"
              required
            />
          </div>
          <Button 
            type="submit" 
            className="w-full" 
            size="lg"
            variant="default"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Search className="mr-2" />
            )}
            {t('find_reservation')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
