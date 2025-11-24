## Grip Async Taps: Design Spec

Goal: First‑class support for async, cancelable, cacheable taps driven by destination/home parameters. Keep code modular and small, avoid enums/switches; rely on classes and helpers. Provide tests before any demo integration (e.g., OpenMeteo).

Principles
- No mutation of engine internals; use existing tap lifecycle (attach/connect/disconnect/detach) and destination param semantics.
- Per‑destination isolation: concurrency and cancellation tracked per destination.
- Predictable, minimal APIs; small helpers over deep inheritance trees.

---

### Core Additions (proposed)

1) BaseAsyncTap (core)
- Purpose: Common utilities for async taps (per‑destination state, cancellation, debouncing, caching, latest‑only).
- Extends: `BaseTap` (or `BaseTapNoParams` depending on use).
- Responsibilities (per destination):
  - Track param snapshot → derive a stable request key (string)
  - Debounce param changes (optional) before triggering a request
  - Cancel in‑flight request via `AbortController`
  - Latest‑only: ignore out‑of‑date completions
  - Publish mapped outputs on success; publish `undefined`/no‑op on failure (configurable)
  - Cleanup on `onDisconnect`/`onDetach`
- Minimal API (abstracts):
  - `protected getRequestKey(dest: GripContext): string | undefined`
  - `protected buildRequest(dest: GripContext, signal: AbortSignal): Promise<unknown>`
  - `protected mapResultToUpdates(dest: GripContext, result: unknown): Map<Grip<any>, any>`
- Options:
  - `debounceMs?: number` (default 0)
  - `cache?: AsyncCache<string, unknown>`
  - `cacheTtlMs?: number`
  - `latestOnly?: boolean` (default true)
  - `deadlineMs?: number` (request timeout, default 0 = no timeout)
  - `historySize?: number` (state transition history size, default 10, 0 = disabled)
  - `retry?: RetryConfig` (exponential backoff retry configuration)
  - `refreshBeforeExpiryMs?: number` (refresh before TTL expires, default 0)
- Optional State Grip: Expose request state per destination (`stateGrip?: Grip<AsyncRequestState>`)
- Optional Controller Grip: Expose retry/refresh operations per destination (`controllerGrip?: Grip<AsyncTapController>`)

2) AsyncCache (core)
- Interface: `get(k): {value:any, expiresAt:number}|undefined`, `set(k, v, ttlMs)`, `delete(k)`.
- Default impl: `LruTtlCache` with size/TTL limits; soft cleanup on writes.

3) Per‑Destination State (core)
- Hidden inside BaseAsyncTap; store in `WeakMap<GripContext, DestState>`.
- `DestState`: 
  - Request management: `abortController?: AbortController`, `key?: string`, `requestKey?: string | null`, `seq: number`
  - State tracking: `currentState: RequestState`, `listenerCount: number`, `retryAttempt: number`
  - Timers: `retryTimer?: any | null`, `refreshTimer?: any | null`, `deadlineTimer?: any`
  - History: `history: StateHistoryEntry[]`, `historySize: number`
  - Controller: `tapController?: AsyncTapController`

4) Promise Adapter (core)
- Utility: `createAsyncValueTap({ provides, destinationParamGrips, requestKeyOf, fetcher, stateGrip?, controllerGrip?, ...opts })`.
- Returns a concrete `Tap` (subclassing BaseAsyncTap) for simple value flows.
- Supports optional `stateGrip` and `controllerGrip` for state visibility and manual control.

5) Debounce Helper (core)
- Small utility: `createDebouncer(ms, schedule)` returning a function that coalesces calls per destination state.

6) Async Request State (core)
- **State Grip**: Optional `Grip<AsyncRequestState>` exposing per-destination request state:
  - Current state: `idle`, `loading`, `success`, `error`, `stale-while-revalidate`, `stale-with-error`
  - Request metadata: `requestKey`, `hasListeners`, `retryAt` (scheduled retry time)
  - History: Circular buffer of state transitions with timestamps and reasons
- **Controller Grip**: Optional `Grip<AsyncTapController>` exposing per-destination operations:
  - `retry(forceRefetch?)`: Manually trigger retry (increments retryAttempt)
  - `refresh(forceRefetch?)`: Manually trigger refresh (doesn't increment retryAttempt)
  - `reset()`: Clear state, history, and cancel all timers
  - `cancelRetry()`: Cancel scheduled retries
  - `abort()`: Abort in-flight request
- **State Helper Functions**: Utilities for UI code (`hasData`, `isLoading`, `hasError`, `isStale`, `hasScheduledRetry`, etc.)
- **Retry System**: Exponential backoff with configurable `maxRetries`, `initialDelayMs`, `backoffMultiplier`, `maxDelayMs`
- **TTL Refresh**: Automatic refresh scheduling before cache expiry (configurable via `refreshBeforeExpiryMs`)
- **Listener Tracking**: Only output Grip subscribers count; retries/refreshes only scheduled when listeners exist
- **Request Key Change Handling**: Automatic cancellation of old requests/timers when parameters change

---

### React Additions (optional, separate module)
- No Grip state usage. Provide only ergonomic wrappers if needed:
  - `useAbortOnUnmount(controller)` (tiny) – generally BaseAsyncTap should manage controllers.
  - Prefer keeping async logic in taps, not hooks.

---

### Lifecycle & Semantics
- Attach: prepare caches/state; no network yet.
- Connect(dest, grip): 
  - Publish initial (cached) values if ready; schedule request if params are present.
  - Track listeners (only output Grips count toward `hasListeners`).
  - Create controller if `controllerGrip` provided.
  - Publish initial state to `stateGrip` if provided.
- Param change (destination/home):
  - Debounce if configured; then compute key → check cache → else fetch.
  - If request key changes: cancel old timers/requests, preserve history, reset retry attempt counter.
  - Cancel prior fetch for that destination; start new one with fresh `AbortController`.
  - If `latestOnly`, stamp request with `seq` and discard outdated completions.
  - Update state transitions: `idle` → `loading` (no cache) or `success` → `stale-while-revalidate` (with cache).
- Request lifecycle:
  - On success: transition to `success`, schedule TTL refresh if configured and listeners exist.
  - On error: transition to `error` or `stale-with-error`, schedule retry if configured and listeners exist.
  - Retry execution: check listeners and request key still match before executing.
  - TTL refresh: automatic refresh before cache expiry (only when listeners exist).
- Disconnect(dest): 
  - Cancel retries/refreshes if listeners drop to zero.
  - Clear controller (make no-op) if `controllerGrip` provided.
  - Freeze state (don't reset to idle).
  - Cancel and dispose per‑dest timers.
- Detach: clear caches, cancel all inflight requests and timers.

---

### Error Handling
- For network errors/abort: do not publish stale values; optional hooks for diagnostics.
- Errors captured in state: `error` state (no cache) or `stale-with-error` state (with cache).
- Errors preserved in history; moved from current state to history on successful refresh.
- Retry system: exponential backoff with configurable limits; only retries when listeners exist.
- Retry cancellation: automatic when listeners drop to zero or request key changes.

---

### Test Plan (core)
- BaseAsyncTap unit tests with a fake async fetcher:
  - Debounce coalesces rapid param changes (single request)
  - Cancellation: previous request aborted when params change
  - Latest‑only: out‑of‑order completions don't publish
  - Cache hit publishes synchronously; TTL expiry re‑fetches
  - Proper cleanup on `onDisconnect`/`onDetach` (no memory leaks)
- State tracking tests:
  - State transitions follow specified rules (idle → loading → success/error)
  - Stale-while-revalidate: cached data shown during refresh
  - State published per destination independently
  - State persists across request key changes
- Retry system tests:
  - Exponential backoff calculation
  - Retry scheduling only when listeners exist
  - Retry cancellation (zero listeners, key change)
  - Max retries limit respected
  - Retry attempt counter increments on schedule
- TTL refresh tests:
  - Refresh scheduled before TTL expiry
  - Refresh only when listeners exist
  - Refresh cancellation (zero listeners, key change)
- Listener tracking tests:
  - Only output Grips count toward `hasListeners`
  - State/controller Grip subscribers don't count
  - Zero listeners cancels retries/refreshes
- History tracking tests:
  - History entries capture previous state
  - Circular buffer maintains correct size
  - History persists across key changes
- Controller tests:
  - Controller methods work correctly (retry, refresh, reset, cancelRetry)
  - Controller is no-op when zero listeners
  - Controller persists across key changes
- LruTtlCache tests: TTL, eviction, capacity, soft cleanup.

---

### Reference Usage (OpenMeteo scenario)
- Geocoding tap:
  - destination params: `[WEATHER_LOCATION]`
  - `requestKeyOf`: `location.toLowerCase()`
  - `fetcher`: fetch Open‑Meteo geocoding; return `{lat, lon, label}`
  - `provides`: `[GEO_LAT, GEO_LON, GEO_LABEL]`
  - debounce: 250ms; cache TTL: 30m
  - Optional: `stateGrip: GEO_STATE`, `controllerGrip: GEO_CONTROLLER` for UI state/control
- Weather tap:
  - destination params: `[GEO_LAT, GEO_LON]`
  - `requestKeyOf`: `"lat:lon"` rounded
  - `fetcher`: fetch current+hourly; choose nearest hour
  - `provides`: `[WEATHER_CURRENT, WEATHER_HOURLY]`
  - cache TTL: 5–10m; refresh before expiry: 1m
  - Optional: `stateGrip: WEATHER_STATE`, `controllerGrip: WEATHER_CONTROLLER` for UI state/control
  - Retry config: `maxRetries: 3`, `initialDelayMs: 1000`, `backoffMultiplier: 2`

---

### Migration/Adoption
- Implement BaseAsyncTap + helpers in core with tests.
- Add minimal docs; do not change existing taps.
- Build the demo OpenMeteo taps using the new primitives.



