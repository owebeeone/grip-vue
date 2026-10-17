import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { markRaw, nextTick } from "vue";
import { Grok, GripRegistry, GripOf, createAtomValueTap } from "@owebeeone/grip-core";
import { GraphDumpButton, GraphDumpDialog, GripGraphVisualizer } from "../src";

let view: VueWrapper | undefined;
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
      this.querySelector<HTMLElement>("[autofocus]")?.focus();
    },
  });
});
afterEach(() => {
  view?.unmount();
  view = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function fixture() {
  const registry = new GripRegistry();
  const value = GripOf(registry)<number>("InspectorValue");
  const grok = markRaw(new Grok(registry));
  const tap = createAtomValueTap(value, { initial: 17 });
  grok.registerTap(tap);
  const drip = grok.query(value, grok.mainContext);
  grok.flush();
  return { grok, tap, drip };
}
const button = (label: string) =>
  Array.from(document.querySelectorAll("button")).find((el) => el.textContent === label)!;
it("refreshes live graph values, accepts a replacement runtime, and cleans up its timer", async () => {
  vi.useFakeTimers();
  const f = fixture();
  const baseline = vi.getTimerCount();
  view = mount(GripGraphVisualizer, {
    props: { grok: f.grok, refreshMs: 100 },
    attachTo: document.body,
  });
  f.tap.set(28);
  f.grok.flush();
  await vi.advanceTimersByTimeAsync(100);
  expect(view.text()).toContain("28");
  await view.setProps({ pause: true, fitToPane: false });
  expect(vi.getTimerCount()).toBe(baseline);
  expect(view.get("svg").attributes("width")).not.toBe("100%");
  f.tap.set(39);
  f.grok.flush();
  await vi.advanceTimersByTimeAsync(200);
  expect(view.text()).not.toContain("39");
  await view.setProps({ refreshTrigger: 1 });
  expect(view.text()).toContain("39");
  const replacement = fixture();
  const runtimeTimers = vi.getTimerCount();
  await view.setProps({ grok: replacement.grok, pause: false });
  expect(view.text()).toContain("17");
  view.unmount();
  view = undefined;
  expect(vi.getTimerCount()).toBe(runtimeTimers);
});
it("opens a snapshot, changes value options, copies and downloads matching JSON, and returns focus", async () => {
  vi.useFakeTimers();
  const f = fixture();
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  const blobs: Blob[] = [];
  const revoke = vi.fn();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL(blob: Blob) {
        blobs.push(blob);
        return "blob:graph";
      }
      static revokeObjectURL = revoke;
    },
  );
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  view = mount(GraphDumpButton, { props: { grok: f.grok }, attachTo: document.body });
  const opener = view.get("button");
  opener.element.focus();
  await opener.trigger("click");
  await nextTick();
  const dialog = document.querySelector("dialog")!;
  expect(dialog.open).toBe(true);
  expect(document.activeElement).toBe(button("Dismiss"));
  const snapshot = () => JSON.parse(dialog.querySelector("pre")!.textContent!);
  expect(snapshot().nodes.drips.some((d: { value: unknown }) => d.value === 17)).toBe(true);
  const values = dialog.querySelector<HTMLInputElement>("input")!;
  values.checked = false;
  values.dispatchEvent(new Event("change"));
  await nextTick();
  expect(snapshot().nodes.drips.every((d: object) => !("value" in d))).toBe(true);
  values.checked = true;
  values.dispatchEvent(new Event("change"));
  await nextTick();
  f.tap.set(51);
  f.grok.flush();
  button("Refresh snapshot").click();
  await nextTick();
  expect(snapshot().nodes.drips.some((d: { value: unknown }) => d.value === 51)).toBe(true);
  button("Copy").click();
  await nextTick();
  expect(writeText).toHaveBeenCalledWith(dialog.querySelector("pre")!.textContent);
  button("Download JSON").click();
  expect(click).toHaveBeenCalledOnce();
  expect(blobs[0].type).toBe("application/json");
  await vi.advanceTimersByTimeAsync(1000);
  expect(revoke).toHaveBeenCalledWith("blob:graph");
  dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
  await nextTick();
  await nextTick();
  expect(document.querySelector("dialog")).toBeNull();
  expect(document.activeElement).toBe(opener.element);
});
it("reports clipboard denial and allows a directly controlled dialog to close", async () => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
  });
  view = mount(GraphDumpDialog, {
    props: { grok: fixture().grok, open: true },
    attachTo: document.body,
  });
  await nextTick();
  button("Copy").click();
  await nextTick();
  await nextTick();
  expect(document.querySelector('[role="status"]')!.textContent).toContain("Copy unavailable");
  button("Dismiss").click();
  expect(view.emitted("close")).toHaveLength(1);
  await view.setProps({ open: false });
  expect(document.querySelector("dialog")).toBeNull();
});
