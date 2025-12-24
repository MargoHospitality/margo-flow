import { useState, useEffect, useCallback } from 'react';
import { Language, getLanguageFromUrl, t as translate, translations } from '@/lib/i18n';

export function useLanguage() {
  const [language, setLanguage] = useState<Language>(() => getLanguageFromUrl());

  useEffect(() => {
    const handleUrlChange = () => {
      setLanguage(getLanguageFromUrl());
    };

    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  const t = useCallback(
    (key: keyof typeof translations.en): string => translate(key, language),
    [language]
  );

  const toggleLanguage = useCallback(() => {
    const newLang: Language = language === 'en' ? 'fr' : 'en';
    setLanguage(newLang);
    
    // Update URL without reloading
    const url = new URL(window.location.href);
    url.searchParams.set('lang', newLang);
    window.history.replaceState({}, '', url.toString());
  }, [language]);

  return { language, t, toggleLanguage };
}
