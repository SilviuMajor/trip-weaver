

# Move Sticky Day Pill Outside Scroll Container

## Problem
The sticky pill is inside `<main>` (the scroll container), so `position: sticky` causes it to scroll with content and overlap the nav bar. It needs to be a sibling element between the tab bar and the scroll container.

## Target DOM Structure
```text
<div> (page root)
  <TimelineHeader />
  <TripNavBar />
  <DayPill />          <-- fixed here, outside scroll container
  <div> (flex layout)
    <LivePanel />
    <main overflow-y-auto>   <-- scroll container
      <ContinuousTimeline />  <-- no longer renders sticky pill
    </main>
    <CategorySidebar />
  </div>
</div>
```

## Changes

### 1. `src/components/timeline/ContinuousTimeline.tsx`

- Add a new callback prop: `onCurrentDayChange?: (dayIndex: number) => void`
- In the existing scroll listener `useEffect`, call `onCurrentDayChange(clamped)` whenever `currentDayIndex` updates
- **Remove** the sticky pill JSX (lines 477-487) entirely -- it will now live in Timeline.tsx
- Remove the `stickyTzAbbrev` variable (no longer needed here)
- Keep `getMidnightTzAbbrev` as it is (still used by inline midnight pills)
- The return goes back to just `<div className="mx-auto max-w-2xl px-4 py-2">...</div>` (remove the fragment wrapper)

### 2. `src/pages/Timeline.tsx`

- Add state: `const [currentDayIndex, setCurrentDayIndex] = useState(0)`
- Pass `onCurrentDayChange={setCurrentDayIndex}` to `<ContinuousTimeline />`
- Add a small inline helper (or `useMemo`) to compute the TZ abbreviation for the current day using the same midnight-TZ logic: check `dayTimezoneMap` for the day, use `flights[0].originTz` if flights exist, otherwise `activeTz`, then format with `Intl.DateTimeFormat`
- Render the day pill **between** `<TripNavBar />` and the `<div className="flex flex-1 overflow-hidden">` block (around line 1463, before the FAB button)
- Pill JSX (centred, non-scrolling):

```tsx
{trip && days.length > 0 && (
  <div className="flex justify-center py-1 bg-background/90 backdrop-blur-md border-b border-border/30 z-30">
    <div className="inline-flex items-center gap-1 rounded-full bg-background border border-border/50 px-3 py-1 text-xs font-semibold text-foreground shadow-sm">
      <span>{isUndated ? `Day ${currentDayIndex + 1}` : format(days[currentDayIndex], 'EEE d MMM').toUpperCase()}</span>
      <span className="text-muted-foreground/60">·</span>
      <span className="text-muted-foreground">{currentDayTzAbbrev}</span>
      {!isUndated && isToday(days[currentDayIndex]) && (
        <span className="ml-1 rounded-full bg-primary px-1.5 py-0 text-[8px] font-semibold text-primary-foreground">TODAY</span>
      )}
    </div>
  </div>
)}
```

- This div is NOT inside `<main>`, so it never scrolls. It sits in the normal document flow between the tab bar and the flex layout, taking up ~32px of vertical space.

### 3. What does NOT change
- Inline midnight pills inside the timeline (kept, with correct TZ)
- Tab bar, header, navigation
- Timeline content, cards, drag/drop, SNAP
- Transport connectors, weather gutter

