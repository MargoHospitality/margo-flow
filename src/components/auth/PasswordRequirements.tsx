import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordRequirementsProps {
  password: string;
}

interface Requirement {
  label: string;
  test: (password: string) => boolean;
}

const requirements: Requirement[] = [
  { label: '8 characters minimum', test: (p) => p.length >= 8 },
  { label: '1 uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: '1 number', test: (p) => /[0-9]/.test(p) },
  { label: '1 special character', test: (p) => /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\/'`;~]/.test(p) },
];

export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  return (
    <div className="space-y-2 text-sm">
      {requirements.map((req, index) => {
        const isMet = req.test(password);
        return (
          <div
            key={index}
            className={cn(
              'flex items-center gap-2 transition-colors',
              isMet ? 'text-green-600' : 'text-muted-foreground'
            )}
          >
            {isMet ? (
              <Check className="h-4 w-4" />
            ) : (
              <X className="h-4 w-4" />
            )}
            <span>{req.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const req of requirements) {
    if (!req.test(password)) {
      errors.push(req.label);
    }
  }
  
  return { valid: errors.length === 0, errors };
}
