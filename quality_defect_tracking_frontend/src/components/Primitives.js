import React from "react";

/**
 * PUBLIC_INTERFACE
 * Inline error alert.
 */
export function ErrorAlert({ title = "Something went wrong", error }) {
  const message =
    (typeof error === "string" && error) ||
    error?.message ||
    "Unexpected error. Please try again.";

  return (
    <div className="alert alert-error" role="alert" aria-live="polite">
      <strong>{title}:</strong> <span>{message}</span>
    </div>
  );
}

/**
 * PUBLIC_INTERFACE
 * Inline info alert.
 */
export function InfoAlert({ title = "Info", message }) {
  return (
    <div className="alert alert-info" role="status" aria-live="polite">
      <strong>{title}:</strong> <span>{message}</span>
    </div>
  );
}

/**
 * PUBLIC_INTERFACE
 * Simple skeleton block.
 */
export function Skeleton({ height = 14 }) {
  return <div className="skeleton" style={{ height }} aria-hidden="true" />;
}
