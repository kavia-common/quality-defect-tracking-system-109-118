/**
 * Lightweight fetch wrapper for the Django REST API.
 *
 * IMPORTANT:
 * - Reads base URL from REACT_APP_API_BASE or REACT_APP_BACKEND_URL.
 * - Exposes JSON helpers and consistent error handling.
 */

const RAW_BASE =
  (process.env.REACT_APP_API_BASE || process.env.REACT_APP_BACKEND_URL || "").trim();

function normalizeBaseUrl(raw) {
  if (!raw) return "";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

/**
 * Best-effort API base URL resolution.
 *
 * In some deployment modes, build-time env vars may not be injected into the
 * running frontend bundle. When that happens, we still want the app to be able
 * to call the backend.
 *
 * Strategy:
 * 1) Use REACT_APP_API_BASE / REACT_APP_BACKEND_URL if present.
 * 2) If running in a browser, infer backend origin by keeping the same hostname
 *    and switching to the known backend port (3001) used in this workspace.
 * 3) Fall back to same-origin (empty base) so callers can hit relative paths
 *    if a proxy is configured.
 */
function resolveApiBaseUrl() {
  const normalized = normalizeBaseUrl(RAW_BASE);
  if (normalized) return normalized;

  // Browser-only inference (won't run in Jest/node without window)
  if (typeof window !== "undefined" && window.location) {
    try {
      const { protocol, hostname } = window.location;
      // Kavia workspace convention: backend on 3001.
      return `${protocol}//${hostname}:3001`;
    } catch {
      // ignore and fall through
    }
  }

  // Allow relative calls when a reverse proxy is used.
  return "";
}

const API_BASE = resolveApiBaseUrl();

/**
 * PUBLIC_INTERFACE
 * Returns the configured API base URL (may be empty if not configured).
 */
export function getApiBaseUrl() {
  return API_BASE;
}

class ApiError extends Error {
  constructor(message, { status, data, url, method }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.url = url;
    this.method = method;
  }
}

/**
 * PUBLIC_INTERFACE
 * Perform an HTTP request to the API and return parsed JSON (or null for 204).
 */
export async function apiRequest(path, { method = "GET", body, signal, headers } = {}) {
  // If API_BASE is empty, we still attempt a relative request (useful when a proxy
  // serves the backend under the same origin).
  const url = `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  if (!API_BASE && typeof window !== "undefined") {
    // Provide a clearer diagnostic while still allowing the request attempt.
    // (If no proxy is set up, it will fail as a network error and surface below.)
    // eslint-disable-next-line no-console
    console.warn(
      "[api] API base URL not configured via env; attempting relative request:",
      url
    );
  }

  const requestHeaders = {
    Accept: "application/json",
    ...(body ? { "Content-Type": "application/json" } : {}),
    ...(headers || {}),
  };

  let resp;
  try {
    resp = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal,
      credentials: "include",
    });
  } catch (err) {
    throw new ApiError(`Network error while calling API: ${err?.message || "unknown error"}`, {
      status: 0,
      data: null,
      url,
      method,
    });
  }

  const contentType = resp.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await resp.json().catch(() => null) : await resp.text().catch(() => null);

  if (!resp.ok) {
    // Provide a useful message for common DRF validation failures (400),
    // while keeping a stable fallback for other error shapes.
    let message =
      (data && typeof data === "object" && (data.detail || data.message)) ||
      `API request failed (${resp.status})`;

    if (resp.status === 400 && data && typeof data === "object") {
      // DRF serializer errors are usually {field: [msg, ...], ...}
      // Include them so the UI doesn't just show a generic 400.
      try {
        message = `${message}: ${JSON.stringify(data)}`;
      } catch {
        // ignore stringify issues
      }
    }

    throw new ApiError(message, { status: resp.status, data, url, method });
  }

  if (resp.status === 204) return null;
  return data;
}

/**
 * PUBLIC_INTERFACE
 * Convenience helper for GET.
 */
export function apiGet(path, options = {}) {
  return apiRequest(path, { ...options, method: "GET" });
}

/**
 * PUBLIC_INTERFACE
 * Convenience helper for POST.
 */
export function apiPost(path, body, options = {}) {
  return apiRequest(path, { ...options, method: "POST", body });
}

/**
 * PUBLIC_INTERFACE
 * Convenience helper for PATCH.
 */
export function apiPatch(path, body, options = {}) {
  return apiRequest(path, { ...options, method: "PATCH", body });
}

/**
 * PUBLIC_INTERFACE
 * Convenience helper for PUT.
 */
export function apiPut(path, body, options = {}) {
  return apiRequest(path, { ...options, method: "PUT", body });
}

/**
 * PUBLIC_INTERFACE
 * Convenience helper for DELETE.
 */
export function apiDelete(path, options = {}) {
  return apiRequest(path, { ...options, method: "DELETE" });
}

/**
 * PUBLIC_INTERFACE
 * Determines if an error is an ApiError.
 */
export function isApiError(err) {
  return err && typeof err === "object" && err.name === "ApiError";
}
