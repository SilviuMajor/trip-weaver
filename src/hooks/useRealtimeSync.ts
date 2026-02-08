import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribes to realtime changes on votes, entries, entry_options, and option_images.
 * Calls `onSync` whenever any of these tables change so the parent can re-fetch.
 */
export function useRealtimeSync(onSync: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel('trip-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, onSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, onSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entry_options' }, onSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'option_images' }, onSync)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onSync]);
}
