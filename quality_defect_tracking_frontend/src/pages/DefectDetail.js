import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  addCorrectiveAction,
  deleteCorrectiveAction,
  deleteDefect,
  getDefect,
  updateCorrectiveAction,
} from "../api/defects";
import { ErrorAlert, Skeleton } from "../components/Primitives";
import { daysUntil, formatDate, severityBadgeClass, statusBadgeClass } from "../utils/ui";

/**
 * PUBLIC_INTERFACE
 * Defect details page with corrective actions.
 */
export default function DefectDetail() {
  const { defectId } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: null, defect: null });

  const [actionDraft, setActionDraft] = useState({
    title: "",
    owner: "",
    status: "Open",
    due_date: "",
    notes: "",
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      setState({ loading: true, error: null, defect: null });
      try {
        const defect = await getDefect(defectId);
        if (!mounted) return;
        if (!defect) {
          setState({ loading: false, error: new Error("Defect not found"), defect: null });
          return;
        }
        setState({ loading: false, error: null, defect });
      } catch (err) {
        if (!mounted) return;
        setState({ loading: false, error: err, defect: null });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [defectId]);

  const dueMeta = useMemo(() => {
    if (!state.defect?.due_date) return null;
    const days = daysUntil(state.defect.due_date);
    if (days === null) return null;
    if (days < 0) return { label: `${Math.abs(days)}d overdue`, className: "badge-red" };
    if (days <= 3) return { label: `${days}d remaining`, className: "badge-amber" };
    return { label: `${days}d remaining`, className: "badge-blue" };
  }, [state.defect]);

  async function refresh() {
    const defect = await getDefect(defectId);
    setState({ loading: false, error: null, defect });
  }

  async function onAddAction(e) {
    e.preventDefault();
    try {
      await addCorrectiveAction(defectId, actionDraft);
      setActionDraft({ title: "", owner: "", status: "Open", due_date: "", notes: "" });
      await refresh();
    } catch (err) {
      setState((s) => ({ ...s, error: err }));
    }
  }

  async function onUpdateAction(actionId, patch) {
    try {
      await updateCorrectiveAction(defectId, actionId, patch);
      await refresh();
    } catch (err) {
      setState((s) => ({ ...s, error: err }));
    }
  }

  async function onDeleteAction(actionId) {
    if (!window.confirm("Delete this corrective action?")) return;
    try {
      await deleteCorrectiveAction(defectId, actionId);
      await refresh();
    } catch (err) {
      setState((s) => ({ ...s, error: err }));
    }
  }

  async function onDeleteDefect() {
    if (!window.confirm(`Delete defect ${defectId}? This cannot be undone.`)) return;
    try {
      await deleteDefect(defectId);
      navigate("/defects");
    } catch (err) {
      setState((s) => ({ ...s, error: err }));
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Defect Detail</h1>
          <p className="page-subtitle">Track status, ownership, and corrective actions.</p>
        </div>
        <div className="inline-row">
          <Link className="btn" to="/defects">
            ← Back
          </Link>
          <Link className="btn btn-ghost" to={`/defects/${encodeURIComponent(defectId)}/edit`}>
            Edit
          </Link>
          <button className="btn btn-danger" onClick={onDeleteDefect}>
            Delete
          </button>
        </div>
      </div>

      {state.error ? (
        <div style={{ marginBottom: 14 }}>
          <ErrorAlert title="Defect" error={state.error} />
        </div>
      ) : null}

      {state.loading ? (
        <div className="grid grid-2">
          <div className="card">
            <div className="card-body">
              <Skeleton height={18} />
              <div style={{ height: 10 }} />
              <Skeleton height={14} />
              <div style={{ height: 10 }} />
              <Skeleton height={80} />
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <Skeleton height={18} />
              <div style={{ height: 10 }} />
              <Skeleton height={14} />
              <div style={{ height: 10 }} />
              <Skeleton height={120} />
            </div>
          </div>
        </div>
      ) : !state.defect ? null : (
        <div className="grid grid-2">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                {state.defect.id} — {state.defect.title}
              </h3>
              <div className="inline-row">
                <span className={`badge ${severityBadgeClass(state.defect.severity)}`}>
                  {state.defect.severity}
                </span>
                <span className={`badge ${statusBadgeClass(state.defect.status)}`}>
                  {state.defect.status}
                </span>
                {dueMeta ? <span className={`badge ${dueMeta.className}`}>{dueMeta.label}</span> : null}
              </div>
            </div>
            <div className="card-body">
              <div className="grid" style={{ gap: 10 }}>
                <div className="muted small">
                  Created {formatDate(state.defect.created_at)} • Updated {formatDate(state.defect.updated_at)}
                </div>

                <div className="card" style={{ borderRadius: 14, boxShadow: "none" }}>
                  <div className="card-body" style={{ padding: 12 }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Description</div>
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                      {state.defect.description || "—"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-2">
                  <div className="card" style={{ borderRadius: 14, boxShadow: "none" }}>
                    <div className="card-body" style={{ padding: 12 }}>
                      <div className="muted small">Area</div>
                      <div style={{ fontWeight: 800 }}>{state.defect.area || "—"}</div>
                    </div>
                  </div>
                  <div className="card" style={{ borderRadius: 14, boxShadow: "none" }}>
                    <div className="card-body" style={{ padding: 12 }}>
                      <div className="muted small">Priority</div>
                      <div style={{ fontWeight: 800 }}>{state.defect.priority || "—"}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-2">
                  <div className="card" style={{ borderRadius: 14, boxShadow: "none" }}>
                    <div className="card-body" style={{ padding: 12 }}>
                      <div className="muted small">Reported by</div>
                      <div style={{ fontWeight: 800 }}>{state.defect.reported_by || "—"}</div>
                    </div>
                  </div>
                  <div className="card" style={{ borderRadius: 14, boxShadow: "none" }}>
                    <div className="card-body" style={{ padding: 12 }}>
                      <div className="muted small">Assigned to</div>
                      <div style={{ fontWeight: 800 }}>{state.defect.assigned_to || "—"}</div>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ borderRadius: 14, boxShadow: "none" }}>
                  <div className="card-body" style={{ padding: 12 }}>
                    <div className="muted small">Tags</div>
                    <div className="inline-row" style={{ marginTop: 6 }}>
                      {(state.defect.tags || []).length === 0 ? (
                        <span className="muted">—</span>
                      ) : (
                        state.defect.tags.map((t) => (
                          <span className="badge badge-blue" key={t}>
                            {t}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Corrective Actions</h3>
              <div className="muted small">{(state.defect.corrective_actions || []).length} action(s)</div>
            </div>
            <div className="card-body">
              <form className="form" onSubmit={onAddAction}>
                <div className="field">
                  <label className="label" htmlFor="a_title">
                    Add action
                  </label>
                  <input
                    id="a_title"
                    className="input"
                    required
                    value={actionDraft.title}
                    placeholder="e.g., Calibrate tool, update SOP, add inspection…"
                    onChange={(e) => setActionDraft((s) => ({ ...s, title: e.target.value }))}
                  />
                </div>

                <div className="grid grid-2">
                  <div className="field">
                    <label className="label" htmlFor="a_owner">
                      Owner
                    </label>
                    <input
                      id="a_owner"
                      className="input"
                      value={actionDraft.owner}
                      placeholder="Name"
                      onChange={(e) => setActionDraft((s) => ({ ...s, owner: e.target.value }))}
                    />
                  </div>

                  <div className="field">
                    <label className="label" htmlFor="a_due">
                      Due date
                    </label>
                    <input
                      id="a_due"
                      className="input"
                      type="date"
                      value={actionDraft.due_date}
                      onChange={(e) => setActionDraft((s) => ({ ...s, due_date: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-2">
                  <div className="field">
                    <label className="label" htmlFor="a_status">
                      Status
                    </label>
                    <select
                      id="a_status"
                      className="select"
                      value={actionDraft.status}
                      onChange={(e) => setActionDraft((s) => ({ ...s, status: e.target.value }))}
                    >
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>

                  <div className="field">
                    <label className="label" htmlFor="a_notes">
                      Notes
                    </label>
                    <input
                      id="a_notes"
                      className="input"
                      value={actionDraft.notes}
                      placeholder="Optional"
                      onChange={(e) => setActionDraft((s) => ({ ...s, notes: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="actions-row">
                  <button className="btn btn-secondary" type="submit">
                    Add action
                  </button>
                </div>
              </form>

              <div style={{ height: 12 }} />

              {(state.defect.corrective_actions || []).length === 0 ? (
                <div className="muted">No actions yet. Add one above to start the corrective workflow.</div>
              ) : (
                <div className="grid" style={{ gap: 10 }}>
                  {(state.defect.corrective_actions || []).map((a) => (
                    <div key={a.id} className="card" style={{ borderRadius: 14, boxShadow: "none" }}>
                      <div className="card-body" style={{ padding: 12 }}>
                        <div className="inline-row" style={{ justifyContent: "space-between" }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 900 }}>
                              {a.id}{" "}
                              <span className="muted" style={{ fontWeight: 700 }}>
                                — {a.title}
                              </span>
                            </div>
                            <div className="muted small" style={{ marginTop: 6 }}>
                              Owner: <strong>{a.owner || "—"}</strong> • Due:{" "}
                              <strong>{a.due_date ? formatDate(a.due_date) : "—"}</strong>
                            </div>
                            {a.notes ? (
                              <div className="muted small" style={{ marginTop: 6 }}>
                                Notes: {a.notes}
                              </div>
                            ) : null}
                          </div>

                          <div className="inline-row">
                            <select
                              className="select"
                              value={a.status}
                              onChange={(e) => onUpdateAction(a.id, { status: e.target.value })}
                              aria-label={`Change status for action ${a.id}`}
                            >
                              <option value="Open">Open</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Closed">Closed</option>
                            </select>
                            <button className="btn btn-danger btn-small" onClick={() => onDeleteAction(a.id)}>
                              Delete
                            </button>
                          </div>
                        </div>
                        <div className="muted small" style={{ marginTop: 8 }}>
                          Updated {formatDate(a.updated_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
