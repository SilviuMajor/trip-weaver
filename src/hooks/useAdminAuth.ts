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
        if (event === 'SIGNED_IN' && session) {
          setTimeout(async () => {
            const { data } = await supabase
              .from('user_roles')
              .select('id')
              .eq('user_id', session.user.id)
              .maybeSingle();

            if (!data) {
              await supabase.from('user_roles').insert({
                user_id: session.user.id,
                role: 'admin',
              });
            }
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

  const signUp = async (email: string, password: string) => {
    return supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
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
