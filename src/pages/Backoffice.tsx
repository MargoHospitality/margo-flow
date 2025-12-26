import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { RequestCard } from '@/components/backoffice/RequestCard';
import { Loader2, LogOut, Bell, Shield, AlertCircle } from 'lucide-react';
import margoflowLogo from '@/assets/margoflow-logo.png';

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

export default function Backoffice() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, signOut, isSuperAdmin, isManager, riadIds, isActive } = useAuth();
  const { t } = useLanguage();
  const [requests, setRequests] = useState<TransportRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');

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
          created_at,
          riad:riads(name),
          reservation:reservations(guest_first_name, guest_last_name, check_in_date),
          transport_offer:transport_offers(name, name_fr, type)
        `)
        .order('created_at', { ascending: false });

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

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const allRequests = requests;

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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2 mx-auto">
            <TabsTrigger value="pending" className="relative">
              {t('pending_requests')}
              {pendingRequests.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
                  {pendingRequests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="all">{t('all_requests')}</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>{t('no_requests')}</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pendingRequests.map(request => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    isSuperAdmin={isSuperAdmin}
                    onUpdate={fetchRequests}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : allRequests.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>{t('no_requests')}</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {allRequests.map(request => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    isSuperAdmin={isSuperAdmin}
                    onUpdate={fetchRequests}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
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