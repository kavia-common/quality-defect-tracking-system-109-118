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

const API_BASE = normalizeBaseUrl(RAW_BASE);

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
  if (!API_BASE) {
    throw new ApiError(
      "API base URL is not configured. Set REACT_APP_API_BASE or REACT_APP_BACKEND_URL.",
      { status: 0, data: null, url: path, method }
    );
  }

  const url = `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

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
    const message =
      (data && typeof data === "object" && (data.detail || data.message)) ||
      `API request failed (${resp.status})`;
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
