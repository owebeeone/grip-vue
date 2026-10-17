import { expect, it } from "vitest";
import type { GraphDump } from "@owebeeone/grip-core";
import { layoutGraph } from "../src/devtools/graphLayout";
it("lays siblings side by side and terminates even if an inspected context graph contains a cycle", () => {
  const context = (key: string, parents: string[]) => ({
    key,
    type: "Context" as const,
    parents: parents.map((ctx) => ({ ctx, priority: 0 })),
    children: [],
    taps: [],
    consumerDrips: [],
  });
  const dump = {
    nodes: {
      contexts: [context("root", []), context("left", ["root"]), context("right", ["root"])],
      taps: [],
      drips: [],
    },
  } as unknown as GraphDump;
  const { cards } = layoutGraph(dump);
  expect(cards[1].y).toBe(cards[2].y);
  expect(cards[1].x).not.toBe(cards[2].x);
  expect(cards[1].y).toBeGreaterThan(cards[0].y);
  dump.nodes.contexts[0].parents = [{ ctx: "left", priority: 0 }];
  expect(Number.isFinite(layoutGraph(dump).height)).toBe(true);
});
