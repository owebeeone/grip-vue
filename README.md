# **@owebeeone/grip-vue**

**Vue 3 integration for GRIP (Generalized Retrieval Intent Provisioning)**

`grip-vue` provides Vue 3 composables and components that seamlessly integrate the GRIP data provisioning system into Vue applications. It enables reactive data flows, async state management, and automatic dependency resolution through Vue's composition API.

## **Installation**

```bash
npm install @owebeeone/grip-vue @owebeeone/grip-core
```

## **Quick Start**

### **1. Setup Plugin**

```ts
import { createApp } from 'vue';
import { createGripPlugin } from '@owebeeone/grip-vue';
import { GripRegistry, GripOf, Grok } from '@owebeeone/grip-core';

// Create registry and Grok instance
const registry = new GripRegistry();
const grok = new Grok(registry);
const mainContext = grok.mainContext;

const app = createApp(App);
app.use(createGripPlugin({ grok, context: mainContext }));
app.mount('#app');
```

### **2. Use Grips in Components**

```vue
<script setup lang="ts">
import { useGrip } from '@owebeeone/grip-vue';
import { USER_NAME } from './grips';

// Reactive value that updates when the Grip changes
const userName = useGrip(USER_NAME);
</script>

<template>
  <div>Hello, {{ userName ?? 'Guest' }}!</div>
</template>
```

### **3. Register Taps**

```vue
<script setup lang="ts">
import { useTap } from '@owebeeone/grip-vue';
import { createAtomValueTap } from '@owebeeone/grip-core';
import { COUNT } from './grips';

// Register a tap that provides COUNT
useTap(() => createAtomValueTap(COUNT, { initial: 0 }));
</script>
```

## **Core Composables**

### **`useGrip<T>(grip, ctx?)`**

Returns a reactive `Ref<T | undefined>` that updates when the Grip's value changes.

```vue
<script setup lang="ts">
import { useGrip } from '@owebeeone/grip-vue';
import { TEMPERATURE } from './grips';

const temp = useGrip(TEMPERATURE);

// Access value reactively
const displayTemp = computed(() => `${temp.value ?? 0}°C`);
</script>
```

**Parameters:**
- `grip: Grip<T>` - The Grip to subscribe to
- `ctx?: GripContext | GripContextLike` - Optional context (defaults to nearest provided context)

**Returns:** `Ref<T | undefined>`

### **`useTap(factory, opts?)`**

Registers a Tap (data producer) in the current context. The Tap is automatically unregistered when the component unmounts.

```vue
<script setup lang="ts">
import { useTap } from '@owebeeone/grip-vue';
import { createAtomValueTap } from '@owebeeone/grip-core';
import { COUNTER } from './grips';

useTap(() => createAtomValueTap(COUNTER, { initial: 0 }));
</script>
```

**Parameters:**
- `factory: () => Tap` - Function that creates the Tap
- `opts?: { ctx?: GripContext | GripContextLike }` - Optional context

### **`useGripRuntime()`**

Accesses the current GRIP runtime (Grok and context). Useful for advanced scenarios.

```vue
<script setup lang="ts">
import { useGripRuntime } from '@owebeeone/grip-vue';

const { grok, context } = useGripRuntime();

// Access graph introspection, etc.
const graph = grok.getGraph();
</script>
```

**Returns:** `{ grok: Grok; context: GripContextLike }`

### **`useGripQuery<TData, TError>(grip, options?)`**

High-level composable for async data with loading/error states. Works seamlessly with async taps that expose state and controller Grips.

```vue
<script setup lang="ts">
import { useGripQuery } from '@owebeeone/grip-vue';
import { USER_DATA, USER_DATA_STATE, USER_DATA_CONTROLLER } from './grips';

const {
  data,
  loading,
  error,
  refetch,
  isRefreshing,
  isStale
} = useGripQuery(USER_DATA, {
  stateGrip: USER_DATA_STATE,
  controllerGrip: USER_DATA_CONTROLLER
});
</script>

<template>
  <div v-if="loading">Loading...</div>
  <div v-else-if="error">Error: {{ error }}</div>
  <div v-else>{{ data }}</div>
  <button @click="refetch()">Refresh</button>
</template>
```

**Parameters:**
- `grip: Grip<any>` - The data Grip
- `options?: GripQueryOptions`
  - `ctx?: GripContext | GripContextLike` - Optional context
  - `stateGrip?: Grip<AsyncRequestState>` - Optional state Grip for async taps
  - `controllerGrip?: Grip<AsyncTapController>` - Optional controller Grip for manual operations

**Returns:** `GripQueryState<TData, TError>`
- `data: Ref<TData | undefined>` - The data value
- `loading: Ref<boolean>` - Loading state
- `error: Ref<TError | undefined>` - Error state
- `refetch: () => void` - Manual refresh function
- `isRefreshing?: Ref<boolean>` - Stale-while-revalidate state
- `isStale?: Ref<boolean>` - Stale data indicator
- `state?: Ref<AsyncRequestState | undefined>` - Full async state

### **`useChildContext()`**

Creates a child context for scoped data resolution. Useful for feature isolation or component-level state.

```vue
<script setup lang="ts">
import { useChildContext } from '@owebeeone/grip-vue';

const childCtx = useChildContext(parent => parent.createChild());
</script>
```

## **Context Scoping**

GRIP uses hierarchical contexts to resolve data. The nearest context in the component tree determines which Tap provides a Grip.

### **Using `provideGripRuntime`**

For advanced scenarios, you can provide a custom runtime in a component subtree:

```vue
<script setup lang="ts">
import { provideGripRuntime } from '@owebeeone/grip-vue';
import { useGripRuntime } from '@owebeeone/grip-vue';

const { grok, context } = useGripRuntime();
const childCtx = context.getGripConsumerContext().createChild();

provideGripRuntime({ grok, context: childCtx });
</script>
```

## **Working with Async Taps**

Async taps can expose state and controller Grips for enhanced control:

```ts
import { createAsyncValueTap, GripRegistry, GripOf } from '@owebeeone/grip-core';

// Setup registry (typically done once in your app)
const registry = new GripRegistry();
const defineGrip = GripOf(registry);

const USER_DATA = defineGrip<User>("UserData");
const USER_DATA_STATE = defineGrip<AsyncRequestState>("UserDataState");
const USER_DATA_CONTROLLER = defineGrip<AsyncTapController>("UserDataController");

const userDataTap = createAsyncValueTap({
  provides: USER_DATA,
  stateGrip: USER_DATA_STATE,      // Expose async state
  controllerGrip: USER_DATA_CONTROLLER, // Expose controller
  destinationParamGrips: [USER_ID],
  requestKeyOf: (params) => params.get(USER_ID) ?? undefined,
  fetcher: async (params, signal) => {
    const userId = params.get(USER_ID);
    const res = await fetch(`/api/users/${userId}`, { signal });
    return res.json();
  },
  cacheTtlMs: 5 * 60 * 1000,
});
```

In components:

```vue
<script setup lang="ts">
import { useGripQuery } from '@owebeeone/grip-vue';
import { USER_DATA, USER_DATA_STATE, USER_DATA_CONTROLLER } from './grips';

const { data, loading, error, refetch } = useGripQuery(USER_DATA, {
  stateGrip: USER_DATA_STATE,
  controllerGrip: USER_DATA_CONTROLLER
});
</script>
```

## Keyed scopes and buffered inputs

`GripScope` provides a keyed matching context to its descendants. `init` runs once for a new live context, so parent renders do not reset edited values. Use a stable column identity for `scope-key`; city and product selections belong in atoms. Changing the key remounts the scope subtree. Core owns context lifetime, including contexts shared under the same parent/key.

```vue
<script setup lang="ts">
import { GripScope } from '@owebeeone/grip-vue';
import { createAtomValueTap, type MatchingContext } from '@owebeeone/grip-core';
import { LOCATION, LOCATION_TAP } from './grips';
import WeatherColumn from './WeatherColumn.vue';
function seed(context: MatchingContext) {
  context.getGripHomeContext().registerTap(createAtomValueTap(LOCATION, {
    initial: 'Sydney', handleGrip: LOCATION_TAP,
  }));
}
</script>
<template>
  <GripScope scope-key="weather:left" :init="seed"><WeatherColumn /></GripScope>
</template>
```

`GripInput` and `GripTextarea` bind a value grip and its atom handle grip. `parse` converts text to a value; returning `undefined` keeps incomplete input local. `format` converts provider values to text. Focused drafts and the caret survive provider echoes. Blur commits valid input and returns to the provider value. IME composition publishes after composition ends. Use `update="blur"` to defer publication; the default is `change`.

```vue
<GripInput :grip="DESCRIPTION" :tap-grip="DESCRIPTION_TAP"
  :parse="text => text.toUpperCase()" aria-label="Description" />
```

For custom controls, `useBufferedGripInput(grip, tapGrip, options)` exposes a `text` ref, focus/input/blur/composition handlers, `commit()` and `reset()`. Grip identities are fixed for a component instance; use a Vue key to replace the component when changing its grips. The components forward ordinary attributes and event listeners to the native control.

## **Parameter Binding with `GripParams`**

`GripParams` registers bindings in the supplied context (or the current runtime context). It does not create an isolated scope. Use `GripScope` when each column needs separate state.

```vue
<script setup lang="ts">
import { GripParams } from '@owebeeone/grip-vue';
import { LOCALE } from './grips';
defineProps<{ locale: string }>();
</script>
<template>
  <GripParams :bindings="[{ grip: LOCALE, value: locale }]"><slot /></GripParams>
</template>
```

## **TypeScript Support**

`grip-vue` is written in TypeScript and provides full type safety:

```ts
import { useGrip } from '@owebeeone/grip-vue';
import { USER_NAME } from './grips'; // Grip<string>

const userName = useGrip(USER_NAME); // Ref<string | undefined>
// TypeScript knows userName.value is string | undefined
```

## **Comparison with Other State Management**

### **vs. Pinia**

- **GRIP**: Context-aware, hierarchical data resolution
- **Pinia**: Global store with explicit imports
- **GRIP**: Automatic dependency resolution through context graph
- **Pinia**: Explicit store access and mutations

### **vs. Vuex**

- **GRIP**: Framework-agnostic core, works across React/Vue
- **Vuex**: Vue-specific
- **GRIP**: Declarative data requests via Grips
- **Vuex**: Explicit store modules and actions

### **vs. Composables**

- **GRIP**: Shared across components via context graph
- **Composables**: Component-local or explicit provide/inject
- **GRIP**: Automatic producer/consumer matching
- **Composables**: Manual dependency management

## **Examples**

See the `grip-vue-demo` package for complete examples including:
- Counter with atom taps
- Calculator with function taps
- Weather app with async taps
- Independent weather and cryptocurrency columns
- Keyed context scopes and buffered text editing
- Live graph, JSON dump, and actual source inspection

## **API Reference**

### **Composables**

- `useGrip<T>(grip, ctx?)` - Subscribe to a Grip
- `useTap(factory, opts?)` - Register a Tap
- `useGripRuntime()` - Access runtime
- `useGripQuery<TData, TError>(grip, options?)` - Async data with states
- `useChildContext(create)` - Create child context
- `useBufferedGripInput(grip, tapGrip, options)` - Bind a focused text draft

### **Plugin**

- `createGripPlugin(options)` - Vue plugin factory
- `provideGripRuntime(runtime)` - Manual runtime provider

### Components

- `GripScope` - Provide a stable keyed matching context
- `GripInput`, `GripTextarea` - Buffered native text controls

### **Utilities**

- `GripParams` - Declarative parameter binding component
- `PARAMS_GRIP` - Special Grip for parameter binding

## **Related Packages**

- **`@owebeeone/grip-core`** - Framework-agnostic GRIP engine
- **`@owebeeone/grip-react`** - React integration

## **Documentation**

- **Core Concepts**: See `@owebeeone/grip-core` README
- **Design Goals**: See `GRIP_DESIGN_GOALS.md`
- **System Design**: See `Grip-Vue System Design Document 1.md`


## Checks

Run `npm run check` for the integration suite, explicit control-flow boundary check, and ESM/CommonJS/declaration builds. Tests use published Core 0.3.0. The boundary check covers the parity sources; the unchanged legacy `useGripQuery.ts` helper still needs a separate four-branch brace migration.

## Trusted publishing

The release workflow is `.github/workflows/publish.yml`. Configure the npm trusted publisher for `@owebeeone/grip-vue` with GitHub owner `owebeeone`, repository `grip-vue`, workflow filename `publish.yml`, and no environment. It needs direct publishing permission; separate dist-tag management is unnecessary.

A published GitHub release checks that its `v`-prefixed tag matches `package.json`, installs locked dependencies, runs `npm run check`, and packs the checked build. A separate job publishes that exact tarball using OIDC with provenance. Stable releases use `latest`; GitHub prereleases use `next`. No npm token secret is required.

Creating the trust connection does not publish a version. Commit and push the prepared changes, select a new package version, and create its matching GitHub release only when release publication is authorized. The first successful automated publication validates the npm connection.


## Graph inspection tools

`GripGraphVisualizer`, `GraphDumpButton` and `GraphDumpDialog` are reusable package exports. They take an explicit `grok` runtime, work without a GRIP plugin, and include their own styles. The demo imports these same components; only its example source-code viewer is demo-specific.

```vue
<script setup lang="ts">
import { GripGraphVisualizer, GraphDumpButton, useGripRuntime } from '@owebeeone/grip-vue';
const { grok } = useGripRuntime();
</script>
<template>
  <div style="height: 500px; display: flex">
    <GripGraphVisualizer :grok="grok" :refresh-ms="700" :fit-to-pane="true" />
  </div>
  <GraphDumpButton :grok="grok" />
</template>
```

The visualizer shows context hierarchy, provider edges and consumer values. It supports `pause`, `refreshMs` (zero disables polling), `refreshTrigger` (increment to refresh), `fitToPane`, and `showReapedContexts`. Changing the runtime refreshes the graph; unmounting clears its timer. Give the containing pane a height when fitting the graph. Optional `keys` accepts a Core `GraphDumpKeyRegistry` to share identifiers with the dump dialog.

The dump button opens a native modal dialog with value-inclusion options, manual snapshot refresh, clipboard copy and JSON download. For controlled visibility, use `<GraphDumpDialog :grok="grok" :open="open" @close="open = false" />`. These browser tools require native HTML dialog support. The dialog restores focus on dismissal; clipboard failures display a download alternative. Snapshots can contain application values, so select the inclusion options appropriate for what you intend to inspect or share.
