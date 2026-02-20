import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export function useAdminAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up listener FIRST (per Supabase best practices)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setLoading(false);

        // On first sign-in, ensure user_roles entry exists
        // Ensure profile exists on sign-in (trigger handles signup, this covers edge cases)
        if (event === 'SIGNED_IN' && session) {
          setTimeout(async () => {
            await supabase.from('profiles').upsert({
              id: session.user.id,
              display_name: session.user.user_metadata?.display_name || null,
            }, { onConflict: 'id' });
          }, 0);
        }
      }
    );

    // Then check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    return supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          display_name: displayName || email.split('@')[0],
        },
      },
    });
  };

  const signOut = async () => {
    return supabase.auth.signOut();
  };

  return {
    session,
    adminUser: session?.user ?? null,
    loading,
    isAdmin: !!session,
    signIn,
    signUp,
    signOut,
  };
}
