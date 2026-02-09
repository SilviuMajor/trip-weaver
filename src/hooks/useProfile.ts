import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useProfile(userId: string | undefined) {
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetch = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', userId)
        .maybeSingle();

      setDisplayName(data?.display_name ?? null);
      setLoading(false);
    };

    fetch();
  }, [userId]);

  const updateDisplayName = async (name: string) => {
    if (!userId) return;
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, display_name: name.trim() || null });

    if (!error) setDisplayName(name.trim() || null);
    return { error };
  };

  return { displayName, loading, updateDisplayName };
}
