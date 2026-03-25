import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getBackendHealth, listDefects } from "../api/defects";
import { isApiError } from "../api/client";
import { ErrorAlert, InfoAlert, Skeleton } from "../components/Primitives";
import { formatDate, severityBadgeClass, statusBadgeClass } from "../utils/ui";

/**
 * PUBLIC_INTERFACE
 * Dashboard view: health check + key metrics + recent defects.
 */
export default function Dashboard() {
  const [health, setHealth] = useState({ loading: true, ok: false, message: "" });
  const [state, setState] = useState({ loading: true, error: null, defects: [] });

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

  const metrics = useMemo(() => {
    const defects = state.defects || [];
    const byStatus = defects.reduce((acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    }, {});
    const critical = defects.filter((d) => d.severity === "Critical").length;
    const open = (byStatus.Open || 0) + (byStatus.Investigating || 0);
    return { total: defects.length, open, critical, byStatus };
  }, [state.defects]);

  const recent = (state.defects || []).slice(0, 5);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Overview of active defects, risk hotspots, and corrective action momentum.
          </p>
        </div>
        <div className="inline-row">
          <Link className="btn btn-primary" to="/defects/new">
            + Log defect
          </Link>
          <Link className="btn" to="/defects">
            View all
          </Link>
        </div>
      </div>

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

      <div className="grid grid-3" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Total defects</h3>
          </div>
          <div className="card-body" style={{ fontSize: 28, fontWeight: 800 }}>
            {state.loading ? "—" : metrics.total}
            <div className="muted small" style={{ marginTop: 6 }}>
              All time (local demo store)
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Open / Investigating</h3>
          </div>
          <div className="card-body" style={{ fontSize: 28, fontWeight: 800 }}>
            {state.loading ? "—" : metrics.open}
            <div className="muted small" style={{ marginTop: 6 }}>
              Needs triage and closure plan
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Critical severity</h3>
          </div>
          <div className="card-body" style={{ fontSize: 28, fontWeight: 800 }}>
            {state.loading ? "—" : metrics.critical}
            <div className="muted small" style={{ marginTop: 6 }}>
              Highest impact items
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 14 }} />

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
                <div
                  key={d.id}
                  className="card"
                  style={{ borderRadius: 14, boxShadow: "none" }}
                >
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
  );
}
