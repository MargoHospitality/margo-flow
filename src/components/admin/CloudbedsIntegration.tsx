import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Cloud, CheckCircle2, XCircle, RefreshCw, Building, Key, Clock, AlertTriangle } from 'lucide-react';
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

export default function CloudbedsIntegration() {
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<CloudbedsCheckResult | null>(null);

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
                This module provides visibility on Cloudbeds API connectivity only. 
                API credentials are stored securely and never exposed in the UI. 
                Full synchronization features will be enabled once connectivity is confirmed.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
