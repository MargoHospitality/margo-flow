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
import { Loader2, ArrowLeft, Search, UserCog, Shield, UserPlus, Users, Building, Truck, MapPin, Cloud, MessageSquare } from 'lucide-react';
import CloudbedsIntegration from '@/components/admin/CloudbedsIntegration';
import WhatsAppMonitoring from '@/components/admin/WhatsAppMonitoring';
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

interface RiadTransportOffer {
  id: string;
  riad_id: string;
  transport_offer_id: string;
  is_active: boolean;
  override_day_price: number | null;
  override_night_price: number | null;
  override_base_pax: number | null;
  override_extra_pax_price: number | null;
  override_payment_mode: string | null;
}

type TransportType = 'airport_pickup' | 'train_station_pickup' | 'hotel_pickup' | 'bus_station_pickup';

const TRANSPORT_TYPES: { value: TransportType; label: string }[] = [
  { value: 'airport_pickup', label: 'Airport Pickup' },
  { value: 'train_station_pickup', label: 'Train Station Pickup' },
  { value: 'hotel_pickup', label: 'Hotel Pickup' },
  { value: 'bus_station_pickup', label: 'Bus Station Pickup' },
];

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
  const [editingOffer, setEditingOffer] = useState<TransportOffer | null>(null);
  const [newOffer, setNewOffer] = useState({
    name: '', name_fr: '', type: 'airport_pickup' as TransportType,
    default_day_price: '', default_night_price: '',
    default_base_pax: '3', default_extra_pax_price: '0',
    default_payment_mode: 'at_riad'
  });
  const [isSavingOffer, setIsSavingOffer] = useState(false);
  
  // Riad-Transport assignments state
  const [riadOffers, setRiadOffers] = useState<RiadTransportOffer[]>([]);
  const [selectedRiadForOffers, setSelectedRiadForOffers] = useState<string | null>(null);
  const [isLoadingRiadOffers, setIsLoadingRiadOffers] = useState(false);

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
    // Use getUser() which validates the token server-side, then get a fresh session
    const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
    if (userError || !currentUser) {
      // Session is invalid, redirect to login
      navigate('/auth');
      throw new Error('Session expired. Please log in again.');
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      throw new Error('Not authenticated');
    }
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

  async function fetchRiadOffers(riadId: string) {
    setIsLoadingRiadOffers(true);
    try {
      const { data, error } = await supabase
        .from('riad_transport_offers')
        .select('*')
        .eq('riad_id', riadId);
      
      if (!error && data) {
        setRiadOffers(data as RiadTransportOffer[]);
      }
    } catch (error) {
      console.error('Error fetching riad offers:', error);
    } finally {
      setIsLoadingRiadOffers(false);
    }
  }

  async function handleSaveOffer(offer: {
    name: string;
    name_fr?: string | null;
    type: string;
    default_day_price: string | number;
    default_night_price: string | number;
    default_base_pax: string | number;
    default_extra_pax_price: string | number;
    default_payment_mode: string;
  }) {
    if (!offer.name || !offer.default_day_price || !offer.default_night_price) {
      toast.error('Name and prices are required');
      return;
    }
    
    setIsSavingOffer(true);
    try {
      const offerData = {
        name: offer.name,
        name_fr: offer.name_fr || null,
        type: offer.type as TransportType,
        default_day_price: Number(offer.default_day_price),
        default_night_price: Number(offer.default_night_price),
        default_base_pax: Number(offer.default_base_pax) || 3,
        default_extra_pax_price: Number(offer.default_extra_pax_price) || 0,
        default_payment_mode: offer.default_payment_mode as 'at_riad' | 'to_driver'
      };

      if (editingOffer) {
        const { error } = await supabase
          .from('transport_offers')
          .update(offerData)
          .eq('id', editingOffer.id);

        if (error) throw error;
        toast.success('Offer updated');
        setEditingOffer(null);
      } else {
        const { error } = await supabase
          .from('transport_offers')
          .insert(offerData);

        if (error) throw error;
        toast.success('Offer created');
        setNewOffer({
          name: '', name_fr: '', type: 'airport_pickup',
          default_day_price: '', default_night_price: '',
          default_base_pax: '3', default_extra_pax_price: '0',
          default_payment_mode: 'at_riad'
        });
      }
      fetchOffers();
    } catch (error) {
      console.error('Save offer error:', error);
      toast.error('Failed to save offer');
    } finally {
      setIsSavingOffer(false);
    }
  }

  async function handleToggleRiadOffer(riadId: string, offerId: string, isCurrentlyAssigned: boolean, override?: Partial<RiadTransportOffer>) {
    try {
      if (isCurrentlyAssigned) {
        // Remove assignment
        const { error } = await supabase
          .from('riad_transport_offers')
          .delete()
          .eq('riad_id', riadId)
          .eq('transport_offer_id', offerId);
        if (error) throw error;
        toast.success('Offer removed from riad');
      } else {
        // Add assignment
        const { error } = await supabase
          .from('riad_transport_offers')
          .insert([{
            riad_id: riadId,
            transport_offer_id: offerId,
            is_active: true,
            override_day_price: override?.override_day_price ?? null,
            override_night_price: override?.override_night_price ?? null,
            override_base_pax: override?.override_base_pax ?? null,
            override_extra_pax_price: override?.override_extra_pax_price ?? null,
            override_payment_mode: (override?.override_payment_mode as 'at_riad' | 'to_driver' | null) ?? null
          }]);
        if (error) throw error;
        toast.success('Offer assigned to riad');
      }
      if (selectedRiadForOffers) fetchRiadOffers(selectedRiadForOffers);
    } catch (error) {
      console.error('Toggle riad offer error:', error);
      toast.error('Failed to update assignment');
    }
  }

  async function handleUpdateRiadOfferOverride(riadOfferId: string, overrides: Partial<RiadTransportOffer>) {
    try {
      const { error } = await supabase
        .from('riad_transport_offers')
        .update({
          override_day_price: overrides.override_day_price ?? null,
          override_night_price: overrides.override_night_price ?? null,
          override_base_pax: overrides.override_base_pax ?? null,
          override_extra_pax_price: overrides.override_extra_pax_price ?? null,
          override_payment_mode: (overrides.override_payment_mode as 'at_riad' | 'to_driver' | null) ?? null
        })
        .eq('id', riadOfferId);
      
      if (error) throw error;
      toast.success('Override saved');
      if (selectedRiadForOffers) fetchRiadOffers(selectedRiadForOffers);
    } catch (error) {
      console.error('Update override error:', error);
      toast.error('Failed to update override');
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
          <TabsList className="grid w-full max-w-2xl grid-cols-5 mx-auto">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="riads" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              <span className="hidden sm:inline">Properties</span>
            </TabsTrigger>
            <TabsTrigger value="transport" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Transport</span>
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </TabsTrigger>
            <TabsTrigger value="cloudbeds" className="flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              <span className="hidden sm:inline">Cloudbeds</span>
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
                  <Label>Assign Properties</Label>
                  <Select 
                    value={inviteRiads[0] || ''} 
                    onValueChange={(v) => setInviteRiads(v ? [v] : [])}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a property..." />
                    </SelectTrigger>
                    <SelectContent>
                      {riads.filter(r => r.is_active).map(riad => (
                        <SelectItem key={riad.id} value={riad.id}>{riad.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    <Label>Assigned Properties</Label>
                    <Select 
                      value={editRiads[0] || ''} 
                      onValueChange={(v) => setEditRiads(v ? [v] : [])}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a property..." />
                      </SelectTrigger>
                      <SelectContent>
                        {riads.filter(r => r.is_active).map(riad => (
                          <SelectItem key={riad.id} value={riad.id}>{riad.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
            {/* Add/Edit Transport Offer */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Truck className="h-5 w-5" />
                  {editingOffer ? 'Edit Transport Offer' : 'Add New Transport Offer'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Name (EN) *</Label>
                    <Input
                      value={editingOffer ? editingOffer.name : newOffer.name}
                      onChange={(e) => editingOffer 
                        ? setEditingOffer({ ...editingOffer, name: e.target.value })
                        : setNewOffer({ ...newOffer, name: e.target.value })
                      }
                      placeholder="Airport Pickup"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Name (FR)</Label>
                    <Input
                      value={editingOffer ? editingOffer.name_fr || '' : newOffer.name_fr}
                      onChange={(e) => editingOffer
                        ? setEditingOffer({ ...editingOffer, name_fr: e.target.value })
                        : setNewOffer({ ...newOffer, name_fr: e.target.value })
                      }
                      placeholder="Transfert Aéroport"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Type *</Label>
                    <Select 
                      value={editingOffer ? editingOffer.type : newOffer.type}
                      onValueChange={(v) => editingOffer
                        ? setEditingOffer({ ...editingOffer, type: v })
                        : setNewOffer({ ...newOffer, type: v as TransportType })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRANSPORT_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Mode</Label>
                    <Select 
                      value={editingOffer ? editingOffer.default_payment_mode : newOffer.default_payment_mode}
                      onValueChange={(v) => editingOffer
                        ? setEditingOffer({ ...editingOffer, default_payment_mode: v })
                        : setNewOffer({ ...newOffer, default_payment_mode: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="at_riad">At Riad</SelectItem>
                        <SelectItem value="to_driver">To Driver</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Day Price (MAD) *</Label>
                    <Input
                      type="number"
                      value={editingOffer ? editingOffer.default_day_price : newOffer.default_day_price}
                      onChange={(e) => editingOffer
                        ? setEditingOffer({ ...editingOffer, default_day_price: Number(e.target.value) })
                        : setNewOffer({ ...newOffer, default_day_price: e.target.value })
                      }
                      placeholder="200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Night Price (MAD) *</Label>
                    <Input
                      type="number"
                      value={editingOffer ? editingOffer.default_night_price : newOffer.default_night_price}
                      onChange={(e) => editingOffer
                        ? setEditingOffer({ ...editingOffer, default_night_price: Number(e.target.value) })
                        : setNewOffer({ ...newOffer, default_night_price: e.target.value })
                      }
                      placeholder="250"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Base Pax</Label>
                    <Input
                      type="number"
                      value={editingOffer ? editingOffer.default_base_pax : newOffer.default_base_pax}
                      onChange={(e) => editingOffer
                        ? setEditingOffer({ ...editingOffer, default_base_pax: Number(e.target.value) })
                        : setNewOffer({ ...newOffer, default_base_pax: e.target.value })
                      }
                      placeholder="3"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Extra Pax Price</Label>
                    <Input
                      type="number"
                      value={editingOffer ? editingOffer.default_extra_pax_price : newOffer.default_extra_pax_price}
                      onChange={(e) => editingOffer
                        ? setEditingOffer({ ...editingOffer, default_extra_pax_price: Number(e.target.value) })
                        : setNewOffer({ ...newOffer, default_extra_pax_price: e.target.value })
                      }
                      placeholder="50"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  {editingOffer && (
                    <Button variant="outline" className="flex-1" onClick={() => setEditingOffer(null)}>
                      Cancel
                    </Button>
                  )}
                  <Button 
                    className="flex-1" 
                    onClick={() => handleSaveOffer(editingOffer || newOffer)}
                    disabled={isSavingOffer}
                  >
                    {isSavingOffer && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {editingOffer ? 'Update Offer' : 'Add Offer'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Active Transport Offers List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Truck className="h-5 w-5" />
                  Active Transport Offers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingOffers ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {offers.filter(o => o.is_active).map(offer => (
                      <div 
                        key={offer.id}
                        className="p-3 border rounded-lg flex items-center justify-between gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{offer.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {TRANSPORT_TYPES.find(t => t.value === offer.type)?.label || offer.type} • Day: {offer.default_day_price} MAD • Night: {offer.default_night_price} MAD
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setEditingOffer(offer)}>Edit</Button>
                          <Button variant="ghost" size="sm" onClick={() => handleToggleOfferActive(offer)}>Deactivate</Button>
                        </div>
                      </div>
                    ))}
                    {offers.filter(o => o.is_active).length === 0 && (
                      <p className="text-center text-muted-foreground py-4">No active transport offers</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Disabled Transport Offers */}
            {offers.filter(o => !o.is_active).length > 0 && (
              <Card className="border-dashed opacity-75">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg text-muted-foreground">
                    <Truck className="h-5 w-5" />
                    Disabled Offers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {offers.filter(o => !o.is_active).map(offer => (
                      <div key={offer.id} className="p-3 border rounded-lg flex items-center justify-between gap-2 opacity-60">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{offer.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {TRANSPORT_TYPES.find(t => t.value === offer.type)?.label || offer.type}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => handleToggleOfferActive(offer)}>Reactivate</Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Assign Offers to Riads */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building className="h-5 w-5" />
                  Assign Offers to Riads
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Riad</Label>
                  <Select 
                    value={selectedRiadForOffers || ''} 
                    onValueChange={(v) => {
                      setSelectedRiadForOffers(v);
                      fetchRiadOffers(v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a riad..." />
                    </SelectTrigger>
                    <SelectContent>
                      {riads.filter(r => r.is_active).map(riad => (
                        <SelectItem key={riad.id} value={riad.id}>{riad.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedRiadForOffers && (
                  <div className="space-y-3">
                    {isLoadingRiadOffers ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      </div>
                    ) : (
                      offers.filter(o => o.is_active).map(offer => {
                        const assignment = riadOffers.find(ro => ro.transport_offer_id === offer.id);
                        const isAssigned = !!assignment;
                        
                        return (
                          <div key={offer.id} className="border rounded-lg p-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                  checked={isAssigned}
                                  onCheckedChange={() => handleToggleRiadOffer(selectedRiadForOffers, offer.id, isAssigned)}
                                />
                                <span className="font-medium text-sm">{offer.name}</span>
                              </label>
                              <span className="text-xs text-muted-foreground">
                                Default: {offer.default_day_price}/{offer.default_night_price} MAD
                              </span>
                            </div>
                            
                            {isAssigned && assignment && (
                              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 pl-6">
                                <div className="space-y-1">
                                  <Label className="text-xs">Override Day Price</Label>
                                  <Input
                                    type="number"
                                    placeholder={String(offer.default_day_price)}
                                    value={assignment.override_day_price ?? ''}
                                    onChange={(e) => handleUpdateRiadOfferOverride(assignment.id, {
                                      ...assignment,
                                      override_day_price: e.target.value ? Number(e.target.value) : null
                                    })}
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Override Night Price</Label>
                                  <Input
                                    type="number"
                                    placeholder={String(offer.default_night_price)}
                                    value={assignment.override_night_price ?? ''}
                                    onChange={(e) => handleUpdateRiadOfferOverride(assignment.id, {
                                      ...assignment,
                                      override_night_price: e.target.value ? Number(e.target.value) : null
                                    })}
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Override Base Pax</Label>
                                  <Input
                                    type="number"
                                    placeholder={String(offer.default_base_pax)}
                                    value={assignment.override_base_pax ?? ''}
                                    onChange={(e) => handleUpdateRiadOfferOverride(assignment.id, {
                                      ...assignment,
                                      override_base_pax: e.target.value ? Number(e.target.value) : null
                                    })}
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Override Extra Pax</Label>
                                  <Input
                                    type="number"
                                    placeholder={String(offer.default_extra_pax_price)}
                                    value={assignment.override_extra_pax_price ?? ''}
                                    onChange={(e) => handleUpdateRiadOfferOverride(assignment.id, {
                                      ...assignment,
                                      override_extra_pax_price: e.target.value ? Number(e.target.value) : null
                                    })}
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Override Payment Mode</Label>
                                  <Select
                                    value={assignment.override_payment_mode || ''}
                                    onValueChange={(v) => handleUpdateRiadOfferOverride(assignment.id, {
                                      ...assignment,
                                      override_payment_mode: v || null
                                    })}
                                  >
                                    <SelectTrigger className="h-8 text-sm">
                                      <SelectValue placeholder="Default" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="at_riad">At Property</SelectItem>
                                      <SelectItem value="to_driver">To Driver</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                    {offers.filter(o => o.is_active).length === 0 && (
                      <p className="text-center text-muted-foreground py-4">No active offers to assign</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* WhatsApp Monitoring Tab */}
          <TabsContent value="whatsapp">
            <WhatsAppMonitoring />
          </TabsContent>

          {/* Cloudbeds Integration Tab */}
          <TabsContent value="cloudbeds">
            <CloudbedsIntegration />
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