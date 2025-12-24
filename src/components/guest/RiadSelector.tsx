import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/useLanguage';
import { Loader2, Building } from 'lucide-react';

interface Riad {
  id: string;
  name: string;
}

interface RiadSelectorProps {
  onSelect: (riadId: string, riadWhatsapp?: string) => void;
}

export function RiadSelector({ onSelect }: RiadSelectorProps) {
  const { t } = useLanguage();
  const [riads, setRiads] = useState<Riad[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRiads();
  }, []);

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
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (riads.length === 0) {
    return (
      <Card className="card-elevated">
        <CardContent className="py-8 text-center text-muted-foreground">
          No riads available.
        </CardContent>
      </Card>
    );
  }

  if (riads.length === 1) {
    // Auto-select if only one riad
    const riad = riads[0];
    onSelect(riad.id);
    return null;
  }

  return (
    <Card className="card-elevated animate-fade-in">
      <CardHeader className="text-center">
        <CardTitle className="heading-display text-2xl">{t('select_riad')}</CardTitle>
        <CardDescription className="text-body">
          {t('welcome_subtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {riads.map(riad => (
            <button
              key={riad.id}
              onClick={() => onSelect(riad.id)}
              className="flex items-center gap-4 p-4 rounded-lg border-2 border-border hover:border-primary bg-card transition-all hover:shadow-md text-left"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Building className="h-6 w-6 text-primary" />
              </div>
              <span className="font-medium text-lg">{riad.name}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
