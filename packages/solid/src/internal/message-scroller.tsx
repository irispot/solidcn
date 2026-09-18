import { dataValue } from '../utils';
import { createContext, createEffect, createSignal, useContext } from 'solid-js';
import { Button as BaseButton } from '@solid-cn/base-ui/button';
import type { JSX } from '@solidjs/web';
import { omitProps, type ComponentProps } from '../utils';
import {
  getContentBottom,
  getElementScrollTop,
  getMessageScrollerScrollable,
  getMessageScrollerVisibilityState,
} from './message-scroller/geometry';
type ScrollOptions = {
  align?: 'start' | 'center' | 'end' | 'nearest';
  behavior?: ScrollBehavior;
  scrollMargin?: number;
};
type ProviderProps = {
  children?: JSX.Element;
  autoScroll?: boolean;
  defaultScrollPosition?: 'start' | 'end' | 'last-anchor';
  scrollEdgeThreshold?: number;
  scrollPreviousItemPeek?: number;
  scrollMargin?: number;
};
const Context = createContext<ReturnType<typeof controller> | null>(null);
function controller(props: ProviderProps) {
  const [viewport, setViewport] = createSignal<HTMLDivElement | null>(null),
    [content, setContent] = createSignal<HTMLDivElement | null>(null),
    [spacer, setSpacer] = createSignal<HTMLDivElement | null>(null),
    [start, setStart] = createSignal(false),
    [end, setEnd] = createSignal(false),
    [visible, setVisible] = createSignal<string[]>([]),
    [current, setCurrent] = createSignal<string | null>(null),
    [pending, setPending] = createSignal(props.defaultScrollPosition !== 'start');
  const messages = new Map<string, HTMLElement>();
  const handledAnchors = new WeakSet<HTMLElement>();
  let root: HTMLDivElement | null = null;
  let following = props.defaultScrollPosition !== 'start';
  let initialized = false;
  let previousItems: HTMLElement[] = [];
  let anchored: HTMLElement | undefined;
  let tailHeight = 0;
  let lastScrollTop = 0;
  let settlingJump = false;
  let autoscrolling = false;
  let autoscrollTimer: ReturnType<typeof setTimeout> | undefined;
  let visibilitySubscribed = false;
  let visibilityObserver: IntersectionObserver | undefined;
  const observedVisible = new Set<string>();
  let pendingMessage: { id: string; options: ScrollOptions } | undefined;
  const items = () => Array.from(content()?.children ?? []).filter(element => element !== spacer()) as HTMLElement[];
  const padding = () => {
    const node = content();
    const style = node && node.ownerDocument.defaultView!.getComputedStyle(node);
    return { start: parseFloat(style?.paddingBlockStart ?? '0') || 0, end: parseFloat(style?.paddingBlockEnd ?? '0') || 0, gap: parseFloat(style?.rowGap ?? '0') || 0 };
  };
  const contentBottom = () => {
    const node = viewport();
    const body = content();
    if (!node || !body) return 0;
    return getContentBottom({ content: body, spacer: spacer(), viewport: node });
  };
  const setTail = (height: number) => {
    const node = spacer();
    if (!node) return;
    const size = Math.max(0, Math.ceil(height));
    tailHeight = size;
    node.hidden = size === 0;
    node.style.height = `${size}px`;
    node.style.marginTop = size ? `${-padding().gap}px` : '';
  };
  const update = () => {
    const node = viewport();
    if (!node) return;
    const threshold = props.scrollEdgeThreshold ?? 8;
    const scrollable = getMessageScrollerScrollable({
      content: content(),
      scrollEdgeThreshold: threshold,
      spacer: spacer(),
      viewport: node,
    });
    setStart(scrollable.start);
    setEnd(props.autoScroll && following ? false : scrollable.end);
    const scrollableValue = [scrollable.start && 'start',
      (props.autoScroll && following ? false : scrollable.end) && 'end']
      .filter(Boolean).join(' ');
    for (const element of [root, node]) {
      if (!element) continue;
      if (scrollableValue) element.setAttribute('data-scrollable', scrollableValue);
      else element.removeAttribute('data-scrollable');
      element.toggleAttribute('data-autoscrolling', autoscrolling);
    }
    lastScrollTop = node.scrollTop;
    if (visibilitySubscribed) {
      const state = getMessageScrollerVisibilityState({
        content: content(),
        scrollMargin: props.scrollMargin ?? 0,
        scrollPreviousItemPeek: props.scrollPreviousItemPeek ?? 64,
        spacer: spacer(),
        viewport: node,
        visibleMessageIds: observedVisible,
      });
      setVisible(state.visibleMessageIds);
      setCurrent(state.currentAnchorId);
    }
  };
  const to = (top: number, options: ScrollOptions = {}) => {
    const node = viewport();
    if (!node) return false;
    node.scrollTo({ top, behavior: options.behavior ?? 'auto' });
    update();
    return true;
  };
  const scrollToEnd = (options: ScrollOptions = {}) => {
    following = !!props.autoScroll;
    anchored = undefined;
    settlingJump = false;
    setTail(0);
    const node = viewport();
    if (autoscrollTimer) clearTimeout(autoscrollTimer);
    autoscrolling = true;
    autoscrollTimer = setTimeout(() => {
      autoscrolling = false;
      update();
    }, 180);
    return to(node ? Math.max(0, node.scrollHeight - node.clientHeight) : 0, options);
  };
  const scrollToStart = (options: ScrollOptions = {}) => {
    following = false;
    anchored = undefined;
    settlingJump = false;
    setTail(0);
    return to(0, options);
  };
  const scrollToElement = (message: HTMLElement | undefined, options: ScrollOptions = {}, keepPreviousPeek = false) => {
    const node = viewport();
    if (!node || !message) return false;
    following = false;
    anchored = keepPreviousPeek ? message : undefined;
    settlingJump = !keepPreviousPeek;
    const margin = (options.scrollMargin ?? props.scrollMargin ?? 0) + (keepPreviousPeek ? props.scrollPreviousItemPeek ?? 64 : 0);
    const top = getElementScrollTop({
      align: options.align ?? 'start',
      element: message,
      scrollMargin: margin,
      spacer: spacer(),
      viewport: node,
    });
    setTail(top + node.clientHeight - contentBottom());
    return to(top, options);
  };
  const scrollToMessage = (id: string, options: ScrollOptions = {}) => {
    const message = messages.get(id);
    if (!message) {
      if (!initialized) pendingMessage = { id, options };
      return false;
    }
    pendingMessage = undefined;
    if (!initialized) {
      initialized = true;
      previousItems = items();
    }
    setPending(false);
    return scrollToElement(message, options);
  };
  const observeVisibility = () => {
    visibilitySubscribed = true;
    const node = viewport();
    if (!node || visibilityObserver || typeof IntersectionObserver === 'undefined') return;
    visibilityObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.messageId;
        if (!id) continue;
        if (entry.isIntersecting) observedVisible.add(id);
        else observedVisible.delete(id);
      }
      update();
    }, {
      root: node,
      rootMargin: `${-((props.scrollMargin ?? 0) + (props.scrollPreviousItemPeek ?? 64))}px 0px 0px 0px`,
      threshold: [0, 0.01, 0.5, 1],
    });
    for (const element of messages.values()) visibilityObserver.observe(element);
    update();
  };
  return {
    props,
    pending,
    setRoot(element: HTMLDivElement) {
      root = element;
      update();
    },
    viewport,
    setViewport,
    observeVisibility,
    content,
    setContent,
    setSpacer,
    messages,
    observeMessage(element: HTMLElement) {
      visibilityObserver?.observe(element);
    },
    unobserveMessage(element: HTMLElement) {
      visibilityObserver?.unobserve(element);
      const id = element.dataset.messageId;
      if (id) observedVisible.delete(id);
    },
    update,
    scrollToEnd,
    scrollToStart,
    scrollToMessage,
    get start() {
      return start();
    },
    get end() {
      return end();
    },
    get visibleMessageIds() {
      return visible();
    },
    get currentAnchorId() {
      return current();
    },
    onScroll() {
      const node = viewport();
      const scrolledUp = !!node && node.scrollTop < lastScrollTop - 0.5;
      if (scrolledUp && !autoscrolling) following = false;
      else if (node && !settlingJump && !anchored && props.autoScroll &&
        !getMessageScrollerScrollable({ content: content(), scrollEdgeThreshold: props.scrollEdgeThreshold ?? 8, spacer: spacer(), viewport: node }).end)
        following = true;
      update();
    },
    userScrollIntent() {
      anchored = undefined;
      following = false;
      settlingJump = false;
    },
    changed() {
      const node = viewport();
      if (!node?.isConnected || !node.clientHeight || !content()) return;
      const currentItems = items();
      if (pendingMessage) {
        const message = messages.get(pendingMessage.id);
        if (message) {
          const target = pendingMessage;
          pendingMessage = undefined;
          initialized = true;
          scrollToElement(message, target.options);
          previousItems = currentItems;
          setPending(false);
          update();
          return;
        }
        previousItems = currentItems;
        update();
        return;
      }
      if (!initialized && currentItems.length) {
        initialized = true;
        for (const item of currentItems) if (item.dataset.scrollAnchor === 'true') handledAnchors.add(item);
        if (props.defaultScrollPosition === 'last-anchor') {
          const last = currentItems.filter(element => element.dataset.scrollAnchor === 'true').at(-1);
          if (last && contentBottom() - (last.getBoundingClientRect().top - node.getBoundingClientRect().top + node.scrollTop) > node.clientHeight) scrollToElement(last, {}, true);
          else scrollToEnd();
        } else if (props.defaultScrollPosition !== 'start') scrollToEnd();
      } else {
        const appended = previousItems.length && currentItems.length > previousItems.length && currentItems[0] === previousItems[0];
        const anchors = appended ? currentItems.slice(previousItems.length).filter(element => element.dataset.scrollAnchor === 'true') : [];
        if (anchors.length > 1 && following && props.autoScroll)
          for (const anchor of anchors) handledAnchors.add(anchor);
        const newAnchor = anchors[0] ?? (currentItems.length === previousItems.length
          ? currentItems.find(element => element.dataset.scrollAnchor === 'true' && !handledAnchors.has(element))
          : undefined);
        if (newAnchor && !(anchors.length > 1 && following && props.autoScroll)) {
          scrollToElement(newAnchor, {}, true);
          for (const anchor of anchors) handledAnchors.add(anchor);
          handledAnchors.add(newAnchor);
        }
        else if (anchored?.isConnected) {
          const previousTailHeight = tailHeight;
          scrollToElement(anchored, {}, true);
          if (props.autoScroll && previousTailHeight > 0 && tailHeight === 0) scrollToEnd();
        }
        else if (props.autoScroll && following) scrollToEnd();
      }
      previousItems = currentItems;
      setPending(false);
      update();
    },
    resized() {
      if (props.autoScroll && following) {
        scrollToEnd();
      } else if (anchored?.isConnected) {
        const previousTailHeight = tailHeight;
        scrollToElement(anchored, {}, true);
        if (props.autoScroll && previousTailHeight > 0 && tailHeight === 0) scrollToEnd();
      } else update();
    },
  };
}
function useScroller() {
  const context = useContext(Context);
  if (!context) throw new Error('MessageScroller requires MessageScrollerProvider.');
  return context;
}
function Provider(props: ProviderProps) {
  const context = controller(props);
  return <Context value={context}>{props.children}</Context>;
}
function Root(props: ComponentProps<'div'>) {
  const context = useScroller();
  return <div {...omitProps(props, ['children'])} ref={context.setRoot} data-pending-scroll={context.pending() ? '' : undefined}>{props.children}</div>;
}
function Viewport(
  props: ComponentProps<'div'> & {
    preserveScrollOnPrepend?: boolean;
  },
) {
  const context = useScroller();
  let capturePrependAnchor = () => {};
  createEffect(
    () => context.viewport(),
    (node) => {
      if (!node) return;
      let beforeHeight = node.scrollHeight;
      let beforeFirst = node.querySelector('[data-message-id]');
      let prependAnchor: { element: HTMLElement; viewportTop: number } | undefined;
      capturePrependAnchor = () => {
        const viewportRect = node.getBoundingClientRect();
        const visible = Array.from(node.querySelectorAll<HTMLElement>('[data-message-id]')).find((item) => {
          const rect = item.getBoundingClientRect();
          return rect.bottom > viewportRect.top && rect.top < viewportRect.bottom;
        });
        prependAnchor = visible
          ? { element: visible, viewportTop: visible.getBoundingClientRect().top - viewportRect.top }
          : undefined;
      };
      const observer = new MutationObserver(() => {
        const first = node.querySelector('[data-message-id]');
        if (
          props.preserveScrollOnPrepend !== false &&
          beforeFirst &&
          first !== beforeFirst &&
          first &&
          first.compareDocumentPosition(beforeFirst) & Node.DOCUMENT_POSITION_FOLLOWING
        ) {
          const anchor = prependAnchor?.element.isConnected ? prependAnchor : undefined;
          if (anchor) {
            const nextTop = anchor.element.getBoundingClientRect().top - node.getBoundingClientRect().top;
            const delta = nextTop - anchor.viewportTop;
            if (Math.abs(delta) > 0.5) node.scrollTop += delta;
          } else node.scrollTop += node.scrollHeight - beforeHeight;
        }
        beforeFirst = first;
        beforeHeight = node.scrollHeight;
        context.changed();
        capturePrependAnchor();
      });
      observer.observe(node, { childList: true, subtree: true, characterData: true });
      let resizeFrame = 0;
      const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => context.resized());
      });
      resize?.observe(node);
      if (context.content()) resize?.observe(context.content()!);
      context.changed();
      capturePrependAnchor();
      return () => {
        capturePrependAnchor = () => {};
        observer.disconnect();
        resize?.disconnect();
        cancelAnimationFrame(resizeFrame);
      };
    },
  );
  return (
    <div
      {...omitProps(props, ['preserveScrollOnPrepend'])}
      role={props.role ?? 'region'}
      aria-label={props['aria-label'] ?? 'Messages'}
      tabindex={props.tabindex ?? 0}
      data-pending-scroll={context.pending() ? '' : undefined}
      ref={context.setViewport}
      onWheel={context.userScrollIntent}
      onTouchMove={context.userScrollIntent}
      onKeyDown={(event) => {
        if (['ArrowDown', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp', ' '].includes(event.key))
          context.userScrollIntent();
        if (typeof props.onKeyDown === 'function') props.onKeyDown(event);
      }}
      onScroll={(event) => {
        context.onScroll();
        capturePrependAnchor();
        if (typeof props.onScroll === 'function') props.onScroll(event);
      }}
    />
  );
}
function Content(
  props: ComponentProps<'div'> & {
    spacerClassName?: string;
  },
) {
  const context = useScroller();
  return <div {...omitProps(props, ['spacerClassName', 'children'])} ref={context.setContent} role={props.role ?? 'log'} aria-relevant={props['aria-relevant'] ?? 'additions'}>{props.children}<div ref={context.setSpacer} aria-hidden="true" data-message-scroller-spacer="" hidden class={props.spacerClassName}/></div>;
}
function Item(
  props: ComponentProps<'div'> & {
    messageId?: string;
    scrollAnchor?: boolean;
  },
) {
  const context = useScroller();
  const [element, setElement] = createSignal<HTMLDivElement | null>(null);
  createEffect(() => [element(), props.messageId] as const, ([node, id]) => {
    if (!node || !id) return;
    context.messages.set(id, node);
    context.observeMessage(node);
    queueMicrotask(context.changed);
    return () => {
      if (context.messages.get(id) === node) context.messages.delete(id);
      context.unobserveMessage(node);
    };
  });
  return (
    <div
      {...omitProps(props, ['messageId', 'scrollAnchor'])}
      data-message-id={dataValue(props.messageId)}
      data-scroll-anchor={dataValue(!!props.scrollAnchor)}
      ref={setElement}
    />
  );
}
function Button(
  props: ComponentProps<typeof BaseButton> & {
    direction?: 'start' | 'end';
    behavior?: ScrollBehavior;
  },
) {
  const context = useScroller();
  const direction = () => props.direction ?? 'end';
  return (
    <BaseButton
      {...omitProps(props, ['direction', 'behavior'])}
      data-active={dataValue(direction() === 'end' ? context.end : context.start)}
      inert={!(direction() === 'end' ? context.end : context.start)}
      tabIndex={(direction() === 'end' ? context.end : context.start) ? props.tabIndex : -1}
      onClick={(event: MouseEvent & { currentTarget: HTMLButtonElement }) => {
        if (!(direction() === 'end' ? context.end : context.start)) return;
        if (typeof props.onClick === 'function') props.onClick(event);
        if (event.defaultPrevented) return;
        event.currentTarget.blur();
        if (direction() === 'end') context.scrollToEnd({ behavior: props.behavior ?? 'smooth' });
        else context.scrollToStart({ behavior: props.behavior ?? 'smooth' });
      }}
    />
  );
}
export function useMessageScroller() {
  const context = useScroller();
  return {
    scrollToEnd: context.scrollToEnd,
    scrollToStart: context.scrollToStart,
    scrollToMessage: context.scrollToMessage,
  };
}
export function useMessageScrollerScrollable() {
  const context = useScroller();
  return {
    get start() {
      return context.start;
    },
    get end() {
      return context.end;
    },
  };
}
export function useMessageScrollerVisibility() {
  const context = useScroller();
  queueMicrotask(context.observeVisibility);
  return {
    get currentAnchorId() {
      return context.currentAnchorId;
    },
    get visibleMessageIds() {
      return context.visibleMessageIds;
    },
  };
}
export const MessageScroller = { Provider, Root, Viewport, Content, Item, Button };
