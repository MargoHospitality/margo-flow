import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/useLanguage';
import { Loader2, Search, Building, X, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface Riad {
  id: string;
  name: string;
  manager_whatsapp: string | null;
}

interface ReservationData {
  reservation_id: string;
  guest_first_name: string | null;
  guest_last_name: string;
  check_in_date: string;
  riad_id: string;
  riad_name: string;
}

interface ReservationEntryProps {
  onReservationFound: (reservation: ReservationData, riadWhatsapp?: string) => void;
  preselectedRiadId?: string;
}

export function ReservationEntry({ onReservationFound, preselectedRiadId }: ReservationEntryProps) {
  const { t } = useLanguage();
  const [riads, setRiads] = useState<Riad[]>([]);
  const [riadsLoading, setRiadsLoading] = useState(true);
  
  // Form state
  const [riadSearch, setRiadSearch] = useState('');
  const [selectedRiad, setSelectedRiad] = useState<Riad | null>(null);
  const [reservationId, setReservationId] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Autocomplete state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredRiads, setFilteredRiads] = useState<Riad[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchRiads();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (riadSearch.trim() === '') {
      setFilteredRiads([]);
      return;
    }
    
    const searchLower = riadSearch.toLowerCase();
    const filtered = riads.filter(riad => 
      riad.name.toLowerCase().includes(searchLower)
    );
    setFilteredRiads(filtered);
  }, [riadSearch, riads]);

  useEffect(() => {
    if (preselectedRiadId && riads.length > 0) {
      const riad = riads.find(r => r.id === preselectedRiadId);
      if (riad) {
        setSelectedRiad(riad);
        setRiadSearch(riad.name);
      }
    }
  }, [preselectedRiadId, riads]);

  async function fetchRiads() {
    try {
      const { data, error } = await supabase
        .from('riads')
        .select('id, name, manager_whatsapp')
        .order('name');

      if (error) throw error;
      setRiads(data || []);
    } catch (error) {
      console.error('Error fetching riads:', error);
      toast.error(t('error'));
    } finally {
      setRiadsLoading(false);
    }
  }

  const handleRiadSelect = (riad: Riad) => {
    setSelectedRiad(riad);
    setRiadSearch(riad.name);
    setShowSuggestions(false);
  };

  const handleClearRiad = () => {
    setSelectedRiad(null);
    setRiadSearch('');
    inputRef.current?.focus();
  };

  const handleRiadInputChange = (value: string) => {
    setRiadSearch(value);
    setSelectedRiad(null);
    setShowSuggestions(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedRiad) {
      toast.error(t('select_riad'));
      return;
    }
    
    if (!reservationId.trim() || !lastName.trim()) {
      toast.error(t('required_field'));
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          reservation_id,
          guest_first_name,
          guest_last_name,
          check_in_date,
          status,
          riad_id,
          riads!inner(name)
        `)
        .eq('reservation_id', reservationId.trim())
        .eq('riad_id', selectedRiad.id)
        .ilike('guest_last_name', lastName.trim())
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast.error(t('reservation_not_found'));
        return;
      }

      if (data.status === 'canceled' || data.status === 'no_show') {
        toast.error(t('reservation_invalid'));
        return;
      }

      const { data: existingRequest } = await supabase
        .from('transport_requests')
        .select('id, status')
        .eq('reservation_id', data.reservation_id)
        .in('status', ['pending', 'confirmed'])
        .maybeSingle();

      if (existingRequest) {
        toast.error(t('existing_request'));
        return;
      }

      onReservationFound({
        reservation_id: data.reservation_id,
        guest_first_name: data.guest_first_name,
        guest_last_name: data.guest_last_name,
        check_in_date: data.check_in_date,
        riad_id: data.riad_id,
        riad_name: (data.riads as { name: string }).name,
      }, selectedRiad.manager_whatsapp || undefined);
    } catch (error) {
      console.error('Error looking up reservation:', error);
      toast.error(t('error'));
    } finally {
      setIsLoading(false);
    }
  };

  if (riadsLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="card-elevated p-6 md:p-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Riad Name - Autocomplete */}
        <div className="space-y-2">
          <Label htmlFor="riadName" className="text-sm font-medium text-foreground">
            {t('riad_name_label')}
          </Label>
          <div className="relative">
            <div className="relative">
              <Building className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                ref={inputRef}
                id="riadName"
                type="text"
                value={riadSearch}
                onChange={(e) => handleRiadInputChange(e.target.value)}
                onFocus={() => riadSearch.trim() && setShowSuggestions(true)}
                placeholder={t('riad_name_placeholder')}
                className="input-mobile pl-12 pr-12"
                autoComplete="off"
                required
              />
              {selectedRiad && (
                <button
                  type="button"
                  onClick={handleClearRiad}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear selection"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            
            {/* Suggestions dropdown */}
            {showSuggestions && filteredRiads.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute z-50 w-full mt-2 bg-card border border-border rounded-2xl shadow-medium overflow-hidden"
              >
                {filteredRiads.map(riad => (
                  <button
                    key={riad.id}
                    type="button"
                    onClick={() => handleRiadSelect(riad)}
                    className="w-full px-4 py-4 text-left hover:bg-accent/50 flex items-center justify-between transition-colors active:bg-accent"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building className="h-5 w-5 text-primary" />
                      </div>
                      <span className="font-medium text-foreground">{riad.name}</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
            
            {/* No results message */}
            {showSuggestions && riadSearch.trim() && filteredRiads.length === 0 && (
              <div
                ref={suggestionsRef}
                className="absolute z-50 w-full mt-2 bg-card border border-border rounded-2xl shadow-soft p-4 text-center text-muted-foreground"
              >
                {t('no_riads_found')}
              </div>
            )}
          </div>
        </div>

        {/* Reservation Number */}
        <div className="space-y-2">
          <Label htmlFor="reservationId" className="text-sm font-medium text-foreground">
            {t('reservation_id_label')}
          </Label>
          <Input
            id="reservationId"
            type="text"
            value={reservationId}
            onChange={(e) => setReservationId(e.target.value)}
            placeholder={t('reservation_id_placeholder')}
            className="input-mobile"
            required
          />
        </div>

        {/* Last Name */}
        <div className="space-y-2">
          <Label htmlFor="lastName" className="text-sm font-medium text-foreground">
            {t('last_name_label')}
          </Label>
          <Input
            id="lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder={t('last_name_placeholder')}
            className="input-mobile"
            required
          />
        </div>

        <Button 
          type="submit" 
          className="w-full h-14 text-base font-medium rounded-xl mt-2" 
          size="lg"
          disabled={isLoading || !selectedRiad}
        >
          {isLoading ? (
            <Loader2 className="animate-spin mr-2 h-5 w-5" />
          ) : (
            <Search className="mr-2 h-5 w-5" />
          )}
          {t('find_reservation')}
        </Button>
      </form>
    </div>
  );
}
