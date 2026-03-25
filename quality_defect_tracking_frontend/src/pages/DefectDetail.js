import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  addCorrectiveAction,
  closeDefect,
  deleteCorrectiveAction,
  deleteDefect,
  getDefect,
  transitionDefect,
  updateCorrectiveAction,
  upsertRootCause,
} from "../api/defects";
import { ErrorAlert, InfoAlert, Skeleton } from "../components/Primitives";
import {
  canMoveBeyondOpen,
  daysOverdue,
  formatDate,
  isActionCompleted,
  isActionOverdue,
  severityBadgeClass,
  statusBadgeClass,
} from "../utils/ui";

/**
 * PUBLIC_INTERFACE
 * Defect details page with root cause workflow and corrective actions.
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

  // Acceptance criteria: support structured 5-Why analysis input.
  const [rootCauseDraft, setRootCauseDraft] = useState({
    status: "IN_PROGRESS",
    summary: "",
    why1: "",
    why2: "",
    why3: "",
    why4: "",
    why5: "",
    evidence: "",
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

        const rc = defect?.root_cause;
        if (rc) {
          // If prior analysis was stored as free-text, keep it in "evidence" so user doesn't lose it.
          // (Backend still has summary/analysis fields; we serialize structured 5-whys into analysis.)
          setRootCauseDraft({
            status: rc.status || "IN_PROGRESS",
            summary: rc.summary || "",
            why1: "",
            why2: "",
            why3: "",
            why4: "",
            why5: "",
            evidence: rc.analysis || "",
          });
        } else {
          setRootCauseDraft({
            status: "IN_PROGRESS",
            summary: "",
            why1: "",
            why2: "",
            why3: "",
            why4: "",
            why5: "",
            evidence: "",
          });
        }
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
    const overdue = daysOverdue(state.defect.due_date);
    if (overdue === null) return null;
    if (overdue > 0) return { label: `${overdue}d overdue`, className: "badge-red" };
    return { label: "On track", className: "badge-blue" };
  }, [state.defect]);

  const overdueActions = useMemo(() => {
    const actions = state.defect?.corrective_actions || [];
    return actions.filter((a) => isActionOverdue(a));
  }, [state.defect]);

  async function refresh() {
    const defect = await getDefect(defectId);
    setState({ loading: false, error: null, defect });
  }

  async function onAddAction(e) {
    e.preventDefault();
    try {
      // Acceptance criteria: each action must include description, owner, due date, status.
      // Backend requires `description` specifically; in this UI the required field is `title`
      // (labeled "Description *"), and we map it to backend description in the API layer.
      if (!String(actionDraft.title || "").trim()) {
        throw new Error("Action description is required.");
      }
      if (!String(actionDraft.owner || "").trim()) throw new Error("Action owner is required.");
      if (!String(actionDraft.due_date || "").trim()) throw new Error("Action due date is required.");
      if (!String(actionDraft.status || "").trim()) throw new Error("Action status is required.");

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

  function buildStructuredAnalysisText() {
    const lines = [];
    const whys = [rootCauseDraft.why1, rootCauseDraft.why2, rootCauseDraft.why3, rootCauseDraft.why4, rootCauseDraft.why5]
      .map((v) => String(v || "").trim())
      .filter(Boolean);

    if (whys.length) {
      lines.push("5-Why Analysis:");
      whys.forEach((w, idx) => lines.push(`${idx + 1}) ${w}`));
      lines.push("");
    }

    const evidence = String(rootCauseDraft.evidence || "").trim();
    if (evidence) {
      lines.push("Evidence / Notes:");
      lines.push(evidence);
    }

    return lines.join("\n").trim();
  }

  async function onSaveRootCause(e) {
    e.preventDefault();
    try {
      // Ensure required summary when trying to move towards "identified/approved" (backend rule)
      const requestedStatus = String(rootCauseDraft.status || "").trim().toUpperCase();
      if ((requestedStatus === "IDENTIFIED" || requestedStatus === "APPROVED") && !String(rootCauseDraft.summary || "").trim()) {
        throw new Error("Root cause summary is required to mark as Identified/Approved.");
      }

      const analysis = buildStructuredAnalysisText();

      await upsertRootCause(defectId, {
        status: rootCauseDraft.status,
        summary: rootCauseDraft.summary,
        analysis,
      });
      await refresh();
    } catch (err) {
      setState((s) => ({ ...s, error: err }));
    }
  }

  async function onTransitionDefect(nextStatusApi) {
    try {
      // Acceptance criteria: root cause mandatory before moving beyond Open.
      const defect = state.defect;
      if (!defect) return;

      // The backend workflow supports statuses, but acceptance criteria calls out:
      // Open → Investigating → Actions In Progress → Closed
      // We gate any move away from OPEN.
      if (String(defect.status || "") === "Open" && nextStatusApi !== "OPEN") {
        if (!canMoveBeyondOpen(defect)) {
          throw new Error("Root cause summary is required before moving beyond Open.");
        }
      }

      await transitionDefect(defectId, nextStatusApi);
      await refresh();
    } catch (err) {
      setState((s) => ({ ...s, error: err }));
    }
  }

  async function onCloseDefect() {
    if (!window.confirm("Close this defect? This will attempt VERIFIED → CLOSED.")) return;
    try {
      await closeDefect(defectId);
      await refresh();
    } catch (err) {
      setState((s) => ({ ...s, error: err }));
    }
  }

  const workflowHint = useMemo(() => {
    const defect = state.defect;
    if (!defect) return null;
    if (defect.status === "Open" && !canMoveBeyondOpen(defect)) {
      return {
        type: "info",
        msg: "Workflow gate: add a Root Cause summary before moving beyond Open.",
      };
    }
    return null;
  }, [state.defect]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Defect Detail</h1>
          <p className="page-subtitle">Track status, root cause, and corrective actions.</p>
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

      {workflowHint ? (
        <div style={{ marginBottom: 14 }}>
          <InfoAlert title="Workflow" message={workflowHint.msg} />
        </div>
      ) : null}

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

                {overdueActions.length ? (
                  <div className="alert alert-error" role="alert" aria-live="polite">
                    <strong>Overdue actions:</strong>{" "}
                    {overdueActions.length} action(s) are overdue.
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Root Cause & Workflow</h3>
              <div className="inline-row">
                <button
                  className="btn btn-small"
                  onClick={() => onTransitionDefect("INVESTIGATING")}
                  disabled={state.defect.status === "Investigating"}
                >
                  Set Investigating
                </button>
                <button
                  className="btn btn-small"
                  onClick={() => onTransitionDefect("ACTIONS_IN_PROGRESS")}
                  disabled={state.defect.status === "Actions in progress"}
                >
                  Set Actions in progress
                </button>
                <button className="btn btn-secondary btn-small" onClick={onCloseDefect}>
                  Close defect
                </button>
              </div>
            </div>

            <div className="card-body">
              <div className="muted small" style={{ marginBottom: 10 }}>
                Expected workflow: <strong>Open → Investigating → Actions In Progress → Closed</strong>.
                Root cause summary is required before moving beyond Open.
              </div>

              <form className="form" onSubmit={onSaveRootCause}>
                <div className="grid grid-2">
                  <div className="field">
                    <label className="label" htmlFor="rc_status">
                      Root cause status
                    </label>
                    <select
                      id="rc_status"
                      className="select"
                      value={rootCauseDraft.status}
                      onChange={(e) => setRootCauseDraft((s) => ({ ...s, status: e.target.value }))}
                    >
                      <option value="NOT_STARTED">Not started</option>
                      <option value="IN_PROGRESS">In progress</option>
                      <option value="IDENTIFIED">Identified</option>
                      <option value="APPROVED">Approved</option>
                    </select>
                    <div className="hint">
                      Tip: when moving to IDENTIFIED/APPROVED, backend requires a non-empty summary.
                    </div>
                  </div>

                  <div className="field">
                    <label className="label" htmlFor="rc_summary">
                      Summary *
                    </label>
                    <input
                      id="rc_summary"
                      className="input"
                      value={rootCauseDraft.summary}
                      onChange={(e) => setRootCauseDraft((s) => ({ ...s, summary: e.target.value }))}
                      placeholder="Concise statement of the root cause"
                      required
                    />
                  </div>
                </div>

                <div className="card" style={{ borderRadius: 14, boxShadow: "none" }}>
                  <div className="card-body" style={{ padding: 12 }}>
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>Structured 5‑Why Analysis</div>

                    <div className="grid" style={{ gap: 10 }}>
                      {[1, 2, 3, 4, 5].map((n) => {
                        const key = `why${n}`;
                        return (
                          <div className="field" key={key}>
                            <label className="label" htmlFor={key}>
                              Why #{n}
                            </label>
                            <input
                              id={key}
                              className="input"
                              value={rootCauseDraft[key]}
                              onChange={(e) =>
                                setRootCauseDraft((s) => ({ ...s, [key]: e.target.value }))
                              }
                              placeholder={n === 1 ? "Why did it happen?" : "Why is that?"}
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div className="field" style={{ marginTop: 10 }}>
                      <label className="label" htmlFor="rc_evidence">
                        Evidence / Notes
                      </label>
                      <textarea
                        id="rc_evidence"
                        className="textarea"
                        value={rootCauseDraft.evidence}
                        onChange={(e) => setRootCauseDraft((s) => ({ ...s, evidence: e.target.value }))}
                        placeholder="Measurements, test results, observations, contributing factors…"
                      />
                      <div className="hint">
                        Saved to backend as the Root Cause “analysis” field (includes the 5‑Whys + notes).
                      </div>
                    </div>
                  </div>
                </div>

                <div className="actions-row">
                  <button className="btn btn-secondary" type="submit">
                    Save root cause
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Corrective Actions</h3>
              <div className="muted small">
                {(state.defect.corrective_actions || []).length} action(s) •{" "}
                <strong>{overdueActions.length}</strong> overdue
              </div>
            </div>

            <div className="card-body">
              <form className="form" onSubmit={onAddAction}>
                <div className="field">
                  <label className="label" htmlFor="a_title">
                    Description *
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
                      Owner *
                    </label>
                    <input
                      id="a_owner"
                      className="input"
                      required
                      value={actionDraft.owner}
                      placeholder="Name"
                      onChange={(e) => setActionDraft((s) => ({ ...s, owner: e.target.value }))}
                    />
                  </div>

                  <div className="field">
                    <label className="label" htmlFor="a_due">
                      Due date *
                    </label>
                    <input
                      id="a_due"
                      className="input"
                      type="date"
                      required
                      value={actionDraft.due_date}
                      onChange={(e) => setActionDraft((s) => ({ ...s, due_date: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-2">
                  <div className="field">
                    <label className="label" htmlFor="a_status">
                      Status *
                    </label>
                    <select
                      id="a_status"
                      className="select"
                      value={actionDraft.status}
                      onChange={(e) => setActionDraft((s) => ({ ...s, status: e.target.value }))}
                      required
                    >
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Done">Done</option>
                      <option value="Verified">Verified</option>
                      <option value="Canceled">Canceled</option>
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
                  {(state.defect.corrective_actions || []).map((a) => {
                    const overdue = isActionOverdue(a);
                    const overdueDays = overdue ? daysOverdue(a.due_date) : 0;

                    return (
                      <div
                        key={a.id}
                        className="card"
                        style={{
                          borderRadius: 14,
                          boxShadow: "none",
                          borderColor: overdue ? "rgba(239, 68, 68, 0.35)" : undefined,
                          background: overdue ? "rgba(239, 68, 68, 0.05)" : undefined,
                        }}
                      >
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
                                {overdue ? (
                                  <>
                                    {" "}
                                    • <strong style={{ color: "#b91c1c" }}>{overdueDays}d overdue</strong>
                                  </>
                                ) : null}
                              </div>
                              {a.notes ? (
                                <div className="muted small" style={{ marginTop: 6 }}>
                                  Notes: {a.notes}
                                </div>
                              ) : null}
                            </div>

                            <div className="inline-row">
                              {(() => {
                                // Backend enforces action status transitions:
                                // OPEN -> IN_PROGRESS|CANCELED
                                // IN_PROGRESS -> DONE|CANCELED
                                // DONE -> VERIFIED
                                // VERIFIED/CANCELED -> (terminal)
                                const cur = String(a.status || "").trim().toLowerCase();
                                const allowed = {
                                  open: ["Open", "In Progress", "Canceled"],
                                  "in progress": ["In Progress", "Done", "Canceled"],
                                  done: ["Done", "Verified"],
                                  verified: ["Verified"],
                                  canceled: ["Canceled"],
                                  closed: ["Done"], // legacy UI value maps to DONE
                                };
                                const options = allowed[cur] || ["Open", "In Progress", "Done", "Verified", "Canceled"];
                                return (
                                  <select
                                    className="select"
                                    value={a.status}
                                    onChange={(e) => onUpdateAction(a.id, { status: e.target.value })}
                                    aria-label={`Change status for action ${a.id}`}
                                  >
                                    {options.map((opt) => (
                                      <option value={opt} key={opt}>
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                );
                              })()}

                              <button
                                className="btn btn-danger btn-small"
                                onClick={() => onDeleteAction(a.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          <div className="muted small" style={{ marginTop: 8 }}>
                            Updated {formatDate(a.updated_at)} •{" "}
                            <span style={{ fontWeight: 700 }}>
                              {isActionCompleted(a.status) ? "Completed" : "Active"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
