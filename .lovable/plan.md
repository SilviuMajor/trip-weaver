

# TZ-Aware Gutter Hour Labels

## Problem
Hour labels in the gutter use a naive `globalHour % 24` calculation, so on flight days with a timezone change, the labels don't reflect the clock jump that cards already show. For example, flying GMT to CET should skip an hour in the labels.

## Changes (single file: `src/components/timeline/ContinuousTimeline.tsx`)

### 1. Hour labels (lines 660-662)
Replace the simple modulo with TZ-aware logic that checks `dayTimezoneMap` for flights on that day. If the hour falls after the flight's end hour, apply `getUtcOffsetHoursDiff` to shift the displayed number.

**Before:**
```typescript
const localHour = globalHour % 24;
const displayHour = `${String(localHour).padStart(2, '0')}:00`;
```

**After:**
```typescript
const dayIndex = Math.floor(globalHour / 24);
const hourInDay = globalHour % 24;
const dayDate = days[Math.min(dayIndex, days.length - 1)];
if (!dayDate) return null;
const dayStr = format(dayDate, 'yyyy-MM-dd');
const tzInfo = dayTimezoneMap.get(dayStr);

let displayHourNum = hourInDay;
if (tzInfo?.flights && tzInfo.flights.length > 0) {
  const f = tzInfo.flights[0];
  if (hourInDay >= f.flightEndHour) {
    const offset = getUtcOffsetHoursDiff(f.originTz, f.destinationTz);
    displayHourNum = ((hourInDay + offset) % 24 + 24) % 24;
  }
}
const displayHour = `${String(displayHourNum).padStart(2, '0')}:00`;
```

### 2. 30-minute gutter labels (lines 713-714)
Apply the identical TZ-aware calculation so the `:30` labels also shift after a flight boundary.

**Before:**
```typescript
const localHour = globalHour % 24;
// then renders: {String(localHour).padStart(2, '0')}:30
```

**After:** Same dayIndex/hourInDay/flight lookup logic, then render `{String(displayHourNum).padStart(2, '0')}:30`.

### Nothing else changes
- Card positioning (already correct)
- Flight group cards, day markers, weather column, drag logic -- all untouched
- `getUtcOffsetHoursDiff` and `dayTimezoneMap` are already imported/in scope

### Expected behavior
- **Flight GMT to GMT+1**: labels before flight are sequential (07, 08, 09...). After flight arrival, labels skip one (e.g., 11 jumps to 13).
- **Flight GMT+2 to GMT-5**: labels jump backward 7 hours after the flight.
- **No-flight days**: labels remain 0-23 sequential.
- **30-min labels at zoom >120%**: shift identically.
