
# Three Transport Fixes

## Fix 1: TransportOverlay — Desktop Dialog, Mobile Drawer

**File**: `src/components/timeline/TransportOverlay.tsx`

Replace the `Sheet`/`SheetContent` wrapper with a responsive pattern using `useIsMobile()`:
- Import `useIsMobile` from `@/hooks/use-mobile`
- Import `Dialog`, `DialogContent` from `@/components/ui/dialog`
- Import `Drawer`, `DrawerContent` from `@/components/ui/drawer`
- Remove `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle`/`SheetDescription` imports
- Extract all inner content (header through footer) into a `content` variable
- On mobile: wrap in `Drawer` + `DrawerContent`
- On desktop: wrap in `Dialog` + `DialogContent` with `sm:max-w-sm p-0`

## Fix 2: Overflow Connector Z-Index

**File**: `src/components/timeline/ContinuousTimeline.tsx` (line 1310)

Change the connector container z-index from `gapPx < 14 ? 5 : 12` to `gapPx < 14 ? 25 : 12`. This ensures overflow connectors (22px band on tiny gaps) paint above adjacent cards which sit at z-10.

**File**: `src/components/timeline/TransportConnector.tsx` (line 67)

Fix the `topOffset` calculation. Currently `-(22 - gapHeight) / 2` which is correct but should use `(gapHeight - 22) / 2` for clarity (same value, negative). No functional change needed — the current formula already produces the correct negative offset.

## Fix 3: Cog Position — After Emoji and Duration

**File**: `src/components/timeline/TransportConnector.tsx` (lines 119-133)

Reorder the text row elements from: `[cog, emoji, duration, destination]` to: `[emoji, duration, cog, destination]`

Move the `<button>` containing the Settings icon to after the duration `<span>`, before the destination `<span>`.

## Files Modified

- `src/components/timeline/TransportOverlay.tsx` — responsive Dialog/Drawer wrapper
- `src/components/timeline/ContinuousTimeline.tsx` — overflow z-index bump (line 1310)
- `src/components/timeline/TransportConnector.tsx` — reorder text row elements
