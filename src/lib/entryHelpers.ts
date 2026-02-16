export function decodePolylineEndpoint(encoded: string): { lat: number; lng: number } | null {
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
  }
  return { lat: lat / 1e5, lng: lng / 1e5 };
}

export const formatPriceLevel = (level: string | null): string | null => {
  if (!level) return null;
  const map: Record<string, string> = {
    PRICE_LEVEL_FREE: 'Free',
    PRICE_LEVEL_INEXPENSIVE: '💰',
    PRICE_LEVEL_MODERATE: '💰💰',
    PRICE_LEVEL_EXPENSIVE: '💰💰💰',
    PRICE_LEVEL_VERY_EXPENSIVE: '💰💰💰💰',
  };
  return map[level] ?? null;
};

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const checkOpeningHoursConflict = (
  openingHours: string[] | null,
  startTime: string
): { isConflict: boolean; message: string | null } => {
  if (!openingHours || openingHours.length === 0) return { isConflict: false, message: null };
  const d = new Date(startTime);
  const jsDay = d.getDay();
  const googleIndex = jsDay === 0 ? 6 : jsDay - 1;
  const dayHours = openingHours[googleIndex];
  if (!dayHours) return { isConflict: false, message: null };
  if (dayHours.toLowerCase().includes('closed')) {
    const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    return { isConflict: true, message: `This place is closed on ${dayNames[googleIndex]}` };
  }
  return { isConflict: false, message: null };
};

export const getEntryDayHours = (hours: string[] | null, entryStartTime?: string): { text: string | null; dayName: string; googleIndex: number } => {
  const d = entryStartTime ? new Date(entryStartTime) : new Date();
  const jsDay = d.getDay();
  const googleIndex = jsDay === 0 ? 6 : jsDay - 1;
  const dayName = DAY_NAMES[googleIndex] ?? '';
  if (!hours || hours.length === 0) return { text: null, dayName, googleIndex };
  return { text: hours[googleIndex] ?? null, dayName, googleIndex };
};

export function formatTimeInTz(isoString: string, tz: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
}

export function getTzAbbr(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date());
    return parts.find(p => p.type === 'timeZoneName')?.value ?? tz.split('/').pop() ?? tz;
  } catch { return tz.split('/').pop() ?? tz; }
}
