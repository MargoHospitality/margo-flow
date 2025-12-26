import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Search, UserCog, Shield, UserPlus, Users, Building, Truck, MapPin } from 'lucide-react';
import margoflowLogo from '@/assets/margoflow-logo.png';
import type { Database } from '@/integrations/supabase/types';

type AppRole = 'manager' | 'super_admin';

interface Riad {
  id: string;
  name: string;
  cloudbeds_property_id: string | null;
  manager_email: string | null;
  manager_whatsapp: string | null;
  is_active: boolean;
}

interface TransportOffer {
  id: string;
  name: string;
  name_fr: string | null;
  type: string;
  default_day_price: number;
  default_night_price: number;
  default_base_pax: number;
  default_extra_pax_price: number;
  default_payment_mode: string;
  is_active: boolean;
}

interface UserData {
  id: string;
  email: string;
  fullName: string | null;
  isActive: boolean;
  role: AppRole;
  riadIds: string[];
}

export default function Admin() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isSuperAdmin } = useAuth();
  const { t } = useLanguage();
  
  const [activeTab, setActiveTab] = useState('users');
  
  // Users state
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [editRole, setEditRole] = useState<AppRole>('manager');
  const [editFullName, setEditFullName] = useState('');
  const [editRiads, setEditRiads] = useState<string[]>([]);
  const [isSavingUser, setIsSavingUser] = useState(false);
  
  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteRole, setInviteRole] = useState<AppRole>('manager');
  const [inviteRiads, setInviteRiads] = useState<string[]>([]);
  const [isInviting, setIsInviting] = useState(false);
  
  // Riads state
  const [riads, setRiads] = useState<Riad[]>([]);
  const [isLoadingRiads, setIsLoadingRiads] = useState(false);
  const [editingRiad, setEditingRiad] = useState<Riad | null>(null);
  const [newRiad, setNewRiad] = useState({ name: '', cloudbeds_property_id: '', manager_email: '', manager_whatsapp: '' });
  const [isSavingRiad, setIsSavingRiad] = useState(false);
  
  // Transport offers state
  const [offers, setOffers] = useState<TransportOffer[]>([]);
  const [isLoadingOffers, setIsLoadingOffers] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && !isSuperAdmin) {
      navigate('/backoffice');
    }
  }, [user, authLoading, isSuperAdmin, navigate]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchRiads();
      fetchUsers();
      fetchOffers();
    }
  }, [isSuperAdmin]);

  async function getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    };
  }

  async function fetchUsers() {
    setIsLoadingUsers(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-search-user`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ action: 'list' })
        }
      );
      const result = await response.json();
      if (result.users) {
        setUsers(result.users);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  }

  async function fetchRiads() {
    setIsLoadingRiads(true);
    try {
      const { data, error } = await supabase
        .from('riads')
        .select('*')
        .order('name');
      
      if (!error && data) {
        setRiads(data as Riad[]);
      }
    } catch (error) {
      console.error('Error fetching riads:', error);
    } finally {
      setIsLoadingRiads(false);
    }
  }

  async function fetchOffers() {
    setIsLoadingOffers(true);
    try {
      const { data, error } = await supabase
        .from('transport_offers')
        .select('*')
        .order('name');
      
      if (!error && data) {
        setOffers(data as TransportOffer[]);
      }
    } catch (error) {
      console.error('Error fetching offers:', error);
    } finally {
      setIsLoadingOffers(false);
    }
  }

  async function handleInviteUser() {
    if (!inviteEmail.trim()) {
      toast.error('Email is required');
      return;
    }

    setIsInviting(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-search-user`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'invite',
            email: inviteEmail.trim().toLowerCase(),
            fullName: inviteFullName.trim() || null,
            role: inviteRole,
            riadIds: inviteRiads
          })
        }
      );
      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Failed to invite user');
        return;
      }

      toast.success('Invitation sent successfully');
      setInviteEmail('');
      setInviteFullName('');
      setInviteRole('manager');
      setInviteRiads([]);
      fetchUsers();
    } catch (error) {
      console.error('Invite error:', error);
      toast.error('Failed to invite user');
    } finally {
      setIsInviting(false);
    }
  }

  async function handleSelectUser(userData: UserData) {
    setSelectedUser(userData);
    setEditRole(userData.role);
    setEditFullName(userData.fullName || '');
    setEditRiads(userData.riadIds);
  }

  async function handleSaveUser() {
    if (!selectedUser) return;

    setIsSavingUser(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-search-user`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'update',
            userId: selectedUser.id,
            fullName: editFullName.trim() || null,
            role: editRole,
            riadIds: editRiads
          })
        }
      );
      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Failed to update user');
        return;
      }

      toast.success('User updated successfully');
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to update user');
    } finally {
      setIsSavingUser(false);
    }
  }

  async function handleDeactivateUser(userId: string, isActive: boolean) {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-search-user`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: isActive ? 'deactivate' : 'reactivate',
            userId
          })
        }
      );

      if (!response.ok) {
        toast.error('Failed to update user status');
        return;
      }

      toast.success(isActive ? 'User deactivated' : 'User reactivated');
      fetchUsers();
    } catch (error) {
      console.error('Deactivate error:', error);
      toast.error('Failed to update user status');
    }
  }

  async function handleSaveRiad(riad: Partial<Riad>) {
    setIsSavingRiad(true);
    try {
      if (editingRiad) {
        const { error } = await supabase
          .from('riads')
          .update({
            name: riad.name,
            cloudbeds_property_id: riad.cloudbeds_property_id || null,
            manager_email: riad.manager_email || null,
            manager_whatsapp: riad.manager_whatsapp || null
          })
          .eq('id', editingRiad.id);

        if (error) throw error;
        toast.success('Riad updated');
        setEditingRiad(null);
      } else {
        const { error } = await supabase
          .from('riads')
          .insert({
            name: riad.name!,
            cloudbeds_property_id: riad.cloudbeds_property_id || null,
            manager_email: riad.manager_email || null,
            manager_whatsapp: riad.manager_whatsapp || null
          });

        if (error) throw error;
        toast.success('Riad created');
        setNewRiad({ name: '', cloudbeds_property_id: '', manager_email: '', manager_whatsapp: '' });
      }
      fetchRiads();
    } catch (error) {
      console.error('Save riad error:', error);
      toast.error('Failed to save riad');
    } finally {
      setIsSavingRiad(false);
    }
  }

  async function handleToggleRiadActive(riad: Riad) {
    try {
      const { error } = await supabase
        .from('riads')
        .update({ is_active: !riad.is_active })
        .eq('id', riad.id);

      if (error) throw error;
      toast.success(riad.is_active ? 'Riad deactivated' : 'Riad activated');
      fetchRiads();
    } catch (error) {
      console.error('Toggle riad error:', error);
      toast.error('Failed to update riad');
    }
  }

  async function handleToggleOfferActive(offer: TransportOffer) {
    try {
      const { error } = await supabase
        .from('transport_offers')
        .update({ is_active: !offer.is_active })
        .eq('id', offer.id);

      if (error) throw error;
      toast.success(offer.is_active ? 'Offer deactivated' : 'Offer activated');
      fetchOffers();
    } catch (error) {
      console.error('Toggle offer error:', error);
      toast.error('Failed to update offer');
    }
  }

  const filteredUsers = searchEmail
    ? users.filter(u => 
        u.email.toLowerCase().includes(searchEmail.toLowerCase()) ||
        (u.fullName && u.fullName.toLowerCase().includes(searchEmail.toLowerCase()))
      )
    : users;

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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link 
            to="/backoffice" 
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <img 
            src={margoflowLogo} 
            alt="MargoFlow" 
            className="h-8 md:h-10 object-contain"
          />
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium hidden sm:inline">Admin</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3 mx-auto">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="riads" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              <span className="hidden sm:inline">Riads</span>
            </TabsTrigger>
            <TabsTrigger value="transport" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Transport</span>
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            {/* Invite User Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <UserPlus className="h-5 w-5" />
                  Invite New User
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="user@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input
                      value={inviteFullName}
                      onChange={(e) => setInviteFullName(e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Assign Riads</Label>
                  <div className="grid gap-2 max-h-40 overflow-y-auto border rounded-lg p-2">
                    {riads.filter(r => r.is_active).map(riad => (
                      <label key={riad.id} className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer">
                        <Checkbox
                          checked={inviteRiads.includes(riad.id)}
                          onCheckedChange={(checked) => {
                            setInviteRiads(prev => 
                              checked ? [...prev, riad.id] : prev.filter(id => id !== riad.id)
                            );
                          }}
                        />
                        <span className="text-sm">{riad.name}</span>
                      </label>
                    ))}
                    {riads.filter(r => r.is_active).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-2">No active riads</p>
                    )}
                  </div>
                </div>
                <Button onClick={handleInviteUser} disabled={isInviting} className="w-full">
                  {isInviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                  Send Invitation
                </Button>
              </CardContent>
            </Card>

            {/* User List Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5" />
                  Manage Users
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search by email or name..."
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Button variant="outline" size="icon" onClick={fetchUsers}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>

                {isLoadingUsers ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredUsers.map(userData => (
                      <div 
                        key={userData.id}
                        className={`p-3 border rounded-lg flex items-center justify-between gap-2 ${!userData.isActive ? 'opacity-50' : ''}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{userData.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {userData.fullName || 'No name'} • {userData.role}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleSelectUser(userData)}
                          >
                            <UserCog className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeactivateUser(userData.id, userData.isActive)}
                          >
                            {userData.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </div>
                    ))}
                    {filteredUsers.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">No users found</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Edit User Modal */}
            {selectedUser && (
              <Card className="border-primary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <UserCog className="h-5 w-5" />
                    Edit: {selectedUser.email}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={editRole} onValueChange={(v) => setEditRole(v as AppRole)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Assigned Riads</Label>
                    <div className="grid gap-2 max-h-40 overflow-y-auto border rounded-lg p-2">
                      {riads.filter(r => r.is_active).map(riad => (
                        <label key={riad.id} className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer">
                          <Checkbox
                            checked={editRiads.includes(riad.id)}
                            onCheckedChange={(checked) => {
                              setEditRiads(prev => 
                                checked ? [...prev, riad.id] : prev.filter(id => id !== riad.id)
                              );
                            }}
                          />
                          <span className="text-sm">{riad.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setSelectedUser(null)}>
                      Cancel
                    </Button>
                    <Button className="flex-1" onClick={handleSaveUser} disabled={isSavingUser}>
                      {isSavingUser && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Save Changes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Riads Tab */}
          <TabsContent value="riads" className="space-y-6">
            {/* Add Riad */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building className="h-5 w-5" />
                  {editingRiad ? 'Edit Riad' : 'Add New Riad'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      value={editingRiad ? editingRiad.name : newRiad.name}
                      onChange={(e) => editingRiad 
                        ? setEditingRiad({ ...editingRiad, name: e.target.value })
                        : setNewRiad({ ...newRiad, name: e.target.value })
                      }
                      placeholder="Riad name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cloudbeds Property ID</Label>
                    <Input
                      value={editingRiad ? editingRiad.cloudbeds_property_id || '' : newRiad.cloudbeds_property_id}
                      onChange={(e) => editingRiad
                        ? setEditingRiad({ ...editingRiad, cloudbeds_property_id: e.target.value })
                        : setNewRiad({ ...newRiad, cloudbeds_property_id: e.target.value })
                      }
                      placeholder="Property ID"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Manager Email</Label>
                    <Input
                      type="email"
                      value={editingRiad ? editingRiad.manager_email || '' : newRiad.manager_email}
                      onChange={(e) => editingRiad
                        ? setEditingRiad({ ...editingRiad, manager_email: e.target.value })
                        : setNewRiad({ ...newRiad, manager_email: e.target.value })
                      }
                      placeholder="manager@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Manager WhatsApp</Label>
                    <Input
                      value={editingRiad ? editingRiad.manager_whatsapp || '' : newRiad.manager_whatsapp}
                      onChange={(e) => editingRiad
                        ? setEditingRiad({ ...editingRiad, manager_whatsapp: e.target.value })
                        : setNewRiad({ ...newRiad, manager_whatsapp: e.target.value })
                      }
                      placeholder="+212 600 000 000"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  {editingRiad && (
                    <Button variant="outline" className="flex-1" onClick={() => setEditingRiad(null)}>
                      Cancel
                    </Button>
                  )}
                  <Button 
                    className="flex-1" 
                    onClick={() => handleSaveRiad(editingRiad || newRiad)}
                    disabled={isSavingRiad || !(editingRiad?.name || newRiad.name)}
                  >
                    {isSavingRiad && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {editingRiad ? 'Update Riad' : 'Add Riad'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Riad List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5" />
                  All Riads
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingRiads ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {riads.map(riad => (
                      <div 
                        key={riad.id}
                        className={`p-3 border rounded-lg flex items-center justify-between gap-2 ${!riad.is_active ? 'opacity-50' : ''}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{riad.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {riad.manager_email || 'No email'} • {riad.manager_whatsapp || 'No WhatsApp'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setEditingRiad(riad)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleRiadActive(riad)}
                          >
                            {riad.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </div>
                    ))}
                    {riads.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">No riads found</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transport Tab */}
          <TabsContent value="transport" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Truck className="h-5 w-5" />
                  Transport Offers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingOffers ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {offers.map(offer => (
                      <div 
                        key={offer.id}
                        className={`p-3 border rounded-lg flex items-center justify-between gap-2 ${!offer.is_active ? 'opacity-50' : ''}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{offer.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {offer.type} • Day: {offer.default_day_price} MAD • Night: {offer.default_night_price} MAD
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleOfferActive(offer)}
                        >
                          {offer.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    ))}
                    {offers.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">No transport offers found</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
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