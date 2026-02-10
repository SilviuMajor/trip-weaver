

# Implement Unified EntrySheet (Merge Create + View)

## What's Missing

The plan to merge `EntryForm` (creation/editing Dialog) and `EntryOverlay` (read-only view Sheet) into a single unified component was approved but never implemented. Currently:

- **Clicking a card** opens `EntryOverlay` (a bottom Sheet) showing read-only details
- **Clicking "Edit"** inside the overlay closes it, then opens `EntryForm` (a centered Dialog)
- These are two completely separate 350+ line components with duplicated logic

## What We're Building

A single `EntrySheet.tsx` component in a **centered Dialog** that handles both viewing and creating. When viewing an existing entry, editors can **inline-edit individual fields** (click a field to edit it in-place).

## Behavior

### Creating a new entry
- Step 1: Category picker grid (unchanged from current EntryForm)
- Step 2: Centered dialog with all fields editable (name, website, location, photo strip, when section) -- identical to current EntryForm step 2

### Viewing an existing entry (card click)
- Opens a centered Dialog (not bottom Sheet) showing the entry details
- Non-editors see everything read-only
- Editors see each field as display text; clicking a field makes just that field editable (input replaces text). Enter/blur saves immediately to the database
- Map, images, votes, distance, lock/delete/move-to-ideas buttons all present
- ImageUploader available for editors

### What's preserved from EntryOverlay
- Category badge with color
- Flight departure/arrival layout with terminals and timezone abbreviations
- Time display
- Distance calculation
- Website link
- Map preview
- Vote button
- Image gallery + uploader
- Lock/unlock toggle
- Move to ideas
- Delete with confirmation

### What's preserved from EntryForm
- Category picker grid (step 1)
- PlacesAutocomplete with auto-fill
- PhotoStripPicker
- Flight-specific: airport pickers, timezone, terminals, checkin/checkout, airport processing entries
- Transfer-specific: from/to, inline route comparison (transport gap flow), manual mode picker
- Day/date picker, time inputs, duration
- Save as idea flow
- Return flight prompt
- Auto-detect trip dates from flights
- Flight booking upload
- Transport context auto-fill

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/components/timeline/EntrySheet.tsx` | **Create** | Unified component (~800 lines) combining all EntryForm + EntryOverlay functionality. Uses centered Dialog. Supports `mode: 'create' | 'view'`. View mode has inline per-field editing for editors. |
| `src/components/timeline/EntryOverlay.tsx` | **Delete** | Fully replaced by EntrySheet |
| `src/components/timeline/EntryForm.tsx` | **Delete** | Fully replaced by EntrySheet |
| `src/pages/Timeline.tsx` | **Edit** | Replace dual state management (overlayEntry/overlayOpen + entryFormOpen/editEntry) with unified state: `sheetMode`, `sheetEntry`, `sheetOption`, `sheetOpen`. Card clicks set mode='view'. Add buttons set mode='create'. Pass all necessary props to single EntrySheet. |

No database changes. No edge function changes.

## Technical Details

### Unified state in Timeline.tsx

Replace:
- `overlayEntry`, `overlayOption`, `overlayOpen` (for EntryOverlay)
- `entryFormOpen`, `editEntry`, `editOption` (for EntryForm)

With:
```text
sheetMode: 'create' | 'view' | null
sheetEntry: EntryWithOptions | null    (populated for view mode)
sheetOption: EntryOption | null        (populated for view mode)
sheetOpen: boolean
```

Card click: `sheetMode='view'`, populate entry/option, open=true
Add button: `sheetMode='create'`, entry/option=null, open=true
"Edit" is no longer needed as a separate action -- fields are inline-editable

### InlineField helper (inside EntrySheet)

```text
interface InlineFieldProps {
  label: string;
  value: string;
  canEdit: boolean;
  onSave: (newValue: string) => Promise<void>;
  renderDisplay?: (val: string) => React.ReactNode;
  renderInput?: (val: string, onChange: (v: string) => void) => React.ReactNode;
}
```

- Default display: text span with subtle pencil icon on hover
- Click to enter edit mode (shows Input, Enter saves, Escape cancels, blur saves)
- On save: writes directly to Supabase (`entry_options` or `entries` table), then calls `onSaved()` to refresh

### Editable fields (view mode, editors only)
- Name (text input, or PlacesAutocomplete for non-flight/transfer)
- Website (text input)
- Location name (text input)
- Time range: start and end (time inputs)
- Flight: departure/arrival airports, terminals
- Transfer: from/to, travel mode

### Non-editable (display only)
- Category badge (changing category has complex implications)
- Map preview (auto-updates if location changes)
- Distance
- Vote button
- Images (managed via gallery + uploader, not inline edit)

### EntrySheet props

```text
interface EntrySheetProps {
  mode: 'create' | 'view';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  trip?: Trip | null;
  onSaved: () => void;

  // View mode
  entry?: EntryWithOptions | null;
  option?: EntryOption | null;
  formatTime?: (iso: string) => string;
  userLat?: number | null;
  userLng?: number | null;
  votingLocked?: boolean;
  userVotes?: string[];
  onVoteChange?: () => void;
  onMoveToIdeas?: (entryId: string) => void;

  // Create mode
  prefillStartTime?: string;
  prefillEndTime?: string;
  prefillCategory?: string;
  transportContext?: { fromAddress: string; toAddress: string } | null;
}
```

### View mode layout

```text
+--------------------------------------------+
| [Category badge]                            |
|                                             |
| Entry Name              [click to edit]     |
|                                             |
| 09:00 -- 11:00 (2h)    [click to edit]     |
|                                             |
| 1.2km away                                  |
| Visit website           [click to edit]     |
|                                             |
| [====== Map Preview ======]                 |
|                                             |
| [Vote button]  5 votes                      |
|                                             |
| [photo1] [photo2] [photo3]                  |
| [+ Upload photo]                            |
|                                             |
| ------------------------------------------- |
| [Lock] [Move to Ideas] [Delete]             |
+--------------------------------------------+
```

### Create mode layout (unchanged from current EntryForm)

```text
Step 1: Category picker grid
Step 2: Details + When (single scrollable page)
```

