import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Loader2, Cloud, CheckCircle2, XCircle, RefreshCw, Building, Key, Clock, AlertTriangle, Webhook, Database, Play, Power, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CloudbedsCheckResult {
  status: 'ok' | 'error';
  authMethod: 'api_key' | 'oauth' | 'unknown';
  lastCheck: string;
  propertiesCount: number;
  riadMassibaFound: boolean;
  riadMassibaPropertyId: string | null;
  errorMessage?: string;
}

interface PropertyResult {
  property_id: string;
  property_name: string;
  success: boolean;
  reservations_processed: number;
  reservations_created: number;
  reservations_updated: number;
  transport_requests_cancelled: number;
  error?: string;
}

interface ReconcileResult {
  success: boolean;
  run_type: 'manual' | 'scheduled';
  properties_processed: number;
  properties_skipped: number;
  results: PropertyResult[];
  error?: string;
}

interface WebhookLog {
  id: string;
  property_id: string;
  reservation_id: string | null;
  event_type: string;
  processed: boolean;
  created_at: string;
}

interface SyncRun {
  id: string;
  property_id: string;
  run_type: string;
  status: string;
  reservations_processed: number | null;
  reservations_created: number | null;
  reservations_updated: number | null;
  transport_requests_cancelled: number | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

interface PropertySyncStatus {
  id: string;
  name: string;
  cloudbeds_property_id: string;
  cloudbeds_sync_enabled: boolean;
  lastScheduledRun: SyncRun | null;
  lastManualRun: SyncRun | null;
}

// Removed MASSIBA_PROPERTY_ID - sync now driven by cloudbeds_sync_enabled toggle per property

export default function CloudbedsIntegration() {
  const [isChecking, setIsChecking] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [isTogglingSync, setIsTogglingSync] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<CloudbedsCheckResult | null>(null);
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null);
  const [lastWebhook, setLastWebhook] = useState<WebhookLog | null>(null);
  const [webhookTestResult, setWebhookTestResult] = useState<string | null>(null);
  const [propertySyncStatus, setPropertySyncStatus] = useState<PropertySyncStatus[]>([]);

  // Webhook endpoint URL (for display and configuration)
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cloudbeds-webhook`;

  useEffect(() => {
    fetchOperationsData();
  }, []);

  const fetchOperationsData = async () => {
    // Fetch last webhook
    const { data: webhookData } = await supabase
      .from('cloudbeds_webhook_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (webhookData) {
      setLastWebhook(webhookData as WebhookLog);
    }

    // Fetch properties with Cloudbeds integration
    const { data: riads } = await supabase
      .from('riads')
      .select('id, name, cloudbeds_property_id, cloudbeds_sync_enabled')
      .not('cloudbeds_property_id', 'is', null);

    if (riads) {
      const statusPromises = riads.map(async (riad) => {
        // Fetch last scheduled run
        const { data: scheduledRun } = await supabase
          .from('cloudbeds_sync_runs')
          .select('*')
          .eq('property_id', riad.cloudbeds_property_id)
          .eq('run_type', 'scheduled')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Fetch last manual run
        const { data: manualRun } = await supabase
          .from('cloudbeds_sync_runs')
          .select('*')
          .eq('property_id', riad.cloudbeds_property_id)
          .eq('run_type', 'manual')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          id: riad.id,
          name: riad.name,
          cloudbeds_property_id: riad.cloudbeds_property_id!,
          cloudbeds_sync_enabled: riad.cloudbeds_sync_enabled ?? false,
          lastScheduledRun: scheduledRun as SyncRun | null,
          lastManualRun: manualRun as SyncRun | null,
        };
      });

      const statuses = await Promise.all(statusPromises);
      setPropertySyncStatus(statuses);
    }
  };

  const togglePropertySync = async (propertyId: string, currentEnabled: boolean) => {
    setIsTogglingSync(propertyId);
    try {
      const { error } = await supabase
        .from('riads')
        .update({ cloudbeds_sync_enabled: !currentEnabled })
        .eq('id', propertyId);

      if (error) throw error;

      // Update local state
      setPropertySyncStatus(prev => 
        prev.map(p => 
          p.id === propertyId 
            ? { ...p, cloudbeds_sync_enabled: !currentEnabled }
            : p
        )
      );

      toast.success(`Cloudbeds sync ${!currentEnabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to toggle sync:', error);
      toast.error('Failed to update sync status');
    } finally {
      setIsTogglingSync(null);
    }
  };

  const runConnectivityCheck = async () => {
    setIsChecking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cloudbeds-check`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Connectivity check failed');
      }

      const result: CloudbedsCheckResult = await response.json();
      setCheckResult(result);

      if (result.status === 'ok') {
        toast.success('Connectivity check completed successfully');
      } else {
        toast.error(result.errorMessage || 'Connectivity check failed');
      }
    } catch (error) {
      console.error('Cloudbeds check error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to run connectivity check');
    } finally {
      setIsChecking(false);
    }
  };

  const runReconciliation = async () => {
    // Check if at least one property has sync enabled
    const enabledProperties = propertySyncStatus.filter(p => p.cloudbeds_sync_enabled);
    if (enabledProperties.length === 0) {
      toast.error('No properties have Cloudbeds sync enabled. Enable sync for at least one property.');
      return;
    }

    setIsReconciling(true);
    setReconcileResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cloudbeds-reconcile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Reconciliation failed');
      }

      const result: ReconcileResult = await response.json();
      setReconcileResult(result);

      if (result.success) {
        const totalReservations = result.results.reduce((sum, r) => sum + r.reservations_processed, 0);
        toast.success(`Reconciliation completed: ${result.properties_processed} properties, ${totalReservations} reservations processed`);
        fetchOperationsData(); // Refresh operations data
      } else {
        toast.error(result.error || 'Reconciliation failed');
      }
    } catch (error) {
      console.error('Reconciliation error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to run reconciliation');
    } finally {
      setIsReconciling(false);
    }
  };

  const testWebhookEndpoint = async () => {
    setIsTestingWebhook(true);
    setWebhookTestResult(null);
    try {
      const response = await fetch(webhookUrl, { method: 'GET' });
      const data = await response.json();
      
      if (response.ok) {
        setWebhookTestResult(`✅ Endpoint reachable: ${data.message}`);
        toast.success('Webhook endpoint is reachable!');
      } else {
        setWebhookTestResult(`❌ Error: ${response.status} - ${JSON.stringify(data)}`);
        toast.error('Webhook endpoint returned an error');
      }
    } catch (error) {
      setWebhookTestResult(`❌ Failed to reach endpoint: ${error}`);
      toast.error('Failed to reach webhook endpoint');
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const formatDateTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
    }
  };

  const getAuthMethodLabel = (method: string) => {
    switch (method) {
      case 'api_key':
        return 'API Key';
      case 'oauth':
        return 'OAuth 2.0';
      default:
        return 'Unknown';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-600">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'running':
        return <Badge variant="secondary">Running</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Cloud className="h-5 w-5" />
            Cloudbeds Integration Status
          </CardTitle>
          <CardDescription>
            Connectivity and health checks for Cloudbeds API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* API Status */}
            <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
              <div className="p-2 rounded-full bg-muted">
                {checkResult?.status === 'ok' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : checkResult?.status === 'error' ? (
                  <XCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <Cloud className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-muted-foreground">API Status</p>
                <p className="text-lg font-semibold">
                  {checkResult ? (
                    <Badge variant={checkResult.status === 'ok' ? 'default' : 'destructive'}>
                      {checkResult.status === 'ok' ? 'OK' : 'Error'}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">Not checked</span>
                  )}
                </p>
              </div>
            </div>

            {/* Auth Method */}
            <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
              <div className="p-2 rounded-full bg-muted">
                <Key className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Authentication</p>
                <p className="text-lg font-semibold">
                  {checkResult ? getAuthMethodLabel(checkResult.authMethod) : 'Unknown'}
                </p>
              </div>
            </div>

            {/* Last Check */}
            <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
              <div className="p-2 rounded-full bg-muted">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Last Check</p>
                <p className="text-sm font-semibold truncate">
                  {checkResult ? formatDateTime(checkResult.lastCheck) : 'Never'}
                </p>
              </div>
            </div>

            {/* Properties Count */}
            <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
              <div className="p-2 rounded-full bg-muted">
                <Building className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Properties Accessible</p>
                <p className="text-lg font-semibold">
                  {checkResult ? checkResult.propertiesCount : '-'}
                </p>
              </div>
            </div>

            {/* Riad Massiba Status */}
            <div className="flex items-start gap-3 p-4 rounded-lg border bg-card sm:col-span-2 lg:col-span-2">
              <div className="p-2 rounded-full bg-muted">
                {checkResult?.riadMassibaFound ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : checkResult && !checkResult.riadMassibaFound ? (
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                ) : (
                  <Building className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Riad Massiba</p>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold">
                    {checkResult ? (
                      <Badge variant={checkResult.riadMassibaFound ? 'default' : 'secondary'}>
                        {checkResult.riadMassibaFound ? 'Found' : 'Not found'}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">Not checked</span>
                    )}
                  </p>
                  {checkResult?.riadMassibaPropertyId && (
                    <span className="text-xs text-muted-foreground">
                      (ID: {checkResult.riadMassibaPropertyId})
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {checkResult?.errorMessage && (
            <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/50 bg-destructive/10">
              <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Error Details</p>
                <p className="text-sm text-muted-foreground">{checkResult.errorMessage}</p>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={runConnectivityCheck}
              disabled={isChecking}
              className="gap-2"
            >
              {isChecking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Run Connectivity Check
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Configuration Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Webhook className="h-5 w-5" />
            Webhook Configuration
          </CardTitle>
          <CardDescription>
            Configure this URL in Cloudbeds to receive real-time reservation updates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Webhook URL */}
          <div className="p-4 rounded-lg border bg-muted/30">
            <p className="text-sm font-medium mb-2">Webhook Endpoint URL</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-background rounded text-sm font-mono break-all border">
                {webhookUrl}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(webhookUrl)}
              >
                Copy
              </Button>
            </div>
          </div>

          {/* Required Events */}
          <div className="p-4 rounded-lg border bg-card">
            <p className="text-sm font-medium mb-2">Required Cloudbeds Events</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <code className="bg-muted px-1 rounded">reservation.created</code></li>
              <li>• <code className="bg-muted px-1 rounded">reservation.updated</code></li>
              <li>• <code className="bg-muted px-1 rounded">reservation.cancelled</code></li>
            </ul>
          </div>

          {/* Test Result */}
          {webhookTestResult && (
            <div className={`p-3 rounded-lg text-sm ${webhookTestResult.startsWith('✅') ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800' : 'bg-destructive/10 border border-destructive/30'}`}>
              {webhookTestResult}
            </div>
          )}

          {/* Test Button */}
          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              onClick={testWebhookEndpoint}
              disabled={isTestingWebhook}
              className="gap-2"
            >
              {isTestingWebhook ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Test Endpoint Reachability
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Property Sync Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="h-5 w-5" />
            Property Sync Control
          </CardTitle>
          <CardDescription>
            Enable or disable Cloudbeds synchronization per property
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {propertySyncStatus.length === 0 ? (
            <p className="text-sm text-muted-foreground">No properties with Cloudbeds integration configured.</p>
          ) : (
            <div className="space-y-4">
              {propertySyncStatus.map((property) => (
                <div key={property.id} className="p-4 rounded-lg border bg-card">
                  {/* Property Header with Toggle */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Building className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">{property.name}</p>
                        <p className="text-xs text-muted-foreground">Property ID: {property.cloudbeds_property_id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {property.cloudbeds_sync_enabled ? 'Sync ON' : 'Sync OFF'}
                        </span>
                        <Switch
                          checked={property.cloudbeds_sync_enabled}
                          onCheckedChange={() => togglePropertySync(property.id, property.cloudbeds_sync_enabled)}
                          disabled={isTogglingSync === property.id}
                        />
                      </div>
                      <Badge variant={property.cloudbeds_sync_enabled ? 'default' : 'secondary'}>
                        {property.cloudbeds_sync_enabled ? (
                          <><Power className="h-3 w-3 mr-1" /> Active</>
                        ) : (
                          <><Power className="h-3 w-3 mr-1" /> Disabled</>
                        )}
                      </Badge>
                    </div>
                  </div>

                  {/* Sync Status Description */}
                  <div className={`p-3 rounded-lg text-sm mb-4 ${property.cloudbeds_sync_enabled ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800' : 'bg-muted/50 border border-muted'}`}>
                    {property.cloudbeds_sync_enabled ? (
                      <ul className="space-y-1 text-muted-foreground">
                        <li>✓ Cloudbeds webhooks are processed</li>
                        <li>✓ Scheduled reconciliation is active (08:00 & 20:00 daily)</li>
                        <li>✓ Manual reconciliation is allowed</li>
                      </ul>
                    ) : (
                      <ul className="space-y-1 text-muted-foreground">
                        <li>✗ Cloudbeds webhooks are ignored</li>
                        <li>✗ Scheduled reconciliation is disabled</li>
                        <li>✗ Manual reconciliation is blocked</li>
                      </ul>
                    )}
                  </div>

                  {/* Last Runs Grid */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Last Scheduled Run */}
                    <div className="p-3 rounded-lg border bg-muted/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Last Scheduled Run</span>
                      </div>
                      {property.lastScheduledRun ? (
                        <div className="space-y-1 text-sm">
                          <p><span className="text-muted-foreground">Time:</span> {formatDateTime(property.lastScheduledRun.started_at)}</p>
                          <p><span className="text-muted-foreground">Processed:</span> {property.lastScheduledRun.reservations_processed ?? 0} reservations</p>
                          <div className="mt-2">{getStatusBadge(property.lastScheduledRun.status)}</div>
                          {property.lastScheduledRun.error_message && (
                            <p className="text-xs text-destructive mt-1">{property.lastScheduledRun.error_message}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No scheduled runs yet</p>
                      )}
                    </div>

                    {/* Last Manual Run */}
                    <div className="p-3 rounded-lg border bg-muted/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Play className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Last Manual Run</span>
                      </div>
                      {property.lastManualRun ? (
                        <div className="space-y-1 text-sm">
                          <p><span className="text-muted-foreground">Time:</span> {formatDateTime(property.lastManualRun.started_at)}</p>
                          <p><span className="text-muted-foreground">Processed:</span> {property.lastManualRun.reservations_processed ?? 0} reservations</p>
                          <div className="mt-2">{getStatusBadge(property.lastManualRun.status)}</div>
                          {property.lastManualRun.error_message && (
                            <p className="text-xs text-destructive mt-1">{property.lastManualRun.error_message}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No manual runs yet</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Operations Panel - Massiba Only */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Play className="h-5 w-5" />
            Manual Operations (Massiba)
          </CardTitle>
          <CardDescription>
            Run manual reconciliation and view recent webhook activity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Last Webhook */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-3">
              <Webhook className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Last Webhook Received</span>
            </div>
            {lastWebhook ? (
              <div className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Time:</span> {formatDateTime(lastWebhook.created_at)}</p>
                <p><span className="text-muted-foreground">Event:</span> {lastWebhook.event_type}</p>
                <p><span className="text-muted-foreground">Property:</span> {lastWebhook.property_id}</p>
                <p><span className="text-muted-foreground">Reservation:</span> {lastWebhook.reservation_id || 'N/A'}</p>
                <Badge variant={lastWebhook.processed ? 'default' : 'secondary'} className="mt-2">
                  {lastWebhook.processed ? 'Processed' : 'Pending'}
                </Badge>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No webhooks received yet</p>
            )}
          </div>

          {/* Reconcile Result */}
          {reconcileResult && (
            <div className={`flex items-start gap-3 p-4 rounded-lg border ${reconcileResult.success ? 'border-green-500/50 bg-green-50 dark:bg-green-950/20' : 'border-destructive/50 bg-destructive/10'}`}>
              {reconcileResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              )}
              <div className="text-sm">
                <p className="font-medium">{reconcileResult.success ? 'Reconciliation Completed' : 'Reconciliation Failed'}</p>
                {reconcileResult.success ? (
                  <ul className="mt-1 text-muted-foreground">
                    <li>Properties processed: {reconcileResult.properties_processed}</li>
                    {reconcileResult.results.map((r, idx) => (
                      <li key={idx} className="ml-4">
                        {r.property_name}: {r.reservations_processed} reservations ({r.reservations_created} created, {r.reservations_updated} updated)
                        {r.transport_requests_cancelled > 0 && `, ${r.transport_requests_cancelled} transport cancelled`}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">{reconcileResult.error}</p>
                )}
              </div>
            </div>
          )}

          {/* Manual Action */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={runReconciliation}
              disabled={isReconciling || propertySyncStatus.filter(p => p.cloudbeds_sync_enabled).length === 0}
              variant="outline"
              className="gap-2"
            >
              {isReconciling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Manual Reconciliation
                </>
              )}
            </Button>
          </div>

          {/* Disabled warning */}
          {propertySyncStatus.filter(p => p.cloudbeds_sync_enabled).length === 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-amber-800 dark:text-amber-200">
                Manual reconciliation is disabled because no properties have Cloudbeds sync enabled.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scheduled Reconciliation Info */}
      <Card className="border-muted">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-muted shrink-0">
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Scheduled Reconciliation</p>
              <p>
                When Cloudbeds sync is enabled, automatic reconciliation runs at <strong>08:00</strong> and <strong>20:00</strong> daily.
                This syncs all reservations from Cloudbeds and applies cancellation/date-change rules to transport requests.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-muted">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-muted shrink-0">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">About this module</p>
              <p>
                This module provides Cloudbeds integration for all properties with sync enabled.
                The sync toggle controls webhooks, scheduled reconciliation, and manual reconciliation independently per property.
                API credentials are stored securely and never exposed in the UI.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
