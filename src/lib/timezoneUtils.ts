/**
 * Timezone conversion utilities.
 * All entries should be stored as proper UTC timestamps.
 */

/** Convert a local date+time in a specific IANA timezone to a UTC ISO string */
export function localToUTC(dateStr: string, timeStr: string, tz: string): string {
  // Build a "fake" Date from the wall-clock values (interpreted in browser local tz, but we only care about the numeric components)
  const fakeDate = new Date(`${dateStr}T${timeStr}:00`);

  // Render "dateStr T timeStr" as if it were UTC, then format it in the target tz to find the offset
  const utcDate = new Date(`${dateStr}T${timeStr}:00Z`);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(utcDate);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0';
  const localInTz = new Date(
    `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`
  );
  const offsetMs = localInTz.getTime() - utcDate.getTime();

  // fakeDate holds the wall-clock instant; subtract the offset to get true UTC
  const adjustedUtc = new Date(fakeDate.getTime() - offsetMs);
  return adjustedUtc.toISOString();
}

/** Convert a UTC ISO string to local date and time strings in a given timezone */
export function utcToLocal(isoString: string, tz: string): { date: string; time: string } {
  const d = new Date(isoString);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}

/** Get the date string in a specific timezone for a UTC ISO string */
export function getDateInTimezone(isoString: string, tz: string): string {
  return utcToLocal(isoString, tz).date;
}
