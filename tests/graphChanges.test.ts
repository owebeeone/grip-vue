import { afterEach, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { markRaw } from "vue";
import { Grok, GripRegistry, GripOf, createAtomValueTap } from "@owebeeone/grip-core";
import { GripGraphVisualizer } from "../src";
const originalAnimate = HTMLElement.prototype.animate;
let view: VueWrapper | undefined;
afterEach(() => {
  view?.unmount();
  view = undefined;
  if (originalAnimate) {
    HTMLElement.prototype.animate = originalAnimate;
  } else {
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
  }
  vi.unstubAllGlobals();
});
function fixture() {
  const registry = new GripRegistry();
  const value = GripOf(registry)<number>("Graph.Change");
  const grok = markRaw(new Grok(registry));
  const tap = createAtomValueTap(value, { initial: 1 });
  grok.registerTap(tap);
  const drip = grok.query(value, grok.mainPresentationContext);
  const stop = drip.subscribe(() => {});
  grok.flush();
  return { grok, tap, stop };
}
it.each([false, true])("highlights only changed values, preserving rows and honoring reduced motion=%s", async reduced => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: reduced })));
  const cancels: ReturnType<typeof vi.fn>[] = [];
  const animate = vi.fn(function (this: HTMLElement) {
    const cancel = vi.fn();
    cancels.push(cancel);
    return { cancel } as unknown as Animation;
  });
  HTMLElement.prototype.animate = animate;
  const f = fixture();
  view = mount(GripGraphVisualizer, { props: { grok: f.grok, pause: true } });
  const row = view.get("output").element.parentElement;
  expect(animate).not.toHaveBeenCalled();
  f.tap.set(2);
  f.grok.flush();
  await view.setProps({ refreshTrigger: 1 });
  expect(view.get("output").element.parentElement).toBe(row);
  expect(view.get("output").text()).toBe("2");
  expect(animate).toHaveBeenCalledTimes(1);
  const active = { backgroundColor: "#0759c7", color: "#ffffff", boxShadow: "0 0 0 2px #003b8e, 0 0 0 4px #ffcf33" };
  const clear = { backgroundColor: "transparent", color: "#213547", boxShadow: "0 0 0 2px transparent, 0 0 0 4px transparent" };
  expect(animate).toHaveBeenLastCalledWith([
    { ...active, offset: 0, easing: "steps(1, end)" }, { ...active, ...(reduced ? {} : { backgroundColor: "#dbeafe", color: "#213547" }), offset: 0.3 }, { ...(reduced ? active : clear), offset: 1 },
  ], { duration: 1500, easing: "linear" });
  await view.setProps({ refreshTrigger: 2 });
  expect(animate).toHaveBeenCalledTimes(1);
  expect(cancels[0]).not.toHaveBeenCalled();
  f.tap.set(3);
  f.grok.flush();
  await view.setProps({ refreshTrigger: 3 });
  expect(animate).toHaveBeenCalledTimes(2);
  expect(cancels[0]).toHaveBeenCalledOnce();
  const replacement = fixture();
  await view.setProps({ grok: replacement.grok });
  expect(animate).toHaveBeenCalledTimes(2);
  expect(cancels[1]).toHaveBeenCalledOnce();
  replacement.tap.set(4);
  replacement.grok.flush();
  await view.setProps({ refreshTrigger: 4 });
  expect(animate).toHaveBeenCalledTimes(3);
  view.unmount();
  expect(cancels[2]).toHaveBeenCalledOnce();
  view = undefined;
  f.stop();
  replacement.stop();
});
