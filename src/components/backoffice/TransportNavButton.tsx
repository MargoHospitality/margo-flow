import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { CarFront } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type TransportNavButtonProps = {
  active?: boolean;
};

function PendingBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-background">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function TransportNavButton({ active = false }: TransportNavButtonProps) {
  const { user, isLoading: authLoading, isManager, isSuperAdmin, isActive, riadIds } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function fetchPendingCount() {
      if (authLoading || !user || !isManager || !isActive) return;

      if (!isSuperAdmin && riadIds.length === 0) {
        setPendingCount(0);
        return;
      }

      let query = supabase
        .from('transport_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (!isSuperAdmin) {
        query = query.in('riad_id', riadIds);
      }

      const { count, error } = await query;
      if (error) {
        console.error('Error fetching pending transport count:', error);
        return;
      }

      if (isMounted) {
        setPendingCount(count ?? 0);
      }
    }

    void fetchPendingCount();

    return () => {
      isMounted = false;
    };
  }, [authLoading, isActive, isManager, isSuperAdmin, riadIds, user]);

  if (active) {
    return (
      <Badge variant="outline" className="relative hidden sm:inline-flex pr-3">
        <CarFront className="mr-2 h-3.5 w-3.5" />
        Transport
        <PendingBadge count={pendingCount} />
      </Badge>
    );
  }

  return (
    <Button asChild variant="ghost" size="sm" className="relative shrink-0">
      <Link to="/backoffice/transport" aria-label={pendingCount > 0 ? `Transport, ${pendingCount} pending requests` : 'Transport'}>
        <CarFront className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">Transport</span>
        <PendingBadge count={pendingCount} />
      </Link>
    </Button>
  );
}
