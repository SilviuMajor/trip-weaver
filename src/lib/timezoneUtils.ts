/**
 * Timezone conversion utilities.
 * All entries should be stored as proper UTC timestamps.
 * This is the single source of truth for timezone-aware positioning.
 */

import type { EntryWithOptions } from '@/types/trip';

// ─── Core UTC ↔ Local Conversions ───────────────────────────────────

/** Convert a local date+time in a specific IANA timezone to a UTC ISO string */
export function localToUTC(dateStr: string, timeStr: string, tz: string): string {
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
  const fakeDate = new Date(`${dateStr}T${timeStr}:00Z`);
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

// ─── Visual Hour Slot Utilities ─────────────────────────────────────

/** Convert a UTC ISO string to a fractional hour in a given timezone.
 *  e.g. 14:30 → 14.5. Used for card vertical positioning on the 24h grid. */
export function getHourInTimezone(isoString: string, tzName: string): number {
  const date = new Date(isoString);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tzName,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0');
  return hour + minute / 60;
}

// ─── Entry Timezone Resolution ──────────────────────────────────────

interface FlightTzInfo {
  originTz: string;
  destinationTz: string;
  flightStartHour: number;
  flightEndHour: number;
  flightEndUtc?: string;
}

/** Resolve the timezone(s) to use for positioning an entry on the visual grid.
 *  Flights use departure_tz for start and arrival_tz for end.
 *  Other entries resolve based on whether they're before/after a flight on that day. */
export function resolveEntryTz(
  entry: EntryWithOptions,
  dayFlights: FlightTzInfo[],
  activeTz: string | undefined,
  tripTimezone: string
): { startTz: string; endTz: string } {
  const opt = entry.options[0];
  if (opt?.category === 'flight' && opt.departure_tz && opt.arrival_tz) {
    return { startTz: opt.departure_tz, endTz: opt.arrival_tz };
  }
  let tz = activeTz || tripTimezone;
  if (dayFlights.length > 0 && dayFlights[0].flightEndUtc) {
    const entryMs = new Date(entry.start_time).getTime();
    const flightEndMs = new Date(dayFlights[0].flightEndUtc).getTime();
    tz = entryMs >= flightEndMs ? dayFlights[0].destinationTz : dayFlights[0].originTz;
  }
  return { startTz: tz, endTz: tz };
}

/** Resolve the correct timezone for a visual hour slot on the grid.
 *  On flight days, slots after the flight's visual end hour use the destination TZ. */
export function resolveDropTz(
  hourOffset: number,
  tzInfo: { activeTz: string; flights: FlightTzInfo[] } | undefined,
  tripTimezone: string
): string {
  if (!tzInfo || tzInfo.flights.length === 0) {
    return tzInfo?.activeTz || tripTimezone;
  }
  // Use the last flight to determine the boundary
  const lastFlight = tzInfo.flights[tzInfo.flights.length - 1];
  if (hourOffset >= lastFlight.flightEndHour) {
    return lastFlight.destinationTz;
  }
  return lastFlight.originTz;
}

// ─── UTC Offset Utilities ───────────────────────────────────────────

/** Get the UTC offset in minutes for a given date and timezone */
export function getUtcOffsetMinutes(date: Date, tz: string): number {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = date.toLocaleString('en-US', { timeZone: tz });
  return (new Date(tzStr).getTime() - new Date(utcStr).getTime()) / 60000;
}

/** Get the difference in UTC offset hours between two timezones */
export function getUtcOffsetHoursDiff(originTz: string, destTz: string): number {
  try {
    const now = new Date();
    const originOffset = getUtcOffsetMinutes(now, originTz);
    const destOffset = getUtcOffsetMinutes(now, destTz);
    return (destOffset - originOffset) / 60;
  } catch {
    return 0;
  }
}
