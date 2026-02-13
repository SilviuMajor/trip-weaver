

# Four Quick Fixes

## Fix 1: TZ badge centered on flight portion

**File**: `src/components/timeline/ContinuousTimeline.tsx` (lines 1204-1205)

Change:
```typescript
const globalFlightEndHour = dayIndex * 24 + f.flightEndHour;
const badgeTop = globalFlightEndHour * PIXELS_PER_HOUR + PIXELS_PER_HOUR / 2 - 8;
```
To:
```typescript
const globalFlightMidHour = dayIndex * 24 + (f.flightStartHour + f.flightEndHour) / 2;
const badgeTop = globalFlightMidHour * PIXELS_PER_HOUR - 8;
```

---

## Fix 2: "Send to Planner" disabled when locked

**File**: `src/components/timeline/EntrySheet.tsx` (lines 1682-1687)

Replace the conditional hide with always-visible but disabled-when-locked:
```tsx
{isEditor && onMoveToIdeas && option?.category !== 'transfer' && option?.category !== 'flight' && (
  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
    <Button
      variant="outline"
      size="sm"
      disabled={isLocked}
      onClick={() => {
        if (isLocked) {
          toast({ title: 'Unlock this entry first', description: 'Locked entries cannot be sent to the Planner.' });
          return;
        }
        onMoveToIdeas(entry.id);
      }}
    >
      <ClipboardList className="mr-1.5 h-3.5 w-3.5" /> Send to Planner
    </Button>
  </div>
)}
```

The `disabled` prop greys out the button; the guard in `onClick` is a safety fallback.

---

## Fix 3: Planner sidebar independent scroll

**File**: `src/components/timeline/CategorySidebar.tsx` (lines 318-331)

Update the desktop container to be a flex column with explicit height:
```tsx
<div
  className={cn(
    'shrink-0 border-l border-border bg-background flex flex-col overflow-hidden transition-all duration-300',
    open
      ? compact ? 'w-[25vw]' : 'w-[30vw] max-w-[500px]'
      : 'w-0'
  )}
  style={{ height: '100%' }}
>
  {open && panelContent}
</div>
```

The `panelContent` variable (line 183) already uses `flex h-full flex-col`. The scrollable area inside it needs `flex-1 overflow-y-auto` -- will verify the inner scroll container has this. Since `panelContent` is defined at line 183 as `<div className="flex h-full flex-col">`, the structure should work once the parent has explicit height.

---

## Fix 4: Sticky header/nav stability

**File**: `src/components/timeline/TimelineHeader.tsx` (line ~24)

Add `will-change-transform` to the header element's className.

**File**: `src/components/timeline/TripNavBar.tsx` (line ~48)

Add `will-change-transform` to the nav container's className.

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/timeline/ContinuousTimeline.tsx` | TZ badge position: midpoint of flight |
| `src/components/timeline/EntrySheet.tsx` | Send to Planner: visible but disabled when locked |
| `src/components/timeline/CategorySidebar.tsx` | Desktop sidebar: flex column with height constraint |
| `src/components/timeline/TimelineHeader.tsx` | Add `will-change-transform` |
| `src/components/timeline/TripNavBar.tsx` | Add `will-change-transform` |

## What Does NOT Change
- Flight card rendering, hotel system, transport system
- Entry card drag/resize behavior
- Weather system, auto-extend logic, trim logic

