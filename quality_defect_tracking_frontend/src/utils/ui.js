/**
 * UI helper functions.
 */

// PUBLIC_INTERFACE
export function formatDate(isoOrDate) {
  if (!isoOrDate) return "—";
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

// PUBLIC_INTERFACE
export function daysUntil(dateString) {
  if (!dateString) return null;
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return null;
  const diff = d.getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

/**
 * PUBLIC_INTERFACE
 * Returns number of days overdue (positive integer) for a due_date if it is in the past.
 * Returns 0 if not overdue, null if invalid date.
 */
export function daysOverdue(dueDateString) {
  if (!dueDateString) return null;
  const d = new Date(dueDateString);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  return days > 0 ? days : 0;
}

/**
 * PUBLIC_INTERFACE
 * Determines if a corrective action is considered "completed" for overdue logic.
 * We treat Done/Verified/Canceled as not overdue.
 */
export function isActionCompleted(status) {
  const v = String(status || "").trim().toLowerCase();
  return v === "done" || v === "verified" || v === "canceled" || v === "closed";
}

/**
 * PUBLIC_INTERFACE
 * Determines if a corrective action is overdue.
 */
export function isActionOverdue(action) {
  const overdueDays = daysOverdue(action?.due_date);
  if (overdueDays === null) return false;
  if (overdueDays <= 0) return false;
  return !isActionCompleted(action?.status);
}

/**
 * PUBLIC_INTERFACE
 * Counts overdue corrective actions across defects (expects defects with corrective_actions arrays).
 */
export function countOverdueActions(defects) {
  const items = Array.isArray(defects) ? defects : [];
  let count = 0;
  for (const d of items) {
    const actions = Array.isArray(d?.corrective_actions) ? d.corrective_actions : [];
    for (const a of actions) {
      if (isActionOverdue(a)) count += 1;
    }
  }
  return count;
}

/**
 * PUBLIC_INTERFACE
 * Workflow gating per acceptance criteria:
 * - Root cause is mandatory before defect status can move beyond "Open".
 *
 * We interpret "root cause is mandatory" as:
 * - root_cause exists AND has a non-empty summary (a concise root cause statement).
 */
export function canMoveBeyondOpen(defect) {
  const status = String(defect?.status || "").trim();
  if (status !== "Open") return true; // already moved; don't block UI
  const rc = defect?.root_cause;
  const hasSummary = Boolean(String(rc?.summary || "").trim());
  return Boolean(rc) && hasSummary;
}

// PUBLIC_INTERFACE
export function statusBadgeClass(status) {
  switch (status) {
    case "Closed":
      return "badge-green";
    case "Verified":
      return "badge-green";
    case "Actions in progress":
      return "badge-blue";
    case "In Progress":
      return "badge-blue";
    case "Root cause identified":
      return "badge-amber";
    case "Investigating":
      return "badge-amber";
    case "Open":
    default:
      return "badge-red";
  }
}

// PUBLIC_INTERFACE
export function severityBadgeClass(severity) {
  switch (severity) {
    case "Critical":
      return "badge-red";
    case "Major":
      return "badge-amber";
    case "Minor":
    default:
      return "badge-blue";
  }
}
