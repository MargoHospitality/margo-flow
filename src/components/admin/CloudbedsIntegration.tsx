import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Cloud, CheckCircle2, XCircle, RefreshCw, Building, Key, Clock, AlertTriangle, Webhook, Database, Play, Power, Calendar, ChevronDown, ChevronRight, Search } from 'lucide-react';
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

export default function CloudbedsIntegration() {
  const [isChecking, setIsChecking] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [isTogglingSync, setIsTogglingSync] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<CloudbedsCheckResult | null>(null);
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null);
  const [webhookTestResult, setWebhookTestResult] = useState<string | null>(null);
  const [propertySyncStatus, setPropertySyncStatus] = useState<PropertySyncStatus[]>([]);
  const [expandedProperties, setExpandedProperties] = useState<Set<string>>(new Set());
  const [propertySearch, setPropertySearch] = useState('');

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cloudbeds-webhook`;

  useEffect(() => {
    fetchOperationsData();
  }, []);

  const fetchOperationsData = async () => {
    const { data: riads } = await supabase
      .from('riads')
      .select('id, name, cloudbeds_property_id, cloudbeds_sync_enabled')
      .not('cloudbeds_property_id', 'is', null);

    if (riads) {
      const statusPromises = riads.map(async (riad) => {
        const { data: scheduledRun } = await supabase
          .from('cloudbeds_sync_runs')
          .select('*')
          .eq('property_id', riad.cloudbeds_property_id)
          .eq('run_type', 'scheduled')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

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
        fetchOperationsData();
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

  const formatShortDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

  const getRunStatusIcon = (run: SyncRun | null) => {
    if (!run) return <span className="text-muted-foreground">—</span>;
    if (run.status === 'completed') return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    if (run.status === 'failed') return <XCircle className="h-3 w-3 text-destructive" />;
    return <Clock className="h-3 w-3 text-muted-foreground" />;
  };

  const toggleExpanded = (propertyId: string) => {
    setExpandedProperties(prev => {
      const next = new Set(prev);
      if (next.has(propertyId)) {
        next.delete(propertyId);
      } else {
        next.add(propertyId);
      }
      return next;
    });
  };

  const filteredProperties = propertySyncStatus.filter(p => 
    p.name.toLowerCase().includes(propertySearch.toLowerCase()) ||
    p.cloudbeds_property_id.toLowerCase().includes(propertySearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* 1. Cloudbeds Integration Status */}
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          </div>

          {checkResult?.errorMessage && (
            <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/50 bg-destructive/10">
              <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Error Details</p>
                <p className="text-sm text-muted-foreground">{checkResult.errorMessage}</p>
              </div>
            </div>
          )}

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

      {/* 2. Property Sync Control */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5" />
                Property Sync Control
              </CardTitle>
              <CardDescription>
                Enable or disable Cloudbeds synchronization per property
              </CardDescription>
            </div>
            <Button
              onClick={runReconciliation}
              disabled={isReconciling || propertySyncStatus.filter(p => p.cloudbeds_sync_enabled).length === 0}
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
        </CardHeader>
        <CardContent className="space-y-4">
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

          {/* Search */}
          {propertySyncStatus.length > 5 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search properties..."
                value={propertySearch}
                onChange={(e) => setPropertySearch(e.target.value)}
                className="pl-9"
              />
            </div>
          )}

          {filteredProperties.length === 0 ? (
            <p className="text-sm text-muted-foreground">No properties with Cloudbeds integration configured.</p>
          ) : (
            <div className="space-y-2">
              {filteredProperties.map((property) => (
                <Collapsible
                  key={property.id}
                  open={expandedProperties.has(property.id)}
                  onOpenChange={() => toggleExpanded(property.id)}
                >
                  <div className="border rounded-lg bg-card overflow-hidden">
                    {/* Compact Row */}
                    <div className="flex items-center gap-4 p-3">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="p-0 h-auto">
                          {expandedProperties.has(property.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>

                      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
                        <div className="sm:col-span-2">
                          <p className="font-medium text-sm truncate">{property.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{property.cloudbeds_property_id}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground hidden sm:inline">Scheduled:</span>
                          <span className="flex items-center gap-1">
                            {getRunStatusIcon(property.lastScheduledRun)}
                            <span className="text-xs text-muted-foreground">
                              {property.lastScheduledRun ? formatShortDateTime(property.lastScheduledRun.started_at) : '—'}
                            </span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground hidden sm:inline">Manual:</span>
                          <span className="flex items-center gap-1">
                            {getRunStatusIcon(property.lastManualRun)}
                            <span className="text-xs text-muted-foreground">
                              {property.lastManualRun ? formatShortDateTime(property.lastManualRun.started_at) : '—'}
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={property.cloudbeds_sync_enabled}
                            onCheckedChange={() => togglePropertySync(property.id, property.cloudbeds_sync_enabled)}
                            disabled={isTogglingSync === property.id}
                          />
                          <Badge variant={property.cloudbeds_sync_enabled ? 'default' : 'secondary'} className="text-xs">
                            {property.cloudbeds_sync_enabled ? 'ON' : 'OFF'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    <CollapsibleContent>
                      <div className="border-t p-4 bg-muted/30 space-y-4">
                        <div className={`p-3 rounded-lg text-sm ${property.cloudbeds_sync_enabled ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800' : 'bg-muted/50 border border-muted'}`}>
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

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="p-3 rounded-lg border bg-card">
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

                          <div className="p-3 rounded-lg border bg-card">
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
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}

          {propertySyncStatus.filter(p => p.cloudbeds_sync_enabled).length === 0 && propertySyncStatus.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-amber-800 dark:text-amber-200">
                Manual reconciliation is disabled because no properties have Cloudbeds sync enabled.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Webhook Configuration */}
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

          <div className="p-4 rounded-lg border bg-card">
            <p className="text-sm font-medium mb-2">Required Cloudbeds Events</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <code className="bg-muted px-1 rounded">reservation.created</code></li>
              <li>• <code className="bg-muted px-1 rounded">reservation.updated</code></li>
              <li>• <code className="bg-muted px-1 rounded">reservation.cancelled</code></li>
            </ul>
          </div>

          {webhookTestResult && (
            <div className={`p-3 rounded-lg text-sm ${webhookTestResult.startsWith('✅') ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800' : 'bg-destructive/10 border border-destructive/30'}`}>
              {webhookTestResult}
            </div>
          )}

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

      {/* Info Cards */}
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
    </div>
  );
}
