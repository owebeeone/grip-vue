import { defineComponent, h, onUnmounted, ref, watch, type PropType } from "vue";

/** Copy-only display values keep the inspector from owning live graph handles. */
export const GraphValueRow = defineComponent({
  name: "GraphValueRow",
  props: {
    value: { type: String, required: true },
    baseline: { type: Object as PropType<object>, required: true },
  },
  setup(props, { slots }) {
    const element = ref<HTMLElement>();
    let animation: Animation | undefined;
    watch([() => props.value, () => props.baseline], ([value, baseline], [previous, previousBaseline]) => {
      animation?.cancel();
      animation = undefined;
      if (baseline !== previousBaseline || value === previous || !element.value?.animate) {
        return;
      }
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const active = { backgroundColor: "#0759c7", color: "#ffffff", boxShadow: "0 0 0 2px #003b8e, 0 0 0 4px #ffcf33" };
      const clear = { backgroundColor: "transparent", color: "#213547", boxShadow: "0 0 0 2px transparent, 0 0 0 4px transparent" };
      animation = element.value.animate([
        { ...active, offset: 0, easing: "steps(1, end)" },
        { ...active, ...(reduced ? {} : { backgroundColor: "#dbeafe", color: "#213547" }), offset: 0.3 },
        { ...(reduced ? active : clear), offset: 1 },
      ], { duration: 1500, easing: "linear" });
    }, { flush: "post" });
    onUnmounted(() => { animation?.cancel(); });
    return () => h("div", { ref: element }, slots.default?.());
  },
});
