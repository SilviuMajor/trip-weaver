


# Search Bar in Category Picker + Planner Button Closes Explore

## Status: ✅ Implemented

## Overview
Two UX improvements: (1) Added a search bar above the category grid in EntrySheet so users can skip categories and search directly, and (2) Made the Planner FAB close Explore when it's open.

## Changes Made

| File | Changes |
|------|---------|
| `src/components/timeline/EntrySheet.tsx` | Added Search import, search bar above category grid, updated `onExploreRequest` prop type to accept optional searchQuery |
| `src/components/timeline/ExploreView.tsx` | Added `initialSearchQuery` prop, useEffect to apply it to internal searchQuery state |
| `src/pages/Timeline.tsx` | Added `exploreSearchQuery` state, passed to both ExploreView instances, updated Planner FAB onClick to close Explore, cleared search query in all close handlers |
