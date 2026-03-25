import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "./client";

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

function mapDefectFromApi(d) {
  if (!d) return null;
  return {
    id: String(d.id),
    title: d.title || "",
    description: d.description || "",
    severity: mapApiSeverityToUi(d.severity),
    status: mapApiStatusToUi(d.status),
    // Backend is user-id based; keep UI as string for now, but display usernames if present.
    reported_by: d.reported_by_detail?.username || "",
    assigned_to: d.assignee_detail?.username || "",
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
    due_date: input.due_date || null,
    occurred_at: input.occurred_at || null,
    // reported_by / assignee are user ids in backend; leave null in this simple UI
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
    ...("title" in patch ? { title: patch.title } : {}),
    ...("description" in patch ? { description: patch.description } : {}),
    ...("severity" in patch ? { severity: mapUiSeverityToApi(patch.severity) } : {}),
    ...("status" in patch ? { status: mapUiStatusToApi(patch.status) } : {}),
    ...("due_date" in patch ? { due_date: patch.due_date || null } : {}),
    ...("occurred_at" in patch ? { occurred_at: patch.occurred_at || null } : {}),
  };

  const updated = await apiPut(`/api/defects/${encodeURIComponent(defectId)}/`, payload);
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
    const id = existing[0].id;
    return apiPatch(`/api/root-causes/${encodeURIComponent(id)}/`, {
      summary: input.summary || "",
      analysis: input.analysis || "",
      status: input.status || "IN_PROGRESS",
    });
  }

  return apiPost("/api/root-causes/", {
    defect_id: Number(defectId),
    summary: input.summary || "",
    analysis: input.analysis || "",
    status: input.status || "IN_PROGRESS",
  });
}

/**
 * PUBLIC_INTERFACE
 * Add a corrective action to a defect (optionally linked to root cause).
 */
export async function addCorrectiveAction(defectId, input) {
  const created = await apiPost("/api/corrective-actions/", {
    defect: Number(defectId),
    root_cause: input.root_cause_id ?? null,
    title: input.title || "",
    description: input.notes || input.description || "",
    status: mapUiActionStatusToApi(input.status),
    owner: null,
    due_date: input.due_date || null,
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
    ...("due_date" in patch ? { due_date: patch.due_date || null } : {}),
    ...("status" in patch ? { status: mapUiActionStatusToApi(patch.status) } : {}),
  };

  const updated = await apiPatch(`/api/corrective-actions/${encodeURIComponent(actionId)}/`, payload);
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
  // Move defect to VERIFIED (if possible) then CLOSED.
  // If defect isn't in ACTIONS_IN_PROGRESS, caller should have progressed earlier.
  await transitionDefect(defectId, "VERIFIED");
  const closed = await transitionDefect(defectId, "CLOSED");
  return closed;
}
