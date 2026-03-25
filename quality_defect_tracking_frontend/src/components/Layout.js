import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { getApiBaseUrl } from "../api/client";

/**
 * PUBLIC_INTERFACE
 * App shell layout providing top navbar and content container.
 */
export function Layout({ children }) {
  const location = useLocation();
  const apiBase = getApiBaseUrl();

  return (
    <div>
      <div className="navbar" role="banner">
        <div className="navbar-inner">
          <div className="brand" aria-label="Quality Defect Tracking System">
            <div className="brand-badge" aria-hidden="true" />
            <div>
              <div className="brand-title">Quality Defect Tracking</div>
              <div className="brand-subtitle">
                Ocean Professional • {apiBase ? "API configured" : "API not configured"}
              </div>
            </div>
          </div>

          <nav className="nav-links" aria-label="Primary navigation">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/defects"
              className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}
            >
              Defects
            </NavLink>
            <NavLink
              to="/defects/new"
              className={({ isActive }) =>
                `btn btn-primary btn-small ${isActive ? "" : ""}`
              }
              aria-current={location.pathname === "/defects/new" ? "page" : undefined}
            >
              + New Defect
            </NavLink>
          </nav>
        </div>
      </div>

      <main className="container" role="main">
        {children}
        <div style={{ marginTop: 18 }} className="muted small">
          Tip: Configure <code>REACT_APP_API_BASE</code> (or <code>REACT_APP_BACKEND_URL</code>) to
          point to the Django backend (e.g. https://…:3001). Current UI stores defects locally until
          defect CRUD endpoints are available.
        </div>
      </main>
    </div>
  );
}
