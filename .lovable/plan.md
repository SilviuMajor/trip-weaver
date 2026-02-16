

# Extract Shared Helpers from EntrySheet.tsx

## Overview
Pure code extraction — move `InlineField` component and 5 utility functions into their own files for reuse, then update imports in `EntrySheet.tsx`.

## New File 1: `src/components/timeline/InlineField.tsx`

Move lines 59-122 (the `InlineFieldProps` interface and `InlineField` component) into a new file with these imports:
- `useState`, `useEffect` from React
- `Input` from `@/components/ui/input`
- `Pencil` from `lucide-react`
- `cn` from `@/lib/utils`

Export as default export.

## New File 2: `src/lib/entryHelpers.ts`

Move these 5 functions as named exports:

1. `decodePolylineEndpoint` (lines 34-53)
2. `formatPriceLevel` (lines 125-135)
3. `DAY_NAMES` constant + `getEntryDayHours` (lines 138-146)
4. `formatTimeInTz` (lines 210-213)
5. `getTzAbbr` (lines 215-220)

No external dependencies needed — these are pure functions.

## Update: `src/components/timeline/EntrySheet.tsx`

- Remove the extracted code blocks (lines 34-53, 57-122, 124-146, 210-220)
- Add imports:
  - `import InlineField from './InlineField';`
  - `import { decodePolylineEndpoint, formatPriceLevel, getEntryDayHours, formatTimeInTz, getTzAbbr } from '@/lib/entryHelpers';`

No logic or behavior changes — purely moving code into separate files.

