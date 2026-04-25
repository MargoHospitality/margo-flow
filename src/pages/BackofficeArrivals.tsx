import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { addDays, format, parseISO } from 'date-fns';
import {
  ArrowLeft,
  BedDouble,
  CalendarIcon,
  CarFront,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CreditCard,
  Gift,
  Globe2,
  Home,
  Hotel,
  Loader2,
  LogOut,
  MessageSquareText,
  Plane,
  Search,
  Shield,
  UserCheck,
  Users,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import margoflowLogo from '@/assets/margoflow-logo.png';
import {
  ArrivalCheckinStatus,
  ArrivalProperty,
  ArrivalRecord,
  ArrivalSourceKey,
  ArrivalSourceOption,
  ArrivalTransportStatus,
  getCheckinBadgeClass,
  getCheckinLabel,
  getSourceBadgeClass,
  getTransportBadgeClass,
  getTransportLabel,
} from '@/lib/arrivals';

type ArrivalsResponse = {
  success: boolean;
  data?: {
    date: string;
    arrivals: ArrivalRecord[];
    properties: ArrivalProperty[];
    sources: ArrivalSourceOption[];
  };
  error?: string;
};

type BackofficeArrivalsProps = {
  allowedRiadIds?: string[] | null;
};

function getTodayIso() {
  return format(new Date(), 'yyyy-MM-dd');
}

function getSourceIcon(sourceKey: ArrivalSourceKey) {
  if (sourceKey === 'booking') return Globe2;
  if (sourceKey === 'airbnb') return Home;
  if (sourceKey === 'expedia') return Plane;
  if (sourceKey === 'direct') return Hotel;
  return Globe2;
}

function getGuestIdentity(guest: NonNullable<ArrivalRecord['checkin']>['guests'][number]) {
  return [guest.firstName, guest.lastName]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    || 'Guest';
}

function getTransportFieldLabel(key: string) {
  if (key === 'flight_number') return 'Flight ID';
  if (key === 'train_number') return 'Train ID';
  if (key === 'hotel_name') return 'Hotel';
  if (key === 'hotel_address') return 'Hotel address';
  if (key === 'bus_company') return 'Bus company';
  if (key === 'arrival_time') return 'Arrival time';
  return key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildWhatsappUrl(phone: string | null) {
  if (!phone) return null;
  const digitsOnly = phone.replace(/\D/g, '');
  if (!digitsOnly) return null;
  return `https://wa.me/${digitsOnly}`;
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M16.04 4C9.41 4 4.03 9.36 4.03 15.96c0 2.1.56 4.16 1.61 5.97L4 28l6.24-1.63a12.05 12.05 0 0 0 5.8 1.48h.01c6.62 0 12-5.36 12-11.95C28.05 9.36 22.66 4 16.04 4Zm0 21.83h-.01a9.98 9.98 0 0 1-5.08-1.39l-.36-.21-3.7.97.99-3.6-.24-.37a9.86 9.86 0 0 1-1.52-5.27c0-5.49 4.45-9.94 9.93-9.94a9.94 9.94 0 0 1 9.94 9.88c0 5.48-4.46 9.93-9.95 9.93Zm5.45-7.44c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49 0 1.46 1.07 2.87 1.22 3.07.15.2 2.1 3.2 5.09 4.49.71.31 1.27.49 1.7.63.72.23 1.37.2 1.89.12.58-.09 1.77-.72 2.02-1.42.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35Z"
      />
    </svg>
  );
}

function getFlagEmoji(countryCode: string) {
  if (!/^[A-Z]{2}$/.test(countryCode)) return null;
  return String.fromCodePoint(...countryCode.split('').map((char) => 127397 + char.charCodeAt(0)));
}

function formatCountryDisplay(countryValue: string | null) {
  if (!countryValue) return '—';
  const normalized = countryValue.trim();
  if (!normalized) return '—';

  const upper = normalized.toUpperCase();
  const flag = getFlagEmoji(upper);
  if (flag) {
    return `${flag} ${upper}`;
  }

  return normalized;
}

function humanizeToken(value: string | null | undefined) {
  if (!value) return '—';

  const normalized = value.trim();
  if (!normalized) return '—';

  const specialCases: Record<string, string> = {
    no_meal: 'No meal',
    breakfast: 'Breakfast',
    half_board: 'Half board',
    full_board: 'Full board',
    all_inclusive: 'All inclusive',
    twin: 'Twin beds',
    double: 'Double bed',
    single: 'Single bed',
    king: 'King bed',
    queen: 'Queen bed',
    no_preference: 'No preference',
  };

  const lower = normalized.toLowerCase();
  if (specialCases[lower]) {
    return specialCases[lower];
  }

  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCompactDateTime(value: string | null) {
  if (!value) return '—';
  return format(parseISO(value), 'dd/MM/yyyy - HH:mm');
}

function getSectionClasses(section: 'reservation' | 'checkin' | 'transport') {
  if (section === 'reservation') {
    return {
      wrapper: 'rounded-xl border border-[#b9dcde] bg-[#f3fbfb] p-4 shadow-sm',
      title: 'bg-[#005663] text-white',
      icon: 'text-[#005663]',
      field: 'rounded-lg border border-[#d7ebec] bg-white/90 px-3 py-2.5',
      muted: 'text-[#005663]/75',
    };
  }

  if (section === 'checkin') {
    return {
      wrapper: 'rounded-xl border border-[#a8ddda] bg-[#effafa] p-4 shadow-sm',
      title: 'bg-[#009c9a] text-white',
      icon: 'text-[#009c9a]',
      field: 'rounded-lg border border-[#cceae8] bg-white/90 px-3 py-2.5',
      muted: 'text-[#007d7b]/80',
    };
  }

  return {
    wrapper: 'rounded-xl border border-[#a7d6dc] bg-[#f1fafb] p-4 shadow-sm',
    title: 'bg-[#0b6b78] text-white',
    icon: 'text-[#0b6b78]',
    field: 'rounded-lg border border-[#cde7ea] bg-white/90 px-3 py-2.5',
    muted: 'text-[#0b6b78]/80',
  };
}

export default function BackofficeArrivals({ allowedRiadIds = null }: BackofficeArrivalsProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isLoading: authLoading, signOut, isManager, isSuperAdmin, isActive } = useAuth();
  const [arrivals, setArrivals] = useState<ArrivalRecord[]>([]);
  const [properties, setProperties] = useState<ArrivalProperty[]>([]);
  const [sources, setSources] = useState<ArrivalSourceOption[]>([]);
  const [isLoadingArrivals, setIsLoadingArrivals] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRiadId, setSelectedRiadId] = useState('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | ArrivalSourceKey>('all');
  const [transportFilter, setTransportFilter] = useState<'all' | ArrivalTransportStatus>('all');
  const [checkinFilter, setCheckinFilter] = useState<'all' | ArrivalCheckinStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedReservationId, setExpandedReservationId] = useState<string | null>(null);

  const selectedDateIso = searchParams.get('date') || getTodayIso();
  const selectedDate = useMemo(() => parseISO(selectedDateIso), [selectedDateIso]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }

    if (!authLoading && user && !isManager) {
      navigate('/auth');
    }
  }, [authLoading, isManager, navigate, user]);

  const fetchArrivals = useCallback(async () => {
    if (!user || !isManager || !isActive) {
      return;
    }

    setIsLoadingArrivals(true);
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
          date: selectedDateIso,
          riadIds: selectedRiadId === 'all' ? allowedRiadIds ?? undefined : [selectedRiadId],
          source: sourceFilter,
          transportStatus: transportFilter,
          checkinStatus: checkinFilter,
          search: searchQuery || undefined,
        }),
      });

      const payload = await response.json().catch(() => null) as ArrivalsResponse | null;

      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error || 'Failed to load arrivals');
      }

      setArrivals(payload.data.arrivals);
      setProperties(payload.data.properties);
      setSources(payload.data.sources);
    } catch (fetchError) {
      console.error('Failed to fetch arrivals:', fetchError);
      setArrivals([]);
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load arrivals');
    } finally {
      setIsLoadingArrivals(false);
    }
  }, [allowedRiadIds, checkinFilter, isActive, isManager, searchQuery, selectedDateIso, selectedRiadId, sourceFilter, transportFilter, user]);

  useEffect(() => {
    if (user && isManager && isActive) {
      void fetchArrivals();
    }
  }, [fetchArrivals, isActive, isManager, user]);

  useEffect(() => {
    if (expandedReservationId && !arrivals.some((arrival) => arrival.reservationId === expandedReservationId)) {
      setExpandedReservationId(null);
    }
  }, [arrivals, expandedReservationId]);

  const totalCompleted = useMemo(
    () => arrivals.filter((arrival) => arrival.checkinStatus === 'completed').length,
    [arrivals],
  );
  const totalWithTransport = useMemo(
    () => arrivals.filter((arrival) => arrival.transportStatus !== 'none').length,
    [arrivals],
  );

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const updateDate = (nextDate: Date) => {
    setSearchParams((current) => {
      const updated = new URLSearchParams(current);
      updated.set('date', format(nextDate, 'yyyy-MM-dd'));
      return updated;
    });
  };

  const clearFilters = () => {
    setSelectedRiadId('all');
    setSourceFilter('all');
    setTransportFilter('all');
    setCheckinFilter('all');
    setSearchQuery('');
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
            <CardTitle>Account deactivated</CardTitle>
            <CardDescription>Your access is currently disabled. Please contact an administrator.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
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
            <Badge variant="outline" className="hidden sm:inline-flex">
              <Users className="mr-2 h-3.5 w-3.5" />
              Arrivals
            </Badge>
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
        <Card>
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Arrivals</CardTitle>
                <CardDescription>
                  Daily operational overview with transport, digital check-in, and booking source signals.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="icon" onClick={() => updateDate(addDays(selectedDate, -1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="min-w-[220px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(selectedDate, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && updateDate(date)} initialFocus />
                  </PopoverContent>
                </Popover>
                <Button type="button" variant="outline" size="icon" onClick={() => updateDate(addDays(selectedDate, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button type="button" variant="secondary" onClick={() => updateDate(parseISO(getTodayIso()))}>
                  Today
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="space-y-2 xl:col-span-1">
                <Label>Property</Label>
                <Select value={selectedRiadId} onValueChange={setSelectedRiadId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All properties" />
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
                <Label>Source</Label>
                <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value as 'all' | ArrivalSourceKey)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sources</SelectItem>
                    {sources.map((source) => (
                      <SelectItem key={source.key} value={source.key}>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Transport</Label>
                <Select value={transportFilter} onValueChange={(value) => setTransportFilter(value as 'all' | ArrivalTransportStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All transport statuses</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="requested">Requested</SelectItem>
                    <SelectItem value="none">No transport</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Digital check-in</Label>
                <Select value={checkinFilter} onValueChange={(value) => setCheckinFilter(value as 'all' | ArrivalCheckinStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All digital check-in statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="not_yet">Not yet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Guest or reservation ID"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>{arrivals.length} arrival{arrivals.length === 1 ? '' : 's'}</span>
              <span>{totalCompleted} completed check-in{totalCompleted === 1 ? '' : 's'}</span>
              <span>{totalWithTransport} with transport</span>
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-rose-200">
            <CardContent className="py-6 text-sm text-rose-700">
              {error}
            </CardContent>
          </Card>
        )}

        {isLoadingArrivals ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : arrivals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No arrivals found for this date and filter combination.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {arrivals.map((arrival) => {
              const SourceIcon = getSourceIcon(arrival.sourceKey);
              const isExpanded = expandedReservationId === arrival.reservationId;
              const whatsappUrl = buildWhatsappUrl(arrival.guestPhone);
              const transportDetailEntries = Object.entries(arrival.transport?.payloadDetails ?? {})
                .filter(([key, value]) => !['guest_email', 'guest_whatsapp', 'language'].includes(key) && value !== null && value !== undefined && `${value}`.trim().length > 0);
              const reservationStyles = getSectionClasses('reservation');
              const checkinStyles = getSectionClasses('checkin');
              const transportStyles = getSectionClasses('transport');

              return (
                <Card
                  key={arrival.reservationId}
                  className={cn(
                    'transition-colors hover:border-primary/40',
                    isExpanded ? 'border-primary/40 bg-muted/10' : 'hover:bg-muted/20',
                  )}
                >
                  <CardContent className="pt-6">
                    <button
                      type="button"
                      onClick={() => setExpandedReservationId((current) => current === arrival.reservationId ? null : arrival.reservationId)}
                      className="w-full text-left"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-3">
                          <div>
                            <p className="text-lg font-semibold text-foreground">{arrival.guestName}</p>
                            <p className="text-sm text-muted-foreground">
                              {arrival.propertyName} • {arrival.reservationId}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={cn('border-transparent', getSourceBadgeClass(arrival.sourceKey))}>
                              <SourceIcon className="mr-2 h-3.5 w-3.5" />
                              {arrival.sourceLabel}
                            </Badge>
                            <Badge variant="outline" className={getTransportBadgeClass(arrival.transportStatus)}>
                              <CarFront className="mr-2 h-3.5 w-3.5" />
                              {getTransportLabel(arrival.transportStatus)}
                            </Badge>
                            {arrival.transport?.isComplimentary && (
                              <Badge variant="outline" className="border border-status-confirmed/30 bg-status-confirmed/10 text-status-confirmed">
                                <Gift className="mr-1 h-3 w-3" />
                                Free Transfer
                              </Badge>
                            )}
                            <Badge variant="outline" className={getCheckinBadgeClass(arrival.checkinStatus)}>
                              <UserCheck className="mr-2 h-3.5 w-3.5" />
                              {getCheckinLabel(arrival.checkinStatus)}
                            </Badge>
                          </div>

                          {arrival.roomNames.length > 0 && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <BedDouble className="h-4 w-4" />
                              <span>{arrival.roomNames.join(' • ')}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-3 lg:min-w-[420px]">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-lg border border-border/60 px-4 py-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Check-in</p>
                              <p className="mt-1 font-medium">{format(parseISO(arrival.checkInDate), 'PPP')}</p>
                            </div>
                            <div className="rounded-lg border border-border/60 px-4 py-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Arrival time</p>
                              <p className="mt-1 font-medium">{arrival.arrivalTime || '—'}</p>
                            </div>
                            <div className="rounded-lg border border-border/60 px-4 py-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Guests</p>
                              <p className="mt-1 font-medium">{arrival.guestCount}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-end text-sm font-medium text-muted-foreground">
                            <span>{isExpanded ? 'Hide details' : 'Show details'}</span>
                            {isExpanded ? (
                              <ChevronUp className="ml-2 h-4 w-4" />
                            ) : (
                              <ChevronDown className="ml-2 h-4 w-4" />
                            )}
                          </div>
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-6 border-t border-border/60 pt-6">
                        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="text-sm text-muted-foreground">
                            Expanded operational details for {arrival.guestName}.
                          </div>
                          {whatsappUrl && (
                            <Button asChild size="icon" className="h-10 w-10 rounded-full bg-[#25D366] text-white shadow-sm hover:bg-[#1ebe5b]">
                              <a href={whatsappUrl} target="_blank" rel="noreferrer" aria-label="Contact guest on WhatsApp">
                                <WhatsAppIcon className="h-5 w-5" />
                              </a>
                            </Button>
                          )}
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)]">
                          <div className="space-y-4">
                            <div className={reservationStyles.wrapper}>
                              <div className="mb-3 flex items-center gap-2">
                                <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', reservationStyles.title)}>
                                  Reservation
                                </span>
                              </div>
                              <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                                <div className={reservationStyles.field}>
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Property</p>
                                  <p className="mt-1 font-medium">{arrival.propertyName}</p>
                                </div>
                                <div className={reservationStyles.field}>
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Reservation ID</p>
                                  <p className="mt-1 font-medium">{arrival.reservationId}</p>
                                </div>
                                <div className={reservationStyles.field}>
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Source</p>
                                  <p className="mt-1 font-medium">{arrival.sourceLabel}</p>
                                </div>
                                <div className={reservationStyles.field}>
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Check-out</p>
                                  <p className="mt-1 font-medium">{arrival.checkOutDate ? format(parseISO(arrival.checkOutDate), 'PPP') : '—'}</p>
                                </div>
                                <div className={reservationStyles.field}>
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Guest country</p>
                                  <p className="mt-1 font-medium">{formatCountryDisplay(arrival.guestCountryCode)}</p>
                                </div>
                                <div className={reservationStyles.field}>
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Rooms</p>
                                  <p className="mt-1 font-medium">{arrival.roomNames.join(' • ') || '—'}</p>
                                </div>
                              </div>
                            </div>

                            <div className={checkinStyles.wrapper}>
                              <div className="mb-3 flex items-center gap-2">
                                <UserCheck className={cn('h-4 w-4', checkinStyles.icon)} />
                                <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', checkinStyles.title)}>
                                  Digital check-in
                                </span>
                              </div>
                              {arrival.checkinStatus === 'not_yet' || !arrival.checkin ? (
                                <div className={cn(checkinStyles.field, 'border-dashed text-sm text-muted-foreground')}>
                                  The guest has not completed the digital check-in yet.
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
                                    <div className={checkinStyles.field}>
                                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Completed at</p>
                                      <p className="mt-1 font-medium">{formatCompactDateTime(arrival.checkin.completedAt)}</p>
                                    </div>
                                    <div className={checkinStyles.field}>
                                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Cloudbeds sync</p>
                                      <p className="mt-1 font-medium">{arrival.checkin.syncedToCloudbeds ? 'Synced' : 'Not synced yet'}</p>
                                    </div>
                                    <div className={checkinStyles.field}>
                                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Arrival time</p>
                                      <p className="mt-1 font-medium">{arrival.checkin.arrivalTime || '—'}</p>
                                    </div>
                                    <div className={checkinStyles.field}>
                                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Guests submitted</p>
                                      <p className="mt-1 font-medium">{arrival.checkin.guests.length}</p>
                                    </div>
                                  </div>

                                  {arrival.transportStatus === 'none' && (arrival.checkin.transportMethod || arrival.checkin.transportDetails) && (
                                    <div className="grid gap-2.5 md:grid-cols-2">
                                      <div className={checkinStyles.field}>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Alternative transport</p>
                                        <p className="mt-1 font-medium">{humanizeToken(arrival.checkin.transportMethod)}</p>
                                      </div>
                                      <div className={checkinStyles.field}>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Comment</p>
                                        <p className="mt-1 font-medium">{arrival.checkin.transportDetails || '—'}</p>
                                      </div>
                                    </div>
                                  )}

                                  {arrival.checkin.guests.length > 0 && (
                                    <div className="space-y-2">
                                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Guest identities</p>
                                      <div className="grid gap-2 md:grid-cols-2">
                                        {arrival.checkin.guests.map((guest, index) => (
                                          <div key={`${getGuestIdentity(guest)}-${index}`} className={checkinStyles.field}>
                                            <p className="font-medium">{getGuestIdentity(guest)}</p>
                                            {[guest.nationality, guest.passportNumber].filter(Boolean).length > 0 && (
                                              <p className="mt-1 text-sm text-muted-foreground">
                                                {[guest.nationality, guest.passportNumber].filter(Boolean).join(' • ')}
                                              </p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  <div className="grid gap-2.5 md:grid-cols-2">
                                    <div className={checkinStyles.field}>
                                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Restauration</p>
                                      <p className="mt-1 font-medium">{humanizeToken(arrival.checkin.restaurationPreferences)}</p>
                                    </div>
                                    <div className={checkinStyles.field}>
                                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Bedding</p>
                                      <p className="mt-1 font-medium">
                                        {[humanizeToken(arrival.checkin.beddingPreferences), humanizeToken(arrival.checkin.beddingDetails)]
                                          .filter((value) => value !== '—')
                                          .join(' • ') || '—'}
                                      </p>
                                    </div>
                                  </div>

                                  <div className={checkinStyles.field}>
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Other requests</p>
                                    <p className="mt-1 font-medium">{arrival.checkin.otherRequests || '—'}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className={transportStyles.wrapper}>
                            <div className="mb-3 flex items-center gap-2">
                              <CarFront className={cn('h-4 w-4', transportStyles.icon)} />
                              <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', transportStyles.title)}>
                                Transport
                              </span>
                            </div>
                            {!arrival.transport ? (
                              <div className={cn(transportStyles.field, 'border-dashed text-sm text-muted-foreground')}>
                                No transport request is currently attached to this reservation.
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div className="grid gap-2.5 md:grid-cols-2">
                                  <div className={transportStyles.field}>
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                                    <p className="mt-1 font-medium">{getTransportLabel(arrival.transportStatus)}</p>
                                  </div>
                                  <div className={transportStyles.field}>
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Offer</p>
                                    <p className="mt-1 font-medium">{arrival.transport.offerName || 'Transport request'}</p>
                                  </div>
                                  <div className={transportStyles.field}>
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Transport time</p>
                                    <p className="mt-1 font-medium">{arrival.transport.time}</p>
                                  </div>
                                  <div className={transportStyles.field}>
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Passengers</p>
                                    <p className="mt-1 font-medium">{arrival.transport.pax}</p>
                                  </div>
                                </div>

                                {arrival.transport.isComplimentary && (
                                  <div className="rounded-lg border border-status-confirmed/20 bg-status-confirmed/10 p-3">
                                    <p className="text-xs uppercase tracking-wide text-status-confirmed">Rate</p>
                                    <p className="mt-1 flex items-center gap-2 font-medium text-status-confirmed">
                                      <Gift className="h-4 w-4" />
                                      Free Transfer
                                    </p>
                                  </div>
                                )}

                                {transportDetailEntries.length > 0 && (
                                  <div className="grid gap-2.5 md:grid-cols-2">
                                    {transportDetailEntries.map(([key, value]) => (
                                      <div key={key} className={transportStyles.field}>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{getTransportFieldLabel(key)}</p>
                                        <p className="mt-1 font-medium">{String(value)}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <div className={transportStyles.field}>
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Guest comment</p>
                                  <p className="mt-1 font-medium">{arrival.transport.guestComment || '—'}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
