import {
  computed,
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  shallowRef,
  watch,
  type PropType,
} from "vue";
import { GripGraphDumper, type GraphDumpKeyRegistry, type Grok } from "@owebeeone/grip-core";
import { GraphValueRow } from "./GraphValueRow";
import { layoutGraph } from "./graphLayout";

/** Standalone inspector: pass the runtime explicitly; no plugin or stylesheet required. */
export const GripGraphVisualizer = defineComponent({
  name: "GripGraphVisualizer",
  props: {
    grok: { type: Object as PropType<Grok>, required: true },
    keys: Object as PropType<GraphDumpKeyRegistry>,
    refreshMs: { type: Number, default: 700 },
    refreshTrigger: { type: Number, default: 0 },
    fitToPane: { type: Boolean, default: true },
    pause: { type: Boolean, default: false },
    showReapedContexts: { type: Boolean, default: false },
  },
  setup(props) {
    const dumper = computed(
      () =>
        new GripGraphDumper({
          grok: props.grok,
          keys: props.keys,
          opts: { includeValues: true, maxValueLength: 100 },
        }),
    );
    const dump = shallowRef(dumper.value.dump());
    const layout = computed(() => layoutGraph(dump.value, props.showReapedContexts));
    let timer: ReturnType<typeof setInterval> | undefined;
    function refresh() {
      dump.value = dumper.value.dump();
    }
    function schedule() {
      clearInterval(timer);
      if (!props.pause && Number.isFinite(props.refreshMs) && props.refreshMs > 0) {
        timer = setInterval(refresh, props.refreshMs);
      }
    }
    onMounted(() => {
      refresh();
      schedule();
    });
    onUnmounted(() => clearInterval(timer));
    watch([() => props.pause, () => props.refreshMs], schedule);
    watch([dumper, () => props.refreshTrigger], refresh);
    function preview(value: unknown) {
      return typeof value === "string" ? value : (JSON.stringify(value) ?? "undefined");
    }
    return () =>
      h(
        "div",
        {
          class: ["graph-viewport", { "fit-graph": props.fitToPane }],
          style: { overflow: props.fitToPane ? "hidden" : "auto", flex: "1", minHeight: "0" },
        },
        [
          h(
            "svg",
            {
              role: "img",
              "aria-label": "Live GRIP context graph",
              viewBox: `0 0 ${layout.value.width} ${layout.value.height}`,
              width: props.fitToPane ? "100%" : layout.value.width,
              height: props.fitToPane ? "100%" : layout.value.height,
            },
            [
              h("title", "Contexts, providers and live consumer values"),
              ...layout.value.edges.map((edge) =>
                h("path", {
                  key: edge.id,
                  d: `M ${edge.x1} ${edge.y1} V ${(edge.y1 + edge.y2) / 2} H ${edge.x2} V ${edge.y2}`,
                  fill: "none",
                  stroke: edge.kind === "provider" ? "#9068b4" : "#8495b2",
                  "stroke-dasharray": edge.kind === "provider" ? "5 4" : undefined,
                  "stroke-width": 2,
                }),
              ),
              ...layout.value.cards.map((card) =>
                h(
                  "foreignObject",
                  { key: card.key, x: card.x, y: card.y, width: 300, height: 250 },
                  [
                    h(
                      "div",
                      {
                        xmlns: "http://www.w3.org/1999/xhtml",
                        class: "graph-card",
                        style: {
                          boxSizing: "border-box",
                          height: "250px",
                          padding: "14px",
                          background: "white",
                          border: "1px solid #aebed5",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontFamily: "system-ui, sans-serif",
                          color: "#203148",
                          display: "flex",
                          flexDirection: "column",
                        },
                      },
                      [
                        h("strong", card.label || card.key),
                        h(
                          "small",
                          { style: { color: "#6e7e95" } },
                          `${card.gcStatus ?? ""} · ${card.key}`,
                        ),
                        h("div", { style: { overflow: "auto", marginTop: "8px" } }, [
                          ...dump.value.nodes.taps
                            .filter((tap) => tap.publisherContext === card.key)
                            .map((tap) =>
                              h(
                                "div",
                                {
                                  key: tap.key,
                                  style: {
                                    fontSize: "10px",
                                    borderBottom: "1px solid #e4e9f1",
                                    padding: "5px 0",
                                    overflowWrap: "anywhere",
                                    color: "#655197",
                                  },
                                },
                                [h("b", tap.class), ` → ${tap.providesGrips.join(", ")}`],
                              ),
                            ),
                          ...dump.value.nodes.drips
                            .filter((drip) => drip.destContext === card.key)
                            .map((drip) =>
                              h(
                                GraphValueRow,
                                {
                                  key: drip.key,
                                  value: preview(drip.valuePreview ?? drip.value),
                                  baseline: dumper.value,
                                  style: {
                                    color: "#213547",
                                    display: "flex",
                                    flexWrap: "wrap",
                                    justifyContent: "space-between",
                                    gap: "5px",
                                    paddingTop: "7px",
                                    overflowWrap: "anywhere",
                                  },
                                },
                                { default: () => [
                                  h("span", { style: { color: "inherit" } }, drip.grip),
                                  h("output", preview(drip.valuePreview ?? drip.value)),
                                ] },
                              ),
                            ),
                        ]),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      );
  },
});
