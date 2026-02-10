import type { EntryWithOptions } from '@/types/trip';

export interface ConflictInfo {
  entryId: string;
  entryName: string;
  discrepancyMin: number; // positive = needs more time, negative = fits
  prevTravelMin: number | null;
  nextTravelMin: number | null;
  prevGapMin: number;
  nextGapMin: number;
}

export interface Recommendation {
  id: string;
  label: string;
  description: string;
  changes: Array<{
    entryId: string;
    newStartIso: string;
    newEndIso: string;
  }>;
}

/**
 * Analyze conflicts when placing an entry at a given time.
 * Returns the discrepancy in minutes (positive = conflict, 0 or negative = fits).
 */
export function analyzeConflict(
  placedEntry: EntryWithOptions,
  prevEntry: EntryWithOptions | null,
  nextEntry: EntryWithOptions | null,
  prevTravelMin: number | null,
  nextTravelMin: number | null,
): ConflictInfo {
  const placedStart = new Date(placedEntry.start_time).getTime();
  const placedEnd = new Date(placedEntry.end_time).getTime();

  // Gap between previous entry end and placed entry start
  const prevGapMin = prevEntry
    ? (placedStart - new Date(prevEntry.end_time).getTime()) / 60000
    : Infinity;

  // Gap between placed entry end and next entry start
  const nextGapMin = nextEntry
    ? (new Date(nextEntry.start_time).getTime() - placedEnd) / 60000
    : Infinity;

  const prevNeeded = prevTravelMin ?? 0;
  const nextNeeded = nextTravelMin ?? 0;

  // How many extra minutes are needed beyond available gaps
  const prevShortfall = Math.max(0, prevNeeded - prevGapMin);
  const nextShortfall = Math.max(0, nextNeeded - nextGapMin);
  const totalDiscrepancy = prevShortfall + nextShortfall;

  return {
    entryId: placedEntry.id,
    entryName: placedEntry.options[0]?.name ?? 'Entry',
    discrepancyMin: Math.round(totalDiscrepancy),
    prevTravelMin,
    nextTravelMin,
    prevGapMin: Math.round(prevGapMin),
    nextGapMin: Math.round(nextGapMin),
  };
}

/**
 * Generate smart recommendations to resolve a conflict.
 */
export function generateRecommendations(
  conflict: ConflictInfo,
  dayEntries: EntryWithOptions[],
  placedEntryId: string,
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const discrepancy = conflict.discrepancyMin;
  if (discrepancy <= 0) return recommendations;

  // Find unlocked entries that could be shifted
  const unlocked = dayEntries.filter(
    e => !e.is_locked && e.id !== placedEntryId
  );

  // Sort by proximity to the placed entry (adjacent entries first)
  const placedIdx = dayEntries.findIndex(e => e.id === placedEntryId);

  for (const entry of unlocked) {
    const entryIdx = dayEntries.findIndex(e => e.id === entry.id);
    const entryStart = new Date(entry.start_time);
    const entryEnd = new Date(entry.end_time);
    const durationMin = (entryEnd.getTime() - entryStart.getTime()) / 60000;

    // Option: shift entry later
    if (entryIdx > placedIdx) {
      const shiftedStart = new Date(entryStart.getTime() + discrepancy * 60000);
      const shiftedEnd = new Date(entryEnd.getTime() + discrepancy * 60000);
      recommendations.push({
        id: `shift-later-${entry.id}`,
        label: `Start "${entry.options[0]?.name}" ${discrepancy}m later`,
        description: `Move from ${formatTimeShort(entryStart)} to ${formatTimeShort(shiftedStart)}`,
        changes: [{
          entryId: entry.id,
          newStartIso: shiftedStart.toISOString(),
          newEndIso: shiftedEnd.toISOString(),
        }],
      });
    }

    // Option: shift entry earlier
    if (entryIdx < placedIdx) {
      const shiftedStart = new Date(entryStart.getTime() - discrepancy * 60000);
      const shiftedEnd = new Date(entryEnd.getTime() - discrepancy * 60000);
      recommendations.push({
        id: `shift-earlier-${entry.id}`,
        label: `Start "${entry.options[0]?.name}" ${discrepancy}m earlier`,
        description: `Move from ${formatTimeShort(entryStart)} to ${formatTimeShort(shiftedStart)}`,
        changes: [{
          entryId: entry.id,
          newStartIso: shiftedStart.toISOString(),
          newEndIso: shiftedEnd.toISOString(),
        }],
      });
    }

    // Option: shorten entry (if long enough)
    if (durationMin > discrepancy + 15) {
      const shortenedEnd = new Date(entryEnd.getTime() - discrepancy * 60000);
      recommendations.push({
        id: `shorten-${entry.id}`,
        label: `Shorten "${entry.options[0]?.name}" by ${discrepancy}m`,
        description: `End at ${formatTimeShort(shortenedEnd)} instead of ${formatTimeShort(entryEnd)}`,
        changes: [{
          entryId: entry.id,
          newStartIso: entryStart.toISOString(),
          newEndIso: shortenedEnd.toISOString(),
        }],
      });
    }
  }

  // Option: skip entry (move to unscheduled)
  for (const entry of unlocked) {
    recommendations.push({
      id: `skip-${entry.id}`,
      label: `Skip "${entry.options[0]?.name}"`,
      description: 'Move to ideas (unscheduled)',
      changes: [], // handled specially by the caller
    });
  }

  return recommendations.slice(0, 5); // Max 5 recommendations
}

function formatTimeShort(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}
