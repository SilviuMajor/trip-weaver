import type { EntryWithOptions } from '@/types/trip';

export interface Block {
  entries: EntryWithOptions[];
  transports: EntryWithOptions[];
  events: EntryWithOptions[];
}

const GAP_TOLERANCE_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Find the block containing the given entry.
 * A block is a chain of adjacent entries where each pair has no time gap (tolerance: 2 minutes).
 */
export function getBlock(entryId: string, allEntries: EntryWithOptions[]): Block {
  const sorted = [...allEntries]
    .filter(e => e.is_scheduled !== false)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const idx = sorted.findIndex(e => e.id === entryId);
  if (idx < 0) return { entries: [], transports: [], events: [] };

  // Expand backward
  let startIdx = idx;
  for (let i = idx - 1; i >= 0; i--) {
    const gap = new Date(sorted[i + 1].start_time).getTime() - new Date(sorted[i].end_time).getTime();
    if (gap <= GAP_TOLERANCE_MS) startIdx = i;
    else break;
  }

  // Expand forward
  let endIdx = idx;
  for (let i = idx + 1; i < sorted.length; i++) {
    const gap = new Date(sorted[i].start_time).getTime() - new Date(sorted[i - 1].end_time).getTime();
    if (gap <= GAP_TOLERANCE_MS) endIdx = i;
    else break;
  }

  const blockEntries = sorted.slice(startIdx, endIdx + 1);
  return {
    entries: blockEntries,
    transports: blockEntries.filter(e => e.options[0]?.category === 'transfer'),
    events: blockEntries.filter(e => e.options[0]?.category !== 'transfer'),
  };
}

export function blockHasLockedEntry(block: Block): boolean {
  return block.entries.some(e => e.is_locked);
}

export function getEntriesAfterInBlock(entryId: string, block: Block): EntryWithOptions[] {
  const idx = block.entries.findIndex(e => e.id === entryId);
  if (idx < 0) return [];
  return block.entries.slice(idx + 1);
}
