import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, parseISO, subDays } from 'date-fns';
import { AlertCircle, ArrowLeft, CarFront, CreditCard, Loader2, LogOut, MessageSquareText, RefreshCw, Shield, Star, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import margoflowLogo from '@/assets/margoflow-logo.png';

type ReviewItem = {
  id: number;
  propertyId: number;
  propertyName: string;
  reservationId: string;
  guestEmail?: string | null;
  guestName?: string | null;
  ratingGlobal: number;
  ratingStaff: number;
  ratingCleanliness: number;
  servicesAppreciated?: string[] | null;
  suggestions?: string | null;
  redirectedToGoogle: boolean;
  createdAt: string;
};

type ReviewPropertyFilter = {
  id: string;
  name: string;
  cloudbeds_property_id: string | null;
};

function getRatingBadgeClass(rating: number) {
  if (rating >= 5) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (rating >= 4) {
    return 'border-sky-200 bg-sky-50 text-sky-700';
  }

  return 'border-red-200 bg-red-50 text-red-700';
}

function getRowClassName(rating: number) {
  if (rating <= 3) {
    return 'bg-red-50/80 hover:bg-red-50';
  }

  return '';
}

function formatServices(services: string[] | null | undefined) {
  if (!services || services.length === 0) {
    return '—';
  }

  return services.join(', ');
}

function formatGuest(review: ReviewItem) {
  if (review.guestName?.trim()) {
    return review.guestName.trim();
  }

  if (review.guestEmail?.trim()) {
    return review.guestEmail.trim();
  }

  return 'Unknown guest';
}

function getDefaultDateFrom() {
  return format(subDays(new Date(), 2), 'yyyy-MM-dd');
}

export default function BackofficeReviews() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, signOut, isManager, isSuperAdmin, isActive } = useAuth();
  const defaultDateFrom = useMemo(() => getDefaultDateFrom(), []);
  const [properties, setProperties] = useState<ReviewPropertyFilter[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [isLoadingProperties, setIsLoadingProperties] = useState(true);
  const [isLoadingReviews, setIsLoadingReviews] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRiadId, setSelectedRiadId] = useState('all');
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }

    if (!authLoading && user && !isManager) {
      navigate('/auth');
    }
  }, [authLoading, isManager, navigate, user]);

  const loadProperties = useCallback(async () => {
    setIsLoadingProperties(true);
    try {
      const { data, error: riadsError } = await supabase
        .from('riads')
        .select('id, name, cloudbeds_property_id')
        .not('cloudbeds_property_id', 'is', null)
        .order('name', { ascending: true });

      if (riadsError) {
        throw riadsError;
      }

      setProperties((data ?? []) as ReviewPropertyFilter[]);
    } catch (loadError) {
      console.error('Failed to load review properties:', loadError);
      setProperties([]);
    } finally {
      setIsLoadingProperties(false);
    }
  }, []);

  const fetchReviews = useCallback(async () => {
    if (!user || !isManager || !isActive) {
      return;
    }

    setIsLoadingReviews(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          riadIds: selectedRiadId === 'all' ? undefined : [selectedRiadId],
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          rating: ratingFilter === 'all' ? undefined : Number(ratingFilter),
          limit: 50,
          offset: 0,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Reviews temporarily unavailable');
      }

      setReviews((payload.data?.reviews ?? []) as ReviewItem[]);
    } catch (fetchError) {
      console.error('Failed to fetch reviews:', fetchError);
      setReviews([]);
      setError(fetchError instanceof Error ? fetchError.message : 'Reviews temporarily unavailable');
    } finally {
      setIsLoadingReviews(false);
    }
  }, [dateFrom, dateTo, isActive, isManager, ratingFilter, selectedRiadId, user]);

  useEffect(() => {
    if (user && isManager && isActive) {
      void loadProperties();
    }
  }, [isActive, isManager, loadProperties, user]);

  useEffect(() => {
    if (user && isManager && isActive) {
      void fetchReviews();
    }
  }, [fetchReviews, isActive, isManager, user]);

  const hasActiveFilters = selectedRiadId !== 'all' || dateFrom !== defaultDateFrom || Boolean(dateTo) || ratingFilter !== 'all';

  const reviewCountLabel = useMemo(() => {
    if (isLoadingReviews) {
      return 'Loading reviews…';
    }

    return `${reviews.length} review${reviews.length === 1 ? '' : 's'}`;
  }, [isLoadingReviews, reviews.length]);

  const clearFilters = () => {
    setSelectedRiadId('all');
    setDateFrom(getDefaultDateFrom());
    setDateTo('');
    setRatingFilter('all');
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Account Deactivated</CardTitle>
            <CardDescription>This account cannot access reviews right now.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link
            to="/backoffice"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <img
            src={margoflowLogo}
            alt="MargoFlow"
            className="h-8 md:h-10 object-contain"
          />
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <Link to="/admin">
                <Button variant="ghost" size="sm">
                  <Shield className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Admin</span>
                </Button>
              </Link>
            )}
            <Link to="/backoffice">
              <Button variant="ghost" size="sm">
                <Users className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Arrivals</span>
              </Button>
            </Link>
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
            <Badge variant="outline" className="hidden sm:inline-flex">
              <MessageSquareText className="mr-2 h-3.5 w-3.5" />
              Reviews
            </Badge>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <MessageSquareText className="h-5 w-5 text-primary" />
                Reviews
              </CardTitle>
              <CardDescription>
                Read-only operational view of guest feedback pulled from GEA.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Property</Label>
                  <Select value={selectedRiadId} onValueChange={setSelectedRiadId} disabled={isLoadingProperties}>
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingProperties ? 'Loading properties…' : 'All properties'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All properties</SelectItem>
                      {properties.map((property) => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Date from</Label>
                  <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Date to</Label>
                  <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Global rating</Label>
                  <Select value={ratingFilter} onValueChange={setRatingFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All ratings" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All ratings</SelectItem>
                      <SelectItem value="5">5/5</SelectItem>
                      <SelectItem value="4">4/5</SelectItem>
                      <SelectItem value="3">3/5</SelectItem>
                      <SelectItem value="2">2/5</SelectItem>
                      <SelectItem value="1">1/5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={() => void fetchReviews()} disabled={isLoadingReviews}>
                  {isLoadingReviews ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Refresh
                </Button>
                <Button type="button" variant="ghost" onClick={clearFilters} disabled={!hasActiveFilters}>
                  Clear filters
                </Button>
                <span className="text-sm text-muted-foreground">{reviewCountLabel}</span>
              </div>

              <p className="text-xs text-muted-foreground">
                Default view shows reviews from the last 3 days. Use the date filters to explore older feedback.
              </p>
            </CardContent>
          </Card>

          {error ? (
            <Card className="border-red-200">
              <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
                <AlertCircle className="h-10 w-10 text-red-500" />
                <div className="space-y-1">
                  <p className="font-medium">Reviews temporarily unavailable</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
                <Button type="button" variant="outline" onClick={() => void fetchReviews()}>
                  Try again
                </Button>
              </CardContent>
            </Card>
          ) : isLoadingReviews ? (
            <Card>
              <CardContent className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading reviews…
              </CardContent>
            </Card>
          ) : reviews.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                <MessageSquareText className="h-10 w-10 text-muted-foreground/50" />
                <div className="space-y-1">
                  <p className="font-medium">No reviews found</p>
                  <p className="text-sm text-muted-foreground">
                    No review matches the current property, date, or rating filters.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="hidden lg:block">
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Property</TableHead>
                          <TableHead>Guest</TableHead>
                          <TableHead>Ratings</TableHead>
                          <TableHead>Services appreciated</TableHead>
                          <TableHead>Suggestions</TableHead>
                          <TableHead>Google</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reviews.map((review) => (
                          <TableRow key={review.id} className={getRowClassName(review.ratingGlobal)}>
                            <TableCell className="whitespace-nowrap">
                              {format(parseISO(review.createdAt), 'dd MMM yyyy')}
                            </TableCell>
                            <TableCell className="font-medium">{review.propertyName}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <p>{formatGuest(review)}</p>
                                <p className="text-xs text-muted-foreground">{review.reservationId}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className={cn('gap-1', getRatingBadgeClass(review.ratingGlobal))}>
                                  <Star className="h-3 w-3 fill-current" />
                                  {review.ratingGlobal}/5
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  Staff {review.ratingStaff}/5
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Cleanliness {review.ratingCleanliness}/5
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs text-sm text-muted-foreground">
                              {formatServices(review.servicesAppreciated)}
                            </TableCell>
                            <TableCell className="max-w-sm text-sm text-muted-foreground">
                              {review.suggestions?.trim() || '—'}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  review.redirectedToGoogle
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-slate-200 bg-slate-50 text-slate-600',
                                )}
                              >
                                {review.redirectedToGoogle ? 'Yes' : 'No'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:hidden">
                {reviews.map((review) => (
                  <Card key={review.id} className={cn(review.ratingGlobal <= 3 && 'border-red-200 bg-red-50/60')}>
                    <CardContent className="space-y-4 pt-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">
                            {format(parseISO(review.createdAt), 'dd MMM yyyy')}
                          </p>
                          <p className="font-medium">{review.propertyName}</p>
                          <p className="text-sm">{formatGuest(review)}</p>
                          <p className="text-xs text-muted-foreground">{review.reservationId}</p>
                        </div>
                        <Badge variant="outline" className={cn('gap-1 shrink-0', getRatingBadgeClass(review.ratingGlobal))}>
                          <Star className="h-3 w-3 fill-current" />
                          {review.ratingGlobal}/5
                        </Badge>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-md border bg-background px-3 py-2 text-sm">
                          <p className="text-muted-foreground">Staff</p>
                          <p className="font-medium">{review.ratingStaff}/5</p>
                        </div>
                        <div className="rounded-md border bg-background px-3 py-2 text-sm">
                          <p className="text-muted-foreground">Cleanliness</p>
                          <p className="font-medium">{review.ratingCleanliness}/5</p>
                        </div>
                      </div>

                      <div className="space-y-1 text-sm">
                        <p className="text-muted-foreground">Services appreciated</p>
                        <p>{formatServices(review.servicesAppreciated)}</p>
                      </div>

                      <div className="space-y-1 text-sm">
                        <p className="text-muted-foreground">Suggestions</p>
                        <p>{review.suggestions?.trim() || '—'}</p>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Redirected to Google</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            review.redirectedToGoogle
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-slate-50 text-slate-600',
                          )}
                        >
                          {review.redirectedToGoogle ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
