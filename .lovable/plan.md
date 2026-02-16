

# Batch Fixes: Votes, Duration Pills, Transport, Overview, Opening Hours

## Overview
Five targeted fixes across EntryCard, EntrySheet, ContinuousTimeline, and TransportConnector.

## Change 1: Remove VoteButton rendering everywhere

### EntryCard.tsx
- Remove `import VoteButton from './VoteButton'` (line 13)
- Keep `hasVoted` and `onVoteChange` in the interface/destructuring to avoid breaking callers
- Remove the VoteButton render block (lines 690-701)

### EntrySheet.tsx
- Remove `import VoteButton from './VoteButton'` (line 30)
- Remove the VoteButton section in view mode (lines 1767-1779)

### ContinuousTimeline.tsx
- No changes needed -- it passes `hasVoted`/`onVoteChange` to EntryCard but since EntryCard won't render VoteButton, this is fine. Keep the props to avoid type errors.

## Change 2: Duration pill -- ALWAYS absolute top-right, add content padding

### EntryCard.tsx
All tiers get the absolute top-right pill via `durationPillStyle`. Content areas get right-padding to prevent overlap.

- **Full (>=160px)**: Already has `durationPillStyle('l')` at line 629. Add `pr-16` to content div (line 632).
- **Condensed (80-159px)**: Add `<div style={durationPillStyle('m')}>{durationLabel}</div>` back. Remove the inline duration pill from the flex row (lines 610-615). Change time to just show time without inline pill. Add `pr-14` to content div (line 594).
- **Medium (40-79px)**: Add `<div style={durationPillStyle('s')}>{durationLabel}</div>`. Remove inline `<span className="ml-1 font-bold">{durationLabel}</span>` from line 576. Add `pr-12` to content div (line 572).
- **Compact (<40px)**: Add `<div style={durationPillStyle('xs')}>{durationLabel}</div>`. Remove inline `<span className="font-bold">{durationLabel}</span>` from line 557. Add `pr-10` to content div (line 554).

## Change 3: TransportConnector.tsx -- already simplified

The TransportConnector was already rewritten in the previous batch. The current code matches the simplified version (tappable pill, no mode switching). ContinuousTimeline already passes just `onTap`. No changes needed here.

## Change 4: EntrySheet.tsx -- Overview improvements

### 4a. Hero image height: 200px to 240px on mobile
- Line 1222: Change `height: 200` to `height: 240`
- Line 1259: Change `height: 120` to `height: 160` (empty state)

### 4b. Phone + Website as plain text below title
Replace the grid layout (lines 1697-1738) with simple inline emoji text:
```tsx
{option.category !== 'transfer' && option.category !== 'flight' && (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
    {(option as any).phone && (
      <a href={`tel:${(option as any).phone}`} className="text-sm text-primary hover:underline" onClick={e => e.stopPropagation()}>
        phone emoji {(option as any).phone}
      </a>
    )}
    {option.website && (
      <a href={option.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate max-w-[200px]" onClick={e => e.stopPropagation()}>
        link emoji {hostname}
      </a>
    )}
  </div>
)}
```
No boxes, no containers, no labels. Empty values are simply not shown (no dashes).

## Change 5: Opening hours -- fix double day name

### EntrySheet.tsx PlaceDetailsSection (line 187)
The trigger currently shows: `{dayName}: {entryDayHoursText}` which produces "Wed: Wednesday: 09:00 - 01:00".

Fix: Just show the raw `entryDayHoursText` string from the Google API as-is (it already contains the day name):
```tsx
<span className="flex-1 truncate text-muted-foreground text-xs font-semibold">
  {entryDayHoursText || 'Opening hours'}
</span>
```
Remove the `{dayName}: ` prefix. Keep the clock emoji before it.

## Files modified
| File | Scope |
|------|-------|
| `src/components/timeline/EntryCard.tsx` | Remove VoteButton import+render, duration pill always absolute with content padding |
| `src/components/timeline/EntrySheet.tsx` | Remove VoteButton, hero 240px, plain phone/website, fix opening hours double day |
| No changes to ContinuousTimeline or TransportConnector |

