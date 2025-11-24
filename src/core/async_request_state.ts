/**
 * Async Request State Types
 *
 * Type definitions for tracking and exposing async request state.
 * See GRIP_ASYNC_REQUEST_STATE.md for detailed specification.
 */

import type { GripContext } from "./context";

/**
 * Base type for all request states with common retry scheduling.
 */
export type RequestStateBase = {
  retryAt: number | null; // Scheduled retry time or null if no retry scheduled
};

/**
 * Discriminated union type for all possible request states.
 */
export type RequestState =
  | ({ type: "idle" } & RequestStateBase)
  | ({ type: "loading"; initiatedAt: number } & RequestStateBase)
  | ({ type: "success"; retrievedAt: number } & RequestStateBase)
  | ({ type: "error"; error: Error; failedAt: number } & RequestStateBase)
  | ({
      type: "stale-while-revalidate";
      retrievedAt: number;
      refreshInitiatedAt: number;
    } & RequestStateBase)
  | ({
      type: "stale-with-error";
      retrievedAt: number;
      error: Error;
      failedAt: number;
    } & RequestStateBase);

/**
 * Historical state entry for debugging purposes.
 * Captures a snapshot of state at a specific point in time.
 */
export interface StateHistoryEntry {
  state: RequestState;
  timestamp: number; // When this state was entered
  requestKey: string | null;
  transitionReason?: string; // Optional reason for state transition
}

/**
 * Complete async request state for a destination context.
 */
export interface AsyncRequestState {
  state: RequestState;
  requestKey: string | null; // The cache key for this request
  /**
   * Whether any consumers are subscribed to the output Grip(s) for this destination context.
   */
  hasListeners: boolean;
  /**
   * Last N state transitions for debugging.
   */
  history: ReadonlyArray<StateHistoryEntry>;
}

/**
 * Retry configuration for exponential backoff.
 */
export interface RetryConfig {
  maxRetries?: number; // Maximum number of retries (default: 3)
  initialDelayMs?: number; // Initial retry delay (default: 1000ms)
  maxDelayMs?: number; // Maximum retry delay (default: 30000ms)
  backoffMultiplier?: number; // Exponential backoff multiplier (default: 2)
  retryOnError?: (error: Error) => boolean; // Predicate to determine if error is retryable
}

/**
 * Controller interface for async tap operations.
 * Provides methods to manually trigger retries and refreshes.
 */
export interface AsyncTapController {
  /**
   * Manually trigger a retry for the current destination context.
   * Cancels any in-flight request and initiates a new request.
   *
   * @param forceRefetch - If true, bypasses cache and forces a fresh fetch
   */
  retry(forceRefetch?: boolean): void;

  /**
   * Manually trigger a refresh for the current destination context.
   * If data exists, this initiates a stale-while-revalidate refresh.
   * If no data exists, this initiates a new request.
   *
   * @param forceRefetch - If true, bypasses cache and forces a fresh fetch
   */
  refresh(forceRefetch?: boolean): void;

  /**
   * Reset the state for the current destination context.
   * Clears current state, cancels all timers, and clears history.
   */
  reset(): void;

  /**
   * Cancel any scheduled retries for the current destination context.
   */
  cancelRetry(): void;

  /**
   * Abort any in-flight request for the current destination context.
   * This is an internal method exposed for concurrency management.
   */
  abort(): void;
}

