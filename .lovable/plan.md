
# Fix Mobile Pinch-to-Zoom Registration and Add Account Settings Access

## Problem
1. The pinch-to-zoom `useEffect` runs before the `<main>` element renders (it's behind a loading gate), so `mainScrollRef.current` is null and listeners never attach. The deps don't change when the DOM becomes ready.
2. iOS Safari's native page zoom competes with the custom pinch handler.
3. No way to reach Account Settings (where the zoom toggle lives) from the timeline header.

## Changes

### 1. `index.html` -- Disable native browser zoom
Update the viewport meta tag (line 5) to prevent iOS Safari from intercepting pinch gestures:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1, user-scalable=no" />
```

### 2. `src/pages/Timeline.tsx` -- Callback ref for scroll container

Add a `scrollContainerReady` state:
```typescript
const [scrollContainerReady, setScrollContainerReady] = useState(false);
```

Replace the `ref={mainScrollRef}` on `<main>` with a callback ref that sets both the ref and the ready flag:
```tsx
<main
  ref={(el) => {
    (mainScrollRef as React.MutableRefObject<HTMLElement | null>).current = el;
    if (el && !scrollContainerReady) setScrollContainerReady(true);
  }}
  ...
>
```

Update both zoom `useEffect` dependency arrays to `[zoomEnabled, scrollContainerReady]` (removing `isMobile` and `mobileView` since they're no longer needed -- the callback ref handles re-mount).

### 3. `src/components/timeline/TimelineHeader.tsx` -- Add Account Settings button
- Import `User` from lucide-react
- Add a `User` icon button before the logout button that navigates to `/settings`
- Visible to all users (not gated by `isOrganizer`)

## Files changed
1. `index.html` -- viewport meta tag
2. `src/pages/Timeline.tsx` -- callback ref + scrollContainerReady state + effect deps
3. `src/components/timeline/TimelineHeader.tsx` -- Account Settings button

## What does NOT change
- Zoom gesture logic (pinch calculation, scroll anchoring)
- Desktop Ctrl+scroll logic
- Sub-hour grid lines, zoom indicator
- Trip Settings page or its access
- Any drag/resize mechanics
