import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Backoffice from './Backoffice';
import BackofficeArrivals from './BackofficeArrivals';

export default function BackofficeHome() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isManager, isSuperAdmin, isActive, riadIds } = useAuth();
  const [enabledRiadIds, setEnabledRiadIds] = useState<string[] | null>(null);
  const [isResolvingHome, setIsResolvingHome] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }

    if (!authLoading && user && !isManager) {
      navigate('/auth');
    }
  }, [authLoading, isManager, navigate, user]);

  useEffect(() => {
    async function resolveHome() {
      if (authLoading || !user || !isManager) {
        return;
      }

      if (!isActive) {
        setEnabledRiadIds([]);
        setIsResolvingHome(false);
        return;
      }

      if (isSuperAdmin) {
        setEnabledRiadIds(null);
        setIsResolvingHome(false);
        return;
      }

      if (riadIds.length === 0) {
        setEnabledRiadIds([]);
        setIsResolvingHome(false);
        return;
      }

      setIsResolvingHome(true);
      const { data, error } = await supabase
        .from('riads')
        .select('id')
        .in('id', riadIds)
        .eq('arrivals_home_enabled', true);

      if (error) {
        console.error('Error resolving backoffice home:', error);
        setEnabledRiadIds([]);
      } else {
        setEnabledRiadIds((data ?? []).map((riad) => riad.id));
      }

      setIsResolvingHome(false);
    }

    void resolveHome();
  }, [authLoading, isActive, isManager, isSuperAdmin, riadIds, user]);

  if (authLoading || isResolvingHome) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isSuperAdmin) {
    return <BackofficeArrivals />;
  }

  if (enabledRiadIds && enabledRiadIds.length > 0) {
    return <BackofficeArrivals allowedRiadIds={enabledRiadIds} />;
  }

  return <Backoffice />;
}
