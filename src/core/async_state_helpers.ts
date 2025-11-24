/**
 * Async State Helper Functions
 *
 * Utility functions for interpreting RequestState in UI code.
 * See GRIP_ASYNC_REQUEST_STATE.md for detailed specification.
 */

import type { RequestState } from "./async_request_state";

/**
 * Checks if data is currently available (either fresh or stale).
 * Returns true if state is success, stale-while-revalidate, or stale-with-error.
 */
export function hasData(state: RequestState): boolean {
  return (
    state.type === "success" ||
    state.type === "stale-while-revalidate" ||
    state.type === "stale-with-error"
  );
}

/**
 * Checks if data is available but potentially stale.
 * Returns true if state is stale-while-revalidate or stale-with-error.
 */
export function isStale(state: RequestState): boolean {
  return state.type === "stale-while-revalidate" || state.type === "stale-with-error";
}

/**
 * Checks if a request is currently in progress (either initial load or refresh).
 * Returns true if state is loading or stale-while-revalidate.
 */
export function isRefreshing(state: RequestState): boolean {
  return state.type === "loading" || state.type === "stale-while-revalidate";
}

/**
 * Checks if a refresh is in progress with existing data available.
 * Returns true only if state is stale-while-revalidate (data exists, refresh in progress).
 */
export function isRefreshingWithData(state: RequestState): boolean {
  return state.type === "stale-while-revalidate";
}

/**
 * Checks if there is an error condition.
 * Returns true if state is error or stale-with-error.
 */
export function hasError(state: RequestState): boolean {
  return state.type === "error" || state.type === "stale-with-error";
}

/**
 * Gets the error object if present, null otherwise.
 */
export function getError(state: RequestState): Error | null {
  return state.type === "error" || state.type === "stale-with-error" ? state.error : null;
}

/**
 * Checks if the current state indicates loading (no data available yet).
 * Returns true if state is loading and no cached data exists.
 */
export function isLoading(state: RequestState): boolean {
  return state.type === "loading";
}

/**
 * Checks if the state is idle (no request has been made).
 */
export function isIdle(state: RequestState): boolean {
  return state.type === "idle";
}

/**
 * Gets the timestamp when data was last successfully retrieved.
 * Returns null if no data has been retrieved yet.
 */
export function getDataRetrievedAt(state: RequestState): number | null {
  switch (state.type) {
    case "success":
    case "stale-while-revalidate":
    case "stale-with-error":
      return state.retrievedAt;
    default:
      return null;
  }
}

/**
 * Gets the timestamp when a request was initiated.
 * Returns null if no request is currently in progress.
 */
export function getRequestInitiatedAt(state: RequestState): number | null {
  switch (state.type) {
    case "loading":
      return state.initiatedAt;
    case "stale-while-revalidate":
      return state.refreshInitiatedAt;
    default:
      return null;
  }
}

/**
 * Gets the timestamp when an error occurred.
 * Returns null if no error has occurred.
 */
export function getErrorFailedAt(state: RequestState): number | null {
  switch (state.type) {
    case "error":
    case "stale-with-error":
      return state.failedAt;
    default:
      return null;
  }
}

/**
 * Checks if a retry is scheduled (future time).
 */
export function hasScheduledRetry(state: RequestState): boolean {
  return state.retryAt !== null && state.retryAt > Date.now();
}

/**
 * Gets the time remaining until the next retry in milliseconds.
 * Returns 0 if retry is due now (or overdue), null if no retry is scheduled.
 */
export function getRetryTimeRemaining(state: RequestState): number | null {
  if (state.retryAt === null) return null;
  const remaining = state.retryAt - Date.now();
  return remaining > 0 ? remaining : 0;
}

/**
 * Gets a human-readable status string for UI display.
 */
export function getStatusMessage(state: RequestState): string {
  switch (state.type) {
    case "idle":
      return "Ready";
    case "loading":
      return "Loading...";
    case "success":
      return "Loaded";
    case "error":
      return `Error: ${state.error.message}`;
    case "stale-while-revalidate":
      return "Refreshing...";
    case "stale-with-error":
      return `Stale (Error: ${state.error.message})`;
  }
}

