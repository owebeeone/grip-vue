import { computed, watch, type Ref } from "vue";
import type { Grip, GripContext, GripContextLike } from "@owebeeone/grip-core";
import { useGrip } from "./hooks";

export interface GripQueryState<TData = unknown, TError = unknown> {
  data: Ref<TData | undefined>;
  loading: Ref<boolean>;
  error: Ref<TError | undefined>;
  refetch: () => void;
}

export interface GripQueryOptions {
  ctx?: GripContext | GripContextLike;
}

function isStateObject(value: any): value is {
  data?: unknown;
  loading?: boolean;
  error?: unknown;
  refetch?: () => void;
} {
  return value && typeof value === "object" && ("data" in value || "loading" in value || "error" in value || "refetch" in value);
}

export function useGripQuery<TData = unknown, TError = unknown>(
  grip: Grip<any>,
  options?: GripQueryOptions
): GripQueryState<TData, TError> {
  const raw = useGrip<any>(grip, options?.ctx);

  watch(
    raw,
    (value) => {
      console.log("[useGripQuery] value update:", grip.key, value);
    },
    { immediate: true }
  );

  const data = computed(() => {
    const value = raw.value;
    if (isStateObject(value)) {
      return value.data as TData | undefined;
    }
    return value as TData | undefined;
  });

  const loading = computed(() => {
    const value = raw.value;
    if (isStateObject(value)) {
      return Boolean(value.loading);
    }
    return value === undefined;
  });

  const error = computed(() => {
    const value = raw.value;
    if (isStateObject(value)) {
      return value.error as TError | undefined;
    }
    return undefined;
  });

  const refetch = () => {
    const value = raw.value;
    if (isStateObject(value) && typeof value.refetch === "function") {
      value.refetch();
    }
  };

  return { data, loading, error, refetch };
}
