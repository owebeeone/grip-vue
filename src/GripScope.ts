import { defineComponent, h, type PropType } from 'vue';
import type { MatchingContext } from '@owebeeone/grip-core';
import { provideGripRuntime, useGripRuntimeInternal } from './provider';

const scopeProps = {
  scopeKey: { type: String, required: true as const },
  init: Function as PropType<(context: MatchingContext) => void>,
};

// The keyed inner boundary changes the injected context only when scope identity
// changes. Ordinary parent renders retain the context and its edited data.
const ScopeBoundary = defineComponent({
  props: scopeProps,
  setup(props, { slots }) {
    const { grok, context } = useGripRuntimeInternal();
    const child = context
      .getGripConsumerContext()
      .getOrCreateMatchingContext(props.scopeKey, props.init);
    provideGripRuntime({ grok, context: child });
    // Context ownership belongs to Core: another subtree can share this key.
    return () => slots.default?.();
  },
});

export const GripScope = defineComponent({
  name: 'GripScope',
  props: scopeProps,
  setup(props, { slots }) {
    return () => h(ScopeBoundary, { ...props, key: props.scopeKey }, slots);
  },
});
