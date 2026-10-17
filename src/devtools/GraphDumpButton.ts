import { defineComponent, h, ref, type PropType } from "vue";
import type { Grok, GraphDumpKeyRegistry } from "@owebeeone/grip-core";
import { GraphDumpDialog } from "./GraphDumpDialog";

export const GraphDumpButton = defineComponent({
  name: "GraphDumpButton",
  inheritAttrs: false,
  props: {
    grok: { type: Object as PropType<Grok>, required: true },
    keys: Object as PropType<GraphDumpKeyRegistry>,
    label: { type: String, default: "Graph Dump" },
  },
  setup(props, { attrs }) {
    const open = ref(false);
    return () =>
      h("span", [
        h(
          "button",
          {
            ...attrs,
            type: "button",
            onClick: () => {
              open.value = true;
            },
          },
          props.label,
        ),
        h(GraphDumpDialog, {
          grok: props.grok,
          keys: props.keys,
          open: open.value,
          onClose: () => {
            open.value = false;
          },
        }),
      ]);
  },
});
