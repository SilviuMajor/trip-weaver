

# Fix: Single-Tap Transport Mode Switching on Mobile

## Problem

On mobile, switching transport mode requires two taps. This is caused by CSS hover states intercepting the first tap -- the browser shows the hover style on first touch, then fires the click on the second.

## Solution

### TransportConnector.tsx

**Lines 177-180** -- Replace `hover:opacity-80` with mobile-friendly active state and add `touch-action: manipulation` to eliminate the 300ms tap delay:

```tsx
<button
  key={mode}
  onClick={(e) => { ... }}
  style={{ touchAction: 'manipulation', ...(isSelected ? selectedStyle : undefined) }}
  className={cn(
    'flex flex-col items-center rounded-md px-1.5 py-0.5 transition-all',
    !isSelected && 'opacity-50 active:opacity-80',
    !modeData && 'opacity-20 pointer-events-none'
  )}
>
```

Key changes:
- `hover:opacity-80` becomes `active:opacity-80` -- responds instantly to touch without waiting for a second tap
- `touchAction: 'manipulation'` on each mode button -- tells the browser this is a tap target, eliminating double-tap-to-zoom delay

### Files Modified

| File | Change |
|------|--------|
| `src/components/timeline/TransportConnector.tsx` | Replace `hover:opacity-80` with `active:opacity-80`; add `touchAction: 'manipulation'` to mode buttons |

### What Does NOT Change
- Desktop hover behavior still works (active fires on mousedown which is fine)
- Mode switching logic, refresh, delete, info tap -- all unchanged
- Visual appearance of selected/unselected modes unchanged

