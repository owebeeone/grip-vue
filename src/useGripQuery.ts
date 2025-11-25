import { computed, type Ref } from "vue";
import type { Grip, GripContext, GripContextLike, AsyncRequestState, AsyncTapController } from "@owebeeone/grip-core";
import { isLoading, hasError, getError, hasData, isRefreshing } from "@owebeeone/grip-core";
import { useGrip } from "./hooks";

export interface GripQueryState<TData = unknown, TError = unknown> {
  data: Ref<TData | undefined>;
  loading: Ref<boolean>;
  error: Ref<TError | undefined>;
  refetch: () => void;
  // Additional state information when using async state
  isRefreshing?: Ref<boolean>;
  isStale?: Ref<boolean>;
  state?: Ref<AsyncRequestState | undefined>;
}

export interface GripQueryOptions {
  ctx?: GripContext | GripContextLike;
  /**
   * Optional Grip that provides AsyncRequestState for async taps.
   * If provided, loading/error states will be derived from this state.
   */
  stateGrip?: Grip<AsyncRequestState>;
  /**
   * Optional Grip that provides AsyncTapController for manual operations.
   * If provided, refetch will use the controller's refresh method.
   */
  controllerGrip?: Grip<AsyncTapController>;
}

function isAsyncRequestState(value: any): value is AsyncRequestState {
  return (
    value &&
    typeof value === "object" &&
    "state" in value &&
    typeof value.state === "object" &&
    "type" in value.state
  );
}

// Legacy support: check for old state object format
function isLegacyStateObject(value: any): value is {
  data?: unknown;
  loading?: boolean;
  error?: unknown;
  refetch?: () => void;
} {
  return (
    value &&
    typeof value === "object" &&
    !isAsyncRequestState(value) &&
    ("data" in value || "loading" in value || "error" in value || "refetch" in value)
  );
}

export function useGripQuery<TData = unknown, TError = unknown>(
  grip: Grip<any>,
  options?: GripQueryOptions
): GripQueryState<TData, TError> {
  const dataGrip = useGrip<any>(grip, options?.ctx);
  const stateGrip = options?.stateGrip ? useGrip<AsyncRequestState>(options.stateGrip, options?.ctx) : null;
  const controllerGrip = options?.controllerGrip ? useGrip<AsyncTapController>(options.controllerGrip, options?.ctx) : null;

  // If using async state system, derive states from AsyncRequestState
  if (stateGrip) {
    const data = computed(() => {
      const value = dataGrip.value;
      // Data is in the data Grip, state is separate
      return value as TData | undefined;
    });

    const loading = computed(() => {
      const state = stateGrip.value;
      if (!state) return false;
      return isLoading(state.state);
    });

    const error = computed(() => {
      const state = stateGrip.value;
      if (!state) return undefined;
      const err = getError(state.state);
      return (err as TError | undefined) ?? undefined;
    });

    const isRefreshingState = computed(() => {
      const state = stateGrip.value;
      if (!state) return false;
      return isRefreshing(state.state);
    });

    const isStaleState = computed(() => {
      const state = stateGrip.value;
      if (!state) return false;
      return state.state.type === "stale-while-revalidate" || state.state.type === "stale-with-error";
    });

    const refetch = () => {
      const controller = controllerGrip?.value;
      if (controller && typeof controller.refresh === "function") {
        controller.refresh(true); // Force refetch
      }
    };

    return {
      data,
      loading,
      error,
      refetch,
      isRefreshing: isRefreshingState,
      isStale: isStaleState,
      state: stateGrip,
    };
  }

  // Legacy mode: backward compatibility with old state object format
  const data = computed(() => {
    const value = dataGrip.value;
    if (isLegacyStateObject(value)) {
      return value.data as TData | undefined;
    }
    return value as TData | undefined;
  });

  const loading = computed(() => {
    const value = dataGrip.value;
    if (isLegacyStateObject(value)) {
      return Boolean(value.loading);
    }
    return value === undefined;
  });

  const error = computed(() => {
    const value = dataGrip.value;
    if (isLegacyStateObject(value)) {
      return value.error as TError | undefined;
    }
    return undefined;
  });

  const refetch = () => {
    const value = dataGrip.value;
    if (isLegacyStateObject(value) && typeof value.refetch === "function") {
      value.refetch();
    } else if (controllerGrip?.value && typeof controllerGrip.value.refresh === "function") {
      controllerGrip.value.refresh(true);
    }
  };

  return { data, loading, error, refetch };
}
