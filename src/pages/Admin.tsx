import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Search, UserCog, Shield } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface Riad {
  id: string;
  name: string;
}

interface FoundUser {
  id: string;
  email: string;
  role: AppRole;
  assignedRiads: string[];
}

export default function Admin() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isSuperAdmin } = useAuth();
  const { t } = useLanguage();
  
  const [searchEmail, setSearchEmail] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
  const [riads, setRiads] = useState<Riad[]>([]);
  const [selectedRole, setSelectedRole] = useState<AppRole>('pending');
  const [selectedRiads, setSelectedRiads] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && !isSuperAdmin) {
      navigate('/backoffice');
    }
  }, [user, authLoading, isSuperAdmin, navigate]);

  useEffect(() => {
    fetchRiads();
  }, []);

  async function fetchRiads() {
    const { data, error } = await supabase
      .from('riads')
      .select('id, name')
      .order('name');
    
    if (!error && data) {
      setRiads(data);
    }
  }

  async function handleSearch() {
    if (!searchEmail.trim()) return;
    
    setIsSearching(true);
    setFoundUser(null);
    
    try {
      // Search for user by email in auth.users via RPC or direct query
      // Since we can't query auth.users directly, we'll search user_roles and match
      const { data: allRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      
      if (rolesError) throw rolesError;

      // We need to find user by email - this requires an edge function or admin API
      // For now, let's check if we can match by looking up user_riads
      const { data: userData, error: userError } = await supabase.rpc('get_user_by_email', {
        email_input: searchEmail.trim().toLowerCase()
      });

      if (userError) {
        // Function doesn't exist yet, show helpful message
        toast.error('User search requires backend setup');
        return;
      }

      if (!userData || userData.length === 0) {
        toast.error(t('admin_user_not_found'));
        return;
      }

      const userId = userData[0].id;
      const userEmail = userData[0].email;

      // Get user's current role
      const roleData = allRoles?.find(r => r.user_id === userId);
      
      // Get user's assigned riads
      const { data: userRiads } = await supabase
        .from('user_riads')
        .select('riad_id')
        .eq('user_id', userId);

      const foundUserData: FoundUser = {
        id: userId,
        email: userEmail,
        role: (roleData?.role as AppRole) || 'pending',
        assignedRiads: userRiads?.map(r => r.riad_id) || []
      };

      setFoundUser(foundUserData);
      setSelectedRole(foundUserData.role);
      setSelectedRiads(foundUserData.assignedRiads);
      
    } catch (error) {
      console.error('Search error:', error);
      toast.error(t('admin_user_not_found'));
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSave() {
    if (!foundUser) return;
    
    setIsSaving(true);
    
    try {
      // Update role
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: foundUser.id,
          role: selectedRole
        }, {
          onConflict: 'user_id'
        });

      if (roleError) throw roleError;

      // Update riad assignments
      // First, remove all existing assignments
      await supabase
        .from('user_riads')
        .delete()
        .eq('user_id', foundUser.id);

      // Then add new assignments
      if (selectedRiads.length > 0) {
        const { error: riadsError } = await supabase
          .from('user_riads')
          .insert(
            selectedRiads.map(riadId => ({
              user_id: foundUser.id,
              riad_id: riadId
            }))
          );

        if (riadsError) throw riadsError;
      }

      toast.success(t('save'));
      
      // Update local state
      setFoundUser({
        ...foundUser,
        role: selectedRole,
        assignedRiads: selectedRiads
      });
      
    } catch (error) {
      console.error('Save error:', error);
      toast.error(t('error'));
    } finally {
      setIsSaving(false);
    }
  }

  function toggleRiad(riadId: string) {
    setSelectedRiads(prev => 
      prev.includes(riadId)
        ? prev.filter(id => id !== riadId)
        : [...prev, riadId]
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/backoffice')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold">{t('admin_users')}</h1>
              <p className="text-xs text-muted-foreground">Super Admin</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container max-w-2xl mx-auto px-4 py-6">
        {/* Search Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Search className="h-5 w-5" />
              {t('admin_find_user')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                type="email"
                placeholder={t('email')}
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t('admin_search')
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* User Management Section */}
        {foundUser && (
          <Card className="animate-fade-up">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserCog className="h-5 w-5" />
                {foundUser.email}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Role Selection */}
              <div className="space-y-2">
                <Label>{t('admin_assign_role')}</Label>
                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{t('admin_role_pending')}</SelectItem>
                    <SelectItem value="manager">{t('admin_role_manager')}</SelectItem>
                    <SelectItem value="super_admin">{t('admin_role_super_admin')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Riad Assignment */}
              <div className="space-y-3">
                <Label>{t('admin_assign_riads')}</Label>
                <div className="grid gap-2 max-h-60 overflow-y-auto p-1">
                  {riads.map(riad => (
                    <label
                      key={riad.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selectedRiads.includes(riad.id)}
                        onCheckedChange={() => toggleRiad(riad.id)}
                      />
                      <span className="text-sm font-medium">{riad.name}</span>
                    </label>
                  ))}
                  {riads.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No riads available
                    </p>
                  )}
                </div>
              </div>

              {/* Save Button */}
              <Button 
                onClick={handleSave} 
                disabled={isSaving}
                className="w-full"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {t('admin_save_changes')}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
