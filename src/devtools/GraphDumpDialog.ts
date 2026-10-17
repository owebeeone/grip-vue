import {
  computed,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  ref,
  Teleport,
  watch,
  type PropType,
} from "vue";
import {
  GripGraphDumper,
  type GraphDump,
  type GraphDumpKeyRegistry,
  type Grok,
} from "@owebeeone/grip-core";

export const GraphDumpDialog = defineComponent({
  name: "GraphDumpDialog",
  props: {
    open: { type: Boolean, required: true },
    grok: { type: Object as PropType<Grok>, required: true },
    keys: Object as PropType<GraphDumpKeyRegistry>,
  },
  emits: ["close"],
  setup(props, { emit }) {
    const dialog = ref<HTMLDialogElement>();
    const includeValues = ref(true);
    const includeTapValues = ref(false);
    const dump = ref<GraphDump>();
    const feedback = ref("");
    const json = computed(() => JSON.stringify(dump.value, null, 2) ?? "");
    let previousFocus: HTMLElement | null = null;
    const downloads = new Map<string, ReturnType<typeof setTimeout>>();
    function refresh() {
      if (props.open) {
        dump.value = new GripGraphDumper({
          grok: props.grok,
          keys: props.keys,
          opts: { includeValues: includeValues.value, includeTapValues: includeTapValues.value },
        }).dump();
        feedback.value = "";
      }
    }
    function restoreFocus() {
      previousFocus?.focus();
      previousFocus = null;
    }
    watch(
      () => props.open,
      async (open) => {
        if (open) {
          previousFocus =
            typeof document === "undefined" ? null : (document.activeElement as HTMLElement);
          refresh();
          await nextTick();
          if (props.open && dialog.value && !dialog.value.open) {
            dialog.value.showModal();
          }
        } else {
          await nextTick();
          restoreFocus();
        }
      },
      { immediate: true },
    );
    watch([() => props.grok, () => props.keys, includeValues, includeTapValues], refresh);
    onBeforeUnmount(() => {
      restoreFocus();
      for (const [url, timer] of downloads) {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
      }
    });
    async function copy() {
      try {
        await navigator.clipboard.writeText(json.value);
        feedback.value = "Copied!";
      } catch {
        feedback.value = "Copy unavailable. Select the JSON or download it instead.";
      }
    }
    function download() {
      const url = URL.createObjectURL(new Blob([json.value], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "grip-graph.json";
      link.click();
      downloads.set(
        url,
        setTimeout(() => {
          URL.revokeObjectURL(url);
          downloads.delete(url);
        }, 1000),
      );
    }
    const close = () => emit("close");
    return () =>
      props.open
        ? h(Teleport, { to: "body" }, [
            h(
              "dialog",
              {
                ref: dialog,
                "aria-label": "Grip Graph Dump",
                style: {
                  boxSizing: "border-box",
                  width: "min(900px, 90vw)",
                  maxHeight: "85vh",
                  background: "white",
                  color: "#203148",
                  border: "1px solid #aebed5",
                  borderRadius: "8px",
                  padding: "16px",
                  fontFamily: "system-ui, sans-serif",
                },
                onCancel: (event: Event) => {
                  event.preventDefault();
                  close();
                },
                onClose: close,
              },
              [
                h(
                  "header",
                  {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                    },
                  },
                  [
                    h("strong", "Grip Graph Dump"),
                    h("button", { type: "button", autofocus: true, onClick: close }, "Dismiss"),
                  ],
                ),
                h(
                  "div",
                  { style: { display: "flex", flexWrap: "wrap", gap: "12px", margin: "12px 0" } },
                  [
                    h("label", [
                      h("input", {
                        type: "checkbox",
                        checked: includeValues.value,
                        onChange: (event: Event) => {
                          includeValues.value = (event.target as HTMLInputElement).checked;
                        },
                      }),
                      " Include drip values",
                    ]),
                    h("label", [
                      h("input", {
                        type: "checkbox",
                        checked: includeTapValues.value,
                        onChange: (event: Event) => {
                          includeTapValues.value = (event.target as HTMLInputElement).checked;
                        },
                      }),
                      " Include tap destination values",
                    ]),
                    h("button", { type: "button", onClick: refresh }, "Refresh snapshot"),
                  ],
                ),
                h(
                  "pre",
                  {
                    style: {
                      maxHeight: "55vh",
                      overflow: "auto",
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      background: "#f5f7fa",
                      padding: "12px",
                    },
                  },
                  json.value,
                ),
                h("footer", { style: { display: "flex", gap: "12px", alignItems: "center" } }, [
                  h("button", { type: "button", onClick: copy }, "Copy"),
                  h("button", { type: "button", onClick: download }, "Download JSON"),
                  h("span", { role: "status" }, feedback.value),
                ]),
              ],
            ),
          ])
        : null;
  },
});
