import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribes to realtime changes on votes, entries, entry_options, and option_images.
 * Calls `onSync` whenever any of these tables change so the parent can re-fetch.
 * Debounces rapid-fire events (e.g. batch photo inserts) into a single call.
 */
export function useRealtimeSync(onSync: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSync = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSync();
      timerRef.current = null;
    }, 500);
  }, [onSync]);

  useEffect(() => {
    const channel = supabase
      .channel('trip-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, debouncedSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, debouncedSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entry_options' }, debouncedSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'option_images' }, debouncedSync)
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [debouncedSync]);
}
