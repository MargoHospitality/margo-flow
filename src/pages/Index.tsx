import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';
import { Car, Building, ArrowRight } from 'lucide-react';

export default function Index() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <pattern id="moroccan-pattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="1.5" fill="currentColor" />
              <path d="M0 10 L10 0 L20 10 L10 20 Z" fill="none" stroke="currentColor" strokeWidth="0.3" />
            </pattern>
            <rect x="0" y="0" width="100" height="100" fill="url(#moroccan-pattern)" className="text-primary-foreground" />
          </svg>
        </div>
        
        <div className="container mx-auto px-4 py-24 md:py-32 relative z-10">
          <div className="max-w-2xl mx-auto text-center text-primary-foreground">
            <h1 className="heading-display text-4xl md:text-5xl lg:text-6xl mb-6 animate-fade-in">
              {t('app_name')}
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/80 mb-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              {t('welcome_subtitle')}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <Button asChild size="xl" variant="sand">
                <Link to="/guest">
                  <Car className="mr-2 h-5 w-5" />
                  {t('welcome_title')}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Link 
            to="/guest" 
            className="group card-elevated p-8 card-hover text-center"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
              <Car className="h-8 w-8 text-primary" />
            </div>
            <h2 className="heading-display text-xl mb-2">{t('welcome_title')}</h2>
            <p className="text-muted-foreground text-sm">{t('welcome_subtitle')}</p>
          </Link>

          <Link 
            to="/auth" 
            className="group card-elevated p-8 card-hover text-center"
          >
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-accent/20 transition-colors">
              <Building className="h-8 w-8 text-accent" />
            </div>
            <h2 className="heading-display text-xl mb-2">{t('dashboard')}</h2>
            <p className="text-muted-foreground text-sm">Manager &amp; Admin Access</p>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} {t('app_name')}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
