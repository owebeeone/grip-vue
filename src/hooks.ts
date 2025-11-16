import { onMounted, onUnmounted, shallowRef, Ref } from "vue";

import type { Grip, GripContext, GripContextLike, Tap, Grok } from "@owebeeone/grip-core";
import { useGripRuntimeInternal } from "./provider";

export function useGripRuntime(): { grok: Grok; context: GripContextLike } {
  return useGripRuntimeInternal();
}

function resolveContext(
  ctx: GripContext | GripContextLike | undefined,
  providerCtx: GripContextLike,
): GripContext {
  const candidate = ctx ?? providerCtx;
  if ((candidate as GripContextLike).getGripConsumerContext) {
    return (candidate as GripContextLike).getGripConsumerContext();
  }
  return candidate as GripContext;
}

/**
 * Vue equivalent of React's useGrip(grip, ctx?).
 * Returns a Ref<T | undefined> whose value updates reactively.
 */
export function useGrip<T>(grip: Grip<T>, ctx?: GripContext | GripContextLike): Ref<T | undefined> {
  const { grok, context: providerCtx } = useGripRuntimeInternal();
  const activeCtx = resolveContext(ctx, providerCtx);

  const valueRef = shallowRef<T | undefined>(undefined);
  let unsubscribe: (() => void) | null = null;

  onMounted(() => {
    const drip = grok.query(grip, activeCtx);
    valueRef.value = drip.get();
    unsubscribe = drip.subscribe((v: T | undefined) => {
      valueRef.value = v;
    });
  });

  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  });

  return valueRef;
}

/**
 * Vue equivalent of useTap(factory, { ctx }).
 */
export function useTap(factory: () => Tap, opts?: { ctx?: GripContext | GripContextLike }) {
  const { context: providerCtx } = useGripRuntimeInternal();
  const ctxLike = (opts?.ctx ?? providerCtx) as GripContextLike;

  let tap: Tap | null = null;

  onMounted(() => {
    tap = factory();
    const home = ctxLike.getGripHomeContext();
    home.registerTap(tap);
  });

  onUnmounted(() => {
    if (!tap) return;
    const home = ctxLike.getGripHomeContext();
    home.unregisterTap(tap);
    tap = null;
  });
}
