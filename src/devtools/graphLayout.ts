import type { GraphDump } from "@owebeeone/grip-core";

/** Context hierarchy is laid out by depth, with a bounded cycle-safe traversal. */
export function layoutGraph(dump: GraphDump, showReapedContexts = false) {
  const contexts = dump.nodes.contexts.filter(
    (context) => showReapedContexts || context.gcStatus !== "collected",
  );
  const byId = new Map(contexts.map((context) => [context.key, context]));
  const depths = new Map<string, number>();
  function depth(id: string, visiting = new Set<string>()): number {
    const known = depths.get(id);
    if (known !== undefined) {
      return known;
    }
    if (visiting.has(id)) {
      return 0;
    }
    const path = new Set(visiting).add(id);
    const parents = (byId.get(id)?.parents ?? []).filter((parent) => byId.has(parent.ctx));
    const result = parents.length
      ? 1 + Math.max(...parents.map((parent) => depth(parent.ctx, path)))
      : 0;
    depths.set(id, result);
    return result;
  }
  const rows = new Map<number, number>();
  const cards = contexts.map((context) => {
    const layer = depth(context.key);
    const column = rows.get(layer) ?? 0;
    rows.set(layer, column + 1);
    return { ...context, x: 24 + column * 330, y: 24 + layer * 300 };
  });
  const positions = new Map(cards.map((card) => [card.key, card]));
  const edges = cards.flatMap((card) =>
    (card.parents ?? []).flatMap((parent) => {
      const from = positions.get(parent.ctx);
      return from
        ? [
            {
              id: `${from.key}-${card.key}`,
              kind: "parent",
              x1: from.x + 150,
              y1: from.y + 250,
              x2: card.x + 150,
              y2: card.y,
            },
          ]
        : [];
    }),
  );
  const providerEdges = new Map<string, (typeof edges)[number]>();
  for (const drip of dump.nodes.drips) {
    const tap = dump.nodes.taps.find((tap) => tap.key === drip.providerTap);
    const from = tap ? positions.get(tap.publisherContext) : undefined;
    const to = positions.get(drip.destContext);
    if (from && to && from.key !== to.key) {
      const id = `provider-${from.key}-${to.key}`;
      providerEdges.set(id, {
        id,
        kind: "provider",
        x1: from.x + 280,
        y1: from.y + 225,
        x2: to.x + 280,
        y2: to.y + 25,
      });
    }
  }
  return {
    cards,
    edges: [...edges, ...providerEdges.values()],
    width: Math.max(360, ...cards.map((card) => card.x + 324)),
    height: Math.max(300, ...cards.map((card) => card.y + 274)),
  };
}
