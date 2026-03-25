import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createDefect, getDefect, updateDefect } from "../api/defects";
import { ErrorAlert, Skeleton } from "../components/Primitives";

/**
 * PUBLIC_INTERFACE
 * Create/Edit defect form.
 */
export default function DefectForm() {
  const { defectId } = useParams();
  const isEdit = Boolean(defectId);
  const navigate = useNavigate();

  const [state, setState] = useState({ loading: isEdit, error: null });
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "Open",
    severity: "Minor",
    priority: "P3",
    area: "General",
    reported_by: "",
    assigned_to: "",
    due_date: "",
    tagsText: "",
  });

  const tags = useMemo(() => {
    const raw = (form.tagsText || "").trim();
    if (!raw) return [];
    return raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }, [form.tagsText]);

  useEffect(() => {
    let mounted = true;
    if (!isEdit) return;

    (async () => {
      try {
        const d = await getDefect(defectId);
        if (!mounted) return;
        if (!d) {
          setState({ loading: false, error: new Error("Defect not found") });
          return;
        }
        setForm({
          title: d.title || "",
          description: d.description || "",
          status: d.status || "Open",
          severity: d.severity || "Minor",
          priority: d.priority || "P3",
          area: d.area || "General",
          reported_by: d.reported_by || "",
          assigned_to: d.assigned_to || "",
          due_date: d.due_date || "",
          tagsText: (d.tags || []).join(", "),
        });
        setState({ loading: false, error: null });
      } catch (err) {
        if (!mounted) return;
        setState({ loading: false, error: err });
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isEdit, defectId]);

  async function onSubmit(e) {
    e.preventDefault();
    setState((s) => ({ ...s, error: null }));

    const payload = {
      title: form.title,
      description: form.description,
      status: form.status,
      severity: form.severity,
      priority: form.priority,
      area: form.area,
      reported_by: form.reported_by,
      assigned_to: form.assigned_to,
      due_date: form.due_date,
      tags,
    };

    try {
      if (isEdit) {
        const updated = await updateDefect(defectId, payload);
        if (!updated) throw new Error("Unable to update defect (not found).");
        navigate(`/defects/${encodeURIComponent(defectId)}`);
      } else {
        const created = await createDefect(payload);
        navigate(`/defects/${encodeURIComponent(created.id)}`);
      }
    } catch (err) {
      setState((s) => ({ ...s, error: err }));
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isEdit ? "Edit Defect" : "New Defect"}</h1>
          <p className="page-subtitle">
            Capture key details to enable consistent triage and corrective action workflows.
          </p>
        </div>
        <div className="inline-row">
          <Link className="btn" to={isEdit ? `/defects/${encodeURIComponent(defectId)}` : "/defects"}>
            ← Cancel
          </Link>
        </div>
      </div>

      {state.error ? (
        <div style={{ marginBottom: 14 }}>
          <ErrorAlert title={isEdit ? "Updating defect" : "Creating defect"} error={state.error} />
        </div>
      ) : null}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Defect details</h3>
          <div className="muted small">Fields marked required must be completed.</div>
        </div>

        <div className="card-body">
          {state.loading ? (
            <div className="grid" style={{ gap: 10 }}>
              <Skeleton height={16} />
              <Skeleton height={16} />
              <Skeleton height={80} />
            </div>
          ) : (
            <form className="form" onSubmit={onSubmit}>
              <div className="field">
                <label className="label" htmlFor="title">
                  Title *
                </label>
                <input
                  id="title"
                  className="input"
                  required
                  value={form.title}
                  onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                  placeholder="Short summary of the defect"
                />
              </div>

              <div className="field">
                <label className="label" htmlFor="description">
                  Description *
                </label>
                <textarea
                  id="description"
                  className="textarea"
                  required
                  value={form.description}
                  onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                  placeholder="What was observed, where, when, and under what conditions?"
                />
              </div>

              <div className="grid grid-3">
                <div className="field">
                  <label className="label" htmlFor="status">
                    Status
                  </label>
                  <select
                    id="status"
                    className="select"
                    value={form.status}
                    onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}
                  >
                    <option value="Open">Open</option>
                    <option value="Investigating">Investigating</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>

                <div className="field">
                  <label className="label" htmlFor="severity">
                    Severity
                  </label>
                  <select
                    id="severity"
                    className="select"
                    value={form.severity}
                    onChange={(e) => setForm((s) => ({ ...s, severity: e.target.value }))}
                  >
                    <option value="Critical">Critical</option>
                    <option value="Major">Major</option>
                    <option value="Minor">Minor</option>
                  </select>
                </div>

                <div className="field">
                  <label className="label" htmlFor="priority">
                    Priority
                  </label>
                  <select
                    id="priority"
                    className="select"
                    value={form.priority}
                    onChange={(e) => setForm((s) => ({ ...s, priority: e.target.value }))}
                  >
                    <option value="P1">P1</option>
                    <option value="P2">P2</option>
                    <option value="P3">P3</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-2">
                <div className="field">
                  <label className="label" htmlFor="area">
                    Area
                  </label>
                  <input
                    id="area"
                    className="input"
                    value={form.area}
                    onChange={(e) => setForm((s) => ({ ...s, area: e.target.value }))}
                    placeholder="e.g., Assembly, Packaging, Incoming…"
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="due_date">
                    Due date
                  </label>
                  <input
                    id="due_date"
                    type="date"
                    className="input"
                    value={form.due_date}
                    onChange={(e) => setForm((s) => ({ ...s, due_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-2">
                <div className="field">
                  <label className="label" htmlFor="reported_by">
                    Reported by
                  </label>
                  <input
                    id="reported_by"
                    className="input"
                    value={form.reported_by}
                    onChange={(e) => setForm((s) => ({ ...s, reported_by: e.target.value }))}
                    placeholder="Name"
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="assigned_to">
                    Assigned to
                  </label>
                  <input
                    id="assigned_to"
                    className="input"
                    value={form.assigned_to}
                    onChange={(e) => setForm((s) => ({ ...s, assigned_to: e.target.value }))}
                    placeholder="Name"
                  />
                </div>
              </div>

              <div className="field">
                <label className="label" htmlFor="tags">
                  Tags (comma-separated)
                </label>
                <input
                  id="tags"
                  className="input"
                  value={form.tagsText}
                  onChange={(e) => setForm((s) => ({ ...s, tagsText: e.target.value }))}
                  placeholder="e.g., torque, cosmetic, calibration"
                />
                <div className="hint">Parsed tags: {tags.length ? tags.join(" • ") : "—"}</div>
              </div>

              <div className="actions-row">
                <button className="btn btn-primary" type="submit">
                  {isEdit ? "Save changes" : "Create defect"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
