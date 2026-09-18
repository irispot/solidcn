// Independent transport diagnostics. These are not original component parity cases.
import { describe, expect, it } from "vitest";
import {
  createContext,
  createSignal,
  flush,
  onCleanup,
  useContext,
} from "solid-js";
import { createComponent, Dynamic, render as renderNative } from "@solidjs/web";
import {
  assertFixturePropKeys,
  createRenderer,
  fireEvent,
  registerNative,
} from "./fixture-renderer";
import { Fragment, jsx, useState } from "./fixture-runtime";
import { Fieldset } from "./fieldset-route";

const Context = createContext<() => string>();
const Provider = registerNative(
  (props: any) =>
    createComponent(Context, {
      value: () => props.value,
      get children() {
        return props.children;
      },
    }),
  "diagnostic-only#Provider",
);
const Consumer = registerNative((props: any) => {
  const value = useContext(Context);
  props.onMount?.();
  onCleanup(() => props.onDispose?.());
  return createComponent(Dynamic, {
    component: "span",
    get children() {
      return value();
    },
    get "data-probe"() {
      return props.name;
    },
    get onClick() {
      return props.onClick;
    },
  });
}, "diagnostic-only#Consumer");

describe("fixture transport ownership", () => {
  const { render } = createRenderer();
  it("reads the nearest native provider through nested fixtures", () => {
    function Fixture() {
      return jsx(Consumer, { name: "inner" });
    }
    const view = render(
      jsx(Provider, {
        value: "outer",
        children: [
          jsx(Consumer, { name: "outer" }),
          jsx(Provider, { value: "inner", children: jsx(Fixture, {}) }),
        ],
      }),
    );
    expect(
      view.container.querySelector("[data-probe=outer]")?.textContent,
    ).toBe("outer");
    expect(
      view.container.querySelector("[data-probe=inner]")?.textContent,
    ).toBe("inner");
  });
  it("does not reuse a child owner between two providers", () => {
    const child = jsx(Consumer, {});
    const view = render(
      jsx(Fragment, {
        children: [
          jsx(Provider, { value: "one", children: child }),
          jsx(Provider, { value: "two", children: child }),
        ],
      }),
    );
    expect(
      [...view.container.querySelectorAll("span")].map(
        (node) => node.textContent,
      ),
    ).toEqual(["one", "two"]);
  });
  it("commits event updates without remounting same-type native children", () => {
    let mounts = 0,
      disposals = 0;
    function Fixture() {
      const [value, setValue] = useState("before");
      return jsx(Provider, {
        value,
        children: jsx(Consumer, {
          onMount: () => mounts++,
          onDispose: () => disposals++,
          onClick: () => setValue("after"),
        }),
      });
    }
    const view = render(jsx(Fixture, {}));
    const node = view.container.querySelector("span");
    fireEvent.click(node!);
    expect(view.container.querySelector("span")).toBe(node);
    expect(node?.textContent).toBe("after");
    expect(mounts).toBe(1);
    expect(disposals).toBe(0);
    view.unmount();
    expect(disposals).toBe(1);
  });
  it("disposes conditional children once and supplies a fresh owner on remount", () => {
    let mounts = 0,
      disposals = 0;
    function Fixture() {
      const [show, setShow] = useState(true);
      return jsx(Provider, {
        value: "context",
        children: jsx(Fragment, {
          children: [
            show
              ? jsx(Consumer, {
                  onMount: () => mounts++,
                  onDispose: () => disposals++,
                })
              : null,
            jsx("button", {
              onClick: () => setShow((value) => !value),
              children: "Toggle",
            }),
          ],
        }),
      });
    }
    const view = render(jsx(Fixture, {}));
    fireEvent.click(view.getByRole("button"));
    expect(view.container.querySelector("span")).toBeNull();
    expect(disposals).toBe(1);
    fireEvent.click(view.getByRole("button"));
    expect(view.container.querySelector("span")?.textContent).toBe("context");
    expect(mounts).toBe(2);
    view.unmount();
    expect(disposals).toBe(2);
  });
  it("updates a live native legend id and clears it without array remounts", () => {
    const element = (id: string | null) =>
      jsx(Fieldset.Root, {
        children:
          id === null
            ? null
            : jsx(Fieldset.Legend, {
                id,
                "data-probe": "legend",
                children: "Label",
              }),
      });
    const view = render(element("first-label"));
    const group = view.getByRole("group");
    const legend = view.container.querySelector("[data-probe=legend]");
    expect(group.getAttribute("aria-labelledby")).toBe("first-label");
    view.rerender(element("next-label"));
    flush();
    expect(view.container.querySelector("[data-probe=legend]")).toBe(legend);
    expect(legend?.id).toBe("next-label");
    expect(group.getAttribute("aria-labelledby")).toBe("next-label");
    view.rerender(element(null));
    flush();
    expect(group.hasAttribute("aria-labelledby")).toBe(false);
  });
  it("updates direct provider props when the fixture root is rerendered", () => {
    const child = jsx(Consumer, {});
    const view = render(jsx(Provider, { value: "first", children: child }));
    view.rerender(jsx(Provider, { value: "next", children: child }));
    flush();
    expect(view.container.textContent).toBe("next");
  });
  it("retains unkeyed sibling nodes and context during fixture updates", () => {
    let mounts = 0,
      disposals = 0;
    function Fixture() {
      const [value, setValue] = useState("before");
      return jsx(Provider, {
        value,
        children: [
          jsx(Consumer, {
            onMount: () => mounts++,
            onDispose: () => disposals++,
          }),
          jsx("button", {
            onClick: () => setValue("after"),
            children: "Change",
          }),
        ],
      });
    }
    const view = render(jsx(Fixture, {}));
    const span = view.container.querySelector("span");
    const button = view.getByRole("button");
    fireEvent.click(button);
    expect(view.container.querySelector("span")).toBe(span);
    expect(view.getByRole("button")).toBe(button);
    expect(span?.textContent).toBe("after");
    expect(mounts).toBe(1);
    expect(disposals).toBe(0);
    view.unmount();
    expect(disposals).toBe(1);
  });
  it("retains indexed list owners and disposes only removed entries", () => {
    const counts = new Map<string, { mounts: number; disposals: number }>();
    const element = (names: string[]) =>
      jsx(Provider, {
        value: "context",
        children: names.map((name) => {
          const count = counts.get(name) ?? { mounts: 0, disposals: 0 };
          counts.set(name, count);
          return jsx(Consumer, {
            name,
            onMount: () => count.mounts++,
            onDispose: () => count.disposals++,
          });
        }),
      });
    const view = render(element(["first", "second"]));
    const first = view.container.querySelector('[data-probe="first"]');
    view.rerender(element(["first"]));
    flush();
    expect(view.container.querySelector("span")).toBe(first);
    expect(counts.get("first")).toEqual({ mounts: 1, disposals: 0 });
    expect(counts.get("second")).toEqual({ mounts: 1, disposals: 1 });
    view.rerender(element(["first", "third"]));
    flush();
    expect(view.container.querySelector('[data-probe="first"]')).toBe(first);
    expect(counts.get("third")).toEqual({ mounts: 1, disposals: 0 });
    view.unmount();
    expect(counts.get("first")?.disposals).toBe(1);
    expect(counts.get("third")?.disposals).toBe(1);
  });
  it("rejects new or removed prop keys instead of returning stale props", () => {
    const before = jsx("section", { title: "first" });
    const added = jsx("section", { title: "next", "data-added": "yes" });
    expect(() => assertFixturePropKeys(before, added)).toThrow(
      "adding or removing prop keys",
    );
    expect(() => assertFixturePropKeys(added, before)).toThrow(
      "adding or removing prop keys",
    );
    expect(() =>
      assertFixturePropKeys(before, jsx("section", { title: "next" })),
    ).not.toThrow();
  });
  it("updates a legend id through the native renderer without fixture transport", () => {
    const container = document.createElement("div");
    document.body.append(container);
    let setId!: (value: string) => void;
    const dispose = renderNative(() => {
      const [id, update] = createSignal("native-first");
      setId = update;
      return createComponent(Fieldset.Root, {
        get children() {
          return createComponent(Fieldset.Legend, {
            get id() {
              return id();
            },
          });
        },
      });
    }, container);
    try {
      const fieldset = container.querySelector("fieldset")!;
      const legend = container.querySelector("fieldset > div")!;
      expect(fieldset.getAttribute("aria-labelledby")).toBe("native-first");
      setId("native-next");
      flush();
      expect(container.querySelector("fieldset > div")).toBe(legend);
      expect(legend.id).toBe("native-next");
      expect(fieldset.getAttribute("aria-labelledby")).toBe("native-next");
    } finally {
      dispose();
      container.remove();
    }
  });
});
