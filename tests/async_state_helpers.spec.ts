import { describe, it, expect } from "vitest";
import {
  hasData,
  isStale,
  isRefreshing,
  isRefreshingWithData,
  hasError,
  getError,
  isLoading,
  isIdle,
  getDataRetrievedAt,
  getRequestInitiatedAt,
  getErrorFailedAt,
  hasScheduledRetry,
  getRetryTimeRemaining,
  getStatusMessage,
} from "../src/core/async_state_helpers";
import type { RequestState } from "../src/core/async_request_state";

describe("Async State Helpers", () => {
  const now = Date.now();
  const error = new Error("Test error");

  describe("hasData", () => {
    it("returns true for success state", () => {
      const state: RequestState = { type: "success", retrievedAt: now, retryAt: null };
      expect(hasData(state)).toBe(true);
    });

    it("returns true for stale-while-revalidate state", () => {
      const state: RequestState = {
        type: "stale-while-revalidate",
        retrievedAt: now,
        refreshInitiatedAt: now + 100,
        retryAt: null,
      };
      expect(hasData(state)).toBe(true);
    });

    it("returns true for stale-with-error state", () => {
      const state: RequestState = {
        type: "stale-with-error",
        retrievedAt: now,
        error,
        failedAt: now + 100,
        retryAt: null,
      };
      expect(hasData(state)).toBe(true);
    });

    it("returns false for idle state", () => {
      const state: RequestState = { type: "idle", retryAt: null };
      expect(hasData(state)).toBe(false);
    });

    it("returns false for loading state", () => {
      const state: RequestState = { type: "loading", initiatedAt: now, retryAt: null };
      expect(hasData(state)).toBe(false);
    });

    it("returns false for error state", () => {
      const state: RequestState = {
        type: "error",
        error,
        failedAt: now,
        retryAt: null,
      };
      expect(hasData(state)).toBe(false);
    });
  });

  describe("isStale", () => {
    it("returns true for stale-while-revalidate state", () => {
      const state: RequestState = {
        type: "stale-while-revalidate",
        retrievedAt: now,
        refreshInitiatedAt: now + 100,
        retryAt: null,
      };
      expect(isStale(state)).toBe(true);
    });

    it("returns true for stale-with-error state", () => {
      const state: RequestState = {
        type: "stale-with-error",
        retrievedAt: now,
        error,
        failedAt: now + 100,
        retryAt: null,
      };
      expect(isStale(state)).toBe(true);
    });

    it("returns false for success state", () => {
      const state: RequestState = { type: "success", retrievedAt: now, retryAt: null };
      expect(isStale(state)).toBe(false);
    });

    it("returns false for other states", () => {
      expect(isStale({ type: "idle", retryAt: null })).toBe(false);
      expect(isStale({ type: "loading", initiatedAt: now, retryAt: null })).toBe(false);
      expect(isStale({ type: "error", error, failedAt: now, retryAt: null })).toBe(false);
    });
  });

  describe("isRefreshing", () => {
    it("returns true for loading state", () => {
      const state: RequestState = { type: "loading", initiatedAt: now, retryAt: null };
      expect(isRefreshing(state)).toBe(true);
    });

    it("returns true for stale-while-revalidate state", () => {
      const state: RequestState = {
        type: "stale-while-revalidate",
        retrievedAt: now,
        refreshInitiatedAt: now + 100,
        retryAt: null,
      };
      expect(isRefreshing(state)).toBe(true);
    });

    it("returns false for other states", () => {
      expect(isRefreshing({ type: "idle", retryAt: null })).toBe(false);
      expect(isRefreshing({ type: "success", retrievedAt: now, retryAt: null })).toBe(false);
      expect(isRefreshing({ type: "error", error, failedAt: now, retryAt: null })).toBe(false);
      expect(
        isRefreshing({
          type: "stale-with-error",
          retrievedAt: now,
          error,
          failedAt: now + 100,
          retryAt: null,
        }),
      ).toBe(false);
    });
  });

  describe("isRefreshingWithData", () => {
    it("returns true only for stale-while-revalidate state", () => {
      const state: RequestState = {
        type: "stale-while-revalidate",
        retrievedAt: now,
        refreshInitiatedAt: now + 100,
        retryAt: null,
      };
      expect(isRefreshingWithData(state)).toBe(true);
    });

    it("returns false for loading state (no data)", () => {
      const state: RequestState = { type: "loading", initiatedAt: now, retryAt: null };
      expect(isRefreshingWithData(state)).toBe(false);
    });

    it("returns false for other states", () => {
      expect(isRefreshingWithData({ type: "idle", retryAt: null })).toBe(false);
      expect(isRefreshingWithData({ type: "success", retrievedAt: now, retryAt: null })).toBe(
        false,
      );
      expect(isRefreshingWithData({ type: "error", error, failedAt: now, retryAt: null })).toBe(
        false,
      );
      expect(
        isRefreshingWithData({
          type: "stale-with-error",
          retrievedAt: now,
          error,
          failedAt: now + 100,
          retryAt: null,
        }),
      ).toBe(false);
    });
  });

  describe("hasError", () => {
    it("returns true for error state", () => {
      const state: RequestState = { type: "error", error, failedAt: now, retryAt: null };
      expect(hasError(state)).toBe(true);
    });

    it("returns true for stale-with-error state", () => {
      const state: RequestState = {
        type: "stale-with-error",
        retrievedAt: now,
        error,
        failedAt: now + 100,
        retryAt: null,
      };
      expect(hasError(state)).toBe(true);
    });

    it("returns false for other states", () => {
      expect(hasError({ type: "idle", retryAt: null })).toBe(false);
      expect(hasError({ type: "loading", initiatedAt: now, retryAt: null })).toBe(false);
      expect(hasError({ type: "success", retrievedAt: now, retryAt: null })).toBe(false);
      expect(
        hasError({
          type: "stale-while-revalidate",
          retrievedAt: now,
          refreshInitiatedAt: now + 100,
          retryAt: null,
        }),
      ).toBe(false);
    });
  });

  describe("getError", () => {
    it("returns error for error state", () => {
      const state: RequestState = { type: "error", error, failedAt: now, retryAt: null };
      expect(getError(state)).toBe(error);
    });

    it("returns error for stale-with-error state", () => {
      const state: RequestState = {
        type: "stale-with-error",
        retrievedAt: now,
        error,
        failedAt: now + 100,
        retryAt: null,
      };
      expect(getError(state)).toBe(error);
    });

    it("returns null for other states", () => {
      expect(getError({ type: "idle", retryAt: null })).toBe(null);
      expect(getError({ type: "loading", initiatedAt: now, retryAt: null })).toBe(null);
      expect(getError({ type: "success", retrievedAt: now, retryAt: null })).toBe(null);
      expect(
        getError({
          type: "stale-while-revalidate",
          retrievedAt: now,
          refreshInitiatedAt: now + 100,
          retryAt: null,
        }),
      ).toBe(null);
    });
  });

  describe("isLoading", () => {
    it("returns true for loading state", () => {
      const state: RequestState = { type: "loading", initiatedAt: now, retryAt: null };
      expect(isLoading(state)).toBe(true);
    });

    it("returns false for other states", () => {
      expect(isLoading({ type: "idle", retryAt: null })).toBe(false);
      expect(isLoading({ type: "success", retrievedAt: now, retryAt: null })).toBe(false);
      expect(isLoading({ type: "error", error, failedAt: now, retryAt: null })).toBe(false);
      expect(
        isLoading({
          type: "stale-while-revalidate",
          retrievedAt: now,
          refreshInitiatedAt: now + 100,
          retryAt: null,
        }),
      ).toBe(false);
      expect(
        isLoading({
          type: "stale-with-error",
          retrievedAt: now,
          error,
          failedAt: now + 100,
          retryAt: null,
        }),
      ).toBe(false);
    });

    it("guarantee: never returns true when data exists", () => {
      // This is a key guarantee - loading never has data
      const statesWithData: RequestState[] = [
        { type: "success", retrievedAt: now, retryAt: null },
        {
          type: "stale-while-revalidate",
          retrievedAt: now,
          refreshInitiatedAt: now + 100,
          retryAt: null,
        },
        {
          type: "stale-with-error",
          retrievedAt: now,
          error,
          failedAt: now + 100,
          retryAt: null,
        },
      ];
      for (const state of statesWithData) {
        expect(isLoading(state)).toBe(false);
      }
    });
  });

  describe("isIdle", () => {
    it("returns true for idle state", () => {
      const state: RequestState = { type: "idle", retryAt: null };
      expect(isIdle(state)).toBe(true);
    });

    it("returns false for other states", () => {
      expect(isIdle({ type: "loading", initiatedAt: now, retryAt: null })).toBe(false);
      expect(isIdle({ type: "success", retrievedAt: now, retryAt: null })).toBe(false);
      expect(isIdle({ type: "error", error, failedAt: now, retryAt: null })).toBe(false);
      expect(
        isIdle({
          type: "stale-while-revalidate",
          retrievedAt: now,
          refreshInitiatedAt: now + 100,
          retryAt: null,
        }),
      ).toBe(false);
      expect(
        isIdle({
          type: "stale-with-error",
          retrievedAt: now,
          error,
          failedAt: now + 100,
          retryAt: null,
        }),
      ).toBe(false);
    });
  });

  describe("getDataRetrievedAt", () => {
    it("returns retrievedAt for success state", () => {
      const state: RequestState = { type: "success", retrievedAt: now, retryAt: null };
      expect(getDataRetrievedAt(state)).toBe(now);
    });

    it("returns retrievedAt for stale-while-revalidate state", () => {
      const state: RequestState = {
        type: "stale-while-revalidate",
        retrievedAt: now,
        refreshInitiatedAt: now + 100,
        retryAt: null,
      };
      expect(getDataRetrievedAt(state)).toBe(now);
    });

    it("returns retrievedAt for stale-with-error state", () => {
      const state: RequestState = {
        type: "stale-with-error",
        retrievedAt: now,
        error,
        failedAt: now + 100,
        retryAt: null,
      };
      expect(getDataRetrievedAt(state)).toBe(now);
    });

    it("returns null for states without data", () => {
      expect(getDataRetrievedAt({ type: "idle", retryAt: null })).toBe(null);
      expect(getDataRetrievedAt({ type: "loading", initiatedAt: now, retryAt: null })).toBe(
        null,
      );
      expect(getDataRetrievedAt({ type: "error", error, failedAt: now, retryAt: null })).toBe(
        null,
      );
    });
  });

  describe("getRequestInitiatedAt", () => {
    it("returns initiatedAt for loading state", () => {
      const state: RequestState = { type: "loading", initiatedAt: now, retryAt: null };
      expect(getRequestInitiatedAt(state)).toBe(now);
    });

    it("returns refreshInitiatedAt for stale-while-revalidate state", () => {
      const refreshTime = now + 100;
      const state: RequestState = {
        type: "stale-while-revalidate",
        retrievedAt: now,
        refreshInitiatedAt: refreshTime,
        retryAt: null,
      };
      expect(getRequestInitiatedAt(state)).toBe(refreshTime);
    });

    it("returns null for other states", () => {
      expect(getRequestInitiatedAt({ type: "idle", retryAt: null })).toBe(null);
      expect(getRequestInitiatedAt({ type: "success", retrievedAt: now, retryAt: null })).toBe(
        null,
      );
      expect(getRequestInitiatedAt({ type: "error", error, failedAt: now, retryAt: null })).toBe(
        null,
      );
      expect(
        getRequestInitiatedAt({
          type: "stale-with-error",
          retrievedAt: now,
          error,
          failedAt: now + 100,
          retryAt: null,
        }),
      ).toBe(null);
    });
  });

  describe("getErrorFailedAt", () => {
    it("returns failedAt for error state", () => {
      const state: RequestState = { type: "error", error, failedAt: now, retryAt: null };
      expect(getErrorFailedAt(state)).toBe(now);
    });

    it("returns failedAt for stale-with-error state", () => {
      const state: RequestState = {
        type: "stale-with-error",
        retrievedAt: now,
        error,
        failedAt: now + 100,
        retryAt: null,
      };
      expect(getErrorFailedAt(state)).toBe(now + 100);
    });

    it("returns null for other states", () => {
      expect(getErrorFailedAt({ type: "idle", retryAt: null })).toBe(null);
      expect(getErrorFailedAt({ type: "loading", initiatedAt: now, retryAt: null })).toBe(null);
      expect(getErrorFailedAt({ type: "success", retrievedAt: now, retryAt: null })).toBe(null);
      expect(
        getErrorFailedAt({
          type: "stale-while-revalidate",
          retrievedAt: now,
          refreshInitiatedAt: now + 100,
          retryAt: null,
        }),
      ).toBe(null);
    });
  });

  describe("hasScheduledRetry", () => {
    it("returns true when retryAt is in the future", () => {
      const futureTime = Date.now() + 1000;
      const state: RequestState = { type: "error", error, failedAt: now, retryAt: futureTime };
      expect(hasScheduledRetry(state)).toBe(true);
    });

    it("returns false when retryAt is null", () => {
      const state: RequestState = { type: "error", error, failedAt: now, retryAt: null };
      expect(hasScheduledRetry(state)).toBe(false);
    });

    it("returns false when retryAt is in the past", () => {
      const pastTime = Date.now() - 1000;
      const state: RequestState = { type: "error", error, failedAt: now, retryAt: pastTime };
      expect(hasScheduledRetry(state)).toBe(false);
    });

    it("works with all state types", () => {
      const futureTime = Date.now() + 1000;
      expect(hasScheduledRetry({ type: "idle", retryAt: futureTime })).toBe(true);
      expect(hasScheduledRetry({ type: "loading", initiatedAt: now, retryAt: futureTime })).toBe(
        true,
      );
      expect(hasScheduledRetry({ type: "success", retrievedAt: now, retryAt: futureTime })).toBe(
        true,
      );
    });
  });

  describe("getRetryTimeRemaining", () => {
    it("returns null when retryAt is null", () => {
      const state: RequestState = { type: "error", error, failedAt: now, retryAt: null };
      expect(getRetryTimeRemaining(state)).toBe(null);
    });

    it("returns positive milliseconds when retryAt is in the future", () => {
      const futureTime = Date.now() + 5000;
      const state: RequestState = { type: "error", error, failedAt: now, retryAt: futureTime };
      const remaining = getRetryTimeRemaining(state);
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(5000);
    });

    it("returns 0 when retryAt is in the past", () => {
      const pastTime = Date.now() - 1000;
      const state: RequestState = { type: "error", error, failedAt: now, retryAt: pastTime };
      expect(getRetryTimeRemaining(state)).toBe(0);
    });

    it("returns 0 when retryAt is exactly now", () => {
      const currentTime = Date.now();
      const state: RequestState = { type: "error", error, failedAt: now, retryAt: currentTime };
      expect(getRetryTimeRemaining(state)).toBe(0);
    });
  });

  describe("getStatusMessage", () => {
    it("returns correct message for idle state", () => {
      const state: RequestState = { type: "idle", retryAt: null };
      expect(getStatusMessage(state)).toBe("Ready");
    });

    it("returns correct message for loading state", () => {
      const state: RequestState = { type: "loading", initiatedAt: now, retryAt: null };
      expect(getStatusMessage(state)).toBe("Loading...");
    });

    it("returns correct message for success state", () => {
      const state: RequestState = { type: "success", retrievedAt: now, retryAt: null };
      expect(getStatusMessage(state)).toBe("Loaded");
    });

    it("returns correct message for error state", () => {
      const state: RequestState = { type: "error", error, failedAt: now, retryAt: null };
      expect(getStatusMessage(state)).toBe(`Error: ${error.message}`);
    });

    it("returns correct message for stale-while-revalidate state", () => {
      const state: RequestState = {
        type: "stale-while-revalidate",
        retrievedAt: now,
        refreshInitiatedAt: now + 100,
        retryAt: null,
      };
      expect(getStatusMessage(state)).toBe("Refreshing...");
    });

    it("returns correct message for stale-with-error state", () => {
      const state: RequestState = {
        type: "stale-with-error",
        retrievedAt: now,
        error,
        failedAt: now + 100,
        retryAt: null,
      };
      expect(getStatusMessage(state)).toBe(`Stale (Error: ${error.message})`);
    });
  });
});

