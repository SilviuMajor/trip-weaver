interface LayoutEntry {
  id: string;
  startMinutes: number;
  endMinutes: number;
}

export interface LayoutResult {
  entryId: string;
  column: number;
  totalColumns: number;
}

export function computeOverlapLayout(entries: LayoutEntry[]): LayoutResult[] {
  if (entries.length === 0) return [];

  const sorted = [...entries].sort(
    (a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes
  );

  // Group overlapping entries into clusters
  const clusters: LayoutEntry[][] = [];
  let currentCluster: LayoutEntry[] = [sorted[0]];
  let clusterEnd = sorted[0].endMinutes;

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startMinutes < clusterEnd) {
      currentCluster.push(sorted[i]);
      clusterEnd = Math.max(clusterEnd, sorted[i].endMinutes);
    } else {
      clusters.push(currentCluster);
      currentCluster = [sorted[i]];
      clusterEnd = sorted[i].endMinutes;
    }
  }
  clusters.push(currentCluster);

  // Assign columns within each cluster
  const results: LayoutResult[] = [];

  for (const cluster of clusters) {
    const columns: LayoutEntry[][] = [];

    for (const entry of cluster) {
      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        const lastInCol = columns[col][columns[col].length - 1];
        if (entry.startMinutes >= lastInCol.endMinutes) {
          columns[col].push(entry);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([entry]);
      }
    }

    const totalColumns = columns.length;
    for (let col = 0; col < columns.length; col++) {
      for (const entry of columns[col]) {
        results.push({
          entryId: entry.id,
          column: col,
          totalColumns,
        });
      }
    }
  }

  return results;
}
