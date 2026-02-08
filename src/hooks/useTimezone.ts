import { useState, useCallback } from 'react';
import type { Timezone } from '@/types/trip';

const UK_TZ = 'Europe/London';
const AMS_TZ = 'Europe/Amsterdam';

export function useTimezone() {
  const [timezone, setTimezone] = useState<Timezone>('UK');

  const toggle = useCallback(() => {
    setTimezone(prev => prev === 'UK' ? 'Amsterdam' : 'UK');
  }, []);

  const formatTime = useCallback((isoString: string, format: 'time' | 'datetime' = 'time') => {
    const tz = timezone === 'UK' ? UK_TZ : AMS_TZ;
    const date = new Date(isoString);

    if (format === 'time') {
      return date.toLocaleTimeString('en-GB', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    }

    return date.toLocaleString('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
      hour12: false,
    });
  }, [timezone]);

  const getTimezoneLabel = useCallback(() => {
    return timezone === 'UK' ? 'GMT/BST' : 'CET/CEST';
  }, [timezone]);

  return { timezone, toggle, formatTime, getTimezoneLabel };
}
