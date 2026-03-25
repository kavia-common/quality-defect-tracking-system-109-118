import { apiGet } from "./client";

/**
 * NOTE:
 * The backend container currently only exposes /api/health/.
 * This module therefore:
 * - Calls backend health endpoint for connectivity
 * - Uses localStorage for defect/action CRUD so the full UI works end-to-end in the frontend
 */

const LS_KEY = "qdt.defects.v1";

function nowIso() {
  return new Date().toISOString();
}

function loadAll() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

function saveAll(defects) {
  localStorage.setItem(LS_KEY, JSON.stringify(defects));
}

function ensureSeed() {
  const existing = loadAll();
  if (existing.length > 0) return existing;

  const seeded = [
    {
      id: "D-10024",
      title: "Surface scratch on housing (Line 2)",
      description:
        "Multiple units show light scratches on the anodized surface after packaging. Suspect tray alignment issue.",
      status: "Open",
      severity: "Major",
      priority: "P2",
      area: "Packaging",
      reported_by: "A. Rivera",
      assigned_to: "J. Kim",
      created_at: nowIso(),
      updated_at: nowIso(),
      due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      tags: ["cosmetic", "packaging"],
      corrective_actions: [
        {
          id: "CA-9001",
          title: "Audit tray alignment and add locator pins",
          owner: "J. Kim",
          status: "In Progress",
          due_date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
          notes: "Maintenance to validate fixtures by end of week.",
          created_at: nowIso(),
          updated_at: nowIso(),
        },
      ],
    },
    {
      id: "D-10025",
      title: "Intermittent torque fail at station 4",
      description:
        "Torque tool reports intermittent fail; retest often passes. Need gauge R&R and tool calibration review.",
      status: "Investigating",
      severity: "Critical",
      priority: "P1",
      area: "Assembly",
      reported_by: "M. Chen",
      assigned_to: "S. Patel",
      created_at: nowIso(),
      updated_at: nowIso(),
      due_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      tags: ["torque", "calibration"],
      corrective_actions: [
        {
          id: "CA-9002",
          title: "Calibrate torque tool and verify with master gauge",
          owner: "S. Patel",
          status: "Open",
          due_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
          notes: "",
          created_at: nowIso(),
          updated_at: nowIso(),
        },
      ],
    },
  ];

  saveAll(seeded);
  return seeded;
}

function generateDefectId(defects) {
  // Simple numeric increment based on existing D-xxxxx ids.
  const nums = defects
    .map((d) => String(d.id || ""))
    .map((id) => {
      const m = id.match(/^D-(\d+)$/);
      return m ? Number(m[1]) : null;
    })
    .filter((x) => typeof x === "number" && Number.isFinite(x));
  const next = (nums.length ? Math.max(...nums) : 10000) + 1;
  return `D-${next}`;
}

function generateActionId(defect) {
  const nums = (defect.corrective_actions || [])
    .map((a) => String(a.id || ""))
    .map((id) => {
      const m = id.match(/^CA-(\d+)$/);
      return m ? Number(m[1]) : null;
    })
    .filter((x) => typeof x === "number" && Number.isFinite(x));
  const next = (nums.length ? Math.max(...nums) : 9000) + 1;
  return `CA-${next}`;
}

/**
 * PUBLIC_INTERFACE
 * Checks backend availability.
 */
export async function getBackendHealth() {
  // Backend routes from api/urls.py: /api/health/
  return apiGet("/api/health/");
}

/**
 * PUBLIC_INTERFACE
 * Lists defects with optional filters.
 */
export async function listDefects({ q, status, severity, area } = {}) {
  const all = ensureSeed();

  const query = (q || "").trim().toLowerCase();

  return all
    .filter((d) => {
      if (status && d.status !== status) return false;
      if (severity && d.severity !== severity) return false;
      if (area && d.area !== area) return false;
      if (!query) return true;

      const haystack = [
        d.id,
        d.title,
        d.description,
        d.status,
        d.severity,
        d.priority,
        d.area,
        d.reported_by,
        d.assigned_to,
        ...(d.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    })
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

/**
 * PUBLIC_INTERFACE
 * Get a single defect by id.
 */
export async function getDefect(defectId) {
  const all = ensureSeed();
  return all.find((d) => d.id === defectId) || null;
}

/**
 * PUBLIC_INTERFACE
 * Create a new defect.
 */
export async function createDefect(input) {
  const all = ensureSeed();
  const id = generateDefectId(all);

  const created = {
    id,
    title: input.title || "",
    description: input.description || "",
    status: input.status || "Open",
    severity: input.severity || "Minor",
    priority: input.priority || "P3",
    area: input.area || "General",
    reported_by: input.reported_by || "",
    assigned_to: input.assigned_to || "",
    due_date: input.due_date || "",
    tags: Array.isArray(input.tags) ? input.tags : [],
    corrective_actions: [],
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  saveAll([created, ...all]);
  return created;
}

/**
 * PUBLIC_INTERFACE
 * Update an existing defect.
 */
export async function updateDefect(defectId, patch) {
  const all = ensureSeed();
  const idx = all.findIndex((d) => d.id === defectId);
  if (idx === -1) return null;

  const updated = {
    ...all[idx],
    ...patch,
    tags: Array.isArray(patch.tags) ? patch.tags : all[idx].tags,
    updated_at: nowIso(),
  };

  const next = [...all];
  next[idx] = updated;
  saveAll(next);
  return updated;
}

/**
 * PUBLIC_INTERFACE
 * Delete defect.
 */
export async function deleteDefect(defectId) {
  const all = ensureSeed();
  const next = all.filter((d) => d.id !== defectId);
  saveAll(next);
  return { ok: next.length !== all.length };
}

/**
 * PUBLIC_INTERFACE
 * Add a corrective action to a defect.
 */
export async function addCorrectiveAction(defectId, input) {
  const all = ensureSeed();
  const idx = all.findIndex((d) => d.id === defectId);
  if (idx === -1) return null;

  const defect = all[idx];
  const action = {
    id: generateActionId(defect),
    title: input.title || "",
    owner: input.owner || "",
    status: input.status || "Open",
    due_date: input.due_date || "",
    notes: input.notes || "",
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  const next = [...all];
  next[idx] = {
    ...defect,
    corrective_actions: [action, ...(defect.corrective_actions || [])],
    updated_at: nowIso(),
  };

  saveAll(next);
  return action;
}

/**
 * PUBLIC_INTERFACE
 * Update corrective action on a defect.
 */
export async function updateCorrectiveAction(defectId, actionId, patch) {
  const all = ensureSeed();
  const idx = all.findIndex((d) => d.id === defectId);
  if (idx === -1) return null;

  const defect = all[idx];
  const actions = defect.corrective_actions || [];
  const aIdx = actions.findIndex((a) => a.id === actionId);
  if (aIdx === -1) return null;

  const updated = {
    ...actions[aIdx],
    ...patch,
    updated_at: nowIso(),
  };

  const nextActions = [...actions];
  nextActions[aIdx] = updated;

  const next = [...all];
  next[idx] = { ...defect, corrective_actions: nextActions, updated_at: nowIso() };
  saveAll(next);
  return updated;
}

/**
 * PUBLIC_INTERFACE
 * Delete corrective action on a defect.
 */
export async function deleteCorrectiveAction(defectId, actionId) {
  const all = ensureSeed();
  const idx = all.findIndex((d) => d.id === defectId);
  if (idx === -1) return null;

  const defect = all[idx];
  const actions = defect.corrective_actions || [];
  const nextActions = actions.filter((a) => a.id !== actionId);

  const next = [...all];
  next[idx] = { ...defect, corrective_actions: nextActions, updated_at: nowIso() };
  saveAll(next);
  return { ok: nextActions.length !== actions.length };
}
