

# Center Lock Button Vertically on Event Cards

## Overview

Move the lock button from the top-left corner (`-top-2 -left-2`) to be vertically centered on the left side of each card.

## Changes

### File: `src/components/timeline/CalendarDay.tsx`

Two lock button instances need updating:

**1. Flight lock button (line 812):**
Change:
```
className="absolute -top-2 -left-2 z-30 flex h-5 w-5 ..."
```
To:
```
className="absolute top-1/2 -translate-y-1/2 -left-2 z-30 flex h-5 w-5 ..."
```

**2. Regular entry lock button (line 913):**
Change:
```
className="absolute -top-2 -left-2 z-30 flex h-5 w-5 ..."
```
To:
```
className="absolute top-1/2 -translate-y-1/2 -left-2 z-30 flex h-5 w-5 ..."
```

Both buttons use `top-1/2 -translate-y-1/2` to vertically center within their parent `relative` container, while keeping the `-left-2` horizontal offset unchanged.

