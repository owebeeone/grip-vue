# GRIP Vue

**Make your components testable and retargetable with typed data contracts.**

GRIP Vue is the Vue integration for GRIP, a reactive dataflow system. Components
request values and actions while producers supply them through contexts. GRIP
resolves each producer's own requirements and maintains the connections as
inputs or provider selections change.

Vue renders the interface. GRIP Core manages dataflow; this package adds Vue
subscriptions, scopes, buffered inputs, and graph inspection tools.

[See the producer switch](#watch-the-connections-change) ·
[Building with an LLM](#building-with-an-llm) ·
[Install](#install-the-published-package) ·
[Run the examples](#run-the-development-examples) · [Vue API](#vue-api)

## Change the producer. Keep the component.

This weather column edits a location and displays a temperature. The component
stays the same when the source of its temperature changes.

A **grip** is a typed key, such as `TEMPERATURE`. `useGrip` returns a Vue ref for
its current value and manages the subscription. The location handle supplies
its mutator; a native Vue select forwards changes to that handle.

<!-- example:src/readme/WeatherColumn.vue -->
```vue
<script setup lang="ts">
import { useGrip } from '@owebeeone/grip-vue';
import { LOCATION, LOCATION_TAP, TEMPERATURE, type City } from './grips';
defineProps<{ title: string }>();
const location = useGrip(LOCATION);
const handle = useGrip(LOCATION_TAP);
const temperature = useGrip(TEMPERATURE);
</script>
<template>
  <section class="demo-card" :aria-label="title">
    <h2>{{ title }}</h2>
    <label
      >City
      <select
        :value="location"
        @change="handle?.set(($event.target as HTMLSelectElement).value as City)"
      >
        <option>Sydney</option>
        <option>Paris</option>
      </select></label
    >
    <p>
      Temperature: <output>{{ temperature ?? '…' }}</output> °C
    </p>
  </section>
</template>
```

The component imports contracts, not a weather implementation. It owns its
presentation and invokes the supplied mutator, without fetching data or passing
a city to a weather service. The `title` prop is a presentation label; it does
not select a provider or identify a data scope.

### The producers declare what changes

These declarations come from the complete [producer configurations](#producers-declare-their-own-inputs) below:

| Producer | Provides | Requires from the consumer's context |
| --- | --- | --- |
| Mock weather | `TEMPERATURE` | `LOCATION` |
| Coordinate weather | `TEMPERATURE` | `COORDINATES` |
| Geocoder | `COORDINATES` | `LOCATION` |

Both weather producers satisfy the same output contract. Their input
requirements differ; GRIP resolves those requirements from each column's context.

### Dynamic linking for application dataflow

The analogy is dynamic linking: a consumer declares a requirement and a runtime
finds an implementation. Here the requirements are typed values and actions,
and resolution also depends on context. The replacement weather producer needs
coordinates, so GRIP resolves another producer to supply them. The consuming
column retains its original contracts throughout.

## Watch the connections change

Put the column in two scopes with independent locations. The source selector
switches between the two weather producers. Coordinate weather adds this chain:

```text
Column's location → Geocoder → Coordinates → Weather producer → Column's temperature
```

Each producer declares its own inputs and outputs. The component does not
assemble the chain or call either producer.

[Run the examples](#run-the-development-examples), then try:

- **Repeatable local trial:** open `/readme-weather.html`, change one city, then
  switch **Mock** to **Coordinates (fixture)** and back. Both providers use local
  fixtures; the column selections remain independent and no network is needed.
- **Live graph:** open the main demo's **Weather** tab and choose **Show Graph**.
  Change a location or switch **Mock** / **Meteo**. Dashed purple lines show
  provider connections; solid lines show the context hierarchy. **View Code**
  displays the actual demo and provider sources.

The graph viewer and dump controls are reusable package exports. The source
viewer remains specific to the demo's files.

## Verify the composition

The demo's `tests/readme.test.ts` runs the standalone counter and checks the
weather dependency chain, independent selections, and switching providers in
both directions. It rejects external fetches so the introduction stays offline.

For a direct check of dependency resolution, this Vitest example requests only
temperature. The geocoder is activated because the weather producer requires
its output:

<!-- example:tests/transitive.test.ts -->
```ts
import { expect, it, vi } from 'vitest';
import { Grok, createAtomValueTap } from '@owebeeone/grip-core';
import { registry, LOCATION, TEMPERATURE } from '../src/readme/grips';
import { createCoordinateWeatherTap, createGeocoderTap } from '../src/readme/providers';

it('resolves coordinates when temperature is requested', async () => {
  const grok = new Grok(registry);
  grok.registerTap(createAtomValueTap(LOCATION, { initial: 'Paris' }));
  const lookup = vi.fn(() => ({ latitude: 48.86, longitude: 2.35 }));
  const geocoder = createGeocoderTap(lookup);
  const weather = createCoordinateWeatherTap();
  grok.registerTap(geocoder);
  grok.registerTap(weather);
  expect(lookup).not.toHaveBeenCalled();
  const result = grok.query(TEMPERATURE, grok.mainContext);
  const unsubscribe = result.subscribe(() => {});
  try {
    grok.flush();
    await vi.waitFor(() => expect(result.get()).toBe(14));
    expect(lookup).toHaveBeenCalledWith('Paris');
  } finally {
    unsubscribe();
    grok.unregisterTap(weather);
    grok.unregisterTap(geocoder);
  }
});
```

The examples below also check each side independently: test a producer with its
declared inputs, or render a component with supplied values. These examples use
Vitest; the component test additionally uses Vue Test Utils and jsdom.

## Start small. Keep the same model as you grow.

Begin with one component and its typed value/action contracts. Add scopes when
instances need independent inputs, derived producers when values depend on other
values, and async producers when a service supplies data. The component keeps
requesting its contracts as that composition grows.

### Try GRIP in one feature

Keep existing services and state ownership. Install a runtime at a feature's
application boundary, or use `provideGripRuntime` within a component subtree.
An adapter tap can expose the existing system's values and actions. Test the
display with fixture values, inspect its graph, then substitute another producer
to assess what the boundary lets you reuse.

## Building with an LLM

Useful implementation constraints for this package are:

- Application data and coordination belong in taps; consumers read typed values
  and invoke supplied mutators. Vue refs remain appropriate for presentation
  state such as an open inspector or a pane's size.
- Producer inputs are declared as home or destination parameters. A consumer
  does not need to import concrete producers or assemble their dependency chain.
- Scope keys identify stable UI instances, not changing cities or products.
  Initialization seeds a new live context; subsequent edits use mutators.
- An adapter for existing state preserves that system's ownership. It forwards
  mutations and owns the subscription that publishes external updates.
- Examples must use exported APIs. GRIP Vue uses a plugin and Vue composables;
  it does not export React's provider component or select-binding hook.

Validate the producer chain, independent scopes, provider switching, and cleanup.
The runnable examples and the API table below provide the concrete vocabulary.

## Install the published package

The API described here targets GRIP Vue **0.3.x**, Vue **3.3 or newer within
Vue 3**, and GRIP Core **0.3.x**.

```sh
npm install @owebeeone/grip-vue@^0.3.0 @owebeeone/grip-core@^0.3.0 vue@^3.3.0
```

Import Vue integration from `@owebeeone/grip-vue` and engine APIs from
`@owebeeone/grip-core`. Core APIs are not re-exported by this package. The package
includes ESM, CommonJS, and matching TypeScript declarations for both formats.

## Quick start: one value, one component

For a page with `<div id="app"></div>`, place these files in the same directory
inside a Vue application with TypeScript and single-file component support.
First define the value and its mutator, then create a runtime supplying them:

<!-- example:src/readme/counterRuntime.ts -->
```ts
import {
  Grok,
  GripOf,
  GripRegistry,
  createAtomValueTap,
  type AtomTapHandle,
} from '@owebeeone/grip-core';
const registry = new GripRegistry();
const defineGrip = GripOf(registry);
export const COUNT = defineGrip<number>('Count', 0);
export const COUNT_TAP = defineGrip<AtomTapHandle<number>>('Count.Handle');
export function createCounterRuntime() {
  const grok = new Grok(registry);
  grok.registerTap(createAtomValueTap(COUNT, { initial: 0, handleGrip: COUNT_TAP }));
  return grok;
}
```

The component reads the contracts and invokes the mutator:

<!-- example:src/readme/Counter.vue -->
```vue
<script setup lang="ts">
import { useGrip } from '@owebeeone/grip-vue';
import { COUNT, COUNT_TAP } from './counterRuntime';
const count = useGrip(COUNT);
const handle = useGrip(COUNT_TAP);
</script>
<template>
  <main class="demo-content">
    <section class="demo-card">
      <h1>GRIP Vue counter</h1>
      <output aria-label="Count">{{ count }}</output>
      <button @click="handle?.update((value) => value + 1)">Increment</button>
    </section>
  </main>
</template>
```

Install the runtime once when mounting the application:

<!-- example:src/readme/counter.ts -->
```ts
import { createApp } from 'vue';
import { createGripPlugin } from '@owebeeone/grip-vue';
import Counter from './Counter.vue';
import { createCounterRuntime } from './counterRuntime';
createApp(Counter)
  .use(createGripPlugin({ grok: createCounterRuntime() }))
  .mount('#app');
```

`useGrip` subscribes on mount and unsubscribes on unmount. Before a value is
available its ref can contain `undefined`, so the handler uses optional chaining.
Run this example at `/readme-counter.html` in the demo.

## Two instances, independent values and controls

`GripScope` supplies a keyed matching context to descendants. This application
seeds each column's location in its scope and places the shared provider selector
outside both scopes:

<!-- example:src/readme/WeatherApp.vue -->
```vue
<script setup lang="ts">
import { GripScope, useGrip } from '@owebeeone/grip-vue';
import { createAtomValueTap, type MatchingContext } from '@owebeeone/grip-core';
import { LOCATION, LOCATION_TAP, SOURCE, SOURCE_TAP, type City, type WeatherSource } from './grips';
import WeatherColumn from './WeatherColumn.vue';
const source = useGrip(SOURCE);
const handle = useGrip(SOURCE_TAP);
function seed(context: MatchingContext, city: City) {
  context
    .getGripHomeContext()
    .registerTap(createAtomValueTap(LOCATION, { initial: city, handleGrip: LOCATION_TAP }));
}
</script>
<template>
  <main class="demo-content">
    <h1>Scoped weather</h1>
    <p>Both providers use local fixtures. No network request is needed.</p>
    <label
      >Provider
      <select
        :value="source"
        @change="handle?.set(($event.target as HTMLSelectElement).value as WeatherSource)"
      >
        <option value="mock">Mock</option>
        <option value="coordinates">Coordinates (fixture)</option>
      </select></label
    >
    <div class="example-columns">
      <GripScope scope-key="readme-weather:left" :init="(ctx) => seed(ctx, 'Sydney')"
        ><WeatherColumn title="Location A"
      /></GripScope>
      <GripScope scope-key="readme-weather:right" :init="(ctx) => seed(ctx, 'Paris')"
        ><WeatherColumn title="Location B"
      /></GripScope>
    </div>
  </main>
</template>
```

Both scopes render the same `WeatherColumn`. Selecting Paris on the left changes
only that scope's location. Keys identify UI instances, not cities. Initialization
runs when the live context is created; parent renders do not reset its values.

The complete contracts used by the column, composition, and producers are:

<!-- example:src/readme/grips.ts -->
```ts
import { GripOf, GripRegistry, type AtomTapHandle } from '@owebeeone/grip-core';

export const registry = new GripRegistry();
const defineGrip = GripOf(registry);

export type City = 'Sydney' | 'Paris';
export type Coordinates = { latitude: number; longitude: number };
export type WeatherSource = 'mock' | 'coordinates';

export const LOCATION = defineGrip<City>('Readme.Location');
export const LOCATION_TAP = defineGrip<AtomTapHandle<City>>('Readme.Location.Handle');
export const TEMPERATURE = defineGrip<number>('Readme.Temperature');
export const COORDINATES = defineGrip<Coordinates>('Readme.Coordinates');
export const SOURCE = defineGrip<WeatherSource>('Readme.Source', 'mock');
export const SOURCE_TAP = defineGrip<AtomTapHandle<WeatherSource>>('Readme.Source.Handle');
```

## Producers declare their own inputs

The mock provider requires a location; its replacement requires coordinates.
The geocoder produces coordinates from a location. `destinationParamGrips`
resolves each input from the requesting column's context, so the same producer
can serve independently configured columns.

Here are all three implementations in `providers.ts`. The coordinate-weather
service is an injected async function with a deterministic default; the fixture
performs no external requests.

<!-- example:src/readme/providers.ts -->
```ts
import { createAsyncValueTap, createFunctionTap } from '@owebeeone/grip-core';
import { COORDINATES, LOCATION, TEMPERATURE, type City, type Coordinates } from './grips';

// Small, deterministic fixtures keep the introduction independent of a service.
const coordinates: Record<City, Coordinates> = {
  Sydney: { latitude: -33.87, longitude: 151.21 },
  Paris: { latitude: 48.86, longitude: 2.35 },
};

export function createMockWeatherTap() {
  // Type slots: outputs, home parameters (none), destination parameters.
  return createFunctionTap<
    { temperature: typeof TEMPERATURE },
    Record<string, never>,
    { location: typeof LOCATION }
  >({
    provides: [TEMPERATURE],
    destinationParamGrips: [LOCATION],
    compute: ({ getDestParam }) => {
      const city = getDestParam(LOCATION);
      return new Map([[TEMPERATURE, city === 'Sydney' ? 20 : 12]]);
    },
  });
}

export function createGeocoderTap(lookup = (city: City) => coordinates[city]) {
  return createFunctionTap<
    { coordinates: typeof COORDINATES },
    Record<string, never>,
    { location: typeof LOCATION }
  >({
    provides: [COORDINATES],
    destinationParamGrips: [LOCATION],
    compute: ({ getDestParam }) => {
      const city = getDestParam(LOCATION);
      return city ? new Map([[COORDINATES, lookup(city)]]) : new Map();
    },
  });
}

export function createCoordinateWeatherTap(
  fetchTemperature: (point: Coordinates, signal: AbortSignal) => Promise<number> = async (point) =>
    point.latitude < 0 ? 22 : 14,
) {
  return createAsyncValueTap({
    provides: TEMPERATURE,
    destinationParamGrips: [COORDINATES],
    requestKeyOf: (params) => {
      const point = params.get(COORDINATES);
      return point ? `${point.latitude}:${point.longitude}` : undefined;
    },
    fetcher: (params, signal) => {
      const point = params.get(COORDINATES);
      if (!point) {
        throw new Error('Weather requires coordinates');
      }
      return fetchTemperature(point, signal);
    },
  });
}
```

Each producer can be tested by supplying its input contracts. The async producer
receives an abort signal and derives a request key from coordinates. A service
implementation can replace the fixture without changing `WeatherColumn`.

### Switch the producer, keep the columns

Register the geocoder and choose between weather producers through bindings
that inspect the shared `SOURCE` value:

<!-- example:src/readme/runtime.ts -->
```ts
import { Grok, createAtomValueTap, withOneOf } from '@owebeeone/grip-core';
import { registry, SOURCE, SOURCE_TAP } from './grips';
import { createCoordinateWeatherTap, createGeocoderTap, createMockWeatherTap } from './providers';

export function createWeatherRuntime() {
  const grok = new Grok(registry);
  grok.registerTap(createAtomValueTap(SOURCE, { initial: 'mock', handleGrip: SOURCE_TAP }));
  grok.registerTap(createGeocoderTap());
  grok.addBinding({
    id: 'mock-weather',
    query: withOneOf(SOURCE, 'mock', 10).build(),
    tap: createMockWeatherTap(),
    baseScore: 5,
  });
  grok.addBinding({
    id: 'coordinate-weather',
    query: withOneOf(SOURCE, 'coordinates', 10).build(),
    tap: createCoordinateWeatherTap(),
    baseScore: 5,
  });
  return grok;
}
```

The entry point supplies this runtime to the application shown above:

<!-- example:src/readme/weather.ts -->
```ts
import { createApp } from 'vue';
import { createGripPlugin } from '@owebeeone/grip-vue';
import WeatherApp from './WeatherApp.vue';
import { createWeatherRuntime } from './runtime';
createApp(WeatherApp)
  .use(createGripPlugin({ grok: createWeatherRuntime() }))
  .mount('#app');
```

Changing the provider selector changes which producer satisfies temperature.
Locations, controls, and column code retain the same responsibilities.

## Test the producer without Vue

Supply coordinates directly and inject a controlled service. Neither Vue nor a
geocoder is needed to test the weather producer:

<!-- example:tests/producer.test.ts -->
```ts
import { expect, it, vi } from 'vitest';
import { Grok, createAtomValueTap } from '@owebeeone/grip-core';
import { registry, COORDINATES, TEMPERATURE } from '../src/readme/grips';
import { createCoordinateWeatherTap } from '../src/readme/providers';

it('tests weather with supplied coordinates', async () => {
  const grok = new Grok(registry);
  const point = { latitude: -33.87, longitude: 151.21 };
  grok.registerTap(createAtomValueTap(COORDINATES, { initial: point }));
  const service = vi.fn(async () => 23);
  const weather = createCoordinateWeatherTap(service);
  grok.registerTap(weather);
  const result = grok.query(TEMPERATURE, grok.mainContext);
  const unsubscribe = result.subscribe(() => {});
  try {
    grok.flush();
    await vi.waitFor(() => expect(result.get()).toBe(23));
    expect(service).toHaveBeenCalledWith(point, expect.any(AbortSignal));
  } finally {
    unsubscribe();
    grok.unregisterTap(weather);
  }
});
```

## Test the component with supplied values

Supply location and temperature atoms, mount the column, and update a value.
No weather or geocoding producer participates in this test:

<!-- example:tests/display.test.ts -->
```ts
// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { Grok, createAtomValueTap } from '@owebeeone/grip-core';
import { createGripPlugin } from '@owebeeone/grip-vue';
import { registry, LOCATION, LOCATION_TAP, TEMPERATURE } from '../src/readme/grips';
import WeatherColumn from '../src/readme/WeatherColumn.vue';

it('renders supplied values without weather services', async () => {
  const grok = new Grok(registry);
  grok.registerTap(createAtomValueTap(LOCATION, { initial: 'Sydney', handleGrip: LOCATION_TAP }));
  const temperature = createAtomValueTap(TEMPERATURE, { initial: 25 });
  grok.registerTap(temperature);
  const view = mount(WeatherColumn, {
    props: { title: 'Fixture column' },
    global: { plugins: [createGripPlugin({ grok })] },
  });
  try {
    grok.flush();
    await nextTick();
    expect(view.get('output').text()).toBe('25');
    temperature.set(26);
    grok.flush();
    await nextTick();
    expect(view.get('output').text()).toBe('26');
  } finally {
    view.unmount();
    grok.unregisterTap(temperature);
  }
});
```

These boundaries allow display and producer tests to evolve independently.
Provider-selection rules and full composition still need their own checks.

## Run the development examples

The [Vue demo](https://github.com/owebeeone/grip-vue-demo) uses a sibling adapter
checkout and published Core. From the directory containing both checkouts:

```sh
cd grip-vue
npm ci
npm run build
cd ../grip-vue-demo
npm ci
npm run dev
```

Use the address Vite prints. Open `/readme-counter.html` for the counter or
`/readme-weather.html` for the offline weather introduction. The main page also
includes a calculator, a clock, buffered text editing, live weather, and
independent cryptocurrency streams.

**Show Graph** keeps the running example beside the graph. **Graph Dump** opens
the package's snapshot dialog. **View Code** displays the active example's source
without remounting it. These are development examples; the source viewer is not
part of the adapter's public API.

From the demo checkout, `npm run check` runs source and README-excerpt checks,
tests, and the multi-entry production build. From this package checkout:

```sh
npm run check
node scripts/check-package.mjs
```

The adapter checks cover scopes, editing, lifecycle cleanup, graph refresh, and
dump behavior. The packed-package check verifies ESM and CommonJS exports plus
strict TypeScript consumers. The unchanged legacy `useGripQuery.ts` helper is
excluded from the brace check; its four unbraced branches remain a separately
recorded migration.

## The concepts behind the example

| Name | Role |
| --- | --- |
| Grip | Typed identifier for a value or capability, rather than a state container. |
| Tap | Producer that declares outputs and the inputs it requires. |
| Drip | Live result of a grip request; `useGrip` manages its Vue subscription. |
| Context | Surroundings used to resolve requests and parameters; contexts form a graph. |
| Grok | Runtime that manages that graph and resolves its connections. |
| Destination parameter | Input resolved from the consumer's context. |
| Home parameter | Input resolved from the producer's home context. |

## A small mechanism that replaces application plumbing

The reusable mechanism is request resolution plus subscription management.
Components declare their needs, producers declare their inputs, and contexts
supply the conditions for connecting them. Application code still implements
business rules, services, and presentation; it can reuse connection management
instead of recreating it for each feature.

## Why the combination matters

Typed contracts, context-dependent resolution, and reactive updates reinforce
each other. The contract boundary that makes a display independent of its
supplier also makes it possible to test with supplied values, switch producers,
and inspect the active connections.

In the weather example, independent instances and an additional geocoding
requirement work without changing the column's data contract. Evaluate the cost
of adopting the model against the coordination and lifecycle code it replaces
in the application you are building.

## Add one feature to an existing application

Choose a panel with a clear value/action contract. Install a GRIP runtime for
that feature, or supply one in a subtree with `provideGripRuntime`. An adapter
tap can expose an existing store or service and route mutations back to that
owner. The adapter owns the external subscription and cleanup; consumers only
need the typed contracts. Other application state can stay where it is.

## Application state through useGrip

Components can read application values and actions through `useGrip` while taps
own stored values, computations, async requests, and streams. Event handlers
invoke supplied capabilities. This removes manual subscriptions and duplicated
derived-state synchronization from those consumers.

Vue remains responsible for rendering, and local Vue state remains useful for
presentation controls. Buffered-input and scope helpers handle editing and
composition. If a project requires a stricter separation of application state,
its lint rules can enforce that policy; this package does not install such rules
for consumers.

## Vue API

Call the runtime-dependent APIs during component setup, under `createGripPlugin`
or a boundary established with `provideGripRuntime`.

| API | Behavior |
| --- | --- |
| `useGrip<T>(grip, ctx?)` | Return `Ref<T \| undefined>` and manage the mounted subscription. Treat it as a read value; invoke a supplied mutator to change state. |
| `useGripRuntime()` | Return the current `grok` and context. |
| `useTap(factory, { ctx }?)` | Create and register a component-owned tap; unregister it on unmount. |
| `useChildContext(create)` | Create a child from the current consumer context and provide it to descendants. |
| `useGripQuery<TData, TError>(grip, options?)` | Read data with loading/error state and a refresh operation. |
| `GripParams` | Register parameter atoms in the supplied `ctx` or current context. |
| `PARAMS_GRIP` | Exported parameter-map grip identifier. |

`useGripQuery` accepts `ctx`, `stateGrip`, and `controllerGrip`. When a producer
exposes an `AsyncRequestState` grip, pass it as `stateGrip`; the result includes
`data`, `loading`, `error`, `refetch`, `isRefreshing`, `isStale`, and `state`.
Manual refresh uses the supplied controller's `refresh(true)`. Without a state
grip it supports a legacy state-object value or treats `undefined` as loading.
Provide an actual state/controller producer when those capabilities are needed;
the composable does not create a request by itself.

`GripParams` accepts `bindings` such as
`[{ grip: LOCALE, value: locale, handleGrip: LOCALE_TAP }]`, or `params` as
`[[LOCALE, locale]]`. Keep the grip set fixed after setup: updates change values
for bindings registered initially. It does not create an isolated context. Use
`GripScope` to separate otherwise identical controls or columns.

`BufferedInputOptions<T>` is exported for custom buffered input bindings. Core
contracts such as `Grip<T>`, `AtomTapHandle<T>`, and `MatchingContext` come from
the Core package.

| Additional export | Purpose |
| --- | --- |
| `createGripPlugin({ grok, context? })` | Install a runtime; context defaults to `grok.mainContext`. |
| `provideGripRuntime(runtime)` | Provide a runtime boundary from component setup. |
| `GripScope` | Provide a stable keyed matching context. |
| `GripInput`, `GripTextarea` | Bind native controls through focused edit buffers. |
| `useBufferedGripInput` | Use the same edit buffer in a custom control. |
| `GripGraphVisualizer`, `GraphDumpButton`, `GraphDumpDialog` | Inspect connections and capture snapshots. |

### Editing without losing the local draft

`GripInput` and `GripTextarea` bind a value grip and an atom-handle grip. A focused
control retains its local draft while provider values change, so normalization
or derived updates do not replace the text under the caret.

This `CountInput.vue` example accepts integers while allowing unfinished input,
such as a lone minus sign, to remain editable:

<!-- example:src/readme/CountInput.vue -->
```vue
<script setup lang="ts">
import { GripInput } from '@owebeeone/grip-vue';
import { COUNT, COUNT_TAP } from './counterRuntime';

function parseInteger(text: string): number | undefined {
  return /^-?\d+$/.test(text) ? Number(text) : undefined;
}
</script>

<template>
  <GripInput
    :grip="COUNT"
    :tap-grip="COUNT_TAP"
    :parse="parseInteger"
    inputmode="numeric"
    aria-label="Count"
  />
</template>
```

- `parse(text)` converts text to a stored value. Returning `undefined` does not
  publish that draft. Supply a parser for non-string values.
- `format(value)` controls the text representation; the default displays
  `String(value ?? '')`.
- `update="change"` publishes valid edits as they happen. `update="blur"` defers
  publication until blur.
- Blur publishes a valid draft and resumes displaying the provider value. An
  invalid draft returns to that value. IME input publishes after composition
  ends, subject to the update mode.

Ordinary attributes and native focus, input, blur, and composition listeners are
forwarded to the control. Component refs expose `commit()` and `reset()`.
For a custom control, `useBufferedGripInput(grip, tapGrip, options)` returns a
read-only `text` ref, those methods, and the focus/input/blur/composition handlers.
Bind `text` to the control's value and forward the handlers rather than assigning
to the ref. Grip identities are fixed for each component instance; use a Vue key
when replacing them.

### Scope lifetime

An equal key under the same parent reuses a live context. Different parents
identify independent scopes. `init` seeds creation; it is not a callback for
synchronizing changed props. Changing a key remounts the subtree.

Core owns context lifetime, including shared contexts. Unmounting a scope does
not explicitly retire it. If a context is collected and later recreated,
initialization can run again; this reuse is not persistent storage.

### Graph inspection tools

The following are public package exports, usable in your own application:

| Component | Purpose |
| --- | --- |
| `GripGraphVisualizer` | Display context hierarchy, provider connections, and current consumer values. |
| `GraphDumpButton` | Open a graph snapshot dialog with one button. |
| `GraphDumpDialog` | Control the snapshot dialog's visibility yourself. |

Each accepts an explicit `grok` runtime and includes its own styles. They do not
require the plugin when passed a runtime directly. This `Inspector.vue` example
uses the plugin's runtime for convenience:

<!-- example:src/readme/Inspector.vue -->
```vue
<script setup lang="ts">
import { ref } from 'vue';
import { GraphDumpKeyRegistry } from '@owebeeone/grip-core';
import {
  GripGraphVisualizer,
  GraphDumpButton,
  GraphDumpDialog,
  useGripRuntime,
} from '@owebeeone/grip-vue';

const { grok } = useGripRuntime();
const keys = new GraphDumpKeyRegistry();
const refresh = ref(0);
const fit = ref(true);
const open = ref(false);
</script>

<template>
  <label><input v-model="fit" type="checkbox" /> Fit graph</label>
  <button @click="refresh++">Refresh graph</button>
  <div style="height: 500px; display: flex">
    <GripGraphVisualizer
      :grok="grok"
      :keys="keys"
      :fit-to-pane="fit"
      :refresh-trigger="refresh"
    />
  </div>
  <GraphDumpButton :grok="grok" :keys="keys" />
  <button @click="open = true">Open controlled dump</button>
  <GraphDumpDialog :grok="grok" :keys="keys" :open="open" @close="open = false" />
</template>
```

The graph polls every 700 ms by default. Set `refreshMs` to another positive
interval, or zero to disable polling; `pause` also suspends polling. Increment
`refreshTrigger` for an explicit refresh. `fitToPane` defaults to true and scales
the graph to its container; false keeps its natural dimensions with scrolling.
Give the container a height for fit mode. `showReapedContexts` includes collected
contexts when true. Changing the runtime refreshes the snapshot, and unmounting
clears the timer. Solid lines show context relationships; dashed purple lines
show provider connections.

The optional shared `keys` registry keeps graph and dump identifiers aligned.
The dialog captures a snapshot when opened; its **Refresh snapshot** button
captures another. Options control inclusion of drip values and tap destination
values. **Copy** copies the JSON; **Download JSON** saves it. Clipboard failure
shows a fallback message. The native modal supports keyboard dismissal and
returns focus to its opener. These UI tools require browser support for native
HTML dialogs.

The demo imports these same graph and dump components. Its **View Code** panel
shows demo source files and remains a demo feature, not a package export.

## Core producers and further reading

| Factory | Purpose |
| --- | --- |
| `createAtomValueTap` | Store a value and optionally supply its mutator. |
| `createFunctionTap` | Derive outputs from declared inputs. |
| `createAsyncValueTap` / `createAsyncMultiTap` | Retrieve asynchronous outputs with request keys, cancellation and optional state/controller grips. |
| `createAsyncStreamMultiTap` | Produce values from long-lived streams. |
| `withOneOf` and bindings | Select providers through context conditions. |

Import these APIs from [GRIP Core](https://github.com/owebeeone/grip-core).
[GRIP React](https://github.com/owebeeone/grip-react) provides the corresponding
React integration. [The Vue exports](src/index.ts) define this package's public
surface; historical design documents can describe proposals beyond it.

[RELEASE.md](RELEASE.md) covers Gearu and npm trusted publishing. The workflow
publishes a checked tarball only after an authorized release is created.

### Live graph value changes

The graph viewer briefly highlights consumer rows when their displayed values
change, using white text on blue with a gold edge. It holds briefly, then fades away
over 1.5 seconds. Unchanged refreshes and the
initial snapshot do not flash. Row identity and graph layout are preserved.
With reduced motion enabled, the highlight stays static briefly and then clears.
