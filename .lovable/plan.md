

# Fix: Overview — Drawer on Mobile, Dialog on Desktop

## Problem
The view mode currently always uses `<Drawer>` (slide-up sheet). This works well on mobile but on desktop a centered `<Dialog>` looks better and was the original behavior.

## Approach
Use `useIsMobile()` to conditionally wrap the same view content in either `<Drawer>` (mobile) or `<Dialog>` (desktop).

## Changes (single file: `EntrySheet.tsx`)

### 1. Add import
Add `import { useIsMobile } from '@/hooks/use-mobile';` at the top (Drawer and Dialog imports already exist).

### 2. Add hook call
Inside the EntrySheet component body (near other hooks), add `const isMobile = useIsMobile();`

### 3. Restructure view mode return (lines 1216-1900)
Extract ALL content between `<DrawerContent>` and `</DrawerContent>` (lines 1219-1897) into a `viewContent` JSX variable. Then conditionally wrap:

```text
if (mode === 'view') {
  // ... existing variable declarations ...

  const viewContent = (
    <>
      {/* Hero image gallery */}
      ...
      {/* All existing content through delete dialogs */}
      ...
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92vh] overflow-y-auto">
          {viewContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        {viewContent}
      </DialogContent>
    </Dialog>
  );
}
```

## What does NOT change
- Create/edit mode (stays as Dialog always)
- All view mode content (hero gallery, grids, collapsibles, vote, delete dialogs)
- Hero image 200px height
- Any other file

## Files modified
| File | Scope |
|------|-------|
| `src/components/timeline/EntrySheet.tsx` | Import useIsMobile, conditional Drawer vs Dialog wrapper in view mode |
