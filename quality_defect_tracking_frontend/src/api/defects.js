import { apiDelete, apiGet, apiPatch, apiPost, apiPut, getApiBaseUrl } from "./client";

/**
 * Creates a stable CSV-safe cell value.
 * - Wraps in quotes
 * - Escapes quotes by doubling
 * - Replaces newlines with spaces
 */
function csvCell(v) {
  const s = String(v ?? "");
  const cleaned = s.replace(/\r?\n/g, " ").replace(/"/g, '""');
  return `"${cleaned}"`;
}

function toIsoDateOnly(dateLike) {
  // For HTML date inputs and backend expectations: 'YYYY-MM-DD' or null.
  if (!dateLike) return null;
  // If already in YYYY-MM-DD, keep it.
  const trimmed = String(dateLike).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Frontend API module backed by the Django REST API.
 *
 * Base routing assumptions:
 * - Backend is served under: <API_BASE>/api/
 * - Health:              GET  /api/health/
 * - Defects:             CRUD /api/defects/
 * - Root causes:         CRUD /api/root-causes/
 * - Corrective actions:  CRUD /api/corrective-actions/
 *
 * Note: The UI uses simplified labels; this module maps them to backend enums.
 */

// -------------------------
// Enum mapping helpers
// -------------------------

function mapUiSeverityToApi(uiSeverity) {
  const v = String(uiSeverity || "").trim().toLowerCase();
  if (v === "critical") return "CRITICAL";
  if (v === "high") return "HIGH";
  if (v === "major") return "HIGH";
  if (v === "medium") return "MEDIUM";
  if (v === "low") return "LOW";
  if (v === "minor") return "LOW";
  return "MEDIUM";
}

function mapApiSeverityToUi(apiSeverity) {
  const v = String(apiSeverity || "").trim().toUpperCase();
  if (v === "CRITICAL") return "Critical";
  if (v === "HIGH") return "Major";
  if (v === "MEDIUM") return "Medium";
  if (v === "LOW") return "Minor";
  return "Medium";
}

function mapUiStatusToApi(uiStatus) {
  const v = String(uiStatus || "").trim().toLowerCase();
  if (v === "open") return "OPEN";
  if (v === "investigating") return "INVESTIGATING";
  if (v === "root cause identified") return "ROOT_CAUSE_IDENTIFIED";
  if (v === "actions in progress") return "ACTIONS_IN_PROGRESS";
  if (v === "verified") return "VERIFIED";
  if (v === "closed") return "CLOSED";
  // historical UI value
  if (v === "in progress") return "ACTIONS_IN_PROGRESS";
  return "OPEN";
}

function mapApiStatusToUi(apiStatus) {
  const v = String(apiStatus || "").trim().toUpperCase();
  if (v === "OPEN") return "Open";
  if (v === "INVESTIGATING") return "Investigating";
  if (v === "ROOT_CAUSE_IDENTIFIED") return "Root cause identified";
  if (v === "ACTIONS_IN_PROGRESS") return "Actions in progress";
  if (v === "VERIFIED") return "Verified";
  if (v === "CLOSED") return "Closed";
  return "Open";
}

function mapUiActionStatusToApi(uiStatus) {
  const v = String(uiStatus || "").trim().toLowerCase();
  if (v === "open") return "OPEN";
  if (v === "in progress") return "IN_PROGRESS";
  if (v === "done") return "DONE";
  if (v === "verified") return "VERIFIED";
  if (v === "canceled") return "CANCELED";
  if (v === "closed") return "DONE";
  return "OPEN";
}

function mapApiActionStatusToUi(apiStatus) {
  const v = String(apiStatus || "").trim().toUpperCase();
  if (v === "OPEN") return "Open";
  if (v === "IN_PROGRESS") return "In Progress";
  if (v === "DONE") return "Done";
  if (v === "VERIFIED") return "Verified";
  if (v === "CANCELED") return "Canceled";
  return "Open";
}

/**
 * Normalizes a backend enum-like status value for stable comparisons.
 * (Backend typically expects/returns UPPERCASE snake-case; UI values may vary.)
 */
function normalizeStatus(v) {
  return String(v || "").trim().toUpperCase();
}

function mapDefectFromApi(d) {
  if (!d) return null;

  // Prefer persisted free-text fields (reporter_name/assigned_to_name) if present;
  // otherwise fall back to embedded auth-user details.
  const reportedBy =
    (d.reporter_name || "").trim() || d.reported_by_detail?.username || "";
  const assignedTo =
    (d.assigned_to_name || "").trim() || d.assignee_detail?.username || "";

  return {
    id: String(d.id),
    title: d.title || "",
    description: d.description || "",
    severity: mapApiSeverityToUi(d.severity),
    status: mapApiStatusToUi(d.status),
    priority: d.priority || "P3",
    area: d.area || "",
    tags: Array.isArray(d.tags) ? d.tags : [],
    reported_by: reportedBy,
    assigned_to: assignedTo,
    due_date: d.due_date || "",
    created_at: d.created_at || "",
    updated_at: d.updated_at || "",
    occurred_at: d.occurred_at || "",
    root_cause: d.root_cause || null,
    corrective_actions: Array.isArray(d.corrective_actions) ? d.corrective_actions : [],
  };
}

function mapActionFromApi(a) {
  if (!a) return null;
  return {
    id: String(a.id),
    title: a.title || "",
    owner: a.owner_detail?.username || "",
    status: mapApiActionStatusToUi(a.status),
    due_date: a.due_date || "",
    notes: a.description || "",
    created_at: a.created_at || "",
    updated_at: a.updated_at || "",
    completed_at: a.completed_at || null,
    root_cause: a.root_cause ?? null,
  };
}

// -------------------------
// Endpoints
// -------------------------

/**
 * PUBLIC_INTERFACE
 * Checks backend availability.
 */
export async function getBackendHealth() {
  return apiGet("/api/health/");
}

/**
 * PUBLIC_INTERFACE
 * Lists defects (backend supports filters; frontend currently uses q/area which backend doesn't).
 */
export async function listDefects({ status, severity } = {}) {
  const qs = new URLSearchParams();
  if (status) qs.set("status", mapUiStatusToApi(status));
  if (severity) qs.set("severity", mapUiSeverityToApi(severity));
  const query = qs.toString();
  const items = await apiGet(`/api/defects/${query ? `?${query}` : ""}`);
  return (items || []).map(mapDefectFromApi);
}

/**
 * PUBLIC_INTERFACE
 * Get a single defect by id.
 */
export async function getDefect(defectId) {
  const d = await apiGet(`/api/defects/${encodeURIComponent(defectId)}/`);
  const mapped = mapDefectFromApi(d);
  if (!mapped) return null;

  // Attach a UI-friendly corrective_actions list for the detail page.
  mapped.corrective_actions = (d.corrective_actions || []).map(mapActionFromApi);

  return mapped;
}

/**
 * PUBLIC_INTERFACE
 * Create a new defect.
 */
export async function createDefect(input) {
  const payload = {
    title: input.title || "",
    description: input.description || "",
    severity: mapUiSeverityToApi(input.severity),
    status: mapUiStatusToApi(input.status),
    due_date: toIsoDateOnly(input.due_date),
    occurred_at: input.occurred_at || null,

    // Persist UI fields
    priority: input.priority || "P3",
    area: input.area || "",
    tags: Array.isArray(input.tags) ? input.tags : [],
    reporter_name: input.reported_by || "",
    assigned_to_name: input.assigned_to || "",

    // user-id based fields (not used by simple UI yet)
    reported_by: null,
    assignee: null,
  };

  const created = await apiPost("/api/defects/", payload);
  return mapDefectFromApi(created);
}

/**
 * PUBLIC_INTERFACE
 * Update an existing defect.
 */
export async function updateDefect(defectId, patch) {
  const payload = {
    // Only include fields supported by the backend DefectSerializer.
    ...("title" in patch ? { title: patch.title } : {}),
    ...("description" in patch ? { description: patch.description } : {}),
    ...("severity" in patch ? { severity: mapUiSeverityToApi(patch.severity) } : {}),
    ...("status" in patch ? { status: mapUiStatusToApi(patch.status) } : {}),
    ...("due_date" in patch ? { due_date: toIsoDateOnly(patch.due_date) } : {}),
    ...("occurred_at" in patch ? { occurred_at: patch.occurred_at || null } : {}),

    // Persist UI fields
    ...("priority" in patch ? { priority: patch.priority || "P3" } : {}),
    ...("area" in patch ? { area: patch.area || "" } : {}),
    ...("tags" in patch ? { tags: Array.isArray(patch.tags) ? patch.tags : [] } : {}),
    ...("reported_by" in patch ? { reporter_name: patch.reported_by || "" } : {}),
    ...("assigned_to" in patch ? { assigned_to_name: patch.assigned_to || "" } : {}),
  };

  // Use PATCH for partial update.
  const updated = await apiPatch(`/api/defects/${encodeURIComponent(defectId)}/`, payload);
  return mapDefectFromApi(updated);
}

/**
 * PUBLIC_INTERFACE
 * Delete defect.
 */
export async function deleteDefect(defectId) {
  await apiDelete(`/api/defects/${encodeURIComponent(defectId)}/`);
  return { ok: true };
}

/**
 * PUBLIC_INTERFACE
 * Transition defect status via the workflow transition endpoint.
 */
export async function transitionDefect(defectId, newStatusApi) {
  const updated = await apiPost(`/api/defects/${encodeURIComponent(defectId)}/transition/`, {
    status: newStatusApi,
  });
  return mapDefectFromApi(updated);
}

/**
 * PUBLIC_INTERFACE
 * Create or update the root cause for a defect.
 *
 * Backend model is 1:1 RootCause <-> Defect.
 */
export async function upsertRootCause(defectId, input) {
  // Try find existing root cause by defect filter; then create/update accordingly.
  const existing = await apiGet(`/api/root-causes/?defect=${encodeURIComponent(defectId)}`);
  if (Array.isArray(existing) && existing.length > 0) {
    const current = existing[0];
    const id = current.id;

    const currentStatus = normalizeStatus(current.status);
    const requestedStatus = normalizeStatus(input.status);

    // Important: do NOT blindly re-send `status` on save.
    // If the existing root cause is already IDENTIFIED/APPROVED, sending the UI default
    // (often IN_PROGRESS) causes an invalid backward transition and a 400.
    // Only include status when the user actually changed it.
    //
    // Also: avoid overwriting text fields with empty strings unless the user provided them.
    // (In this UI input is controlled, so values are present; this keeps behavior safe if
    // callers reuse this API with partial objects.)
    const payload = {
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.analysis !== undefined ? { analysis: input.analysis } : {}),
      ...(requestedStatus && requestedStatus !== currentStatus ? { status: requestedStatus } : {}),
    };

    return apiPatch(`/api/root-causes/${encodeURIComponent(id)}/`, payload);
  }

  // Create: backend requires defect_id (or defect alias) and accepts status.
  return apiPost("/api/root-causes/", {
    defect_id: Number(defectId),
    summary: input.summary || "",
    analysis: input.analysis || "",
    status: normalizeStatus(input.status) || "IN_PROGRESS",
  });
}

/**
 * PUBLIC_INTERFACE
 * Add a corrective action to a defect (optionally linked to root cause).
 */
export async function addCorrectiveAction(defectId, input) {
  const ownerName = String(input.owner || "").trim();
  if (!ownerName) {
    throw new Error("Action owner is required.");
  }

  // Backend (DRF) requires a non-empty `description`.
  // In this UI, the main required text field is `input.title` (labeled "Description *").
  const description = String(input.title || input.description || "").trim();
  if (!description) {
    throw new Error("Action description is required.");
  }

  // Resolve (or create) a backend user so we can satisfy the required `owner` FK.
  const owner = await apiPost("/api/users/resolve/", { username: ownerName });

  const created = await apiPost("/api/corrective-actions/", {
    defect: Number(defectId),
    root_cause: input.root_cause_id ?? null,

    // Backend also has a `title` field; since the UI doesn't currently capture a separate
    // title vs description, we set both to the required description value.
    title: description,
    description,

    status: mapUiActionStatusToApi(input.status),
    owner: owner?.id,
    due_date: toIsoDateOnly(input.due_date),
  });

  return mapActionFromApi(created);
}

/**
 * PUBLIC_INTERFACE
 * Update corrective action.
 *
 * NOTE: actionId is the backend integer id (as string in UI).
 */
export async function updateCorrectiveAction(_defectId, actionId, patch) {
  const payload = {
    ...("title" in patch ? { title: patch.title } : {}),
    ...("notes" in patch ? { description: patch.notes || "" } : {}),
    ...("description" in patch ? { description: patch.description || "" } : {}),
    // Backend expects YYYY-MM-DD (DateField). Keep behavior consistent with create.
    ...("due_date" in patch ? { due_date: toIsoDateOnly(patch.due_date) } : {}),
    ...("status" in patch ? { status: mapUiActionStatusToApi(patch.status) } : {}),
  };

  const updated = await apiPatch(
    `/api/corrective-actions/${encodeURIComponent(actionId)}/`,
    payload
  );
  return mapActionFromApi(updated);
}

/**
 * PUBLIC_INTERFACE
 * Delete corrective action.
 */
export async function deleteCorrectiveAction(_defectId, actionId) {
  await apiDelete(`/api/corrective-actions/${encodeURIComponent(actionId)}/`);
  return { ok: true };
}

/**
 * PUBLIC_INTERFACE
 * Attempt to close a defect using the canonical flow:
 * - Ensure root cause is identified/approved
 * - Ensure actions are done/verified
 * - Transition defect to VERIFIED then CLOSED (backend enforces transitions)
 */
export async function closeDefect(defectId) {
  // Backend enforces the simplified workflow:
  // OPEN → INVESTIGATING → ACTIONS_IN_PROGRESS → CLOSED
  // and also enforces closure gating (RCA complete + actions DONE/VERIFIED).
  //
  // Older legacy flows used VERIFIED; attempting that transition in the new flow
  // can yield a 400 (invalid transition). So we go straight to CLOSED.
  const closed = await transitionDefect(defectId, "CLOSED");
  return closed;
}

/**
 * PUBLIC_INTERFACE
 * Export a single defect (including root cause and corrective actions) as CSV text.
 *
 * @param {object} defectDetail - object returned from getDefect(defectId)
 * @returns {string} CSV text
 */
export function exportDefectAuditCsv(defectDetail) {
  const d = defectDetail || {};
  const rc = d.root_cause || {};
  const actions = Array.isArray(d.corrective_actions) ? d.corrective_actions : [];

  const header = [
    "defect_id",
    "title",
    "area",
    "severity",
    "status",
    "priority",
    "reported_by",
    "assigned_to",
    "due_date",
    "created_at",
    "updated_at",
    "root_cause_status",
    "root_cause_summary",
    "root_cause_analysis",
    "action_id",
    "action_title",
    "action_owner",
    "action_status",
    "action_due_date",
    "action_notes",
    "action_updated_at",
  ];

  // One row per corrective action; if no actions, emit a single row with empty action columns.
  const rows = (actions.length ? actions : [null]).map((a) => {
    const action = a || {};
    return [
      d.id ?? "",
      d.title ?? "",
      d.area ?? "",
      d.severity ?? "",
      d.status ?? "",
      d.priority ?? "",
      d.reported_by ?? "",
      d.assigned_to ?? "",
      d.due_date ?? "",
      d.created_at ?? "",
      d.updated_at ?? "",
      rc.status ?? "",
      rc.summary ?? "",
      rc.analysis ?? "",
      action.id ?? "",
      action.title ?? "",
      action.owner ?? "",
      action.status ?? "",
      action.due_date ?? "",
      action.notes ?? "",
      action.updated_at ?? "",
    ]
      .map(csvCell)
      .join(",");
  });

  return `${header.join(",")}\n${rows.join("\n")}\n`;
}

/**
 * PUBLIC_INTERFACE
 * Export all defects as audit CSV (fetches detail for each defect to include root cause + actions).
 *
 * @param {{signal?: AbortSignal}} [options]
 * @returns {Promise<string>}
 */
export async function exportAllDefectsAuditCsv(options = {}) {
  const defects = await listDefects({});
  // Fetch detail for each defect (sequential to avoid overwhelming backend; still fine for small datasets).
  const chunks = [];
  let wroteHeader = false;

  for (const d of defects) {
    const detail = await getDefect(d.id, options);
    const csv = exportDefectAuditCsv(detail);

    if (!wroteHeader) {
      chunks.push(csv);
      wroteHeader = true;
    } else {
      // Drop header line for subsequent defects.
      const lines = csv.split("\n");
      chunks.push(lines.slice(1).join("\n"));
    }
  }

  if (!chunks.length) {
    // Provide a valid CSV with header only.
    return "defect_id,title,area,severity,status,priority,reported_by,assigned_to,due_date,created_at,updated_at,root_cause_status,root_cause_summary,root_cause_analysis,action_id,action_title,action_owner,action_status,action_due_date,action_notes,action_updated_at\n";
  }

  return chunks.join("");
}

/**
 * PUBLIC_INTERFACE
 * Download a defect audit export CSV from the backend endpoint as a Blob.
 *
 * This matches the backend behavior and ensures the browser triggers a real file download.
 *
 * @param {string|number} defectId - Defect id.
 * @param {{signal?: AbortSignal}} [options]
 * @returns {Promise<{blob: Blob, filename: string}>}
 */
export async function downloadDefectAuditCsv(defectId, options = {}) {
  const base = getApiBaseUrl() || "";
  const url = `${base}/api/defects/${encodeURIComponent(defectId)}/audit-export/`;

  const resp = await fetch(url, {
    method: "GET",
    credentials: "include",
    signal: options.signal,
    headers: {
      // Prefer CSV, but include common fallbacks to avoid DRF 406 when intermediaries
      // (or future refactors) introduce stricter content negotiation.
      Accept: "text/csv,application/csv;q=0.9,*/*;q=0.8",
    },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `Failed to download audit CSV (${resp.status}). ${text ? `Response: ${text}` : ""}`.trim()
    );
  }

  const blob = await resp.blob();

  // Try to honor backend filename if present
  const cd = resp.headers.get("content-disposition") || "";
  const match = cd.match(/filename="([^"]+)"/i) || cd.match(/filename=([^;]+)/i);
  const filename = (match && String(match[1] || "").trim()) || `defect_${defectId}_audit.csv`;

  return { blob, filename };
}

/**
 * PUBLIC_INTERFACE
 * Download a defects list export CSV from the backend as a Blob.
 *
 * This is used by the Defects list page "Export CSV" button. It sends the current
 * filter query parameters so the downloaded file matches the current view.
 *
 * @param {{status?: string, severity?: string}} [filters]
 * @param {{signal?: AbortSignal}} [options]
 * @returns {Promise<{blob: Blob, filename: string}>}
 */
export async function downloadDefectsCsv(filters = {}, options = {}) {
  const base = getApiBaseUrl() || "";
  const qs = new URLSearchParams();

  if (filters.status) qs.set("status", mapUiStatusToApi(filters.status));
  if (filters.severity) qs.set("severity", mapUiSeverityToApi(filters.severity));

  const url = `${base}/api/defects/export/${qs.toString() ? `?${qs.toString()}` : ""}`;

  const resp = await fetch(url, {
    method: "GET",
    credentials: "include",
    signal: options.signal,
    headers: {
      Accept: "text/csv,application/csv;q=0.9,*/*;q=0.8",
    },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `Failed to download defects CSV (${resp.status}). ${text ? `Response: ${text}` : ""}`.trim()
    );
  }

  const blob = await resp.blob();

  const cd = resp.headers.get("content-disposition") || "";
  const match = cd.match(/filename="([^"]+)"/i) || cd.match(/filename=([^;]+)/i);
  const filename = (match && String(match[1] || "").trim()) || "defects.csv";

  return { blob, filename };
}
