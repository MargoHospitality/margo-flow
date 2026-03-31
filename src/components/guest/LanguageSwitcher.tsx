import { Globe } from 'lucide-react';
import { Language } from '@/lib/i18n';

interface LanguageSwitcherProps {
  language: Language;
  onToggle: () => void;
}

export function LanguageSwitcher({ language, onToggle }: LanguageSwitcherProps) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50 active:bg-muted"
      aria-label={language === 'en' ? 'Switch to French' : 'Passer en anglais'}
    >
      <Globe className="h-4 w-4" />
      <span className="uppercase">{language === 'en' ? 'FR' : 'EN'}</span>
    </button>
  );
}