import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/useLanguage';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

// Massiba property ID for on-demand Cloudbeds lookup
const MASSIBA_PROPERTY_ID = '9462';

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
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reservationId.trim()) {
      toast.error(t('required_field'));
      return;
    }

    setIsLoading(true);

    try {
      // Build query (canonical identification = reservation_id + riad_id)
      let query = supabase
        .from('reservations')
        .select(`
          reservation_id,
          guest_first_name,
          guest_last_name,
          check_in_date,
          status,
          riad_id,
          riads!inner(name, cloudbeds_property_id)
        `)
        .eq('reservation_id', reservationId.trim());

      if (riadId) {
        query = query.eq('riad_id', riadId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;

      // If found locally, use it
      if (data) {
        // Check if reservation is still valid
        if (data.status === 'canceled' || data.status === 'no_show') {
          toast.error(t('reservation_invalid'));
          return;
        }

        // Check if transport request already exists
        const { data: existingRequest } = await supabase
          .from('transport_requests')
          .select('id, status')
          .eq('reservation_id', data.reservation_id)
          .in('status', ['pending', 'confirmed'])
          .maybeSingle();

        if (existingRequest) {
          toast.error(t('existing_request'));
          return;
        }

        onReservationFound({
          reservation_id: data.reservation_id,
          guest_first_name: data.guest_first_name,
          guest_last_name: data.guest_last_name,
          check_in_date: data.check_in_date,
          riad_id: data.riad_id,
          riad_name: (data.riads as { name: string }).name,
        });
        return;
      }

      // Not found locally - try Cloudbeds lookup for Massiba only
      const effectivePropertyId = cloudbedsPropertyId || (riadId ? undefined : MASSIBA_PROPERTY_ID);
      
      // Only do Cloudbeds lookup for Massiba
      if (effectivePropertyId === MASSIBA_PROPERTY_ID) {
        console.log('Attempting Cloudbeds on-demand lookup for Massiba...');
        
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cloudbeds-lookup`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              reservation_id: reservationId.trim(),
              property_id: MASSIBA_PROPERTY_ID,
            }),
          }
        );

        if (response.ok) {
          const lookupResult = await response.json();
          
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
        }
      }

      // Not found anywhere
      toast.error(t('reservation_not_found'));
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
