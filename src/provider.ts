import { inject, provide, App } from "vue";
import type { Grok, GripContext, GripContextLike } from "@owebeeone/grip-core";

export interface GripRuntime {
  grok: Grok;
  context: GripContextLike;
}

const GripRuntimeSymbol = Symbol("GripRuntime");

export interface GripPluginOptions {
  grok: Grok;
  context?: GripContext | GripContextLike;
}

/**
 * Vue plugin to install a GRIP runtime at the app root.
 */
export const createGripPlugin = (options: GripPluginOptions) => {
  return {
    install(app: App) {
      const rootCtx = options.context ?? options.grok.mainContext;
      const runtime: GripRuntime = {
        grok: options.grok,
        context: rootCtx,
      };
      app.provide(GripRuntimeSymbol, runtime);
    },
  };
};

/**
 * Low-level helper if you want to set up runtime inside a subtree component
 * rather than at app root.
 */
export function provideGripRuntime(runtime: GripRuntime) {
  provide(GripRuntimeSymbol, runtime);
}

/**
 * Internal: retrieve current runtime (throws if missing).
 */
export function useGripRuntimeInternal(): GripRuntime {
  const runtime = inject<GripRuntime | null>(GripRuntimeSymbol, null);
  if (!runtime) {
    throw new Error(
      "[grip-vue] No Grip runtime found. Did you call app.use(createGripPlugin(...)) " +
        "or provideGripRuntime() in this component tree?",
    );
  }
  return runtime;
}
