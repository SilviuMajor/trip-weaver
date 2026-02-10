

# Transport Card Redesign + "When" Section Removal + View Mode Fix

## Issues Found

### 1. "When" section still shows for transport entries
In `EntrySheet.tsx` (create mode), the entire "When" section (lines 1338-1416) -- including the "When" label, time inputs, and duration field -- still renders for transport entries. When transport context exists, the timing is derived from the gap, so these fields are redundant and should be hidden.

### 2. Transport cards look the same as regular entries on the timeline
Currently, transport entries render using the same `EntryCard` component as everything else. They appear as a full card with category badge, title, time row, etc. The user wants transport to look visually distinct -- more like a connector/segment showing mode, time, and distance rather than a full event card.

### 3. Transport view mode doesn't match the new card design
When clicking a transport card, the view mode in `EntrySheet.tsx` shows a generic entry layout (lines 935-975) with From/To, clock/time, route map, and then the standard website/map/vote/image section below. It should match the distinct transport visual and show relevant transport-specific info cleanly.

---

## Changes

### A. Remove "When" section for transport with context (`EntrySheet.tsx`)

Hide the entire "When" block (the divider, date selector, time inputs, and duration field) when `isTransfer && transportContext` is present. The start/end times are already computed from the selected route mode and the gap position.

**Lines affected**: 1338-1416 -- wrap in a condition `{!(isTransfer && transportContext) && (...)}`

### B. Redesign transport timeline card (`EntryCard.tsx`)

For transport entries (`isTransfer === true`), render a completely different layout instead of the standard card. The new transport card will be a horizontal connector-style element:

```
[Mode emoji]  Walk to Restaurant Y    12m · 0.8km
              ─────────────────────
              [mini route map if available]
```

Design:
- No category badge (it's visually obvious from the design)
- Horizontal layout: mode emoji on left, name + details on right
- Duration and distance shown inline, prominently
- Dashed left border in the category color (same as current)
- Subtler/slimmer than regular cards
- Contingency buffer shown as small muted text if applicable
- Mini route map preserved below if polyline exists and card is large enough

This applies to all 4 layout variants (compact, medium, condensed, full).

### C. Redesign transport view overlay (`EntrySheet.tsx` view mode)

When viewing a transport entry (lines 935-975), redesign the layout to match the card's connector feel:

```
+--------------------------------------------+
| [Mode emoji large]   Transit               |
|                                             |
| From:  Heathrow Airport                     |
| To:    Hotel Krasnapolsky                   |
|                                             |
| 12m · 1.2km                                |
| +2m contingency buffer                      |
|                                             |
| [====== Route Map ======]                   |
| [Open in Google Maps] [Open in Apple Maps]  |
|                                             |
| 09:30 -- 09:42                              |
|                                             |
| ------------------------------------------- |
| [Lock] [Move to Ideas] [Delete]             |
+--------------------------------------------+
```

Key differences from current:
- No website field for transport view
- Mode emoji + mode label as the header instead of category badge
- From/To displayed prominently
- Duration + distance shown as the primary metric
- Contingency buffer shown if block time differs from real duration
- Route map with "Open in Maps" buttons
- Time shown but de-emphasized

---

## File Summary

| File | Changes |
|------|---------|
| `src/components/timeline/EntrySheet.tsx` | Hide "When" section when `isTransfer && transportContext`. Redesign transport view mode layout with mode-centric header, From/To, duration/distance, contingency, and map links. Remove website from transport view. |
| `src/components/timeline/EntryCard.tsx` | Add a distinct transport card layout for all 4 size variants (compact, medium, condensed, full) showing mode emoji, name, duration, distance as a slim connector-style card instead of the standard event card. |

No database changes. No edge function changes. No new files.

---

## Technical Details

### EntryCard transport layouts

**Full layout** (height >= 160px):
- Slim horizontal bar with mode emoji, entry name, duration pill, distance
- Category color left border (3px)
- Mini route map below if polyline exists
- Lighter background tint than regular cards

**Condensed layout** (80-160px):
- Mode emoji + name on one line, duration + distance on second line
- No route map (not enough space)

**Medium layout** (40-80px):
- Single line: emoji + truncated name + duration

**Compact layout** (< 40px):
- Single line: emoji + duration only

### EntrySheet "When" section hiding

Current code (line 1338):
```tsx
<div className="border-t border-border/50 pt-4 mt-2">
  <Label className="text-sm font-semibold text-muted-foreground">When</Label>
</div>
```

Wrap lines 1338-1416 in: `{!(isTransfer && transportContext) && ( ... )}`

### Transport view mode redesign

Replace the current transfer view block (lines 935-975) with a mode-centric layout. Extract travel mode from the entry name or store it. Use a `getModeEmoji` helper (already exists in TravelSegmentCard.tsx) to determine the mode icon. Calculate contingency from block duration vs real duration (block = entry end - start, real = nearest lower non-5-multiple or stored value).

### Mode detection for view

Since we don't store the travel mode separately, extract it from the entry name pattern (e.g., "Walk to ...", "Transit to ...", "Drive to ...") or from the category. Add a simple helper:
```typescript
function detectTransportMode(name: string): { mode: string; emoji: string; label: string } {
  const lower = name.toLowerCase();
  if (lower.startsWith('walk')) return { mode: 'walk', emoji: '🚶', label: 'Walking' };
  if (lower.startsWith('transit')) return { mode: 'transit', emoji: '🚌', label: 'Transit' };
  if (lower.startsWith('drive')) return { mode: 'drive', emoji: '🚗', label: 'Driving' };
  if (lower.startsWith('cycle')) return { mode: 'bicycle', emoji: '🚲', label: 'Cycling' };
  return { mode: 'transit', emoji: '🚆', label: 'Transport' };
}
```

