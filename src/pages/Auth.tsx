import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { Loader2, ArrowLeft, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import margoflowLogo from '@/assets/margoflow-logo.png';
import { PasswordRequirements } from '@/components/auth/PasswordRequirements';

const authSchema = z.object({
  email: z.string().trim().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

const passwordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least 1 number')
    .regex(/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\/'`;~]/, 'Password must contain at least 1 special character'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type AuthMode = 'login' | 'set-password' | 'reset-password';

export default function Auth() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const [authLinkError, setAuthLinkError] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const { signIn } = useAuth();

  // Check for invite/recovery tokens in URL (query) or URL hash
  useEffect(() => {
    const handleAuthRedirect = async () => {
      // 1) Preferred: token_hash flow (avoids URL hash, which can conflict with some hosting auth overlays)
      const url = new URL(window.location.href);
      const tokenHash = url.searchParams.get('token_hash');
      const typeParam = url.searchParams.get('type');

      if (tokenHash && typeParam) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: typeParam as any,
        });

        if (error) {
          console.error('verifyOtp error:', error);
          const msg = error.message || 'Authentication link is invalid or has expired';
          setAuthLinkError(msg);
          toast.error(msg);
          setIsCheckingSession(false);
          return;
        }

        setAuthLinkError(null);

        // Clean URL (remove query params)
        window.history.replaceState(null, '', window.location.pathname);

        if (typeParam === 'invite' || typeParam === 'signup') {
          setMode('set-password');
          toast.info('Please set your password to complete your account setup.');
        } else if (typeParam === 'recovery') {
          setMode('reset-password');
          toast.info('Please enter your new password.');
        }

        setIsCheckingSession(false);
        return;
      }

      // 2) Legacy: access_token/refresh_token in hash
      const hash = window.location.hash;

      if (hash) {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');
        const error = params.get('error');
        const errorDescription = params.get('error_description');

        if (error) {
          toast.error(errorDescription || 'Authentication error');
          setIsCheckingSession(false);
          return;
        }

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            toast.error('Failed to authenticate. Please try again.');
            setIsCheckingSession(false);
            return;
          }

          window.history.replaceState(null, '', window.location.pathname);

          if (type === 'invite' || type === 'signup') {
            setMode('set-password');
            toast.info('Please set your password to complete your account setup.');
          } else if (type === 'recovery') {
            setMode('reset-password');
            toast.info('Please enter your new password.');
          }
        }
      }

      setIsCheckingSession(false);
    };

    handleAuthRedirect();
  }, []);

  // Redirect if already logged in and not setting password
  useEffect(() => {
    if (user && !isLoading && !isCheckingSession && mode === 'login') {
      navigate('/backoffice');
    }
  }, [user, isLoading, isCheckingSession, mode, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = authSchema.safeParse({ email, password });
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await signIn(email, password);

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Invalid email or password.');
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('Please check your email to confirm your account.');
        } else {
          toast.error(error.message);
        }
        return;
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast.error(t('error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = passwordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        console.error('Password update error:', error);
        toast.error(error.message);
        return;
      }

      toast.success('Password set successfully! Redirecting...');
      
      // Small delay then redirect
      setTimeout(() => {
        navigate('/backoffice');
      }, 1000);
    } catch (error) {
      console.error('Password update error:', error);
      toast.error('Failed to set password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isPasswordMode = mode === 'set-password' || mode === 'reset-password';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="container max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link 
            to="/" 
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label={t('back')}
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <img 
            src={margoflowLogo} 
            alt="MargoFlow" 
            className="h-8 md:h-10 object-contain"
          />
          <div className="w-10" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="card-elevated animate-fade-in">
            <CardHeader className="text-center">
              {isPasswordMode ? (
                <>
                  <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <KeyRound className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="font-serif text-2xl">
                    {mode === 'set-password' ? 'Set Your Password' : 'Reset Your Password'}
                  </CardTitle>
                  <CardDescription>
                    {mode === 'set-password' 
                      ? 'Create a password to complete your account setup'
                      : 'Enter your new password below'
                    }
                  </CardDescription>
                </>
              ) : (
                <>
                  <CardTitle className="font-serif text-2xl">
                    {t('sign_in')}
                  </CardTitle>
                  <CardDescription>
                    Sign in to manage transport requests
                  </CardDescription>
                </>
              )}
            </CardHeader>
            <CardContent>
              {authLinkError && !isPasswordMode && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>
                    {authLinkError}
                    <span className="block mt-1">Please request a new password reset link.</span>
                  </AlertDescription>
                </Alert>
              )}
              {isPasswordMode ? (
                <form onSubmit={handleSetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">New Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-12"
                      required
                      autoFocus
                    />
                    <PasswordRequirements password={password} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-12"
                      required
                    />
                    {confirmPassword && password !== confirmPassword && (
                      <p className="text-sm text-destructive">Passwords don't match</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    variant="default"
                    className="w-full h-12"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      mode === 'set-password' ? 'Complete Setup' : 'Reset Password'
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('email')}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="h-12"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">{t('password')}</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-12"
                      required
                      minLength={6}
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="default"
                    className="w-full h-12"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      t('sign_in')
                    )}
                  </Button>
                </form>
              )}

              {!isPasswordMode && (
                <p className="mt-6 text-center text-sm text-muted-foreground">
                  Access is by invitation only. Contact your administrator for an account.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-4">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            {t('footer_copyright')}{' '}
            <a 
              href="https://www.margo-hospitality.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {t('footer_margo')}
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
