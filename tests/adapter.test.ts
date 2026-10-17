import { afterEach, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { defineComponent, h, markRaw, nextTick, ref } from 'vue';
import {
  Grok,
  Grip,
  GripOf,
  GripRegistry,
  createAtomValueTap,
  type AtomTapHandle,
  type MatchingContext,
} from '@owebeeone/grip-core';
import { createGripPlugin, GripInput, GripScope, GripTextarea, useGrip, useTap } from '../src';

const mounted: VueWrapper[] = [];
afterEach(() => {
  for (const view of mounted.splice(0)) {
    view.unmount();
  }
});
function fixture<T>(initial: T) {
  const registry = new GripRegistry();
  const defineGrip = GripOf(registry);
  const value = markRaw(defineGrip<T>('Value'));
  const handle = markRaw(defineGrip<AtomTapHandle<T>>('Handle'));
  const grok = new Grok(registry);
  const tap = createAtomValueTap(value, { initial, handleGrip: handle });
  grok.registerTap(tap);
  return { value, handle, grok, tap, plugin: createGripPlugin({ grok }) };
}
async function settle(grok: Grok) {
  grok.flush();
  await nextTick();
}

it('retains edits on parent renders, isolates siblings, and changes context only with the scope key', async () => {
  const f = fixture('root');
  const key = ref('left');
  const seed = ref('first');
  const init = vi.fn((context: MatchingContext) =>
    context
      .getGripHomeContext()
      .registerTap(createAtomValueTap(f.value, { initial: seed.value, handleGrip: f.handle })),
  );
  const Editor = defineComponent({
    setup: () => () => h(GripInput, { grip: f.value, tapGrip: f.handle }),
  });
  const view = mount(
    defineComponent({
      setup: () => () =>
        h('div', [
          h(GripScope, { scopeKey: key.value, init }, () => h(Editor)),
          h(GripScope, { scopeKey: 'right', init }, () => h(Editor)),
          h('span', seed.value),
        ]),
    }),
    { global: { plugins: [f.plugin] } },
  );
  mounted.push(view);
  await settle(f.grok);
  await view.findAll('input')[0].setValue('edited');
  await settle(f.grok);
  seed.value = 'next seed';
  await nextTick();
  expect(view.findAll('input').map((input) => input.element.value)).toEqual(['edited', 'first']);
  expect(init).toHaveBeenCalledTimes(2);
  key.value = 'replacement';
  await settle(f.grok);
  await nextTick();
  expect(view.findAll('input').map((input) => input.element.value)).toEqual(['next seed', 'first']);
  expect(init).toHaveBeenCalledTimes(3);
});

it('preserves a focused draft and caret while publishing transformed text, then accepts external values after blur', async () => {
  const f = fixture('HELLO WORLD');
  const view = mount(GripInput, {
    props: { grip: f.value, tapGrip: f.handle, parse: (text: string) => text.toUpperCase() },
    attachTo: document.body,
    global: { plugins: [f.plugin] },
  });
  mounted.push(view);
  await settle(f.grok);
  const input = view.get('input');
  input.element.focus();
  input.element.value = 'HELLO new WORLD';
  input.element.setSelectionRange(9, 9);
  await input.trigger('input');
  await settle(f.grok);
  expect(f.tap.get()).toBe('HELLO NEW WORLD');
  expect(input.element.value).toBe('HELLO new WORLD');
  expect(input.element.selectionStart).toBe(9);
  f.tap.set('REMOTE');
  await settle(f.grok);
  expect(input.element.value).toBe('HELLO new WORLD');
  await input.trigger('blur');
  await settle(f.grok);
  expect(input.element.value).toBe('HELLO NEW WORLD');
  f.tap.set('AFTER BLUR');
  await settle(f.grok);
  expect(input.element.value).toBe('AFTER BLUR');
});

it('keeps incomplete numeric input local and restores the stored number on blur', async () => {
  const f = fixture(7);
  const view = mount(GripInput, {
    props: {
      grip: f.value,
      tapGrip: f.handle,
      parse: (text: string) => (/^-?\d+$/.test(text) ? Number(text) : undefined),
    },
    global: { plugins: [f.plugin] },
  });
  mounted.push(view);
  await settle(f.grok);
  const input = view.get('input');
  await input.trigger('focus');
  await input.setValue('-');
  await settle(f.grok);
  expect(input.element.value).toBe('-');
  expect(f.tap.get()).toBe(7);
  await input.trigger('blur');
  await settle(f.grok);
  expect(input.element.value).toBe('7');
});

it('supports blur-only updates, textarea, IME composition, and user input listeners', async () => {
  const f = fixture('old');
  const onInput = vi.fn();
  const view = mount(GripTextarea, {
    props: { grip: f.value, tapGrip: f.handle, update: 'blur' },
    attrs: { onInput },
    global: { plugins: [f.plugin] },
  });
  mounted.push(view);
  await settle(f.grok);
  const input = view.get('textarea');
  await input.trigger('focus');
  await input.setValue('draft');
  expect(f.tap.get()).toBe('old');
  await input.trigger('blur');
  await settle(f.grok);
  expect(f.tap.get()).toBe('draft');
  await view.setProps({ update: 'change' });
  await input.trigger('focus');
  await input.trigger('compositionstart');
  await input.setValue('日本');
  expect(f.tap.get()).toBe('draft');
  await input.trigger('compositionend');
  await settle(f.grok);
  expect(f.tap.get()).toBe('日本');
  expect(onInput).toHaveBeenCalled();
});

it('unsubscribes consumers and unregisters component-owned taps on unmount', async () => {
  const f = fixture(0);
  const home = f.grok.mainContext.getGripHomeContext();
  const unregister = vi.spyOn(home, 'unregisterTap');
  let observed: ReturnType<typeof useGrip<number>>;
  const owned = createAtomValueTap(new Grip<number>({ name: 'Owned' }), { initial: 21 });
  const view = mount(
    defineComponent({
      setup() {
        useTap(() => owned);
        observed = useGrip(f.value);
        return () => h('output', String(observed.value));
      },
    }),
    { global: { plugins: [f.plugin] } },
  );
  await settle(f.grok);
  view.unmount();
  expect(unregister).toHaveBeenCalledWith(owned);
  const afterUnmount = observed!.value;
  f.tap.set(50);
  await settle(f.grok);
  expect(observed!.value).toBe(afterUnmount);
});
