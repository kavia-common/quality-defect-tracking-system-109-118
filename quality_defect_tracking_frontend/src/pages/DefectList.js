import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listDefects } from "../api/defects";
import { ErrorAlert, Skeleton } from "../components/Primitives";
import { formatDate, severityBadgeClass, statusBadgeClass } from "../utils/ui";

/**
 * PUBLIC_INTERFACE
 * Defect list view with filters/search.
 */
export default function DefectList() {
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState({ loading: true, error: null, defects: [] });
  const [exportState, setExportState] = useState({ exporting: false, error: null });

  const filters = useMemo(() => {
    return {
      q: params.get("q") || "",
      status: params.get("status") || "",
      severity: params.get("severity") || "",
      area: params.get("area") || "",
    };
  }, [params]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const defects = await listDefects({
          q: filters.q,
          status: filters.status || undefined,
          severity: filters.severity || undefined,
          area: filters.area || undefined,
        });
        if (!mounted) return;
        setState({ loading: false, error: null, defects });
      } catch (err) {
        if (!mounted) return;
        setState({ loading: false, error: err, defects: [] });
      }
    })();

    return () => {
      mounted = false;
    };
  }, [filters.q, filters.status, filters.severity, filters.area]);

  const uniqueAreas = useMemo(() => {
    const set = new Set((state.defects || []).map((d) => d.area).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [state.defects]);

  function updateParam(key, value) {
    const next = new URLSearchParams(params);
    if (!value) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  }

  async function onExportCsv() {
    // Force a real browser download by navigating directly to the backend CSV endpoint.
    // Per requirements: no fetch/axios/blob.
    try {
      window.location.href = "http://localhost:3001/api/export-csv";
      setExportState({ exporting: false, error: null });
    } catch (err) {
      setExportState({ exporting: false, error: err });
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Defects</h1>
          <p className="page-subtitle">Search, triage, and manage corrective actions.</p>
        </div>
        <div className="inline-row">
          <button className="btn" onClick={onExportCsv} disabled={exportState.exporting}>
            {exportState.exporting ? "Exporting…" : "Export CSV"}
          </button>
          <Link className="btn btn-primary" to="/defects/new">
            + New defect
          </Link>
        </div>
      </div>

      {exportState.error ? (
        <div style={{ marginBottom: 12 }}>
          <ErrorAlert title="CSV export" error={exportState.error} />
        </div>
      ) : null}

      <div className="card">
        <div className="card-body">
          <div className="grid grid-3">
            <div className="field">
              <label className="label" htmlFor="q">
                Search
              </label>
              <input
                id="q"
                className="input"
                placeholder="ID, title, area, tag…"
                value={filters.q}
                onChange={(e) => updateParam("q", e.target.value)}
              />
              <div className="hint">Tip: try “torque”, “Packaging”, or “D-1002”.</div>
            </div>

            <div className="field">
              <label className="label" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                className="select"
                value={filters.status}
                onChange={(e) => updateParam("status", e.target.value)}
              >
                <option value="">All</option>
                <option value="Open">Open</option>
                <option value="Investigating">Investigating</option>
                <option value="Root cause identified">Root cause identified</option>
                <option value="Actions in progress">Actions in progress</option>
                <option value="Verified">Verified</option>
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
                value={filters.severity}
                onChange={(e) => updateParam("severity", e.target.value)}
              >
                <option value="">All</option>
                <option value="Critical">Critical</option>
                <option value="Major">Major</option>
                <option value="Minor">Minor</option>
              </select>
            </div>

            <div className="field">
              <label className="label" htmlFor="area">
                Area
              </label>
              <select
                id="area"
                className="select"
                value={filters.area}
                onChange={(e) => updateParam("area", e.target.value)}
              >
                <option value="">All</option>
                {uniqueAreas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div className="field" style={{ alignSelf: "end" }}>
              <div className="actions-row" style={{ justifyContent: "flex-start" }}>
                <button
                  className="btn"
                  onClick={() => {
                    setParams(new URLSearchParams(), { replace: true });
                  }}
                >
                  Clear
                </button>
                <div className="muted small">
                  Showing <strong>{state.loading ? "—" : state.defects.length}</strong> defects
                </div>
              </div>
            </div>
          </div>

          {state.error ? (
            <div style={{ marginTop: 12 }}>
              <ErrorAlert title="Loading defects" error={state.error} />
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Results</h3>
          <div className="muted small">Click a defect to open details and actions.</div>
        </div>
        <div className="card-body">
          {state.loading ? (
            <div className="grid" style={{ gap: 10 }}>
              <Skeleton height={20} />
              <Skeleton height={20} />
              <Skeleton height={20} />
            </div>
          ) : state.defects.length === 0 ? (
            <div className="muted">No defects match your filters.</div>
          ) : (
            <div className="table-wrap">
              <table className="table" role="table" aria-label="Defects table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Area</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {state.defects.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <Link to={`/defects/${encodeURIComponent(d.id)}`} style={{ fontWeight: 800 }}>
                          {d.id}
                        </Link>
                      </td>
                      <td style={{ maxWidth: 360 }}>
                        <div style={{ fontWeight: 700 }}>{d.title}</div>
                        <div className="muted small" style={{ marginTop: 4 }}>
                          {(d.description || "").slice(0, 90)}
                          {(d.description || "").length > 90 ? "…" : ""}
                        </div>
                      </td>
                      <td>{d.area || "—"}</td>
                      <td>
                        <span className={`badge ${severityBadgeClass(d.severity)}`}>{d.severity}</span>
                      </td>
                      <td>
                        <span className={`badge ${statusBadgeClass(d.status)}`}>{d.status}</span>
                      </td>
                      <td>{formatDate(d.updated_at)}</td>
                      <td>
                        <div className="inline-row">
                          <Link className="btn btn-small" to={`/defects/${encodeURIComponent(d.id)}`}>
                            Open
                          </Link>
                          <Link className="btn btn-ghost btn-small" to={`/defects/${encodeURIComponent(d.id)}/edit`}>
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
