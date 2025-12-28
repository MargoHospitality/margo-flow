import { useState, useMemo } from 'react';
import { Check, X, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Property {
  id: string;
  name: string;
  is_active: boolean;
}

interface SearchablePropertySelectProps {
  properties: Property[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}

export function SearchablePropertySelect({
  properties,
  selectedIds,
  onChange,
  placeholder = "Search properties..."
}: SearchablePropertySelectProps) {
  const [search, setSearch] = useState('');

  const activeProperties = useMemo(() => 
    properties.filter(p => p.is_active),
    [properties]
  );

  const filteredProperties = useMemo(() => {
    if (!search.trim()) return activeProperties;
    return activeProperties.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [activeProperties, search]);

  const selectedProperties = useMemo(() => 
    properties.filter(p => selectedIds.includes(p.id)),
    [properties, selectedIds]
  );

  const toggleProperty = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(i => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const removeProperty = (id: string) => {
    onChange(selectedIds.filter(i => i !== id));
  };

  return (
    <div className="space-y-2">
      {/* Selected properties as chips */}
      {selectedProperties.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedProperties.map(prop => (
            <Badge 
              key={prop.id} 
              variant="secondary"
              className="flex items-center gap-1 pl-2 pr-1"
            >
              <span className="text-xs">{prop.name}</span>
              <button
                type="button"
                onClick={() => removeProperty(prop.id)}
                className="ml-1 rounded-full p-0.5 hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          className="pl-8"
        />
      </div>

      {/* Property list */}
      <ScrollArea className="h-40 border rounded-md">
        <div className="p-2 space-y-1">
          {filteredProperties.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              No properties found
            </p>
          ) : (
            filteredProperties.map(prop => {
              const isSelected = selectedIds.includes(prop.id);
              return (
                <button
                  key={prop.id}
                  type="button"
                  onClick={() => toggleProperty(prop.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors ${
                    isSelected 
                      ? 'bg-primary/10 text-primary' 
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className={`flex items-center justify-center w-4 h-4 rounded border ${
                    isSelected 
                      ? 'bg-primary border-primary text-primary-foreground' 
                      : 'border-input'
                  }`}>
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  <span>{prop.name}</span>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
