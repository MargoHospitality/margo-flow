import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { RequestCard } from '@/components/backoffice/RequestCard';
import { Loader2, LogOut, Bell, Shield, AlertCircle, Search, Calendar, Clock, CalendarDays, List } from 'lucide-react';
import margoflowLogo from '@/assets/margoflow-logo.png';
import { format, isToday, isTomorrow, addDays, parseISO, isAfter, isBefore } from 'date-fns';

interface TransportRequest {
  id: string;
  reservation_id: string;
  transport_date: string;
  transport_time: string;
  pax: number;
  computed_price: number;
  payment_mode: string;
  payload_details: Record<string, string>;
  status: string;
  rejection_reason: string | null;
  guest_comment?: string | null;
  created_at: string;
  riad: { name: string };
  reservation: {
    guest_first_name: string | null;
    guest_last_name: string;
    check_in_date: string;
  };
  transport_offer: {
    name: string;
    name_fr: string | null;
    type: string;
  };
}

type MenuTab = 'today' | 'tomorrow' | 'upcoming' | 'pending' | 'all';

export default function Backoffice() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, signOut, isSuperAdmin, isManager, riadIds, isActive } = useAuth();
  const { t } = useLanguage();
  const [requests, setRequests] = useState<TransportRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<MenuTab>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && isManager && isActive) {
      fetchRequests();
    }
  }, [user, isSuperAdmin, riadIds, isManager, isActive]);

  // Set default tab based on pending requests
  useEffect(() => {
    const pendingCount = requests.filter(r => r.status === 'pending').length;
    if (pendingCount > 0 && !isLoading) {
      setActiveTab('pending');
    }
  }, [requests, isLoading]);

  async function fetchRequests() {
    setIsLoading(true);
    try {
      let query = supabase
        .from('transport_requests')
        .select(`
          id,
          reservation_id,
          transport_date,
          transport_time,
          pax,
          computed_price,
          payment_mode,
          payload_details,
          status,
          rejection_reason,
          guest_comment,
          created_at,
          riad:riads(name),
          reservation:reservations(guest_first_name, guest_last_name, check_in_date),
          transport_offer:transport_offers(name, name_fr, type)
        `)
        .order('transport_date', { ascending: true })
        .order('transport_time', { ascending: true });

      // Filter by riad access if not super admin
      if (!isSuperAdmin && riadIds.length > 0) {
        query = query.in('riad_id', riadIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      const transformedData = (data || []).map(item => ({
        ...item,
        riad: item.riad as unknown as { name: string },
        reservation: item.reservation as unknown as { guest_first_name: string | null; guest_last_name: string; check_in_date: string },
        transport_offer: item.transport_offer as unknown as { name: string; name_fr: string | null; type: string },
        payload_details: (item.payload_details || {}) as Record<string, string>,
      }));

      setRequests(transformedData);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  // Filter functions
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const dayPlusTwo = addDays(today, 2);
  const dayPlusSeven = addDays(today, 7);

  const filteredRequests = useMemo(() => {
    let filtered = requests;

    // Apply tab filter
    switch (activeTab) {
      case 'today':
        filtered = requests.filter(r => {
          const date = parseISO(r.transport_date);
          return isToday(date) && (r.status === 'pending' || r.status === 'confirmed');
        });
        break;
      case 'tomorrow':
        filtered = requests.filter(r => {
          const date = parseISO(r.transport_date);
          return isTomorrow(date) && (r.status === 'pending' || r.status === 'confirmed');
        });
        break;
      case 'upcoming':
        filtered = requests.filter(r => {
          const date = parseISO(r.transport_date);
          return isAfter(date, tomorrow) && isBefore(date, addDays(dayPlusSeven, 1)) && (r.status === 'pending' || r.status === 'confirmed');
        });
        break;
      case 'pending':
        filtered = requests.filter(r => r.status === 'pending');
        break;
      case 'all':
        // Show only upcoming transports (today and future), not past
        filtered = requests.filter(r => {
          const date = parseISO(r.transport_date);
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          return date >= todayStart && (r.status === 'pending' || r.status === 'confirmed');
        });
        break;
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.reservation.guest_last_name.toLowerCase().includes(query) ||
        (r.reservation.guest_first_name?.toLowerCase().includes(query)) ||
        r.reservation_id.toLowerCase().includes(query) ||
        r.riad.name.toLowerCase().includes(query) ||
        r.transport_offer.name.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [requests, activeTab, searchQuery, today, tomorrow, dayPlusTwo, dayPlusSeven]);

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const todayCount = requests.filter(r => isToday(parseISO(r.transport_date)) && (r.status === 'pending' || r.status === 'confirmed')).length;
  const tomorrowCount = requests.filter(r => isTomorrow(parseISO(r.transport_date)) && (r.status === 'pending' || r.status === 'confirmed')).length;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show deactivated message
  if (!isActive) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h1 className="font-serif text-2xl mb-2">Account Deactivated</h1>
          <p className="text-muted-foreground mb-6">
            Your account has been deactivated. Please contact your administrator for assistance.
          </p>
          <Button onClick={handleLogout} variant="outline">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  const menuItems: { key: MenuTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'today', label: t('today_transfers'), icon: <Calendar className="h-4 w-4" />, count: todayCount },
    { key: 'tomorrow', label: t('tomorrow_transfers'), icon: <Clock className="h-4 w-4" />, count: tomorrowCount },
    { key: 'upcoming', label: t('upcoming_transfers'), icon: <CalendarDays className="h-4 w-4" /> },
    { key: 'pending', label: t('pending_requests'), icon: <Bell className="h-4 w-4" />, count: pendingCount },
    { key: 'all', label: t('all_requests'), icon: <List className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
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
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{t('logout')}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* Menu Navigation */}
          <div className="flex flex-wrap items-center gap-2">
            {menuItems.map(item => (
              <Button
                key={item.key}
                variant={activeTab === item.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab(item.key)}
                className="relative"
              >
                {item.icon}
                <span className="ml-2 hidden sm:inline">{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <span className={`ml-1 inline-flex items-center justify-center min-w-[20px] h-5 text-xs font-medium rounded-full px-1.5 ${
                    activeTab === item.key 
                      ? 'bg-primary-foreground text-primary' 
                      : 'bg-primary text-primary-foreground'
                  }`}>
                    {item.count}
                  </span>
                )}
              </Button>
            ))}
            
            {/* Search Toggle */}
            <div className="ml-auto flex items-center gap-2">
              {showSearch && (
                <Input
                  placeholder={t('search_placeholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-48 h-9"
                />
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSearch(!showSearch)}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Request Cards */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>{t('no_requests')}</p>
            </div>
          ) : (
            <>
              {/* Use list view for 3+ items, card view for 1-2 items */}
              {filteredRequests.length > 2 ? (
                <div className="space-y-2">
                  {filteredRequests.map(request => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      isSuperAdmin={isSuperAdmin}
                      onUpdate={fetchRequests}
                      compact
                    />
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredRequests.map(request => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      isSuperAdmin={isSuperAdmin}
                      onUpdate={fetchRequests}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-4">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            {t('footer_copyright')}{' '}
            <a 
              href="https://www.margo-hospitality.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {t('footer_margo')}
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
