import { provideGripRuntime, useGripRuntimeInternal } from "./provider";
import type { GripContext } from "@owebeeone/grip-core";

/**
 * Create a child GripContext derived from the current one and provide
 * it for this component subtree.
 */
export function useChildContext(create: (parent: GripContext) => GripContext): GripContext {
  const { grok, context: parentCtx } = useGripRuntimeInternal();
  const baseCtx = parentCtx.getGripConsumerContext();
  const childCtx = create(baseCtx);

  provideGripRuntime({ grok, context: childCtx });

  return childCtx;
}
