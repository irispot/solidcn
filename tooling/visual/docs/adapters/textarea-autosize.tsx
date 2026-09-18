import { createRenderEffect, onCleanup } from "solid-js";
import { omitProps } from "../../../../shadcn-ui/packages/solid/src/utils";

// Native lifecycle for react-textarea-autosize 8.5.9. The measurement algorithm,
// style list, placeholder fallback and Firefox double measurement are preserved.
const sizingKeys = [
  "borderBottomWidth",
  "borderLeftWidth",
  "borderRightWidth",
  "borderTopWidth",
  "boxSizing",
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontWeight",
  "letterSpacing",
  "lineHeight",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "tabSize",
  "textIndent",
  "textRendering",
  "textTransform",
  "width",
  "wordBreak",
  "wordSpacing",
  "scrollbarGutter",
];
const hiddenStyle = {
  "min-height": "0",
  "max-height": "none",
  height: "0",
  visibility: "hidden",
  overflow: "hidden",
  position: "absolute",
  "z-index": "-1000",
  top: "0",
  right: "0",
  display: "block",
};

export default function TextareaAutosize(props) {
  let element: HTMLTextAreaElement;
  let hidden: HTMLTextAreaElement;
  let sizing;
  let previousHeight = 0;
  let resetFrame;
  const resize = () => {
    if (!element?.isConnected) return;
    if (
      props.style &&
      ("maxHeight" in props.style || "minHeight" in props.style)
    )
      throw new Error(
        "Use minRows and maxRows instead of style.minHeight or style.maxHeight.",
      );
    const doc = element.ownerDocument;
    if (!props.cacheMeasurements || !sizing) {
      const style = doc.defaultView.getComputedStyle(element);
      if (!style.boxSizing) return;
      sizing = Object.fromEntries(sizingKeys.map((key) => [key, style[key]]));
    }
    if (!hidden) {
      hidden = doc.createElement("textarea");
      hidden.tabIndex = -1;
      hidden.setAttribute("aria-hidden", "true");
      doc.body.appendChild(hidden);
    }
    Object.assign(hidden.style, sizing);
    for (const [key, value] of Object.entries(hiddenStyle))
      hidden.style.setProperty(key, value, "important");
    const padding =
      parseFloat(sizing.paddingBottom) + parseFloat(sizing.paddingTop);
    const border =
      parseFloat(sizing.borderBottomWidth) + parseFloat(sizing.borderTopWidth);
    const borderBox = sizing.boxSizing === "border-box";
    const value = element.value || element.placeholder || "x";
    hidden.value = value;
    let height = hidden.scrollHeight;
    hidden.value = value;
    height = hidden.scrollHeight + (borderBox ? border : -padding);
    hidden.value = "x";
    const rowHeight = hidden.scrollHeight - padding;
    const extra = borderBox ? padding + border : 0;
    height = Math.min(
      Math.max(height, rowHeight * (props.minRows ?? 1) + extra),
      rowHeight * (props.maxRows ?? Infinity) + extra,
    );
    if (height !== previousHeight) {
      previousHeight = height;
      element.style.setProperty("height", `${height}px`, "important");
      props.onHeightChange?.(height, { rowHeight });
    }
  };
  createRenderEffect(
    () => [props.value, props.minRows, props.maxRows, props.class, props.style],
    () => queueMicrotask(resize),
    { schedule: true },
  );
  createRenderEffect(
    () => true,
    () => {
      let disposed = false;
      let remove = () => {};
      // Solid templates can still have an inert ownerDocument in the first
      // render phase. Read the owner only after the node is in its real tree.
      queueMicrotask(() => {
        if (disposed) return;
        const doc = element.ownerDocument;
        const win = doc.defaultView;
        const reset = (event) => {
          if (element.form !== event.target || props.value !== undefined)
            return;
          const value = element.value;
          resetFrame = win.requestAnimationFrame(() => {
            if (value !== element.value) resize();
          });
        };
        doc.body.addEventListener("reset", reset);
        win.addEventListener("resize", resize);
        doc.fonts?.addEventListener("loadingdone", resize);
        remove = () => {
          doc.body.removeEventListener("reset", reset);
          win.removeEventListener("resize", resize);
          doc.fonts?.removeEventListener("loadingdone", resize);
          win.cancelAnimationFrame(resetFrame);
        };
        resize();
      });
      return () => {
        disposed = true;
        remove();
      };
    },
    { schedule: true },
  );
  onCleanup(() => hidden?.remove());
  return (
    <textarea
      {...omitProps(props, [
        "cacheMeasurements",
        "maxRows",
        "minRows",
        "onHeightChange",
        "onChange",
        "onInput",
        "ref",
      ])}
      ref={(node) => {
        element = node;
        if (typeof props.ref === "function") props.ref(node);
        else if (props.ref) props.ref.current = node;
      }}
      onInput={(event) => {
        if (props.value === undefined) resize();
        props.onInput?.(event);
        props.onChange?.(event);
      }}
    />
  );
}
