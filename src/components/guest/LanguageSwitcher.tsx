import { Languages } from 'lucide-react';
import { Language } from '@/lib/i18n';

interface LanguageSwitcherProps {
  language: Language;
  onToggle: () => void;
}

export function LanguageSwitcher({ language, onToggle }: LanguageSwitcherProps) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground text-sm font-medium transition-colors"
      aria-label={language === 'en' ? 'Switch to French' : 'Passer en anglais'}
    >
      <Languages className="h-4 w-4" />
      <span>{language === 'en' ? 'FR' : 'EN'}</span>
    </button>
  );
}
