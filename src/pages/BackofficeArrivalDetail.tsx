import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  ArrowLeft,
  BedDouble,
  CarFront,
  CreditCard,
  Globe2,
  Home,
  Hotel,
  Loader2,
  LogOut,
  MessageSquareText,
  Plane,
  Shield,
  UserCheck,
  Users,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import margoflowLogo from '@/assets/margoflow-logo.png';
import { ArrivalRecord, ArrivalSourceKey, getCheckinBadgeClass, getCheckinLabel, getTransportBadgeClass, getTransportLabel } from '@/lib/arrivals';

type ArrivalDetailResponse = {
  success: boolean;
  data?: {
    arrival: ArrivalRecord | null;
  };
  error?: string;
};

function getSourceIcon(sourceKey: ArrivalSourceKey) {
  if (sourceKey === 'booking') return Globe2;
  if (sourceKey === 'airbnb') return Home;
  if (sourceKey === 'expedia') return Plane;
  if (sourceKey === 'direct') return Hotel;
  return Globe2;
}

function getGuestIdentity(guest: Record<string, unknown>) {
  return [guest.firstName, guest.lastName]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    || 'Guest';
}

export default function BackofficeArrivalDetail() {
  const navigate = useNavigate();
  const { reservationId } = useParams<{ reservationId: string }>();
  const [searchParams] = useSearchParams();
  const { user, isLoading: authLoading, signOut, isManager, isSuperAdmin, isActive } = useAuth();
  const [arrival, setArrival] = useState<ArrivalRecord | null>(null);
  const [isLoadingArrival, setIsLoadingArrival] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const backDate = searchParams.get('date');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }

    if (!authLoading && user && !isManager) {
      navigate('/auth');
    }
  }, [authLoading, isManager, navigate, user]);

  const fetchArrival = useCallback(async () => {
    if (!user || !isManager || !isActive || !reservationId) {
      return;
    }

    setIsLoadingArrival(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-arrivals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          reservationId,
        }),
      });

      const payload = await response.json().catch(() => null) as ArrivalDetailResponse | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to load arrival details');
      }

      setArrival(payload.data?.arrival ?? null);
    } catch (fetchError) {
      console.error('Failed to fetch arrival detail:', fetchError);
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load arrival details');
    } finally {
      setIsLoadingArrival(false);
    }
  }, [isActive, isManager, reservationId, user]);

  useEffect(() => {
    if (user && isManager && isActive && reservationId) {
      void fetchArrival();
    }
  }, [fetchArrival, isActive, isManager, reservationId, user]);

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const backHref = useMemo(() => {
    if (!backDate) return '/backoffice';
    return `/backoffice?date=${backDate}`;
  }, [backDate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to={backHref}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </Link>
            <img
              src={margoflowLogo}
              alt="MargoFlow"
              className="h-8 md:h-10 object-contain"
            />
          </div>
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <Link to="/admin">
                <Button variant="ghost" size="sm">
                  <Shield className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Admin</span>
                </Button>
              </Link>
            )}
            <Link to="/backoffice/transport">
              <Button variant="ghost" size="sm">
                <CarFront className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Transport</span>
              </Button>
            </Link>
            <Link to="/backoffice/payments">
              <Button variant="ghost" size="sm">
                <CreditCard className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Payments</span>
              </Button>
            </Link>
            <Link to="/backoffice/reviews">
              <Button variant="ghost" size="sm">
                <MessageSquareText className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Reviews</span>
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 space-y-6">
        {isLoadingArrival ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to load arrival details</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : !arrival ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Arrival not found or inaccessible.
            </CardContent>
          </Card>
        ) : (() => {
          const SourceIcon = getSourceIcon(arrival.sourceKey);
          return (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{arrival.guestName}</CardTitle>
                  <CardDescription>
                    {arrival.propertyName} • {arrival.reservationId}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                      <SourceIcon className="mr-2 h-3.5 w-3.5" />
                      {arrival.sourceLabel}
                    </Badge>
                    <Badge variant="outline" className={getTransportBadgeClass(arrival.transportStatus)}>
                      <CarFront className="mr-2 h-3.5 w-3.5" />
                      {getTransportLabel(arrival.transportStatus)}
                    </Badge>
                    <Badge variant="outline" className={getCheckinBadgeClass(arrival.checkinStatus)}>
                      <UserCheck className="mr-2 h-3.5 w-3.5" />
                      {getCheckinLabel(arrival.checkinStatus)}
                    </Badge>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-lg border border-border/60 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Check-in</p>
                      <p className="font-medium">{format(parseISO(arrival.checkInDate), 'PPP')}</p>
                    </div>
                    <div className="rounded-lg border border-border/60 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Check-out</p>
                      <p className="font-medium">{arrival.checkOutDate ? format(parseISO(arrival.checkOutDate), 'PPP') : '—'}</p>
                    </div>
                    <div className="rounded-lg border border-border/60 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Arrival time</p>
                      <p className="font-medium">{arrival.arrivalTime || '—'}</p>
                    </div>
                    <div className="rounded-lg border border-border/60 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Guest country</p>
                      <p className="font-medium">{arrival.guestCountryCode || '—'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
                <Card>
                  <CardHeader>
                    <CardTitle>Digital check-in</CardTitle>
                    <CardDescription>
                      Submitted guest information and arrival details collected in the Guest App.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {arrival.checkinStatus === 'not_yet' || !arrival.checkin ? (
                      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                        The guest has not completed the digital check-in yet.
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-lg border border-border/60 p-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Completed at</p>
                            <p className="font-medium">{arrival.checkin.completedAt ? format(parseISO(arrival.checkin.completedAt), 'PPP p') : '—'}</p>
                          </div>
                          <div className="rounded-lg border border-border/60 p-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Cloudbeds sync</p>
                            <p className="font-medium">{arrival.checkin.syncedToCloudbeds ? 'Synced' : 'Not synced yet'}</p>
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-lg border border-border/60 p-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Arrival time</p>
                            <p className="font-medium">{arrival.checkin.arrivalTime || '—'}</p>
                          </div>
                          <div className="rounded-lg border border-border/60 p-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Guests submitted</p>
                            <p className="font-medium">{arrival.checkin.guests.length}</p>
                          </div>
                        </div>

                        {arrival.checkin.guests.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Guest identities</p>
                            <div className="space-y-2">
                              {arrival.checkin.guests.map((guest, index) => (
                                <div key={`${getGuestIdentity(guest)}-${index}`} className="rounded-lg border border-border/60 p-3">
                                  <p className="font-medium">{getGuestIdentity(guest)}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {[guest.nationality, guest.passportNumber].filter((value): value is string => typeof value === 'string' && value.trim().length > 0).join(' • ') || 'No document details'}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-lg border border-border/60 p-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Restauration</p>
                            <p className="font-medium">{arrival.checkin.restaurationPreferences || '—'}</p>
                          </div>
                          <div className="rounded-lg border border-border/60 p-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Bedding</p>
                            <p className="font-medium">
                              {[arrival.checkin.beddingPreferences, arrival.checkin.beddingDetails].filter(Boolean).join(' • ') || '—'}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-lg border border-border/60 p-3">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Other requests</p>
                          <p className="font-medium">{arrival.checkin.otherRequests || '—'}</p>
                        </div>

                        {arrival.checkin.cloudbedsSyncError && (
                          <Alert>
                            <AlertTitle>Cloudbeds sync issue</AlertTitle>
                            <AlertDescription>{arrival.checkin.cloudbedsSyncError}</AlertDescription>
                          </Alert>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Transport</CardTitle>
                      <CardDescription>
                        Current transport status for this reservation.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!arrival.transport ? (
                        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                          No transport request is currently attached to this reservation.
                        </div>
                      ) : (
                        <>
                          <div className="grid gap-3">
                            <div className="rounded-lg border border-border/60 p-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                              <p className="font-medium">{getTransportLabel(arrival.transportStatus)}</p>
                            </div>
                            <div className="rounded-lg border border-border/60 p-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Offer</p>
                              <p className="font-medium">{arrival.transport.offerName || 'Transport request'}</p>
                            </div>
                            <div className="rounded-lg border border-border/60 p-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Transport time</p>
                              <p className="font-medium">{arrival.transport.time}</p>
                            </div>
                            <div className="rounded-lg border border-border/60 p-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Passengers</p>
                              <p className="font-medium">{arrival.transport.pax}</p>
                            </div>
                          </div>

                          <div className="rounded-lg border border-border/60 p-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Guest comment</p>
                            <p className="font-medium">{arrival.transport.guestComment || '—'}</p>
                          </div>

                          <Link to="/backoffice/transport">
                            <Button variant="outline" className="w-full">
                              Open transport module
                            </Button>
                          </Link>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Operational summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Source</span>
                        <span className="font-medium">{arrival.sourceLabel}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Digital check-in</span>
                        <span className="font-medium">{getCheckinLabel(arrival.checkinStatus)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Transport</span>
                        <span className="font-medium">{getTransportLabel(arrival.transportStatus)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          );
        })()}
      </main>
    </div>
  );
}
