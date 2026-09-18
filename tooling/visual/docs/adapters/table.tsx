import {
  createMemo,
  createRenderEffect,
  createRoot,
  createSignal,
  onCleanup,
  untrack,
} from "solid-js";
import { constructTable } from "@tanstack/table-core";
import { table_setOptions } from "@tanstack/table-core/static-functions";
import { Dynamic } from "@solidjs/web";
export * from "@tanstack/table-core";

// TanStack owns all row models and table operations. Only its reactive bindings
// and its render function are framework-specific. No React renderer is loaded.
function subscribe(get, observer) {
  let previous = untrack(get);
  const unsubscribe = createRoot((dispose) => {
    createRenderEffect(get, (value) => {
      if (!Object.is(previous, value)) {
        previous = value;
        if (typeof observer === "function") observer(value);
        else observer.next?.(value);
      }
    });
    return dispose;
  });
  return { unsubscribe };
}

export function solidTableReactivity() {
  return {
    createOptionsStore: true,
    wrapExternalAtoms: true,
    addSubscription: (subscription) =>
      onCleanup(() => subscription.unsubscribe()),
    untrack,
    // Solid 2 batches writes until its next apply phase.
    batch: (callback) => callback(),
    schedule: (callback) => queueMicrotask(callback),
    createReadonlyAtom: (compute, options) => {
      const get = createMemo(compute, { equals: options?.compare });
      return { get, subscribe: (observer) => subscribe(get, observer) };
    },
    createWritableAtom: (initial, options) => {
      const [get, set] = createSignal(() => initial, {
        equals: options?.compare,
        // Table construction synchronizes controlled state into its own atoms.
        // These writes are part of this adapter's store initialization contract.
        ownedWrite: true,
      });
      return { get, set, subscribe: (observer) => subscribe(get, observer) };
    },
  };
}

function mergeOptions(...sources) {
  return new Proxy(
    {},
    {
      get: (_, key) => {
        for (let i = sources.length - 1; i >= 0; i--)
          if (key in sources[i]) return sources[i][key];
      },
      has: (_, key) => sources.some((source) => key in source),
      ownKeys: () => [...new Set(sources.flatMap(Reflect.ownKeys))],
      getOwnPropertyDescriptor: (_, key) => ({
        enumerable: true,
        configurable: true,
        get() {
          for (let i = sources.length - 1; i >= 0; i--)
            if (key in sources[i]) return sources[i][key];
        },
      }),
    },
  );
}

export function useTable(options, selector = (state) => state) {
  const table = untrack(() =>
    constructTable({
      ...options,
      mergeOptions,
      features: {
        coreReactivityFeature: solidTableReactivity(),
        ...options.features,
      },
    }),
  );
  // Preserve source getters. Spreading a controlled state object during setup
  // would disconnect sorting, filtering, visibility, and selection updates.
  untrack(() => table_setOptions(table, options));
  table.FlexRender = FlexRender;
  table.Subscribe = (props) => {
    const value = createMemo(() =>
      (props.selector ?? ((state) => state))(
        (props.source ?? table.store).get(),
      ),
    );
    return () => props.children(value());
  };
  Object.defineProperty(table, "state", {
    get: () => selector(table.store.get()),
  });
  return table;
}

export function flexRender(component, props) {
  return typeof component === "function" ? (
    <Dynamic component={component} {...props} />
  ) : (
    (component ?? null)
  );
}

export function FlexRender(props) {
  return () => {
    if (props.cell) {
      const cell = props.cell;
      const def = cell.column.columnDef;
      if (cell.getIsAggregated?.())
        return flexRender(def.aggregatedCell ?? def.cell, cell.getContext());
      if (cell.getIsPlaceholder?.()) return null;
      return flexRender(def.cell, cell.getContext());
    }
    const header = props.header ?? props.footer;
    return header
      ? flexRender(
          header.column.columnDef[props.header ? "header" : "footer"],
          header.getContext(),
        )
      : null;
  };
}
