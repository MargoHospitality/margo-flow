import { Link } from 'react-router-dom';
import { ArrowLeft, CreditCard, LogOut, LucideIcon, MessageSquareText, Shield, Users } from 'lucide-react';
import margoflowLogo from '@/assets/margoflow-logo.png';
import { Button } from '@/components/ui/button';
import { TransportNavButton } from '@/components/backoffice/TransportNavButton';

export type BackofficeHeaderSection = 'admin' | 'arrivals' | 'transport' | 'payments' | 'reviews';

type BackofficeHeaderProps = {
  active: BackofficeHeaderSection;
  isSuperAdmin: boolean;
  onLogout?: () => void;
  backTo?: string;
};

type NavItemProps = {
  active: boolean;
  icon: LucideIcon;
  label: string;
  to?: string;
  onClick?: () => void;
};

function NavItem({ active, icon: Icon, label, to, onClick }: NavItemProps) {
  const className = 'h-9 w-9 shrink-0 px-0 sm:w-auto sm:px-3';
  const iconClassName = 'h-4 w-4 sm:mr-2';
  const content = (
    <>
      <Icon className={iconClassName} />
      <span className="hidden sm:inline">{label}</span>
    </>
  );

  if (active) {
    return (
      <Button variant="outline" size="sm" className={className} aria-current="page" aria-label={label} onClick={onClick}>
        {content}
      </Button>
    );
  }

  if (to) {
    return (
      <Button asChild variant="ghost" size="sm" className={className}>
        <Link to={to} aria-label={label}>
          {content}
        </Link>
      </Button>
    );
  }

  return (
    <Button variant="ghost" size="sm" className={className} onClick={onClick} aria-label={label}>
      {content}
    </Button>
  );
}

export function BackofficeHeader({ active, isSuperAdmin, onLogout, backTo = '/' }: BackofficeHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/50 bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3">
        <div className="flex items-center gap-3">
          <Link
            to={backTo}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <img
            src={margoflowLogo}
            alt="MargoFlow"
            className="h-8 object-contain md:h-10"
          />
        </div>

        <nav className="flex w-full items-center justify-between gap-1 sm:w-auto sm:justify-end sm:gap-2" aria-label="Backoffice navigation">
          {isSuperAdmin && (
            <NavItem active={active === 'admin'} icon={Shield} label="Admin" to="/admin" />
          )}
          <NavItem active={active === 'arrivals'} icon={Users} label="Arrivals" to="/backoffice" />
          <TransportNavButton active={active === 'transport'} />
          <NavItem active={active === 'payments'} icon={CreditCard} label="Payments" to="/backoffice/payments" />
          <NavItem active={active === 'reviews'} icon={MessageSquareText} label="Reviews" to="/backoffice/reviews" />
          {onLogout && (
            <NavItem active={false} icon={LogOut} label="Logout" onClick={onLogout} />
          )}
        </nav>
      </div>
    </header>
  );
}
