
# FlightGroupCard: Lock-in-Pill + Check-in/Checkout Backgrounds

## Overview
Two changes to FlightGroupCard.tsx: replace the existing frosted-glass duration pill with a perma-locked orange lock pill, and update check-in/checkout section backgrounds to a consistent blue HSLA tint with border separators.

## File: `src/components/timeline/FlightGroupCard.tsx`

### Change 1: Lock-in-Pill (Perma-Locked)

**Add imports:**
- `Lock` from `lucide-react`
- `useToast` from `@/hooks/use-toast`
- `useTheme` from `next-themes`

**Add inside component body:**
```tsx
const { toast } = useToast();

const handleFlightLockTap = (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
  e.stopPropagation();
  toast({ description: "Flights are locked — edit times in the overview" });
};
```

**Replace the existing duration pill (lines 153-159)** with the lock pill:
```tsx
<div
  className="absolute top-[7px] right-[7px] z-20 rounded-full font-bold flex items-center gap-1 cursor-pointer select-none"
  style={{
    fontSize: 10,
    padding: '3px 10px',
    background: 'rgba(224, 138, 58, 0.85)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(224, 138, 58, 0.4)',
    color: '#fff',
  }}
  onClick={handleFlightLockTap}
  onMouseDown={(e) => e.stopPropagation()}
  onTouchStart={(e) => e.stopPropagation()}
  onPointerDown={(e) => e.stopPropagation()}
>
  <Lock className="h-2.5 w-2.5" />
  <span>{flightDuration}</span>
</div>
```

Always orange, always shows Lock icon. Tapping shows a toast instead of toggling.

### Change 2: Check-in/Checkout Backgrounds (Option D)

**Add theme detection:**
```tsx
const { theme } = useTheme();
const isDark = theme === 'dark';
const processBarBg = isDark ? 'hsla(210, 50%, 45%, 0.25)' : 'hsla(210, 55%, 55%, 0.15)';
const processBarBorder = '1px solid hsla(210, 50%, 55%, 0.12)';
```

**Update check-in section (line 94-95):** Replace `backgroundColor: catColor + '33'` with:
```tsx
style={{ flex: checkinFraction, background: processBarBg, borderBottom: processBarBorder }}
```

**Update checkout section (line 184-185):** Replace `backgroundColor: catColor + '33'` with:
```tsx
style={{ flex: checkoutFraction, background: processBarBg, borderTop: processBarBorder }}
```

### What stays unchanged
- Right-aligned flight name and route text
- Timeline dot + dashed line in check-in/checkout sections
- Diagonal fade gradient on flight main section
- Corner flag (plane emoji) top-left
- All check-in/checkout content (labels, detail text, times)
- Flex layout (check-in, flight, checkout stacked vertically)
- `formatDuration` helper (reused for pill label)
