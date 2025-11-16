import { defineComponent, h, watch, type PropType } from "vue";
import {
  Grip,
  createAtomValueTap,
  type GripContext,
  type GripContextLike,
  type AtomTap,
  type Tap
} from "@owebeeone/grip-core";
import { useGripRuntimeInternal } from "./provider";
import { useTap } from "./hooks";

export type GripParamEntry = readonly [Grip<any>, any];
export type GripParamBinding = {
  grip: Grip<any>;
  value: any;
  handleGrip?: Grip<any>;
};

type NormalizedBinding = {
  grip: Grip<any>;
  value: any;
  handleGrip?: Grip<any>;
};

export const PARAMS_GRIP = new Grip<Map<Grip<any>, any>>({
  name: "grip-vue:params"
});

export const GripParams = defineComponent({
  name: "GripParams",
  props: {
    params: {
      type: Array as PropType<readonly GripParamEntry[]>,
      default: undefined
    },
    bindings: {
      type: Array as PropType<readonly GripParamBinding[]>,
      default: undefined
    },
    ctx: {
      type: Object as PropType<GripContext | GripContextLike>,
      default: undefined
    }
  },
  setup(props, { slots }) {
    const { context: runtimeCtx } = useGripRuntimeInternal();
    const targetCtx = props.ctx ?? runtimeCtx;
    const tapHandles = new Map<Grip<any>, AtomTap<any> & Tap>();

    const initial = normalizeBindings(props.params, props.bindings);
    for (const binding of initial) {
      registerBinding(binding, tapHandles, targetCtx);
    }

    watch(
      () => [props.params, props.bindings],
      () => {
        const next = normalizeBindings(props.params, props.bindings);
        for (const binding of next) {
          const handle = tapHandles.get(binding.grip);
          if (handle) {
            handle.set(binding.value);
          }
        }
      },
      { deep: true }
    );

    return () => (slots.default ? slots.default() : h("span"));
  }
});

function normalizeBindings(
  entries?: readonly GripParamEntry[],
  bindings?: readonly GripParamBinding[]
): NormalizedBinding[] {
  const result: NormalizedBinding[] = [];

  if (entries) {
    for (const [grip, value] of entries) {
      result.push({ grip, value });
    }
  }

  if (bindings) {
    for (const binding of bindings) {
      result.push(binding);
    }
  }

  return result;
}

function registerBinding(
  binding: NormalizedBinding,
  tapHandles: Map<Grip<any>, AtomTap<any> & Tap>,
  ctx: GripContext | GripContextLike
) {
  if (tapHandles.has(binding.grip)) {
    tapHandles.get(binding.grip)!.set(binding.value);
    return;
  }

  const tap = createAtomValueTap(binding.grip, {
    initial: binding.value,
    handleGrip: binding.handleGrip
  }) as AtomTap<any> & Tap;

  tapHandles.set(binding.grip, tap);
  useTap(() => tap, { ctx });
}
