import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  MessageSquare, 
  Mail, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Loader2,
  Signal,
  SignalZero,
  TrendingUp,
  Clock,
  Building,
  User,
  Bell,
  WalletCards
} from 'lucide-react';
import { format, parseISO, subHours, subDays } from 'date-fns';

interface NotificationAttempt {
  id: string;
  transport_request_id: string | null;
  notification_type: string;
  channel: string;
  recipient_phone: string | null;
  recipient_email: string | null;
  template_sid: string | null;
  status: string;
  error_message: string | null;
  provider_message_id: string | null;
  is_fallback: boolean;
  metadata: any;
  created_at: string;
}

interface WhatsAppRiad {
  id: string;
  name: string;
  whatsapp_enabled: boolean;
}

interface ErrorGroup {
  errorCode: string;
  message: string;
  count: number;
  lastOccurrence: string;
}

interface TwilioBalance {
  balance: string | null;
  currency: string | null;
  fetchedAt: string;
}

type TimeRange = '24h' | '7d' | '30d';

export default function WhatsAppMonitoring() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [attempts, setAttempts] = useState<NotificationAttempt[]>([]);
  const [riads, setRiads] = useState<WhatsAppRiad[]>([]);
  const [twilioBalance, setTwilioBalance] = useState<TwilioBalance | null>(null);
  const [twilioBalanceError, setTwilioBalanceError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [isTogglingWhatsApp, setIsTogglingWhatsApp] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  async function fetchData() {
    setIsLoading(true);
    try {
      await Promise.all([fetchAttempts(), fetchRiads(), fetchTwilioBalance()]);
    } finally {
      setIsLoading(false);
    }
  }

  async function getAccessToken() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Authentication required');
    }

    return session.access_token;
  }

  async function fetchTwilioBalance() {
    try {
      setTwilioBalanceError(null);
      const token = await getAccessToken();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-twilio-balance`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to load Twilio balance');
      }

      setTwilioBalance(result.data as TwilioBalance);
    } catch (error) {
      console.error('Error fetching Twilio balance:', error);
      setTwilioBalance(null);
      setTwilioBalanceError(error instanceof Error ? error.message : 'Failed to load Twilio balance');
    }
  }

  async function fetchAttempts() {
    const hoursAgo = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720;
    const startDate = subHours(new Date(), hoursAgo).toISOString();

    const { data, error } = await supabase
      .from('notification_attempts')
      .select('*')
      .gte('created_at', startDate)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching attempts:', error);
      return;
    }

    setAttempts(data || []);
  }

  async function fetchRiads() {
    const { data, error } = await supabase
      .from('riads')
      .select('id, name, whatsapp_enabled')
      .order('name');

    if (error) {
      console.error('Error fetching riads:', error);
      return;
    }

    setRiads(data || []);
  }

  async function handleToggleWhatsApp(riadId: string, currentState: boolean) {
    setIsTogglingWhatsApp(riadId);
    try {
      const { error } = await supabase
        .from('riads')
        .update({ whatsapp_enabled: !currentState })
        .eq('id', riadId);

      if (error) throw error;

      setRiads(prev => prev.map(r => 
        r.id === riadId ? { ...r, whatsapp_enabled: !currentState } : r
      ));

      toast.success(`WhatsApp ${!currentState ? 'enabled' : 'disabled'} for this property`);
    } catch (error) {
      console.error('Error toggling WhatsApp:', error);
      toast.error('Failed to update WhatsApp setting');
    } finally {
      setIsTogglingWhatsApp(null);
    }
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
    toast.success('Data refreshed');
  }

  // Computed stats
  const stats = useMemo(() => {
    const whatsappAttempts = attempts.filter(a => a.channel === 'whatsapp');
    const emailAttempts = attempts.filter(a => a.channel === 'email');
    const whatsappFailed = whatsappAttempts.filter(a => a.status === 'failed' || a.status === 'undelivered');
    const emailFallbacks = emailAttempts.filter(a => a.is_fallback);
    
    const fallbackRate = whatsappAttempts.length > 0 
      ? ((whatsappFailed.length / whatsappAttempts.length) * 100).toFixed(1)
      : '0';

    return {
      totalWhatsApp: whatsappAttempts.length,
      whatsappSent: whatsappAttempts.filter(a => a.status === 'sent' || a.status === 'delivered').length,
      whatsappFailed: whatsappFailed.length,
      totalEmail: emailAttempts.length,
      emailFallbacks: emailFallbacks.length,
      fallbackRate,
    };
  }, [attempts]);

  // Breakdown by notification type
  const typeBreakdown = useMemo(() => {
    const types = ['client_confirmation', 'manager_urgent', 'client_reminder', 'manager_new_request'];
    return types.map(type => {
      const typeAttempts = attempts.filter(a => a.notification_type === type);
      const whatsapp = typeAttempts.filter(a => a.channel === 'whatsapp');
      const email = typeAttempts.filter(a => a.channel === 'email');
      const fallbacks = email.filter(a => a.is_fallback);
      
      return {
        type,
        label: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        whatsappAttempts: whatsapp.length,
        whatsappSuccess: whatsapp.filter(a => a.status === 'sent' || a.status === 'delivered').length,
        emailAttempts: email.length,
        emailFallbacks: fallbacks.length,
      };
    }).filter(t => t.whatsappAttempts > 0 || t.emailAttempts > 0);
  }, [attempts]);

  // Error grouping
  const errorGroups = useMemo(() => {
    const failedAttempts = attempts.filter(a => 
      a.channel === 'whatsapp' && 
      (a.status === 'failed' || a.status === 'undelivered') && 
      a.error_message
    );

    const groups: Record<string, ErrorGroup> = {};
    
    failedAttempts.forEach(attempt => {
      const errorCode = attempt.metadata?.twilioStatus || 'UNKNOWN';
      const message = attempt.error_message || 'Unknown error';
      
      if (!groups[errorCode]) {
        groups[errorCode] = {
          errorCode,
          message: message.substring(0, 100),
          count: 0,
          lastOccurrence: attempt.created_at,
        };
      }
      
      groups[errorCode].count++;
      if (attempt.created_at > groups[errorCode].lastOccurrence) {
        groups[errorCode].lastOccurrence = attempt.created_at;
      }
    });

    return Object.values(groups).sort((a, b) => b.count - a.count);
  }, [attempts]);

  // Recent WhatsApp attempts for table
  const recentWhatsAppAttempts = useMemo(() => {
    return attempts
      .filter(a => a.channel === 'whatsapp')
      .slice(0, 30);
  }, [attempts]);

  // WhatsApp status indicator
  const whatsappStatus = useMemo(() => {
    const last24h = attempts.filter(a => 
      a.channel === 'whatsapp' && 
      new Date(a.created_at) > subHours(new Date(), 24)
    );
    
    if (last24h.length === 0) {
      return { status: 'unknown', label: 'No Recent Activity', color: 'text-muted-foreground' };
    }
    
    const successRate = last24h.filter(a => a.status === 'sent' || a.status === 'delivered').length / last24h.length;
    
    if (successRate >= 0.9) {
      return { status: 'healthy', label: 'Operational', color: 'text-green-600' };
    } else if (successRate >= 0.5) {
      return { status: 'degraded', label: 'Degraded', color: 'text-amber-600' };
    } else {
      return { status: 'down', label: 'Issues Detected', color: 'text-red-600' };
    }
  }, [attempts]);

  const anyWhatsAppEnabled = riads.some(r => r.whatsapp_enabled);
  const lastAttempt = attempts.find(a => a.channel === 'whatsapp');
  const twilioBalanceValue = twilioBalance?.balance !== null && twilioBalance?.balance !== undefined
    ? Number(twilioBalance.balance)
    : null;
  const twilioBalanceLabel = twilioBalanceValue !== null && Number.isFinite(twilioBalanceValue)
    ? `${twilioBalanceValue.toFixed(2)} ${twilioBalance?.currency || ''}`.trim()
    : 'Unavailable';

  const getNotificationTypeLabel = (type: string) => {
    switch (type) {
      case 'client_confirmation': return 'Client Confirmation';
      case 'manager_urgent': return 'Manager Urgent';
      case 'client_reminder': return 'Client Reminder';
      case 'manager_new_request': return 'Manager New Request';
      default: return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Sent</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Failed</Badge>;
      case 'undelivered':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Undelivered</Badge>;
      case 'pending':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-600" />
            WhatsApp Monitoring
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor notification delivery and manage WhatsApp settings
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Level 1: Global Status */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Twilio Balance */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Twilio Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <WalletCards className={twilioBalanceError ? 'h-8 w-8 text-amber-600' : 'h-8 w-8 text-primary'} />
              <div>
                <p className={twilioBalanceError ? 'font-semibold text-amber-700' : 'font-semibold text-primary'}>
                  {twilioBalanceError ? 'Unavailable' : twilioBalanceLabel}
                </p>
                <p className="text-xs text-muted-foreground">
                  {twilioBalance?.fetchedAt ? `Updated ${format(parseISO(twilioBalance.fetchedAt), 'HH:mm')}` : 'Live account balance'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Sender Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sender Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {whatsappStatus.status === 'healthy' ? (
                <Signal className="h-8 w-8 text-green-600" />
              ) : whatsappStatus.status === 'degraded' ? (
                <Signal className="h-8 w-8 text-amber-600" />
              ) : whatsappStatus.status === 'down' ? (
                <SignalZero className="h-8 w-8 text-red-600" />
              ) : (
                <Signal className="h-8 w-8 text-muted-foreground" />
              )}
              <div>
                <p className={`font-semibold ${whatsappStatus.color}`}>{whatsappStatus.label}</p>
                <p className="text-xs text-muted-foreground">
                  Based on last 24h activity
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feature Flag Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Feature Flag</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {anyWhatsAppEnabled ? (
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              ) : (
                <XCircle className="h-8 w-8 text-red-600" />
              )}
              <div>
                <p className={`font-semibold ${anyWhatsAppEnabled ? 'text-green-600' : 'text-red-600'}`}>
                  {anyWhatsAppEnabled ? 'Enabled' : 'Disabled'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {riads.filter(r => r.whatsapp_enabled).length} of {riads.length} properties
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Last Check */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Last WhatsApp Attempt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-muted-foreground" />
              <div>
                {lastAttempt ? (
                  <>
                    <p className="font-semibold">
                      {format(parseISO(lastAttempt.created_at), 'PPp')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Status: {lastAttempt.status}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">No attempts yet</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Level 2: Usage Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5" />
            Usage Overview ({timeRange === '24h' ? 'Last 24 Hours' : timeRange === '7d' ? 'Last 7 Days' : 'Last 30 Days'})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="text-center p-4 rounded-lg bg-green-50 border border-green-100">
              <MessageSquare className="h-6 w-6 mx-auto text-green-600 mb-2" />
              <p className="text-2xl font-bold text-green-700">{stats.totalWhatsApp}</p>
              <p className="text-xs text-green-600">WhatsApp Attempts</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-green-50 border border-green-100">
              <CheckCircle2 className="h-6 w-6 mx-auto text-green-600 mb-2" />
              <p className="text-2xl font-bold text-green-700">{stats.whatsappSent}</p>
              <p className="text-xs text-green-600">Successful</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-red-50 border border-red-100">
              <XCircle className="h-6 w-6 mx-auto text-red-600 mb-2" />
              <p className="text-2xl font-bold text-red-700">{stats.whatsappFailed}</p>
              <p className="text-xs text-red-600">Failed</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-blue-50 border border-blue-100">
              <Mail className="h-6 w-6 mx-auto text-blue-600 mb-2" />
              <p className="text-2xl font-bold text-blue-700">{stats.emailFallbacks}</p>
              <p className="text-xs text-blue-600">Email Fallbacks</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-amber-50 border border-amber-100">
              <AlertTriangle className="h-6 w-6 mx-auto text-amber-600 mb-2" />
              <p className="text-2xl font-bold text-amber-700">{stats.fallbackRate}%</p>
              <p className="text-xs text-amber-600">Fallback Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown by Type */}
      {typeBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="h-5 w-5" />
              Breakdown by Notification Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Type</th>
                    <th className="text-center py-2 font-medium">WhatsApp Attempts</th>
                    <th className="text-center py-2 font-medium">WhatsApp Success</th>
                    <th className="text-center py-2 font-medium">Email Total</th>
                    <th className="text-center py-2 font-medium">Email Fallbacks</th>
                  </tr>
                </thead>
                <tbody>
                  {typeBreakdown.map(row => (
                    <tr key={row.type} className="border-b last:border-0">
                      <td className="py-3">{row.label}</td>
                      <td className="text-center py-3">
                        <Badge variant="outline" className="bg-green-50">{row.whatsappAttempts}</Badge>
                      </td>
                      <td className="text-center py-3">
                        <Badge variant="outline" className="bg-green-100 text-green-700">{row.whatsappSuccess}</Badge>
                      </td>
                      <td className="text-center py-3">
                        <Badge variant="outline" className="bg-blue-50">{row.emailAttempts}</Badge>
                      </td>
                      <td className="text-center py-3">
                        <Badge variant="outline" className="bg-amber-100 text-amber-700">{row.emailFallbacks}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent WhatsApp Attempts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5" />
            Recent WhatsApp Attempts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentWhatsAppAttempts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No WhatsApp attempts in selected time range</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Time</th>
                    <th className="text-left py-2 font-medium">Type</th>
                    <th className="text-left py-2 font-medium">Status</th>
                    <th className="text-left py-2 font-medium">Fallback?</th>
                    <th className="text-left py-2 font-medium">Template</th>
                  </tr>
                </thead>
                <tbody>
                  {recentWhatsAppAttempts.map(attempt => (
                    <tr key={attempt.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 text-muted-foreground">
                        {format(parseISO(attempt.created_at), 'MMM d, HH:mm')}
                      </td>
                      <td className="py-3">
                        {getNotificationTypeLabel(attempt.notification_type)}
                      </td>
                      <td className="py-3">
                        {getStatusBadge(attempt.status)}
                      </td>
                      <td className="py-3">
                        {attempt.is_fallback ? (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700">Yes</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 text-xs text-muted-foreground font-mono">
                        {attempt.metadata?.templateKey || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Summary */}
      {errorGroups.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Recent Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {errorGroups.map(group => (
                <div key={group.errorCode} className="p-3 rounded-lg bg-red-50 border border-red-100">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-red-800">
                        {group.errorCode}
                      </p>
                      <p className="text-sm text-red-600 truncate">
                        {group.message}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <Badge className="bg-red-100 text-red-800 border-red-200">
                        {group.count} occurrences
                      </Badge>
                      <p className="text-xs text-red-500 mt-1">
                        Last: {format(parseISO(group.lastOccurrence), 'MMM d, HH:mm')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* WhatsApp Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building className="h-5 w-5" />
            WhatsApp Enable/Disable by Property
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            When disabled, all notifications will be sent via email only. No redeployment required.
          </p>
          <div className="space-y-3">
            {riads.map(riad => (
              <div 
                key={riad.id} 
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  riad.whatsapp_enabled ? 'bg-green-50 border-green-200' : 'bg-muted/50 border-border'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Building className={`h-5 w-5 ${riad.whatsapp_enabled ? 'text-green-600' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="font-medium">{riad.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {riad.whatsapp_enabled ? 'WhatsApp enabled' : 'Email only'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isTogglingWhatsApp === riad.id && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  <Switch
                    checked={riad.whatsapp_enabled}
                    onCheckedChange={() => handleToggleWhatsApp(riad.id, riad.whatsapp_enabled)}
                    disabled={isTogglingWhatsApp !== null}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
