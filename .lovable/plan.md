

# Fix Planner/Explore Drag Ghost Outline + Photos

## Overview
Two issues to fix: (1) Planner and Explore drags don't show a ghost outline on the ContinuousTimeline grid, and (2) the floating card during sidebar drag uses a SidebarEntryCard instead of matching the timeline's EntryCard visual. Photos issue appears already fixed (filtered option_images query exists at line 273).

## Changes

### 1. ContinuousTimeline.tsx -- Add `externalDragGlobalHour` and `externalDragDurationHours` props

Add two new optional props to `ContinuousTimelineProps`:
- `externalDragGlobalHour?: number | null` -- the global hour where the external card would land
- `externalDragDurationHours?: number | null` -- duration in hours of the externally-dragged card

Destructure them in the component.

After the existing ghost outline block (line ~1986, after the detached move ghost), render a new ghost outline for external drags:

```
{externalDragGlobalHour != null && externalDragDurationHours != null && (() => {
  const ghostTop = externalDragGlobalHour * pixelsPerHour;
  const ghostHeight = externalDragDurationHours * pixelsPerHour;
  return (
    <div
      className="absolute left-0 right-0 z-[11] rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 pointer-events-none transition-all duration-75"
      style={{ top: ghostTop, height: Math.max(ghostHeight, 20) }}
    >
      <div className="absolute -left-[72px] top-0 z-[60] pointer-events-none">
        <span className="inline-flex items-center justify-center rounded-full bg-white dark:bg-zinc-800 border border-border shadow-sm px-2 py-0.5 text-[10px] font-bold text-foreground whitespace-nowrap">
          {formatGlobalHourToDisplay(externalDragGlobalHour)}
        </span>
      </div>
    </div>
  );
})()}
```

This uses the exact same visual treatment (className, positioning math) as the existing timeline ghost at lines 1969-1983, ensuring visual consistency.

### 2. Timeline.tsx -- Pass external drag state to ContinuousTimeline

On the `<ContinuousTimeline>` component (line ~2795), add:

```
externalDragGlobalHour={
  (sidebarDrag?.globalHour ?? exploreDrag?.globalHour) ?? null
}
externalDragDurationHours={
  sidebarDrag
    ? (new Date(sidebarDrag.entry.end_time).getTime() - new Date(sidebarDrag.entry.start_time).getTime()) / 3600000
    : exploreDrag
      ? 1
      : null
}
```

This covers both sidebar and explore drags. Sidebar drags use the entry's actual duration; explore drags default to 1 hour.

### 3. Timeline.tsx -- Replace floating SidebarEntryCard with EntryCard during sidebar drag

Replace the sidebar drag floating card (lines 3211-3235) to use `EntryCard` instead of `SidebarEntryCard`, matching the timeline's Stage 1 visual:

```
{sidebarDrag && (() => {
  const opt = sidebarDrag.entry.options[0];
  if (!opt) return null;
  const durationMs = new Date(sidebarDrag.entry.end_time).getTime() - new Date(sidebarDrag.entry.start_time).getTime();
  const durationHours = durationMs / 3600000;
  const moveHeight = durationHours * pixelsPerHour;
  const cardWidth = Math.min(window.innerWidth * 0.6, 300);
  return (
    <div className="fixed inset-0 z-[200] pointer-events-none">
      <div
        style={{
          position: 'fixed',
          left: sidebarDrag.clientX - cardWidth / 2,
          top: sidebarDrag.clientY - 40,
          width: cardWidth,
          height: Math.max(moveHeight, 60),
          willChange: 'transform',
        }}
      >
        <div className="h-full ring-2 ring-primary/60 shadow-lg shadow-primary/20 rounded-2xl overflow-hidden">
          <EntryCard
            option={opt}
            startTime={sidebarDrag.entry.start_time}
            endTime={sidebarDrag.entry.end_time}
            formatTime={(iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}
            isPast={false}
            optionIndex={0}
            totalOptions={1}
            votingLocked={votingLocked}
            hasVoted={false}
            onVoteChange={() => {}}
            cardSizeClass="h-full"
            height={Math.max(moveHeight, 60)}
            notes={sidebarDrag.entry.notes}
            isLocked={sidebarDrag.entry.is_locked}
          />
        </div>
        {sidebarDrag.globalHour !== null && sidebarDrag.globalHour >= 0 && (
          <div className="mt-1 flex justify-center">
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-primary-foreground shadow-md">
              {String(Math.floor((sidebarDrag.globalHour % 24))).padStart(2, '0')}:
              {String(Math.round(((sidebarDrag.globalHour % 1) * 60))).padStart(2, '0')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
})()}
```

This matches the Stage 1 in-timeline card (lines 1999-2025 of ContinuousTimeline) with ring-2 ring-primary/60, shadow-lg shadow-primary/20, rounded-2xl overflow-hidden.

Import `EntryCard` at the top of Timeline.tsx (add alongside the existing SidebarEntryCard import).

### 4. Photos -- Verify current state

The option_images query (lines 271-278) is already filtered by option IDs:
```
optionIds.length > 0
  ? supabase.from('option_images').select('*').in('option_id', optionIds).order('sort_order')
  : Promise.resolve({ data: [] as any[] }),
```

This was fixed in a previous prompt. If photos still aren't appearing, it may be because:
- The `handleAddAtTime` function (used by explore drag) creates the entry but the background photo fetch hasn't completed yet when `fetchData()` is called
- This is expected behavior: the card appears immediately with name/rating, photos fill in moments later after the google-places details call completes

No code change needed for photos -- the current implementation is correct.

## Files Modified
- `src/components/timeline/ContinuousTimeline.tsx` -- add `externalDragGlobalHour` and `externalDragDurationHours` props, render ghost outline
- `src/pages/Timeline.tsx` -- pass external drag state to ContinuousTimeline, replace floating SidebarEntryCard with EntryCard, import EntryCard

