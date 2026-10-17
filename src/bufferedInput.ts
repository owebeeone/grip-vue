import { computed, defineComponent, h, ref, type PropType } from 'vue';
import type { AtomTapHandle, Grip } from '@owebeeone/grip-core';
import { useGrip } from './hooks';

export interface BufferedInputOptions<T> {
  parse?: (text: string) => T | undefined;
  format?: (value: T | undefined) => string;
  update?: 'change' | 'blur';
}

/** Keep a focused draft independent from provider echoes (including transforms). */
export function useBufferedGripInput<T>(
  grip: Grip<T>,
  tapGrip: Grip<AtomTapHandle<T>>,
  options: BufferedInputOptions<T> = {},
) {
  const value = useGrip(grip);
  const handle = useGrip(tapGrip);
  const focused = ref(false);
  const draft = ref<string | null>(null);
  let composing = false;
  const storedText = computed(() =>
    options.format ? options.format(value.value) : String(value.value ?? ''),
  );
  const text = computed(() =>
    focused.value ? (draft.value ?? storedText.value) : storedText.value,
  );
  const publish = (input: string) => {
    const parsed = options.parse ? options.parse(input) : (input as T);
    if (parsed !== undefined) {
      handle.value?.set(parsed);
    }
  };
  const inputText = (event: Event) =>
    (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  const onInput = (event: Event) => {
    draft.value = inputText(event);
    if (!composing && options.update !== 'blur') {
      publish(draft.value);
    }
  };
  return {
    text,
    onFocus(event: FocusEvent) {
      draft.value = inputText(event);
      focused.value = true;
    },
    onInput,
    onBlur(event: FocusEvent) {
      composing = false;
      publish(inputText(event));
      focused.value = false;
      draft.value = null;
    },
    onCompositionstart() {
      composing = true;
    },
    onCompositionend(event: CompositionEvent) {
      composing = false;
      onInput(event);
    },
    commit() {
      publish(text.value);
    },
    reset() {
      draft.value = null;
    },
  };
}

const inputProps = {
  grip: { type: Object as PropType<Grip<any>>, required: true as const },
  tapGrip: { type: Object as PropType<Grip<AtomTapHandle<any>>>, required: true as const },
  parse: Function as PropType<(text: string) => any>,
  format: Function as PropType<(value: any) => string>,
  update: { type: String as PropType<'change' | 'blur'>, default: 'change' },
};

function bufferedComponent(tag: 'input' | 'textarea') {
  return defineComponent({
    name: tag === 'input' ? 'GripInput' : 'GripTextarea',
    inheritAttrs: false,
    props: inputProps,
    setup(props, { attrs, expose }) {
      const bind = useBufferedGripInput(props.grip, props.tapGrip, props);
      expose({ commit: bind.commit, reset: bind.reset });
      return () =>
        h(tag, {
          ...attrs,
          value: bind.text.value,
          onFocus: [bind.onFocus, attrs.onFocus].filter(Boolean),
          onInput: [bind.onInput, attrs.onInput].filter(Boolean),
          onBlur: [bind.onBlur, attrs.onBlur].filter(Boolean),
          onCompositionstart: [bind.onCompositionstart, attrs.onCompositionstart].filter(Boolean),
          onCompositionend: [bind.onCompositionend, attrs.onCompositionend].filter(Boolean),
        });
    },
  });
}

export const GripInput = bufferedComponent('input');
export const GripTextarea = bufferedComponent('textarea');
