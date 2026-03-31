import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, Plane, Calendar, Clock, Users, CreditCard, MapPin, AlertCircle } from 'lucide-react';
import margoflowLogo from '@/assets/margoflow-logo.png';

interface ConfirmationData {
  id: string;
  status: string;
  transport_date: string;
  transport_time: string;
  pax: number;
  computed_price: number;
  payment_mode: string;
  is_free_transfer: boolean;
  payload_details: Record<string, string>;
  guest_comment: string | null;
  property_name: string;
  transport_type: string;
  transport_name: string;
  reservation_id: string;
}

const transportTypeLabels: Record<string, { en: string; fr: string }> = {
  airport_pickup: { en: 'Airport Pickup', fr: 'Transfert Aéroport' },
  train_station_pickup: { en: 'Train Station Pickup', fr: 'Transfert Gare' },
  hotel_pickup: { en: 'Hotel Pickup', fr: 'Transfert Hôtel' },
  bus_station_pickup: { en: 'Bus Station Pickup', fr: 'Transfert Gare Routière' },
  port_pickup: { en: 'Port Pickup', fr: 'Transfert Port' },
};

export default function Confirmation() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ConfirmationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchConfirmation() {
      if (!token) {
        setError('Invalid confirmation link');
        setLoading(false);
        return;
      }

      const { data: result, error: err } = await supabase.rpc('get_transport_request_by_token', {
        _token: token,
      });

      if (err) {
        console.error('Error fetching confirmation:', err);
        setError('Unable to load confirmation details');
        setLoading(false);
        return;
      }

      if (!result || result.length === 0) {
        setError('Confirmation not found or no longer available');
        setLoading(false);
        return;
      }

      setData(result[0] as ConfirmationData);
      setLoading(false);
    }

    fetchConfirmation();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-muted flex flex-col items-center justify-center p-4">
        <img src={margoflowLogo} alt="Margo Flow" className="h-10 mb-8" />
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Confirmation Not Found</h2>
            <p className="text-muted-foreground">
              {error || 'This confirmation link may have expired or is no longer valid.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const transportLabel = transportTypeLabels[data.transport_type]?.en || data.transport_name;

  const payloadFields = Object.entries(data.payload_details || {}).filter(
    ([key, value]) => value && !['guest_email', 'guest_whatsapp'].includes(key)
  );

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header - transparent background, consistent with other Margo Flow pages */}
        <div className="text-center mb-6">
          <img src={margoflowLogo} alt="Margo Flow" className="h-10 mx-auto mb-6" />
        </div>

        {/* Success Banner */}
        <Card className="mb-6 border-emerald-200 bg-emerald-50">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
            <h1 className="text-xl font-semibold text-emerald-800">Transport Confirmed</h1>
            <p className="text-emerald-600 text-sm mt-1">
              Your transfer has been confirmed by the property.
            </p>
          </CardContent>
        </Card>

        {/* Main Details Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              {data.property_name}
            </CardTitle>
            <Badge variant="outline" className="w-fit">
              Reservation #{data.reservation_id}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Transport Type */}
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Plane className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Transport Type</p>
                <p className="font-medium">{transportLabel}</p>
              </div>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium text-sm">{formatDate(data.transport_date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <Clock className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-sm text-amber-700">Arrival Time</p>
                  <p className="font-bold text-amber-800">{formatTime(data.transport_time)}</p>
                </div>
              </div>
            </div>

            {/* Passengers */}
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Passengers</p>
                <p className="font-medium">{data.pax} {data.pax === 1 ? 'person' : 'people'}</p>
              </div>
            </div>

            {/* Dynamic Fields */}
            {payloadFields.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  {payloadFields.map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Guest Comment */}
            {data.guest_comment && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Your Comment</p>
                  <p className="text-sm bg-muted p-3 rounded-lg">{data.guest_comment}</p>
                </div>
              </>
            )}

            <Separator />

            {/* Payment */}
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <CreditCard className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Payment</p>
                {data.is_free_transfer ? (
                  <p className="font-medium text-emerald-600">🎁 Complimentary Transfer</p>
                ) : (
                  <div className="flex justify-between items-center">
                    <p className="font-medium">
                      {data.payment_mode === 'at_riad' ? 'At Property' : 'Cash to Driver'}
                    </p>
                    <p className="text-lg font-bold text-primary">{data.computed_price} MAD</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Margo Flow – Transfer Management System<br />
          © 2025 Margo Hospitality
        </p>
      </div>
    </div>
  );
}