import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { RequestCard } from '@/components/backoffice/RequestCard';
import { Loader2, LogOut, Building, Bell } from 'lucide-react';

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
  const { user, isLoading: authLoading, signOut, isSuperAdmin, riadIds } = useAuth();
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
    if (user) {
      fetchRequests();
    }
  }, [user, isSuperAdmin, riadIds]);

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

      // Transform data to match expected structure
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Building className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold">{t('app_name')}</h1>
              <p className="text-xs text-muted-foreground">{t('dashboard')}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            {t('logout')}
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="pending" className="relative">
              {t('pending_requests')}
              {pendingRequests.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-amber text-primary-foreground rounded-full">
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
    </div>
  );
}
