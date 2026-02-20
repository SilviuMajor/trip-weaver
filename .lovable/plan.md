

# L1c — Copy/Duplicate Missing Enrichment Fields

## Overview
Three entry_options insert blocks in Timeline.tsx are missing 11 enrichment fields (phone, address, rating, user_rating_count, opening_hours, google_maps_uri, google_place_id, price_level, hotel_id, estimated_budget, actual_cost). When entries are copied, duplicated, or inserted from the sidebar, the cloned options lose this data.

## Changes

### `src/pages/Timeline.tsx` — 3 identical fixes

**Fix 1: handleDropOnTimeline copy path (lines 1674-1691)**
Add the 11 missing fields after `airport_checkout_min: opt.airport_checkout_min,`

**Fix 2: handleDuplicate path (lines 2142-2158)**
Same addition after `airport_checkout_min: opt.airport_checkout_min,`

**Fix 3: Sidebar insert path (lines 2238-2254)**
Same addition after `airport_checkout_min: opt.airport_checkout_min,`

All three get these fields added:
```
phone: opt.phone,
address: opt.address,
rating: opt.rating,
user_rating_count: opt.user_rating_count,
opening_hours: opt.opening_hours,
google_maps_uri: opt.google_maps_uri,
google_place_id: opt.google_place_id,
price_level: opt.price_level,
hotel_id: opt.hotel_id,
estimated_budget: opt.estimated_budget,
actual_cost: opt.actual_cost,
```

## What does NOT change
- Image cloning logic after each insert (correct as-is)
- Other entry_options inserts (explore/planner paths use different structure)
- EntrySheet.tsx, HotelWizard.tsx, or any other files
- Entry (parent) cloning logic

## Files modified
| File | Change |
|------|--------|
| `src/pages/Timeline.tsx` | Add 11 missing fields to 3 entry_options insert blocks (lines 1674, 2142, 2238) |
