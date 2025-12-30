import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/useLanguage';
import { Loader2, Search, Building, X, ChevronRight, CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { format, parse } from 'date-fns';
import { cn } from '@/lib/utils';

interface Riad {
  id: string;
  name: string;
  whatsapp_enabled?: boolean;
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

// Cloudflare Turnstile site key (publishable)
const TURNSTILE_SITE_KEY = '0x4AAAAAACJeqTerSezL_4lj';

export function ReservationEntry({ onReservationFound, preselectedRiadId }: ReservationEntryProps) {
  const { t } = useLanguage();
  const [riads, setRiads] = useState<Riad[]>([]);
  const [riadsLoading, setRiadsLoading] = useState(true);
  
  // Form state
  const [riadSearch, setRiadSearch] = useState('');
  const [selectedRiad, setSelectedRiad] = useState<Riad | null>(null);
  const [reservationId, setReservationId] = useState('');
  const [checkInDate, setCheckInDate] = useState<Date | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  
  // Captcha state
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [turnstileLoadError, setTurnstileLoadError] = useState(false);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);
  
  // Autocomplete state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredRiads, setFilteredRiads] = useState<Riad[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load Turnstile script
  useEffect(() => {
    if (!captchaRequired || typeof window === 'undefined') return;

    setTurnstileLoadError(false);

    // If already loaded
    if ((window as any).turnstile) {
      setTurnstileReady(true);
      return;
    }

    const SCRIPT_ID = 'cf-turnstile-script';
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

    const onLoaded = () => {
      if ((window as any).turnstile) setTurnstileReady(true);
    };

    const onError = () => {
      setTurnstileLoadError(true);
      setTurnstileReady(false);
    };

    if (existing) {
      // Script exists but maybe not loaded yet
      existing.addEventListener('load', onLoaded, { once: true });
      existing.addEventListener('error', onError, { once: true });

      // Also poll briefly as a fallback
      const iv = window.setInterval(() => {
        if ((window as any).turnstile) {
          setTurnstileReady(true);
          window.clearInterval(iv);
        }
      }, 150);
      window.setTimeout(() => window.clearInterval(iv), 6000);

      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.addEventListener('load', onLoaded, { once: true });
    script.addEventListener('error', onError, { once: true });
    document.head.appendChild(script);
  }, [captchaRequired]);

  // Render Turnstile widget when script is ready
  useEffect(() => {
    if (!captchaRequired) return;
    if (turnstileLoadError) return;
    if (!turnstileReady) return;
    if (!turnstileRef.current) return;
    if (!(window as any).turnstile) return;

    // Clear existing widget
    if (turnstileWidgetId.current) {
      try {
        (window as any).turnstile.remove(turnstileWidgetId.current);
      } catch (e) {}
    }

    // Ensure container is clean
    turnstileRef.current.innerHTML = '';

    turnstileWidgetId.current = (window as any).turnstile.render(turnstileRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token: string) => {
        setCaptchaToken(token);
      },
      'expired-callback': () => {
        setCaptchaToken(null);
      },
      'error-callback': () => {
        setCaptchaToken(null);
      },
      theme: 'light',
    });
  }, [captchaRequired, turnstileReady, turnstileLoadError]);

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
      // Use security definer function - only returns non-sensitive fields
      const { data, error } = await supabase.rpc('get_public_riads');

      if (error) throw error;
      
      // Sort by name client-side since RPC doesn't support order
      const sorted = (data || []).sort((a, b) => a.name.localeCompare(b.name));
      setRiads(sorted);
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

    if (!reservationId.trim()) {
      toast.error(t('required_field'));
      return;
    }

    if (!checkInDate) {
      toast.error(t('check_in_date_required'));
      return;
    }

    // If captcha is required but not solved, block submission
    if (captchaRequired && !captchaToken) {
      toast.error(t('captcha_required'));
      return;
    }

    setIsLoading(true);

    try {
      const reservationIdStr = reservationId.trim();
      const checkInDateStr = format(checkInDate, 'yyyy-MM-dd');

      // Use secure RPC function to lookup reservation (no direct table access)
      const { data: rpcResult, error } = await supabase.rpc('lookup_reservation_public', {
        _reservation_id: reservationIdStr,
        _riad_id: selectedRiad.id,
        _check_in_date: checkInDateStr,
      });

      if (error) throw error;

      // RPC returns array, get first result
      let resolved = rpcResult && rpcResult.length > 0 ? {
        reservation_id: rpcResult[0].reservation_id,
        guest_first_name: rpcResult[0].guest_first_name,
        guest_last_name: rpcResult[0].guest_last_name,
        check_in_date: rpcResult[0].check_in_date,
        status: rpcResult[0].status,
        riad_id: rpcResult[0].riad_id,
        riads: { name: rpcResult[0].riad_name },
      } : null;

      // If not found locally, try Cloudbeds on-demand lookup
      if (!resolved) {
        const { data: lookupData, error: lookupError } = await supabase.functions.invoke('cloudbeds-lookup', {
          body: {
            reservation_id: reservationIdStr,
            riad_id: selectedRiad.id,
            check_in_date: checkInDateStr,
            turnstile_token: captchaToken,
          },
        });

        if (lookupError) {
          console.error('Cloudbeds lookup error:', lookupError);
        }

        // Handle rate limiting response
        if (lookupData?.rate_limited) {
          const waitTime = lookupData.retry_after || 60;
          toast.error(t('too_many_requests').replace('{seconds}', String(waitTime)));
          setCaptchaRequired(true);
          return;
        }

        // Handle captcha requirement from server
        if (lookupData?.captcha_required) {
          setCaptchaRequired(true);
          toast.error(t('verification_required'));
          return;
        }

        if (lookupData?.found && lookupData?.reservation) {
          resolved = {
            reservation_id: lookupData.reservation.reservation_id,
            guest_first_name: lookupData.reservation.guest_first_name,
            guest_last_name: lookupData.reservation.guest_last_name,
            check_in_date: lookupData.reservation.check_in_date,
            status: lookupData.reservation.status,
            riad_id: lookupData.reservation.riad_id,
            riads: { name: lookupData.reservation.riad_name },
          } as any;
        }
      }

      if (!resolved) {
        setFailedAttempts(prev => prev + 1);
        if (failedAttempts + 1 >= 3) {
          setCaptchaRequired(true);
        }
        toast.error(t('reservation_not_found'));
        return;
      }

      if (resolved.status === 'canceled' || resolved.status === 'no_show') {
        toast.error(t('reservation_invalid'));
        return;
      }

      const { data: existingRequest } = await supabase
        .from('transport_requests')
        .select('id, status')
        .eq('reservation_id', resolved.reservation_id)
        .in('status', ['pending', 'confirmed'])
        .maybeSingle();

      if (existingRequest) {
        toast.error(t('existing_request'));
        return;
      }

      // Reset failed attempts on success
      setFailedAttempts(0);
      setCaptchaRequired(false);
      setCaptchaToken(null);

      onReservationFound(
        {
          reservation_id: resolved.reservation_id,
          guest_first_name: resolved.guest_first_name,
          guest_last_name: resolved.guest_last_name,
          check_in_date: resolved.check_in_date,
          riad_id: resolved.riad_id,
          riad_name: (resolved.riads as { name: string }).name,
        }
        // WhatsApp info now fetched server-side by notify-manager edge function
      );
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

        {/* Check-in Date */}
        <div className="space-y-2">
          <Label htmlFor="checkInDate" className="text-sm font-medium text-foreground">
            {t('check_in_date_label')}
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="checkInDate"
                variant="outline"
                className={cn(
                  "w-full h-12 justify-start text-left font-normal",
                  !checkInDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-3 h-5 w-5" />
                {checkInDate ? format(checkInDate, "PPP") : <span>{t('check_in_date_placeholder')}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={checkInDate}
                onSelect={setCheckInDate}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Turnstile CAPTCHA - only shown when required */}
        {captchaRequired && (
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">
              {t('verify_human')}
            </Label>
            <div 
              ref={turnstileRef} 
              className="flex justify-center"
            />
            {!captchaToken && (
              <p className="text-xs text-muted-foreground text-center">
                {t('complete_captcha')}
              </p>
            )}
          </div>
        )}

        <Button 
          type="submit" 
          className="w-full h-14 text-base font-medium rounded-xl mt-2" 
          size="lg"
          disabled={isLoading || !selectedRiad || (captchaRequired && !captchaToken)}
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