

# Fix Card Sizing, Duration Pill Overlap, and Overview Hero Image

## Overview
Three fixes to restore correct sizing after the diagonal-fade redesign: title/pill font sizes, duration pill positioning per tier, and hero image height constraint.

## Fix 1: Restore Title and Duration Pill Sizes (`EntryCard.tsx`)

### 1a. Fix `durationPillStyle` function (lines 305-325)
Replace the oversized pill dimensions with the original small sizes:
- `l` (full): fontSize 10, padding `2px 6px`, top 8, right 8
- `m` (condensed): fontSize 10, padding `2px 6px`, top 7, right 7
- `s` (medium): fontSize 10, padding `2px 6px`, top 5, right 5
- `xs` (compact): fontSize 9, padding `2px 5px`, top 3, right 4

### 1b. Fix title sizes per tier
- **Full** (line 633): Change `text-[17px]` to `text-lg` (18px)
- **Full** rating (line 639): Change `text-[11px]` to `text-[10px]`
- **Condensed** title (line 597): Already `text-[14px]` -- correct (matches `text-sm`)
- **Medium** title (line 572): Change `text-[13px]` to `text-xs` (12px), change `font-bold` to `font-semibold`
- **Compact** title (line 556): Change `text-[12px]` to `text-[11px]`, change `font-bold` to `font-semibold`

## Fix 2: Duration Pill Positioning Per Tier (`EntryCard.tsx`)

### 2a. Full cards (>=160px) -- keep absolute top-right pill
No change needed, the `durationPillStyle('l')` stays as an absolute-positioned pill.

### 2b. Condensed cards (80-159px) -- move pill inline
Remove the `<div style={durationPillStyle('m')}>` absolute pill (line 592). Instead, replace the time line (lines 605-607) with a flex row containing time on the left and an inline pill on the right:
```tsx
<div className="flex items-center justify-between gap-1">
  <span className={cn('text-[10px]', faintTextColor)}>
    {formatTime(startTime)} — {formatTime(endTime)}
  </span>
  <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold',
    firstImage ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground')}>
    {durationLabel}
  </span>
</div>
```

### 2c. Medium cards (40-79px) -- duration inline with time
Remove the `<div style={durationPillStyle('s')}>` absolute pill (line 570). Append duration inline to the time span (lines 573-575):
```tsx
<span className={cn('text-[10px]', faintTextColor)}>
  {formatTime(startTime)} — {formatTime(endTime)}
  <span className="ml-1 font-bold">{durationLabel}</span>
</span>
```

### 2d. Compact cards (<40px) -- duration inline with name
Remove the `<div style={durationPillStyle('xs')}>` absolute pill (line 554). Add duration inline after the name:
```tsx
<span className="text-[11px] font-semibold truncate">
  {option.name}
</span>
<span className={cn('text-[9px] whitespace-nowrap shrink-0', faintTextColor)}>
  {formatTime(startTime)} <span className="font-bold">{durationLabel}</span>
</span>
```

## Fix 3: Overview Hero Image Height (`EntrySheet.tsx`)

### 3a. Replace ImageGallery with fixed-height hero (lines 1219-1233)
Replace the `ImageGallery` component usage with a fixed `height: 200` container that renders a single image with inline swipe controls (arrows + dots). Add `heroIndex` state (defaults to 0).

### 3b. Import ChevronLeft/ChevronRight
Add `ChevronLeft, ChevronRight` to the lucide-react import if not already present.

### 3c. No-image non-editor: render nothing
Change the empty state: if no images and not editor, render `null` (no placeholder eating space).

## What does NOT change
- Diagonal fade gradients, corner flags, glossy backgrounds
- Card wrapper, drag handlers, overlap overlay
- Transport card rendering
- EntrySheet create/edit mode
- Any other component

## Files modified
| File | Scope |
|------|-------|
| `src/components/timeline/EntryCard.tsx` | Pill sizes, title sizes, pill positioning per tier |
| `src/components/timeline/EntrySheet.tsx` | Hero gallery fixed 200px height with inline controls |
