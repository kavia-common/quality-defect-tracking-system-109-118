/**
 * Lightweight analytics helpers for the dashboard (no external chart libs).
 */

/**
 * PUBLIC_INTERFACE
 * Groups defects by title (used as "defect type") and returns Pareto-style ranking.
 *
 * @param {Array<{title: string}>} defects
 * @param {number} [topN]
 * @returns {Array<{label: string, count: number, pct: number, cumPct: number}>}
 */
export function paretoByDefectTitle(defects, topN = 8) {
  const items = Array.isArray(defects) ? defects : [];
  const counts = new Map();

  for (const d of items) {
    const label = String(d?.title || "").trim() || "Untitled";
    counts.set(label, (counts.get(label) || 0) + 1);
  }

  const total = items.length || 1;
  const ranked = Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, topN);

  let cum = 0;
  return ranked.map((r) => {
    const pct = (r.count / total) * 100;
    cum += pct;
    return { ...r, pct, cumPct: cum };
  });
}

/**
 * PUBLIC_INTERFACE
 * Produces a time series of defect counts grouped by day or week.
 *
 * For simplicity and determinism, we group by:
 * - day: YYYY-MM-DD (local date derived from created_at)
 * - week: YYYY-Wxx (ISO-ish week number approximation, good enough for UI trend)
 *
 * @param {Array<{created_at?: string}>} defects
 * @param {"daily"|"weekly"} [granularity]
 * @returns {Array<{bucket: string, count: number}>} sorted ascending by bucket
 */
export function defectTrend(defects, granularity = "weekly") {
  const items = Array.isArray(defects) ? defects : [];
  const counts = new Map();

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function bucketForDate(d) {
    const year = d.getFullYear();
    const month = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    if (granularity === "daily") return `${year}-${month}-${day}`;

    // Weekly: approximate ISO week number.
    // Based on local date; for dashboard "trend" this is acceptable.
    const tmp = new Date(d.getTime());
    tmp.setHours(0, 0, 0, 0);
    // Thursday in current week decides the year.
    tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
    const weekYear = tmp.getFullYear();
    const week1 = new Date(weekYear, 0, 4);
    const weekNo = Math.round(
      1 +
        (tmp.getTime() -
          (week1.getTime() + (3 - ((week1.getDay() + 6) % 7)) * 86400000)) /
          604800000
    );

    return `${weekYear}-W${pad2(weekNo)}`;
  }

  for (const d of items) {
    const dt = d?.created_at ? new Date(d.created_at) : null;
    if (!dt || Number.isNaN(dt.getTime())) continue;
    const bucket = bucketForDate(dt);
    counts.set(bucket, (counts.get(bucket) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([bucket, count]) => ({ bucket, count }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));
}
