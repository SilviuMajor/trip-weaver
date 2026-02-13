

# Remove Dead/Defunct Code

## Changes

### 1. Delete files
- `src/components/timeline/TravelSegmentCard.tsx`
- `src/pages/StyleShowcase.tsx`
- `src/components/timeline/CalendarDay.tsx`

### 2. `src/components/timeline/ContinuousTimeline.tsx`
- Remove line 12: `import TravelSegmentCard from './TravelSegmentCard';`
- Remove `travelSegments: TravelSegment[]` from the props interface (line 42)
- Remove `travelSegments,` from the destructured props (line 75)
- Remove `TravelSegment` from the type import on line 4 (if no longer used elsewhere in the file)

### 3. `src/pages/Timeline.tsx`
- Remove `const [travelSegments, setTravelSegments] = useState<TravelSegment[]>([]);` (line 38)
- Remove `supabase.from('travel_segments').select('*').eq('trip_id', tripId)` from the Promise.all (line 123), and remove `setTravelSegments(...)` (line 127). Adjust the destructuring accordingly.
- Remove `travelSegments={travelSegments}` prop on ContinuousTimeline (line 1595)
- Remove `TravelSegment` from the type import if no longer used

### 4. `src/App.tsx`
- Remove line 13: `import StyleShowcase from "./pages/StyleShowcase";`
- Remove line 35: `<Route path="/styles" element={<StyleShowcase />} />`

## What does NOT change
- Database tables/migrations (travel_segments table stays)
- OptionSwiper, VoteButton, LivePanel, Live, UserSelect
- All other timeline components

## Test expectations
- App builds without errors
- Timeline renders correctly
- No `/styles` route
- No console errors for removed components
