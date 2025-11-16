# Grip-Vue System Design Document 1.0

---

# **1\. Overview**

## **1.1 Purpose**

This document describes the architecture and design of the **Grip** ecosystem:

* **`@owebeeone/grip-core`** – framework-agnostic engine implementing Grips, Taps, Drips, and the GripContext graph.

* **`@owebeeone/grip-react`** – React bindings (existing; used as reference implementation).

* **`@owebeeone/grip-vue`** – Vue bindings that bring the same concepts to Vue’s plugin / composable / component model.

The main objective is:

Keep **Grip’s identity as a contextual dependency graph**, not a global store, while making it feel natural in Vue and React.

## **1.2 Scope**

This doc covers:

* Domain model (Grip, Tap, Drip, GripContext, Grok).

* Core engine behaviour (`grip-core`).

* React integration (just enough to act as a baseline).

* Vue integration (`grip-vue`): plugin, composables, components, and higher-level helpers (`useGripQuery`, `GripParams`, `useGripRuntime`).

* HMR and multi-context considerations.

* Packaging & deployment (AIAR archives).

---

# **2\. Core Concepts (Shared Across Frameworks)**

### **2.1 Grip**

* **Grip\<T\>** is a *key* for a piece of data of type `T`.

* Defined **globally** (module-level singletons) so identity is stable across the app and engines.

* Grips are used both:

  * by producers (Taps) to declare what they publish; and

  * by consumers to declare what they want.

### **2.2 Tap**

* A **Tap** is a producer:

  * Owns one or more output Grips.

  * Optionally depends on one or more input Grips.

  * Lives in a **GripContext**; that context and descendants see its outputs unless shadowed.

* Types of Taps (conceptual):

  * **AtomTap**: owns a mutable value for one Grip.

  * **DerivedTap / FunctionTap**: computes outputs from input Drips.

  * **AsyncTap**: performs async work, maintains per-destination async state via Drips.

### **2.3 Drip**

* A **Drip\<T\>** is a destination-local stream of values for a given Grip:

  * Created when a consumer asks for `Grip<T>` in a context (via engine `query()` or framework hooks).

  * Internally subscribes to the chosen Tap for that Grip.

  * Can carry metadata such as loading/error state for async pipelines.

### **2.4 GripContext & Graph**

* **GripContext** represents a location in the context graph.

* Graph is a **DAG**:

  * A context can have multiple parents with priorities.

  * Child contexts inherit Taps from parents; closer Taps **shadow** parents.

* Each context has an internal **ContextNode**:

  * Holds Taps registered at that context.

  * Holds live Drips for consumers at that context.

  * Participates in the resolver and graph snapshotting.

### **2.5 Grok (Engine)**

* **Grok** is the engine that:

  * Owns the root GripContext.

  * Manages the graph, Tap registration and unregistration.

  * Resolves consumer queries to Drips (`query(grip, consumerCtx)`).

  * Coordinates the **TapMatcher / QueryEvaluator** pipelines when used (for dynamic Tap selection).

  * Provides graph inspection APIs (`getGraph()`, `getGraphSanityCheck()`).

**Design stance:**  
 Grok is *usually a singleton* per runtime, especially in typical app setups, but the architecture allows multiple Grok instances when multiple independent context trees are needed (e.g., multi-tenant shells or SSR+isolation).

---

# **3\. `@owebeeone/grip-core` Design**

This is now **framework-agnostic TypeScript**; React/Vue specifics live in separate packages. The AIAR archive `grip-core.sh` contains the built library and its TS source.

## **3.1 Public API (High Level)**

Key exports (conceptual):

* **Types / primitives**

  * `Grip<T>`

  * `Drip<T>`

  * `Tap`, `TapFactory`

  * `GripContext`

  * `Grok`

  * `GripRegistry`

* **Context helpers**

  * `createRootContext(opts?: { registry?: GripRegistry; grok?: Grok; }): GripContext`

* **Query system**

  * `Query`, `QueryBuilderFactory`, `QueryEvaluator`, `QueryBinding`, etc.

* **Matching & dynamic producers**

  * `TapMatcher`, `MatchingContext`, `DualContextContainer`.

### **3.2 GripLifecycle**

* Grips are **registry entries** known to Grok via a `GripRegistry`.

* Best practice: create them in a `grips.ts` module per feature, import as needed (React & Vue both follow this).

### **3.3 Context Graph Management**

* **Creating contexts**:

  * Engine: `grok.createContext(parent?, priority?, id?)` creates new contexts and wires them into the DAG.

  * Root: `createRootContext` (optionally reusing an existing Grok and/or registry).

* **Disposal**:

  * `grok.disposeContext(ctx)` exists as a hook for cleaning up; GC uses weak references inside the graph structure.

### **3.4 Tap Registration & Replacement Semantics**

* Context method: `context.registerTap(tap)` delegates to `grok.registerTapAt(context, tap)`.

* Engine method: `grok.unregisterTap(tap)` removes producers and triggers re-resolution.

* **Design rule (per your clarification):**

  * If a new Tap is registered that provides the same Grip(s) at the same context and is meant to replace the previous Tap, the engine prioritises the *newer* Tap and effectively de-registers the old one.

  * This supports HMR and feature re-registration patterns (see §7.2).

### **3.5 Query System & TapMatcher**

* `Query` expresses conditions on **Grip values**, used to dynamically activate Taps based on context parameters.

* `QueryEvaluator` manages:

  * All query bindings.

  * Reactive, incremental evaluation on Grip changes.

  * Conflict resolution and attribution between candidate Taps.

* `TapMatcher` \+ `MatchingContext`:

  * Observes *input* Grips in a “home” context.

  * Applies deltas of added/removed Taps in a “presentation” context.

**Core principle preserved:**  
 The Query engine and TapMatcher remain fully **framework-agnostic** in `grip-core`. Frameworks just decide *where and how* contexts, bindings, and matchers are created.

---

# **4\. React Integration (Reference)**

The existing `anchorscad-viewer` demo shows typical `grip-react` usage:

* Taps are defined in `taps.ts` using core factories like `createAtomValueTap`, `createAsyncValueTap`, etc.

* Grips are defined in `grips.ts` as global constants.

* In `main.tsx`:

  * A root context is created.

  * Taps are registered via `useTap` \+ `<GripProvider>` hierarchy.

* Components use:

  * `useGrip(GRIP_KEY)` to read.

  * `useGripSetter(ATOM_TAP)` to write atom values.

* Dynamic / async behaviour is encapsulated inside Taps; consumers stay agnostic, just reading values.

This acts as a behavioural baseline for `grip-vue`:

* Same separation of concerns.

* Same wholistic context graph semantics.

* No store-like “global module” abstraction hiding the graph.

---

# **5\. Vue Integration: `@owebeeone/grip-vue`**

The AIAR archive `grip-vue.sh` contains the skeleton bindings; this design formalises the target API around it.

## **5.1 Design Goals**

1. **Grip-first, not store-first**

   * No Pinia-style global store mental model.

   * No “root context only” simplification as the default story.

2. **Location Matters**

   * The **nearest GripContext** in the graph determines how a Grip is resolved.

   * `<GripScope>` in Vue must be a first-class building block, mirroring `GripScope` in React.

3. **Framework-appropriate ergonomics**

   * Use Vue’s **plugin**, **provide/inject**, and **composables** as the main primitives.

   * Keep core engine out of Vue import paths where possible.

4. **Engine Agnosticism of Async**

   * `grip-core` remains agnostic: it doesn’t know “async vs sync”.

   * Async semantics are **conventions** on the shape of Drip values and Tap implementations.

   * `useGripQuery` is a *consumer convenience* that assumes a certain value shape but does **not** encode async-only Grip types.

---

## **5.2 Runtime & Plugin**

### **5.2.1 Plugin API**

import { createApp } from 'vue';  
import { GripPlugin } from '@owebeeone/grip-vue';  
import { createRootContext } from '@owebeeone/grip-core';

const rootContext \= createRootContext();  
const app \= createApp(App);

app.use(GripPlugin, {  
  rootContext,       // optional; if omitted, plugin calls createRootContext()  
  grok: rootContext.getGrok?.(), // optional; for multi-tree setups  
  registry: /\* optional GripRegistry \*/,  
});

app.mount('\#app');

Plugin responsibilities:

* Ensure there is a **root GripContext** and **Grok** instance.

`app.provide()` a **grip runtime object**:

 interface GripRuntime {  
  grok: Grok;  
  rootContext: GripContext;  
}

* 

### **5.2.2 `useGripRuntime`**

export function useGripRuntime(): { grok: Grok; context: GripContext };

* `context` is the **nearest GripContext** provided (scope-aware).

* `grok` gives access to engine introspection (`getGraph()`, etc.) and advanced APIs (used by visualizers, devtools, dynamic matching contexts).

---

## **5.3 Context Scoping Components**

### **5.3.1 `<GripScope>`**

\<GripScope\>  
  \<\!-- children see a child context that shadows the parent \--\>  
  \<SomeFeature /\>  
\</GripScope\>

Script:

// props (initial version)  
interface GripScopeProps {  
  id?: string;              // optional debug/inspection id  
  inheritFrom?: 'nearest' | GripContext; // future-proofing, default 'nearest'  
  priority?: number;        // parent edge priority  
}

export const GripScope \= defineComponent({  
  name: 'GripScope',  
  props: { id, inheritFrom, priority },  
  setup(props, { slots }) {  
    const parentRuntime \= useGripRuntime();  
    const grok \= parentRuntime.grok;

    const parentContext \=  
      props.inheritFrom \=== 'nearest' || \!props.inheritFrom  
        ? parentRuntime.context  
        : props.inheritFrom;

    const childContext \= grok.createContext(parentContext, props.priority, props.id);

    // Provide a new runtime for descendants  
    provide(GRIP\_RUNTIME\_SYMBOL, { grok, context: childContext });

    onUnmounted(() \=\> {  
      grok.disposeContext(childContext);  
    });

    return () \=\> slots.default?.();  
  },  
});

**Behaviour:**

* Creates a child context with the given parent and priority.

* Automatically participates in the DAG; parents can be extended in future (multi-parent, cross-tree contexts) without API changes.

* Disposing the scope hints the engine to detach/GC context nodes, but keeps underlying Drips/Taps safe for `keep-alive` use cases (already handled engine side as per your note).

---

## **5.4 Production & Consumption Composables**

### **5.4.1 `useTap` – Producer Registration**

export function useTap(tap: Tap | TapFactory): void;

Called from `<script setup>` or `setup()`:

 const MY\_ATOM\_TAP \= createAtomValueTap(MY\_ATOM\_GRIP, initialValue);

export default defineComponent({  
  setup() {  
    useTap(MY\_ATOM\_TAP);  
    // ...  
  }  
});

*   
* Implementation:

  * `inject` runtime.

  * `onMounted` → `context.registerTap(tap)`.

  * `onUnmounted` → `context.unregisterTap(tapInstance)`.

Because the engine resolves collisions and prioritises newer taps that cover the same grips, re-registering taps (e.g. under HMR) naturally replaces them.

### **5.4.2 `useGrip` – Basic Consumer**

export function useGrip\<T\>(grip: Grip\<T\>, ctx?: GripContext): Readonly\<Ref\<T | undefined\>\>;

* If `ctx` is omitted:

  * Uses the **nearest** context from runtime.

* Internally:

  * Uses `customRef` to subscribe to the Drip’s updates and trigger Vue reactivity; unsubscribes on component unmount.

* Drip creation path:

  * `grok.query(grip, consumerCtxLike)` → `Drip<T>`; `GripContextLike` comes from the runtime context.

### **5.4.3 `useGripSetter` – AtomWriter**

export function useGripSetter\<T\>(tap: AtomTap\<T\>): (value: T | (prev: T) \=\> T) \=\> void;

* Mirrors `grip-react` semantics used in AnchorSCAD: `useGripSetter(SHOW_SPLASH_TAP)` etc.

* Implementation:

  * `useTap(tap)` is **not** called here. `useGripSetter` assumes the tap is registered by some scope/feature.

  * Returns a function that writes to the Tap’s owned value, using engine or tap API.

---

## **5.5 Higher-Level Consumption: `useGripQuery`**

### **5.5.1 Goal**

Provide a composable for **async-shaped data** (like `createAsyncValueTap`) without baking async semantics into `Grip` types.

### **5.5.2 API**

interface GripQueryState\<T\> {  
  data: Ref\<T | undefined\>;  
  loading: Ref\<boolean\>;  
  error: Ref\<unknown | undefined\>;  
  refetch: () \=\> void;  
}

export function useGripQuery\<T, S extends GripQueryStateShape \= DefaultShape\>(  
  grip: Grip\<S\>,  
  options?: { /\* future proofing \*/ }  
): GripQueryState\<S\['data'\]\>;

Where:

* `S` is a *value shape* convention (e.g. `{ data: T; loading: boolean; error?: unknown; refetch?: () => void }`) defined by async tap helpers, not by core.

* Internally:

  * `const raw = useGrip<S>(grip);`

  * Wraps `raw.value` into derived `Ref`s:

    * `data` ref points at `raw.value?.data`.

    * `loading` ref points at `raw.value?.loading ?? false`.

    * `error` ref points at `raw.value?.error`.

    * `refetch` delegated to `raw.value?.refetch ?? noop`.

**Important:**

* Engine remains completely agnostic about async vs sync.

* `useGripQuery` works as long as taps produce values that adhere to the agreed shape; if a Grip is not async-shaped, `useGripQuery` is technically still valid but just not very meaningful (user responsibility).

---

## **5.6 Declarative Destination Parameters: `<GripParams>`**

### **5.6.1 Design Decision**

* We **don’t** add `context.setParam()` to `grip-core` – that would leak framework concerns into the core.

* Instead, **params are represented as data in Taps**:

  * A dedicated **Params AtomTap** at each scope holds a list of tuples `[Grip<any>, any]`.

  * “Param-driven” Taps look up these values as inputs.

### **5.6.2 Component API**

\<GripScope\>  
  \<GripParams  
    :params="\[  
      \[USER\_ID\_GRIP, currentUserId\],  
      \[VIEW\_MODE\_GRIP, 'list'\]  
    \]"  
  /\>  
  \<MyContent /\>  
\</GripScope\>

OR object-like sugar (still compiled to `[Grip, value][]` under the hood):

\<GripParams  
  :bindings="\[  
    { grip: USER\_ID\_GRIP, value: currentUserId },  
    { grip: VIEW\_MODE\_GRIP, value: 'list' }  
  \]"  
/\>

### **5.6.3 Implementation Sketch**

* On `setup`:

  * `useGripRuntime` → current context.

  * Create a **single AtomTap** for this scope, e.g. `PARAMS_TAP`, owning `PARAMS_GRIP` – a map from `Grip<any>` to value.

* Use `watch` on the `params` prop to:

  * Update the AtomTap’s value.

  * Since Taps that depend on `PARAMS_GRIP` (using `createDerivedTap` etc.) will see changes, this drives param-based behaviour.

* On unmount:

  * Unregister the params tap from this context.

This keeps **parameters as data**, uses vanilla Grip/Tap patterns, and is consistent across frameworks.

---

## **5.7 Feature Modules & HMR**

### **5.7.1 Feature Modules**

A *feature module* defines Grips and Taps, but doesn’t perform framework registration itself:

// feature/userFeature.ts  
export const USER\_ID \= new Grip\<string\>({ name: 'USER\_ID' });  
export const USER\_PROFILE \= new Grip\<UserProfile\>({ name: 'USER\_PROFILE' });

export const USER\_ID\_TAP \= createAtomValueTap(USER\_ID, null);  
export const USER\_PROFILE\_TAP \= createAsyncValueTap(USER\_PROFILE, async ctx \=\> {  
  const userId \= ctx.get(USER\_ID); // uses Drip context  
  // ...  
});

// Grouped for convenience  
export const USER\_FEATURE\_TAPS \= \[USER\_ID\_TAP, USER\_PROFILE\_TAP\];

Then, per scope:

import { USER\_FEATURE\_TAPS } from './feature/userFeature';

export function useUserFeature() {  
  for (const tap of USER\_FEATURE\_TAPS) {  
    useTap(tap);  
  }  
}

### **5.7.2 HMR Behaviour**

Given the engine semantics you described:

* **If a feature is reloaded under HMR**, `useUserFeature` runs again:

  * New Tap instances are registered.

  * Old conflicting taps are removed by the engine’s replacement semantics.

* To make this predictable:

  * Maintain stable **Tap identity** per `grip` per context (e.g. each factory returns taps with stable `id` or metadata).

  * Optionally, `useUserFeature` can:

    * Keep its own registry of taps by feature ID.

    * On re-run, explicitly unregister taps it previously registered in that context before adding new ones.

`grip-vue` itself doesn’t need to hard-code HMR logic, but it **must not** make decisions that would block this pattern (e.g., no hidden global caching of taps per component instance that can’t be invalidated).

---

# **6\. Multi-Context & “Per-Route” Considerations**

Per your note:

* The context graph is a DAG, and `useGrip` can accept an explicit `ctx` parameter if a specific context should be used.

* Framework bindings should support the **common case** (use nearest context) while allowing advanced users to call `useGrip(grip, ctx)` with explicit context.

For Vue:

* The recommended pattern is **layout/route-based scopes** (without shipping router helpers):

  * Route root component: wraps content with `<GripScope>` and `useFeatureX()`.

  * Nested UI: uses `useGrip` and `useGripSetter` only.

This respects Grip’s graph semantics without forcing router-specific APIs or assumptions.

---

# **7\. Non-Functional Requirements**

## **7.1 Performance**

* `grip-core`:

  * Query evaluation uses hybrid strategies and caching for large condition sets.

  * Context graph uses efficient node representations and weak references for GC.

* `grip-vue`:

  * `useGrip`/`useGripQuery` must use `customRef` or equivalent low-level reactivity bridging to:

    * Minimize subscriptions.

    * Ensure proper teardown.

## **7.2 Testability**

* `grip-core`:

  * Exports `flush()` on task queues for tests (drain async work deterministically).

  * `getGraph()` and `getGraphSanityCheck()` provide introspection for structural tests.

* `grip-vue`:

  * `useGripRuntime` exposes `grok` and `context` to tests; they can:

    * Assert which Taps are registered at which contexts.

    * Inspect Drip states.

## **7.3 Packaging & AIAR**

* Each library (core, react, vue) is shipped as:

  * Standard npm package (`package.json`, TS typings, build artefacts).

  * **AIAR archive** (self-extracting `.sh`) for offline / tooling use, as in the current `grip-core.sh` and `grip-vue.sh` files.

---

# **8\. Open Questions / Future Work**

1. **Devtools / Visualizer Integration**

   * Vue Devtools panel for Grip:

     * Show context graph.

     * Show Taps, Drips, query bindings.

     * Hooks into `useGripRuntime` and `grok.getGraph()`.

2. **Macro / Script-Setup Sugar**

   * Once the base primitives are stable, consider:

     * `defineGripFeature()` \+ `useGripFeature()` macros.

     * Optional `<script setup>` macros for auto-registering a feature’s taps in `setup()`.

3. **Router Conventions Doc**

   * Not code helpers, but a “Best Practices” write-up:

     * Where to place `<GripScope>` in route layouts.

     * How to share features across routes while using shadowing effectively.

4. **SSR / Nuxt Integration**

   * Provide recipes (not necessarily first-class APIs) showing:

     * How to create one Grok per request.

     * How to hydrate contexts on client.

---

