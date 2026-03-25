import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { exportAllDefectsAuditCsv, getBackendHealth, listDefects } from "../api/defects";
import { isApiError } from "../api/client";
import { ErrorAlert, InfoAlert, Skeleton } from "../components/Primitives";
import { paretoByDefectTitle, defectTrend } from "../utils/analytics";
import {
  countOverdueActions,
  formatDate,
  severityBadgeClass,
  statusBadgeClass,
} from "../utils/ui";

/**
 * PUBLIC_INTERFACE
 * Dashboard view: health check + key metrics + analytics + recent defects.
 */
export default function Dashboard() {
  const [health, setHealth] = useState({ loading: true, ok: false, message: "" });
  const [state, setState] = useState({ loading: true, error: null, defects: [] });

  const [filters, setFilters] = useState({ severity: "", status: "" });
  const [exportState, setExportState] = useState({ exporting: false, error: null });

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const resp = await getBackendHealth();
        if (!mounted) return;
        setHealth({ loading: false, ok: true, message: resp?.message || "OK" });
      } catch (err) {
        if (!mounted) return;
        setHealth({
          loading: false,
          ok: false,
          message: isApiError(err)
            ? err.message
            : "Unable to reach backend health endpoint (check REACT_APP_API_BASE).",
        });
      }
    })();

    (async () => {
      try {
        const defects = await listDefects({});
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
  }, []);

  const filteredDefects = useMemo(() => {
    const items = state.defects || [];
    return items.filter((d) => {
      if (filters.severity && d.severity !== filters.severity) return false;
      if (filters.status && d.status !== filters.status) return false;
      return true;
    });
  }, [state.defects, filters.severity, filters.status]);

  const metrics = useMemo(() => {
    const defects = filteredDefects || [];
    const byStatus = defects.reduce((acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    }, {});
    const open = (byStatus.Open || 0) + (byStatus.Investigating || 0) + (byStatus["Root cause identified"] || 0) + (byStatus["Actions in progress"] || 0);
    const closed = (byStatus.Closed || 0) + (byStatus.Verified || 0);
    const overdueActions = countOverdueActions(defects);
    return { total: defects.length, open, closed, overdueActions, byStatus };
  }, [filteredDefects]);

  const recent = (filteredDefects || []).slice(0, 5);

  const pareto = useMemo(() => paretoByDefectTitle(filteredDefects, 8), [filteredDefects]);
  const trendWeekly = useMemo(() => defectTrend(filteredDefects, "weekly").slice(-10), [filteredDefects]);

  async function onExportAudit() {
    setExportState({ exporting: true, error: null });
    try {
      const csv = await exportAllDefectsAuditCsv();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `defect_audit_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setExportState({ exporting: false, error: null });
    } catch (err) {
      setExportState({ exporting: false, error: err });
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Overview of defects, overdue corrective actions, and basic analytics.
          </p>
        </div>
        <div className="inline-row">
          <button className="btn" onClick={onExportAudit} disabled={exportState.exporting}>
            {exportState.exporting ? "Exporting…" : "Export audit (CSV)"}
          </button>
          <Link className="btn btn-primary" to="/defects/new">
            + Log defect
          </Link>
          <Link className="btn" to="/defects">
            View all
          </Link>
        </div>
      </div>

      {exportState.error ? (
        <div style={{ marginBottom: 12 }}>
          <ErrorAlert title="Audit export" error={exportState.error} />
        </div>
      ) : null}

      {health.loading ? (
        <div className="card">
          <div className="card-body">
            <Skeleton height={14} />
            <div style={{ height: 8 }} />
            <Skeleton height={14} />
          </div>
        </div>
      ) : health.ok ? (
        <InfoAlert title="Backend health" message={health.message} />
      ) : (
        <ErrorAlert title="Backend health" error={health.message} />
      )}

      <div style={{ height: 14 }} />

      {state.error ? <ErrorAlert title="Loading defects" error={state.error} /> : null}

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-header">
          <h3 className="card-title">Filters</h3>
          <div className="muted small">Dashboard metrics + analytics update dynamically.</div>
        </div>
        <div className="card-body">
          <div className="grid grid-3">
            <div className="field">
              <label className="label" htmlFor="dash_sev">
                Severity
              </label>
              <select
                id="dash_sev"
                className="select"
                value={filters.severity}
                onChange={(e) => setFilters((s) => ({ ...s, severity: e.target.value }))}
              >
                <option value="">All</option>
                <option value="Critical">Critical</option>
                <option value="Major">Major</option>
                <option value="Medium">Medium</option>
                <option value="Minor">Minor</option>
              </select>
            </div>

            <div className="field">
              <label className="label" htmlFor="dash_status">
                Status
              </label>
              <select
                id="dash_status"
                className="select"
                value={filters.status}
                onChange={(e) => setFilters((s) => ({ ...s, status: e.target.value }))}
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

            <div className="field" style={{ alignSelf: "end" }}>
              <div className="actions-row" style={{ justifyContent: "flex-start" }}>
                <button
                  className="btn"
                  onClick={() => setFilters({ severity: "", status: "" })}
                  disabled={state.loading}
                >
                  Clear
                </button>
                <div className="muted small">
                  Showing <strong>{state.loading ? "—" : filteredDefects.length}</strong> defects
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 14 }}>
        <div className="grid grid-2">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Total defects</h3>
            </div>
            <div className="card-body" style={{ fontSize: 28, fontWeight: 800 }}>
              {state.loading ? "—" : metrics.total}
              <div className="muted small" style={{ marginTop: 6 }}>
                Current view
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Open defects</h3>
            </div>
            <div className="card-body" style={{ fontSize: 28, fontWeight: 800 }}>
              {state.loading ? "—" : metrics.open}
              <div className="muted small" style={{ marginTop: 6 }}>
                Not closed
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Closed defects</h3>
            </div>
            <div className="card-body" style={{ fontSize: 28, fontWeight: 800 }}>
              {state.loading ? "—" : metrics.closed}
              <div className="muted small" style={{ marginTop: 6 }}>
                Verified/Closed
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Overdue actions</h3>
            </div>
            <div className="card-body" style={{ fontSize: 28, fontWeight: 800 }}>
              {state.loading ? "—" : metrics.overdueActions}
              <div className="muted small" style={{ marginTop: 6 }}>
                Due date passed & not completed
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Defect trend (weekly)</h3>
            <div className="muted small">Last {trendWeekly.length} buckets</div>
          </div>
          <div className="card-body">
            {state.loading ? (
              <div className="grid" style={{ gap: 10 }}>
                <Skeleton height={18} />
                <Skeleton height={18} />
                <Skeleton height={18} />
              </div>
            ) : trendWeekly.length === 0 ? (
              <div className="muted">Not enough data to show a trend yet.</div>
            ) : (
              <div className="grid" style={{ gap: 10 }}>
                {(() => {
                  const max = Math.max(...trendWeekly.map((p) => p.count), 1);
                  return trendWeekly.map((p) => (
                    <div key={p.bucket} className="inline-row" style={{ justifyContent: "space-between" }}>
                      <div className="muted small" style={{ width: 86 }}>
                        {p.bucket}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div
                          className="skeleton"
                          style={{
                            height: 12,
                            background: "rgba(37, 99, 235, 0.10)",
                            border: "1px solid rgba(37, 99, 235, 0.18)",
                            width: `${Math.round((p.count / max) * 100)}%`,
                          }}
                          aria-hidden="true"
                        />
                      </div>
                      <div style={{ width: 34, textAlign: "right", fontWeight: 800 }}>{p.count}</div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Pareto (top defect types)</h3>
            <div className="muted small">Ranked by count (uses title as type)</div>
          </div>
          <div className="card-body">
            {state.loading ? (
              <div className="grid" style={{ gap: 10 }}>
                <Skeleton height={18} />
                <Skeleton height={18} />
                <Skeleton height={18} />
              </div>
            ) : pareto.length === 0 ? (
              <div className="muted">No defects to analyze yet.</div>
            ) : (
              <div className="grid" style={{ gap: 10 }}>
                {(() => {
                  const max = Math.max(...pareto.map((p) => p.count), 1);
                  return pareto.map((p) => (
                    <div key={p.label} className="grid" style={{ gap: 6 }}>
                      <div className="inline-row" style={{ justifyContent: "space-between" }}>
                        <div style={{ fontWeight: 800, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.label}
                        </div>
                        <div className="muted small">
                          {p.count} ({p.pct.toFixed(0)}%) • Cum {p.cumPct.toFixed(0)}%
                        </div>
                      </div>
                      <div
                        className="skeleton"
                        style={{
                          height: 12,
                          background: "rgba(245, 158, 11, 0.12)",
                          border: "1px solid rgba(245, 158, 11, 0.22)",
                          width: `${Math.round((p.count / max) * 100)}%`,
                        }}
                        aria-hidden="true"
                      />
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent defects</h3>
            <Link className="btn btn-ghost btn-small" to="/defects">
              Open list →
            </Link>
          </div>
          <div className="card-body">
            {state.loading ? (
              <div className="grid" style={{ gap: 10 }}>
                <Skeleton height={18} />
                <Skeleton height={18} />
                <Skeleton height={18} />
              </div>
            ) : recent.length === 0 ? (
              <div className="muted">No defects yet. Log your first defect to start tracking.</div>
            ) : (
              <div className="grid" style={{ gap: 10 }}>
                {recent.map((d) => (
                  <div key={d.id} className="card" style={{ borderRadius: 14, boxShadow: "none" }}>
                    <div className="card-body" style={{ padding: 12 }}>
                      <div className="inline-row" style={{ justifyContent: "space-between" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            <Link to={`/defects/${encodeURIComponent(d.id)}`}>{d.id}</Link>{" "}
                            <span className="muted" style={{ fontWeight: 600 }}>
                              — {d.title}
                            </span>
                          </div>
                          <div className="muted small" style={{ marginTop: 4 }}>
                            Updated {formatDate(d.updated_at)} • Area: {d.area || "—"}
                          </div>
                        </div>
                        <div className="inline-row">
                          <span className={`badge ${severityBadgeClass(d.severity)}`}>{d.severity}</span>
                          <span className={`badge ${statusBadgeClass(d.status)}`}>{d.status}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
