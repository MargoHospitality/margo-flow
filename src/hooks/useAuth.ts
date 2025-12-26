import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'super_admin' | 'manager' | null;

interface AuthState {
  user: User | null;
  session: Session | null;
  role: UserRole;
  isLoading: boolean;
  riadIds: string[];
  isActive: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    role: null,
    isLoading: true,
    riadIds: [],
    isActive: true,
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setAuthState(prev => ({
          ...prev,
          session,
          user: session?.user ?? null,
        }));

        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setAuthState(prev => ({
            ...prev,
            role: null,
            riadIds: [],
            isActive: true,
            isLoading: false,
          }));
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState(prev => ({
        ...prev,
        session,
        user: session?.user ?? null,
      }));

      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchUserData(userId: string) {
    try {
      // Fetch role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) console.error('Error fetching user role:', roleError);

      // Fetch riads
      const { data: riadsData, error: riadsError } = await supabase
        .from('user_riads')
        .select('riad_id')
        .eq('user_id', userId);

      if (riadsError) console.error('Error fetching user riads:', riadsError);

      // Fetch profile for is_active status
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) console.error('Error fetching profile:', profileError);

      setAuthState(prev => ({
        ...prev,
        role: (roleData?.role as UserRole) ?? 'manager',
        riadIds: riadsData?.map(r => r.riad_id) ?? [],
        isActive: profileData?.is_active ?? true,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error fetching user data:', error);
      setAuthState(prev => ({ 
        ...prev, 
        role: 'manager', 
        isLoading: false 
      }));
    }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  return {
    ...authState,
    signIn,
    signOut,
    isSuperAdmin: authState.role === 'super_admin',
    isManager: authState.role === 'manager' || authState.role === 'super_admin',
  };
}