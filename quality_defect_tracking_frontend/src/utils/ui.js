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

// PUBLIC_INTERFACE
export function statusBadgeClass(status) {
  switch (status) {
    case "Closed":
      return "badge-green";
    case "In Progress":
      return "badge-blue";
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
