import {
  createContext,
  createSignal,
  createEffect,
  createMemo,
  createUniqueId,
  useContext,
  Show,
  onCleanup,
  untrack,
} from 'solid-js';
import { Portal, isServer, type JSX } from '@solidjs/web';
import {
  computePosition,
  autoUpdate,
  offset,
  flip,
  shift,
  size,
  arrow as positionArrow,
  type Placement,
  type VirtualElement,
} from '@floating-ui/dom';
import {
  renderElement,
  omitProps,
  createControllable,
  mergeProps,
  assignRef,
  focusableElements,
  activeElement,
  contains,
  getTarget,
  useTimeout,
  useAnimationFrame,
  useDirection,
  eventDetails,
  acquireScrollLock,
  type BaseProps,
  type Ref,
} from './core';
import { Separator } from './structure';

export class PopupHandle<Payload = unknown> {
  private readContext: () => PopupContext | undefined;
  private writeContext: (context: PopupContext | undefined) => void;
  private triggers = new Map<string, { element: HTMLElement; payload: Payload | undefined }>();
  constructor() {
    const [context, setContext] = createSignal<PopupContext | undefined>(undefined);
    this.readContext = context;
    this.writeContext = (value) => {
      setContext(value);
    };
  }
  /** Calls made without an attached root have no effect. */
  open(triggerId: string | null = null) {
    const context = this.readContext();
    if (!context) return;
    const trigger = triggerId === null ? undefined : this.triggers.get(triggerId);
    if (trigger) {
      context.setTrigger(trigger.element);
      context.setPayload(trigger.payload);
    }
    context.setOpen(true, undefined, 'imperative-action');
  }
  openWithPayload(payload: Payload) {
    const context = this.readContext();
    if (context) {
      context.setPayload(payload);
      context.setOpen(true, undefined, 'imperative-action');
    }
  }
  close() {
    this.readContext()?.setOpen(false, undefined, 'imperative-action');
  }
  get isOpen() {
    return this.readContext()?.open() ?? false;
  }
  /** @internal */ get context() {
    return this.readContext();
  }
  /** @internal */ attach(context: PopupContext) {
    this.writeContext(context);
    if (context.kind === 'popover' && context.open() && !context.trigger()) {
      const first = this.triggers.values().next().value;
      if (first) context.setTrigger(first.element);
    }
    return () => {
      if (this.readContext() === context) this.writeContext(undefined);
    };
  }
  /** @internal */ register(element: HTMLElement, payload?: Payload) {
    if (!element.id) element.id = `solid-popup-trigger-${++detachedTriggerId}`;
    this.triggers.set(element.id, { element, payload });
    const context = this.readContext();
    if (context?.kind === 'popover' && context.open() && !context.trigger())
      context.setTrigger(element);
    return () => this.triggers.delete(element.id);
  }
  /** @internal */ getOpen = () => this.isOpen;
  /** @internal */ setOpen = (value: boolean, event?: Event, reason?: string) => {
    this.readContext()?.setOpen(value, event, reason);
  };
  /** @internal */ activate = (element: HTMLElement, payload?: Payload) => {
    const context = this.readContext();
    context?.setTrigger(element);
    context?.setPayload(payload);
  };
}
let detachedTriggerId = 0;
export function createPopupHandle<Payload = unknown>() {
  return new PopupHandle<Payload>();
}
interface PopupContext {
  kind: string;
  props: BaseProps;
  open: () => boolean;
  present: () => boolean;
  transition: () => 'starting' | 'ending' | undefined;
  instant: () => 'delay' | 'focus' | undefined;
  setInstant: (value: 'delay' | 'focus' | undefined) => void;
  forceUnmount: () => void;
  setOpen: (value: boolean, event?: Event, reason?: string) => boolean;
  trigger: () => HTMLElement | undefined;
  setTrigger: (element: HTMLElement) => void;
  popup: () => HTMLElement | undefined;
  setPopup: (element: HTMLElement) => void;
  arrow: () => HTMLElement | undefined;
  setArrow: (element: HTMLElement) => void;
  arrowStyles: () => Record<string, string>;
  setArrowStyles: (styles: Record<string, string>) => void;
  point: () => VirtualElement | undefined;
  setPoint: (point: VirtualElement | undefined) => void;
  title: () => string | undefined;
  setTitle: (id: string | undefined) => void;
  description: () => string | undefined;
  setDescription: (id: string | undefined) => void;
  placement: () => Placement;
  setPlacement: (value: Placement) => void;
  id: string;
  parent?: PopupContext;
  payload: () => unknown;
  setPayload: (value: unknown) => void;
  hoverTimer: ReturnType<typeof useTimeout>;
  menuFocusEdge?: 'first' | 'last';
  openReason?: string;
  openMethod?: string;
  safePolygonCleanup?: () => void;
  closeCount: () => number;
  setCloseCount: (value: (count: number) => number) => void;
  portalKeepMounted?: boolean;
  allowPropagation?: boolean;
  drawer?: DrawerState;
}
const Popup = createContext<PopupContext | null>(null);
const openPopupContexts = new Set<PopupContext>();
function isInDescendantPopup(ancestor: PopupContext, target: Node) {
  for (const candidate of openPopupContexts) {
    for (let parent = candidate.parent; parent; parent = parent.parent)
      if (parent === ancestor && contains(candidate.popup(), target)) return true;
  }
  return false;
}
interface TooltipGroup {
  props: BaseProps;
  active?: PopupContext;
  resetTimer?: ReturnType<typeof setTimeout>;
  hasProvider: boolean;
}
const TooltipOptions = createContext<TooltipGroup>({ props: {}, hasProvider: false });
const layers = new WeakMap<Document, HTMLElement[]>();
function popupRole(kind: string) {
  return kind === 'menu' || kind === 'context-menu'
    ? 'menu'
    : kind === 'tooltip'
      ? 'tooltip'
      : kind === 'alert-dialog'
        ? 'alertdialog'
        : 'dialog';
}
function createPopupRoot(kind: string) {
  return function PopupRoot(props: BaseProps) {
    const animationsDisabled = () =>
      (globalThis as typeof globalThis & { BASE_UI_ANIMATIONS_DISABLED?: boolean })
        .BASE_UI_ANIMATIONS_DISABLED === true;
    const parent = useContext(Popup) ?? undefined;
    const [localOpen, setLocalOpen] = createSignal(!!untrack(() => props.defaultOpen && !props.disabled));
    const open = () => !props.disabled && (props.open !== undefined ? !!props.open : localOpen());
    const [present, setPresent] = createSignal(untrack(open));
    const [transition, setTransition] = createSignal<'starting' | 'ending' | undefined>(undefined);
    const [instant, setInstant] = createSignal<'delay' | 'focus' | undefined>(undefined);
    let manualUnmount = false;
    const setOpen = (next: boolean, event?: Event, reason?: string) => {
      if (next === open()) return false;
      let preventUnmount = false;
      const details = Object.assign(eventDetails(event, reason), {
        ...(kind === 'popover'
          ? { trigger: reason === 'outside-press' ? undefined : context.trigger() }
          : {}),
        preventUnmountOnClose() {
          preventUnmount = true;
        },
      });
      props.onOpenChange?.(next, details);
      if (details.isCanceled) return false;
      manualUnmount = !next && (manualUnmount || preventUnmount);
      context.allowPropagation = details.isPropagationAllowed;
      context.openReason = reason;
      if (!next && kind === 'popover') context.safePolygonCleanup?.();
      if (kind === 'tooltip') {
        if (!next) setTooltipInstant(undefined);
        else if (reason === 'trigger-focus') setTooltipInstant('focus');
      }
      if ((kind === 'tooltip' || kind === 'popover') && next && props.open === undefined) {
        setPresent(true);
        setTransition('starting');
      }
      if ((kind === 'tooltip' || kind === 'popover') && !next && props.open === undefined &&
        !manualUnmount && animationsDisabled()) {
        const animations = context.popup()?.getAnimations?.({ subtree: true }) ?? [];
        if (animations.length === 0) {
          setPresent(false);
          setTransition(undefined);
        }
      }
      if (props.open === undefined) setLocalOpen(next);
      return true;
    };
    const handle = props.handle as PopupHandle | undefined;
    const [trigger, setTrigger] = createSignal<HTMLElement | undefined>(undefined);
    const [popup, setPopup] = createSignal<HTMLElement | undefined>(undefined);
    const setTooltipInstant = (value: 'delay' | 'focus' | undefined) => {
      setInstant(value);
      // Solid 2 can reuse a Show child node after close. Keep this attribute
      // current on the reused node as well as on a new mount.
      if (kind === 'tooltip') {
        const node = popup();
        if (value) node?.setAttribute('data-instant', value);
        else node?.removeAttribute('data-instant');
      }
    };
    const [arrow, setArrow] = createSignal<HTMLElement | undefined>(undefined);
    const [arrowStyles, setArrowStyles] = createSignal<Record<string, string>>({
      position: 'absolute',
    });
    const [point, setPoint] = createSignal<VirtualElement | undefined>(undefined);
    const [title, setTitle] = createSignal<string | undefined>(undefined);
    const [description, setDescription] = createSignal<string | undefined>(undefined);
    const [placement, setPlacement] = createSignal<Placement>('bottom');
    const [payload, setPayload] = createSignal<unknown>(undefined);
    const [openReason, setOpenReason] = createSignal<string | undefined>(undefined);
    const [closeCount, setCloseCount] = createSignal(0);
    const context: PopupContext = {
      kind,
      props,
      open,
      present,
      transition,
      instant,
      setInstant: setTooltipInstant,
      forceUnmount: () => {
        manualUnmount = false;
        setPresent(false);
        setTransition(undefined);
      },
      setOpen,
      trigger,
      setTrigger,
      popup,
      setPopup,
      arrow,
      setArrow,
      arrowStyles,
      setArrowStyles,
      point,
      setPoint,
      title,
      setTitle,
      description,
      setDescription,
      placement,
      setPlacement,
      id: createUniqueId(),
      parent,
      payload,
      setPayload: (value) => {
        setPayload(() => value);
      },
      hoverTimer: useTimeout(),
      get openReason() {
        return openReason();
      },
      set openReason(value: string | undefined) {
        setOpenReason(value);
      },
      closeCount,
      setCloseCount,
    };
    if (kind === 'drawer') context.drawer = createDrawerState(context);
    createEffect(open, (isOpen) => {
      if (isOpen) openPopupContexts.add(context);
      return () => openPopupContexts.delete(context);
    });
    createEffect(
      () => handle,
      (value) => value?.attach(context),
    );
    const frame = useAnimationFrame();
    if (kind === 'tooltip')
      createEffect(
        () => !!props.disabled,
        (disabled) => {
          if (!disabled) return;
          setLocalOpen(false);
          setPresent(false);
        },
      );
    createEffect(open, (next) => {
      if (next) {
        if (kind === 'popover') manualUnmount = false;
        setPresent(true);
        setTransition('starting');
      } else if (present()) {
        if ((kind === 'tooltip' || kind === 'popover') && !manualUnmount && animationsDisabled()) {
          setPresent(false);
          setTransition(undefined);
          props.onOpenChangeComplete?.(false);
        } else setTransition('ending');
      }
    });
    createEffect(
      () => ({ open: open(), node: popup() }),
      ({ open, node }) => {
        if (!node) return;
        if ((kind === 'tooltip' || kind === 'popover') && animationsDisabled()) {
          if (open) {
            setTransition(undefined);
            props.onOpenChangeComplete?.(true);
          }
          return;
        }
        let canceled = false;
        frame.request(() => {
          if (open) setTransition(undefined);
          frame.request(() => {
            // Dialog popups complete from their own transition. Descendant
            // scroll-driven animations can run for the life of the document.
            const animations = (['dialog', 'alert-dialog', 'drawer'].includes(kind)
              ? node.getAnimations?.()
              : node.getAnimations?.({ subtree: true })) ?? [];
            const finiteAnimations = animations.filter((animation) => {
              const timing = animation.effect?.getTiming();
              return timing?.duration !== Infinity && timing?.iterations !== Infinity;
            });
            Promise.allSettled(finiteAnimations.map((animation) => animation.finished)).then(() => {
              if (canceled) return;
              if (!open && !manualUnmount) setPresent(false);
              setTransition(undefined);
              props.onOpenChangeComplete?.(open);
            });
          });
        });
        return () => {
          canceled = true;
          frame.cancel();
        };
      },
    );
    createEffect(
      () => props.actionsRef,
      (ref) => {
        assignRef(ref, {
          close: () => setOpen(false, undefined, 'imperative-action'),
          unmount: () => {
            manualUnmount = false;
            setPresent(false);
          },
        });
      },
    );
    if (kind === 'popover') {
      createEffect(
        () => ({ open: open(), present: present(), node: popup() }),
        ({ open: isOpen, present: isPresent, node }) => {
          if (!isOpen || !isPresent || !node) return;
          const document = node.ownerDocument;
          let pressStartedInside = false;
          const dismiss = (event: Event) => {
            const target = getTarget(event) as Node;
            const inside = contains(node, target) || contains(context.trigger(), target) ||
              isInDescendantPopup(context, target);
            if (event.type === 'pointerdown') pressStartedInside = inside;
            if (event.type === 'click' && pressStartedInside) {
              pressStartedInside = false;
              return;
            }
            if (context.props.disablePointerDismissal || inside) return;
            context.setOpen(false, event, 'outside-press');
          };
          document.addEventListener('pointerdown', dismiss, true);
          document.addEventListener('click', dismiss, true);
          return () => {
            document.removeEventListener('pointerdown', dismiss, true);
            document.removeEventListener('click', dismiss, true);
          };
        },
      );
    }
    return (
      <Popup value={context}>
        <PopupChildren>{props.children}</PopupChildren>
      </Popup>
    );
  };
}
function PopupChildren(props: BaseProps) {
  const context = useContext(Popup)!;
  const content = props.children;
  return typeof content === 'function'
    ? (content as (state: { payload: unknown }) => JSX.Element)({
        get payload() {
          return context.payload();
        },
      })
    : content;
}
function PopupTrigger(props: BaseProps, popoverTrigger = false) {
  const context = useContext(Popup);
  const handle = props.handle as PopupHandle | undefined;
  const currentContext = () => context ?? handle?.context;
  const tooltipGroup = useContext(TooltipOptions);
  const timer = context?.hoverTimer ?? useTimeout();
  let nestedTooltipHovered = false;
  let lastPointerType: string | undefined;
  let triggerElement: HTMLElement | undefined;
  let hovered = false;
  let hoverStartedAt = 0;
  const [pressed, setPressed] = createSignal(false);
  const open = () => context?.open() ?? handle?.getOpen() ?? false;
  const activeOpen = () => currentContext()?.kind === 'popover'
    ? open() && currentContext()?.trigger() === triggerElement
    : open();
  const disabled = () => !!(props.disabled ?? currentContext()?.props.disabled);
  const setOpen = (next: boolean, event: Event, reason: string) => {
    if (next && currentContext()?.kind === 'tooltip' && currentContext()?.props.disabled) return;
    if (!disabled() || !next) (context?.setOpen ?? handle?.setOpen)?.(next, event, reason);
  };
  const hover = () => currentContext()?.kind === 'tooltip' ||
    currentContext()?.kind === 'preview-card' ||
    (currentContext()?.kind === 'popover' && props.openOnHover === true);
  const trackCursor = (event: MouseEvent | PointerEvent) => {
    const activeContext = currentContext();
    if (activeContext?.kind !== 'tooltip') return;
    const axis = activeContext.props.trackCursorAxis;
    if (!axis || axis === 'none') {
      activeContext.setPoint(undefined);
      return;
    }
    const trigger = event.currentTarget as HTMLElement;
    const rect = trigger.getBoundingClientRect();
    const x = axis === 'x' || axis === 'both' ? event.clientX : rect.x;
    const y = axis === 'y' || axis === 'both' ? event.clientY : rect.y;
    const width = axis === 'x' || axis === 'both' ? 0 : rect.width;
    const height = axis === 'y' || axis === 'both' ? 0 : rect.height;
    activeContext.setPoint({
      contextElement: trigger,
      getBoundingClientRect: () => new DOMRect(x, y, width, height),
    });
  };
  const show = (event: Event) => {
    if (hover() && !disabled() && lastPointerType !== 'touch') {
      if (event instanceof MouseEvent ||
        (typeof PointerEvent !== 'undefined' && event instanceof PointerEvent))
        trackCursor(event);
      const activeContext = currentContext();
      const hoveredTrigger = event.currentTarget as HTMLElement;
      if (activeContext?.kind === 'popover') {
        if (activeContext.openMethod === 'touch' && activeContext.openReason === 'trigger-press')
          return;
        if (hovered && (activeContext.open() || timer.isStarted())) return;
        hovered = true;
        hoverStartedAt = Date.now();
      }
      if (!context) handle?.activate(hoveredTrigger, props.payload);
      const grouped = activeContext?.kind === 'tooltip' && tooltipGroup.hasProvider;
      if (activeContext?.kind === 'tooltip' && tooltipGroup.active !== activeContext)
        activeContext.setInstant(grouped && tooltipGroup.active ? 'delay' : undefined);
      const delay = grouped && tooltipGroup.active
        ? 0
        : props.delay ?? activeContext?.props.delay ?? tooltipGroup.props.delay ??
          (activeContext?.kind === 'popover' ? 300 : 600);
      const openNow = () => {
        if (grouped && activeContext) {
          clearTimeout(tooltipGroup.resetTimer);
          const prior = tooltipGroup.active;
          tooltipGroup.active = activeContext;
          if (prior && prior !== activeContext) {
            prior.setOpen(false, event, 'none');
            prior.forceUnmount();
          }
        }
        if (activeContext?.kind === 'popover') {
          if (activeContext.open() && activeContext.trigger() === hoveredTrigger &&
            activeContext.openReason === 'trigger-press') return;
          hoverStartedAt = Date.now();
          activeContext.setTrigger(hoveredTrigger);
          activeContext.setPayload(props.payload);
          activeContext.openReason = 'trigger-hover';
          setPressed(false);
        }
        setOpen(true, event, 'trigger-hover');
      };
      if (delay === 0) openNow();
      else timer.start(delay, openNow);
    }
  };
  const close = (event: Event) => {
    if (hover()) {
      timer.clear();
      const activeContext = currentContext();
      if (activeContext?.kind === 'popover') {
        hovered = false;
        if (activeContext.openReason === 'trigger-press' ||
          activeContext.trigger() !== event.currentTarget) return;
        const positioner = activeContext.popup()?.parentElement;
        if (event instanceof MouseEvent && positioner &&
          event.relatedTarget instanceof Node && positioner.contains(event.relatedTarget)) {
          activeContext.safePolygonCleanup?.();
          const trigger = event.currentTarget as HTMLElement;
          const move = (moveEvent: MouseEvent) => {
            const triggerRect = trigger.getBoundingClientRect();
            const popupRect = positioner.getBoundingClientRect();
            const inTravelArea =
              moveEvent.clientX >= Math.min(triggerRect.left, popupRect.left) &&
              moveEvent.clientX <= Math.max(triggerRect.right, popupRect.right) &&
              moveEvent.clientY >= Math.min(triggerRect.top, popupRect.top) &&
              moveEvent.clientY <= Math.max(triggerRect.bottom, popupRect.bottom);
            if (!inTravelArea && !positioner.contains(getTarget(moveEvent) as Node)) {
              activeContext.safePolygonCleanup?.();
              activeContext.setOpen(false, moveEvent, 'trigger-hover');
            }
          };
          const ownerDocument = (event.currentTarget as HTMLElement).ownerDocument;
          ownerDocument.addEventListener('mousemove', move);
          activeContext.safePolygonCleanup = () => {
            ownerDocument.removeEventListener('mousemove', move);
            activeContext.safePolygonCleanup = undefined;
          };
          return;
        }
      }
      if (activeContext?.kind === 'tooltip') activeContext.setInstant(undefined);
      if (activeContext?.kind === 'tooltip' && !activeContext.props.disableHoverablePopup &&
        event instanceof MouseEvent) {
        const popup = activeContext.popup();
        const related = event.relatedTarget as Node | null;
        const rect = popup?.getBoundingClientRect();
        if ((popup && related && popup.contains(related)) ||
          (!related && rect && (event.clientX !== 0 || event.clientY !== 0) &&
            event.clientX >= rect.left && event.clientX <= rect.right &&
            event.clientY >= rect.top && event.clientY <= rect.bottom)) return;
      }
      const delay = activeContext?.kind === 'tooltip'
        ? props.closeDelay ?? tooltipGroup.props.closeDelay ?? 0
        : props.closeDelay ?? activeContext?.props.closeDelay ??
          (activeContext?.kind === 'popover' ? 0 : 150);
      const closeNow = () => {
        setOpen(false, event, 'trigger-hover');
        if (activeContext?.kind === 'tooltip' && tooltipGroup.active === activeContext) {
          clearTimeout(tooltipGroup.resetTimer);
          tooltipGroup.resetTimer = setTimeout(() => {
            if (tooltipGroup.active === activeContext) tooltipGroup.active = undefined;
          }, tooltipGroup.props.timeout ?? 400);
        }
      };
      if (delay === 0) closeNow();
      else timer.start(delay, closeNow);
    }
  };
  const element = renderElement(
    context?.kind === 'preview-card' ? 'a' : 'button',
    currentContext()?.kind === 'popover'
      ? omitProps(props, props.nativeButton === false ? ['openOnHover', 'disabled'] : ['openOnHover'])
      : props,
    {
      get open() {
        return activeOpen();
      },
      get popupOpen() {
        return activeOpen();
      },
      get disabled() {
        return disabled();
      },
    },
    {
      ref: (element: HTMLElement) => {
        triggerElement = element;
        if (context?.kind !== 'popover' || !context.trigger()) context?.setTrigger(element);
        handle?.register(element, props.payload);
      },
      type: 'button',
      get role() {
        return currentContext()?.kind === 'popover' && props.nativeButton === false
          ? 'button'
          : undefined;
      },
      get tabIndex() {
        return currentContext()?.kind === 'popover' && props.nativeButton === false
          ? disabled() ? -1 : 0
          : undefined;
      },
      get disabled() {
        return currentContext()?.kind === 'popover' && props.nativeButton === false
          ? undefined
          : disabled();
      },
      get 'aria-disabled'() {
        return currentContext()?.kind === 'popover' && props.nativeButton === false && disabled()
          ? true
          : undefined;
      },
      get 'data-pressed'() {
        return currentContext()?.kind === 'popover' && activeOpen() && pressed()
          ? ''
          : undefined;
      },
      get 'data-trigger-disabled'() {
        return disabled() && currentContext()?.kind === 'tooltip' ? '' : undefined;
      },
      get 'data-base-ui-tooltip-trigger'() {
        return !disabled() && currentContext()?.kind === 'tooltip' ? '' : undefined;
      },
      get 'aria-haspopup'() {
        return context?.kind === 'tooltip' ? undefined : popupRole(context?.kind ?? 'dialog');
      },
      get 'aria-expanded'() {
        return context?.kind === 'tooltip' ? undefined : activeOpen();
      },
      get 'aria-controls'() {
        return activeOpen() && context
          ? context.kind === 'popover' ? context.popup()?.id ?? context.id : context.id
          : undefined;
      },
      get 'aria-describedby'() {
        return context?.kind === 'tooltip' && open() ? context.id : undefined;
      },
      onClick(event: MouseEvent) {
        const wasActive = activeOpen();
        if (context?.kind === 'popover') context.setTrigger(event.currentTarget as HTMLElement);
        context?.setPayload(props.payload);
        handle?.activate(event.currentTarget as HTMLElement, props.payload);
        if (currentContext()?.kind === 'popover') {
          const activeContext = currentContext()!;
          timer.clear();
          if (wasActive) {
            if (activeContext.openReason === 'trigger-hover' &&
              Date.now() - hoverStartedAt < 500) {
              activeContext.openReason = 'trigger-press';
              activeContext.safePolygonCleanup?.();
              setPressed(true);
            } else {
              setPressed(false);
              setOpen(false, event, 'trigger-press');
            }
          } else {
            activeContext.openMethod = lastPointerType;
            setPressed(true);
            setOpen(true, event, 'trigger-press');
          }
          return;
        }
        if (hover()) {
          if (currentContext()?.kind !== 'tooltip' || props.closeOnClick !== false) {
            timer.clear();
            setOpen(false, event, 'trigger-press');
          }
        }
        else setOpen(!open(), event, 'trigger-press');
      },
      onPointerDown(event: PointerEvent) {
        lastPointerType = event.pointerType || lastPointerType;
        trackCursor(event);
        if (currentContext()?.kind === 'tooltip' && props.closeOnClick !== false) timer.clear();
      },
      onPointerEnter(event: PointerEvent) {
        lastPointerType = event.pointerType || lastPointerType;
        show(event);
      },
      onPointerLeave: close,
      onMouseMove(event: MouseEvent) {
        trackCursor(event);
        if (currentContext()?.kind === 'popover' && props.openOnHover && !hovered) show(event);
      },
      onMouseOver(event: MouseEvent) {
        if (currentContext()?.kind !== 'tooltip') return;
        const outer = event.currentTarget as Element;
        const path = event.composedPath?.() ?? [];
        const target = (path.find((entry) => entry instanceof Element) ?? getTarget(event)) as Element | null;
        const nested = [target, ...path]
          .filter((entry): entry is Element => entry instanceof Element)
          .map((entry) => entry.closest('[data-base-ui-tooltip-trigger]'))
          .find((entry) => entry && entry !== outer);
        if (nested && nested !== outer && outer.contains(nested)) {
          nestedTooltipHovered = true;
          timer.clear();
          if (currentContext()?.openReason === 'trigger-hover' && open())
            setOpen(false, event, 'trigger-hover');
        } else if (nestedTooltipHovered && outer.contains(target)) {
          nestedTooltipHovered = false;
          if (lastPointerType !== 'touch') show(event);
        }
      },
      onMouseOut(event: MouseEvent) {
        if (currentContext()?.kind !== 'tooltip') return;
        const trigger = event.currentTarget as Element;
        if (!event.relatedTarget || !trigger.contains(event.relatedTarget as Node)) close(event);
      },
      onMouseEnter(event: MouseEvent) {
        if ((currentContext()?.kind === 'tooltip' && !nestedTooltipHovered) ||
          (currentContext()?.kind === 'popover' && props.openOnHover)) show(event);
      },
      onMouseLeave(event: MouseEvent) {
        if (currentContext()?.kind === 'tooltip') {
          nestedTooltipHovered = false;
          lastPointerType = undefined;
          close(event);
        }
        if (currentContext()?.kind === 'popover' && props.openOnHover) close(event);
      },
      onFocus(event: FocusEvent) {
        if (hover() && currentContext()?.kind !== 'popover') {
          timer.clear();
          setOpen(true, event, 'trigger-focus');
        }
      },
      onBlur(event: FocusEvent) {
        if (hover() && currentContext()?.kind !== 'popover') {
          timer.clear();
          setOpen(false, event, 'focus-out');
        }
      },
      onKeyDown(event: KeyboardEvent) {
        if (
          !props.disabled &&
          ['menu', 'context-menu'].includes(context?.kind ?? '') &&
          ['ArrowDown', 'ArrowUp'].includes(event.key)
        ) {
          event.preventDefault();
          const edge = event.key === 'ArrowUp' ? 'last' : 'first';
          context!.menuFocusEdge = edge;
          setOpen(true, event, 'trigger-press');
          const popup = context?.popup();
          if (open() && popup) {
            const items = menuItems(popup);
            (edge === 'last' ? items.at(-1) : items[0])?.focus();
          }
        }
        if (event.key === 'Escape') setOpen(false, event, 'escape-key');
        if (currentContext()?.kind === 'popover' && props.nativeButton === false &&
          event.key === 'Enter') {
          event.preventDefault();
          (event.currentTarget as HTMLElement).click();
        }
      },
      onKeyUp(event: KeyboardEvent) {
        if (currentContext()?.kind === 'popover' && props.nativeButton === false &&
          event.key === ' ') {
          event.preventDefault();
          (event.currentTarget as HTMLElement).click();
        }
      },
    },
  );
  if (context?.kind !== 'menu' && context?.kind !== 'popover' && !(handle && popoverTrigger))
    return element;

  const focusGuardStyle: JSX.CSSProperties = {
    'clip-path': 'inset(50%)',
    overflow: 'hidden',
    'white-space': 'nowrap',
    border: '0',
    padding: '0',
    width: '1px',
    height: '1px',
    margin: '0',
    position: 'fixed',
    top: '0',
    left: '0',
  };
  const focusMenu = () => {
    const activeContext = currentContext();
    const popup = activeContext?.popup();
    (popup && (activeContext?.kind === 'popover'
      ? focusableElements(popup)[0] ?? popup
      : menuItems(popup)[0] ?? popup))?.focus();
  };
  const focusBeforeTrigger = (event: FocusEvent) => {
    const activeContext = currentContext();
    activeContext?.setOpen(false, event, 'focus-out');
    const trigger = activeContext?.trigger();
    if (!trigger) return;
    const focusable = focusableElements(trigger.ownerDocument.body);
    focusable[focusable.indexOf(trigger) - 1]?.focus();
  };
  const focusAfterTrigger = (event: FocusEvent) => {
    const activeContext = currentContext();
    if (activeContext?.kind !== 'popover') {
      focusMenu();
      return;
    }
    if (contains(activeContext.popup(), event.relatedTarget as Node)) {
      activeContext.trigger()?.focus();
      return;
    }
    focusMenu();
  };
  const focusManagerModal = () => currentContext()?.kind === 'popover' &&
    currentContext()?.props.modal !== false && (currentContext()?.closeCount() ?? 0) > 0;
  const showTriggerGuard = () => currentContext()?.kind === 'popover'
    ? activeOpen() && !focusManagerModal()
    : open();
  return (
    <>
      <Show when={showTriggerGuard()}>
        <span
          aria-hidden="true"
          tabindex={0}
          data-base-ui-focus-guard=""
          style={focusGuardStyle}
          onFocus={focusBeforeTrigger}
        />
      </Show>
      {element}
      <Show when={showTriggerGuard()}>
        <span
          aria-hidden="true"
          tabindex={0}
          data-base-ui-focus-guard=""
          style={focusGuardStyle}
          onFocus={focusAfterTrigger}
        />
      </Show>
    </>
  );
}
function PopupPortal(props: BaseProps) {
  const context = useContext(Popup)!;
  if (context.kind === 'popover') context.portalKeepMounted = !!props.keepMounted;
  const children = props.children;
  const portalContent = (
    <>
      <Show
        when={
          context.present() &&
          (context.props.modal ?? ['dialog', 'alert-dialog', 'drawer'].includes(context.kind)) &&
          ['dialog', 'alert-dialog', 'drawer'].includes(context.kind)
        }
      >
        <div
          role="presentation"
          data-base-ui-inert=""
          inert={!context.open() || undefined}
          style={{
            position: 'fixed',
            inset: 0,
            'user-select': 'none',
            '-webkit-user-select': 'none',
          }}
        />
      </Show>
      {children}
    </>
  );
  return (
    <Show when={context.present() || props.keepMounted}>
      <Portal mount={props.container?.current ?? props.container ?? props.mount}>
        {renderElement(
          'div',
          omitProps(props, ['container', 'mount', 'keepMounted', 'children']),
          {},
          { 'data-base-ui-portal': '', children: portalContent },
        )}
      </Portal>
    </Show>
  );
}
function menuItems(popup: HTMLElement) {
  return Array.from(
    popup.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])'),
  ).filter((item) => item.closest('[role="menu"]') === popup);
}
function PopupBackdrop(props: BaseProps) {
  const context = useContext(Popup)!;
  return (
    <Show when={context.present() || props.keepMounted}>
      {renderElement(
        'div',
        props,
        {
          get open() {
            return context.open();
          },
          get closed() {
            return !context.open();
          },
          get startingStyle() {
            return context.transition() === 'starting';
          },
          get endingStyle() {
            return context.transition() === 'ending';
          },
        },
        {
          'aria-hidden': true,
          get hidden() {
            return !context.present();
          },
          onPointerDown(event: PointerEvent) {
            if (
              context.kind !== 'popover' &&
              !context.props.disablePointerDismissal &&
              context.kind !== 'alert-dialog' &&
              event.target === event.currentTarget
            )
              context.setOpen(false, event, 'outside-press');
          },
        },
      )}
    </Show>
  );
}
function PopupPositioner(props: BaseProps) {
  const context = useContext(Popup)!;
  const [element, setElement] = createSignal<HTMLElement | undefined>(undefined);
  const openCycle = createMemo((previous: { open: boolean; cycle: number } | undefined) => {
    const open = context.open();
    return {
      open,
      cycle: open && !previous?.open ? (previous?.cycle ?? 0) + 1 : (previous?.cycle ?? 0),
    };
  });
  const [positionedCycle, setPositionedCycle] = createSignal(0);
  const [styles, setStyles] = createSignal<Record<string, string>>({
    position: context.kind === 'context-menu' ? 'fixed' : props.positionMethod ?? 'absolute',
    left: '0px',
    top: '0px',
  });
  const direction = useDirection();
  const modalBackdrop = () =>
    context.present() &&
    context.openReason !== 'trigger-hover' &&
    (context.kind === 'popover'
      ? context.props.modal === true
      : ['menu', 'context-menu'].includes(context.kind) &&
        !['menu', 'context-menu'].includes(context.parent?.kind ?? '') &&
        context.props.modal !== false);
  const backdropClipPath = () => {
    styles();
    const rect = context.trigger()?.getBoundingClientRect();
    return rect
      ? `polygon(0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${rect.left}px ${rect.top}px,${rect.left}px ${rect.bottom}px,${rect.right}px ${rect.bottom}px,${rect.right}px ${rect.top}px,${rect.left}px ${rect.top}px)`
      : undefined;
  };
  createEffect(
    () => ({
      open: context.open(),
      node: element(),
      modal: context.props.modal === true,
    }),
    ({ open, node, modal }) => {
      if (context.kind !== 'popover' || !open || !node || !modal ||
        context.openReason === 'trigger-hover') return;
      if (context.openMethod === 'touch') {
        const viewportWidth = node.ownerDocument.documentElement.clientWidth;
        const positionerWidth = node.offsetWidth;
        if (!viewportWidth || !positionerWidth || positionerWidth < viewportWidth - 20) return;
      }
      return acquireScrollLock(node.ownerDocument);
    },
  );
  const defaultPosition = () => {
    const menubar = context.kind === 'menu'
      ? context.trigger()?.closest('[role="menubar"]')
      : null;
    const align = props.align ?? (context.kind === 'context-menu' || menubar ? 'start' : 'center');
    const pointerOffset = context.kind === 'context-menu' && props.side === undefined && align !== 'center';
    return {
      side: props.side ?? (context.kind === 'tooltip'
        ? 'top'
        : menubar?.getAttribute('aria-orientation') === 'vertical'
          ? 'inline-end'
          : 'bottom'),
      align,
      sideOffset: props.sideOffset ?? (pointerOffset ? -5 : 0),
      alignOffset: props.alignOffset ?? (pointerOffset ? 2 : 0),
    };
  };
  createEffect(
    () => ({
      open: context.open(),
      node: element(),
      anchor:
        props.anchor?.current ??
        (typeof props.anchor === 'function' ? props.anchor() : props.anchor) ??
        context.point() ??
        context.trigger(),
      ...defaultPosition(),
      strategy: context.kind === 'context-menu' ? 'fixed' : props.positionMethod ?? 'absolute',
      arrow: context.arrow(),
      direction: direction(),
    }),
    ({ open, node, anchor, side, align, sideOffset, alignOffset, strategy, arrow, direction }) => {
      if (!open || !node || !anchor) return;
      const currentOpenCycle = openCycle().cycle;
      let alive = true;
      const update = async () => {
        const physicalSide =
          side === 'inline-start'
            ? direction === 'rtl'
              ? 'right'
              : 'left'
            : side === 'inline-end'
              ? direction === 'rtl'
                ? 'left'
                : 'right'
              : side;
        const placement = `${physicalSide}${align === 'center' ? '' : `-${align}`}` as Placement;
        const result = await computePosition(anchor, node, {
          placement,
          strategy,
          middleware: [
            offset({ mainAxis: sideOffset, crossAxis: alignOffset, alignmentAxis: alignOffset }),
            flip({ padding: props.collisionPadding ?? 5 }),
            shift({ padding: props.collisionPadding ?? 5 }),
            size({
              padding: props.collisionPadding ?? 5,
              apply({ availableWidth, availableHeight, rects }) {
                if (alive) {
                  const dpr = node.ownerDocument.defaultView?.devicePixelRatio || 1;
                  const { x, y, width, height } = rects.reference;
                  const anchorWidth = (Math.round((x + width) * dpr) - Math.round(x * dpr)) / dpr;
                  const anchorHeight = (Math.round((y + height) * dpr) - Math.round(y * dpr)) / dpr;
                  node.style.setProperty('--available-width', `${availableWidth}px`);
                  node.style.setProperty('--available-height', `${availableHeight}px`);
                  node.style.setProperty('--anchor-width', `${anchorWidth}px`);
                  node.style.setProperty('--anchor-height', `${anchorHeight}px`);
                }
              },
            }),
            ...(arrow ? [positionArrow({ element: arrow, padding: props.arrowPadding ?? 5 })] : []),
          ],
        });
        if (!alive) return;
        context.setPlacement(result.placement);
        const scale = node.ownerDocument.defaultView?.devicePixelRatio ?? 1;
        const round = (value: number) => Math.round(value * scale) / scale;
        const arrowData = result.middlewareData.arrow;
        context.setArrowStyles({
          position: 'absolute',
          ...(arrowData?.x !== undefined ? { left: `${arrowData.x}px` } : {}),
          ...(arrowData?.y !== undefined ? { top: `${arrowData.y}px` } : {}),
        });
        setStyles({
          position: strategy,
          left: '0px',
          top: '0px',
          transform:
            scale >= 1.5
              ? `translate3d(${round(result.x)}px, ${round(result.y)}px, 0)`
              : `translate(${round(result.x)}px, ${round(result.y)}px)`,
          '--transform-origin': `${align === 'start' ? 'left' : align === 'end' ? 'right' : 'center'} ${side === 'top' ? 'bottom' : 'top'}`,
        });
        setPositionedCycle(currentOpenCycle);
        props.onPositioned?.();
      };
      const cleanup = autoUpdate(anchor, node, update);
      return () => {
        alive = false;
        cleanup();
      };
    },
  );
  return (
    <>
      <Show when={modalBackdrop()}>
        <div
          role="presentation"
          data-base-ui-inert=""
          inert={!context.open()}
          style={{
            position: 'fixed',
            inset: 0,
            'user-select': 'none',
            '-webkit-user-select': 'none',
            'clip-path': backdropClipPath(),
          }}
        />
      </Show>
      <Show when={context.present() || props.keepMounted || context.portalKeepMounted}>
        {renderElement(
          'div',
          props,
          {
            get side() {
              return context.placement().split('-')[0];
            },
            get align() {
              return context.placement().split('-')[1] ?? 'center';
            },
            get open() {
              return context.open();
            },
            get closed() {
              return !context.open();
            },
          },
          {
            ref: setElement,
            get style() {
              const anchor =
                props.anchor?.current ??
                (typeof props.anchor === 'function' ? props.anchor() : props.anchor) ??
                context.point() ??
                context.trigger();
              const anchorRect = anchor?.getBoundingClientRect();
              const dpr =
                (anchor as HTMLElement | undefined)?.ownerDocument?.defaultView?.devicePixelRatio ||
                element()?.ownerDocument.defaultView?.devicePixelRatio ||
                1;
              const measuredWidth = anchorRect
                ? (Math.round((anchorRect.x + anchorRect.width) * dpr) -
                    Math.round(anchorRect.x * dpr)) /
                  dpr
                : 0;
              const positionedStyles = {
                ...styles(),
                '--anchor-width': `${measuredWidth}px`,
                opacity:
                  context.open() && measuredWidth > 0 && positionedCycle() !== openCycle().cycle
                    ? '0'
                    : undefined,
              };
              return context.kind === 'tooltip' &&
                (context.props.disableHoverablePopup || context.props.trackCursorAxis === 'both')
                ? { ...positionedStyles, 'pointer-events': 'none' }
                : positionedStyles;
            },
            get hidden() {
              return !context.present();
            },
            onMouseEnter() {
              if (context.kind === 'popover') context.hoverTimer.clear();
            },
            onMouseLeave(event: MouseEvent) {
              if (context.kind === 'popover' && context.openReason === 'trigger-hover') {
                context.safePolygonCleanup?.();
                context.setOpen(false, event, 'trigger-hover');
              }
            },
          },
        )}
      </Show>
    </>
  );
}
function PopupPanel(props: BaseProps) {
  const context = useContext(Popup)!;
  const timer = useTimeout();
  const isMenu = () => ['menu', 'context-menu'].includes(context.kind);
  let openingFocus: HTMLElement | null = null;
  let openingFocusCaptured = false;
  let openedProgrammaticallyInsideParent = false;
  createEffect(
    () => ({
      // A closing modal stays present for its exit animation, but it must
      // release focus, inert siblings, and the scroll lock when it closes.
      open: ['dialog', 'alert-dialog', 'drawer'].includes(context.kind)
        ? context.open()
        : context.present(),
      node: context.popup(),
      modal: context.kind === 'popover'
        ? context.props.modal !== false && context.closeCount() > 0
        : context.props.modal ?? ['dialog', 'alert-dialog', 'drawer'].includes(context.kind),
    }),
    ({ open, node, modal }) => {
      if (!open || !node) return;
      const document = node.ownerDocument;
      const stack = layers.get(document) ?? [];
      layers.set(document, stack);
      stack.push(node);
      const previousFocus = activeElement(node) as HTMLElement | null;
      if (context.kind === 'popover' && !openingFocusCaptured) {
        openingFocus = previousFocus;
        openingFocusCaptured = true;
        openedProgrammaticallyInsideParent = !!context.parent &&
          context.openReason === undefined &&
          contains(context.parent.popup(), previousFocus);
      }
      const top = () => stack.at(-1) === node;
      const inertNodes: Array<{ element: HTMLElement; inert: boolean; hidden: string | null }> = [];
      const releaseScrollLock = modal === true && context.kind !== 'popover'
        ? acquireScrollLock(document)
        : undefined;
      if (modal === true) {
        for (const child of Array.from(document.body.children) as HTMLElement[]) {
          if (contains(child, node) || child.tagName === 'SCRIPT') continue;
          inertNodes.push({
            element: child,
            inert: child.inert,
            hidden: child.getAttribute('aria-hidden'),
          });
          child.inert = true;
          child.setAttribute('aria-hidden', 'true');
        }
      }
      const focusInitial = () => {
        if (!top() || context.kind === 'tooltip' || context.kind === 'preview-card' ||
          (context.kind === 'popover' && context.openReason === 'trigger-hover')) return;
        const initial =
          typeof props.initialFocus === 'function'
            ? props.initialFocus()
            : (props.initialFocus?.current ?? props.initialFocus);
        if (initial === false) return;
        const target =
          initial && typeof initial.focus === 'function'
            ? initial
            : isMenu() && context.menuFocusEdge
              ? ((context.menuFocusEdge === 'last' ? menuItems(node).at(-1) : menuItems(node)[0]) ??
                node)
              : (focusableElements(node)[0] ?? node);
        context.menuFocusEdge = undefined;
        target.focus({ preventScroll: true });
      };
      focusInitial();
      const outside = (event: Event) => {
        const target = getTarget(event) as Node;
        if (
          !top() ||
          contains(node, target) ||
          contains(context.trigger(), target) ||
          context.props.disablePointerDismissal ||
          context.kind === 'alert-dialog'
        )
          return;
        context.setOpen(false, event, 'outside-press');
      };
      const keydown = (event: KeyboardEvent) => {
        if (!top()) return;
        if (event.key === 'Escape') {
          if (context.setOpen(false, event, 'escape-key')) {
            event.preventDefault();
            if (!context.allowPropagation) event.stopPropagation();
          }
          return;
        }
        const focusManagerModal = context.kind === 'popover'
          ? modal && context.closeCount() > 0
          : modal;
        if (event.key === 'Tab' && context.kind === 'popover' && !focusManagerModal &&
          contains(node, getTarget(event) as Node)) {
          const focusable = focusableElements(node);
          const active = activeElement(node);
          const atEdge = event.shiftKey
            ? active === focusable[0] || active === node
            : active === focusable.at(-1) || active === node;
          if (atEdge) {
            event.preventDefault();
            if (event.shiftKey) context.trigger()?.focus();
            else {
              const trigger = context.trigger();
              const outside = focusableElements(document.body).filter((element) =>
                !element.hasAttribute('data-base-ui-focus-guard') && !contains(node, element),
              );
              const next = outside[outside.indexOf(trigger as HTMLElement) + 1];
              context.setOpen(false, event, 'focus-out');
              queueMicrotask(() => next?.focus());
            }
          }
        }
        if (event.key === 'Tab' && focusManagerModal) {
          const focusable = focusableElements(node);
          const first = focusable[0] ?? node;
          const last = focusable.at(-1) ?? node;
          const active = activeElement(node);
          if (
            !focusable.length ||
            (event.shiftKey ? active === first : active === last) ||
            !contains(node, active)
          ) {
            event.preventDefault();
            (event.shiftKey ? last : first).focus();
          }
        }
        if (event.key === 'Tab' && isMenu()) context.setOpen(false, event, 'focus-out');
      };
      const focusin = (event: FocusEvent) => {
        if (!top() || contains(node, getTarget(event) as Node)) return;
        if (modal && (context.kind !== 'popover' || context.closeCount() > 0))
          (focusableElements(node)[0] ?? node).focus();
        else if (context.kind === 'popover' &&
          contains(node, event.relatedTarget as Node) &&
          !contains(context.trigger(), getTarget(event) as Node))
          context.setOpen(false, event, 'focus-out');
        else if (isMenu() && !contains(context.trigger(), getTarget(event) as Node))
          context.setOpen(false, event, 'focus-out');
      };
      if (context.kind !== 'popover') document.addEventListener('pointerdown', outside, true);
      document.addEventListener('keydown', keydown, true);
      document.addEventListener('focusin', focusin);
      return () => {
        const index = stack.indexOf(node);
        if (index >= 0) stack.splice(index, 1);
        if (context.kind !== 'popover') document.removeEventListener('pointerdown', outside, true);
        document.removeEventListener('keydown', keydown, true);
        document.removeEventListener('focusin', focusin);
        releaseScrollLock?.();
        if (modal === true) {
          inertNodes.forEach(({ element, inert, hidden }) => {
            element.inert = inert;
            if (hidden === null) element.removeAttribute('aria-hidden');
            else element.setAttribute('aria-hidden', hidden);
          });
        }
        // A Close part can change the focus-manager mode while the popup stays
        // open. Keep the opening focus through that effect restart.
        if (context.kind === 'popover' && context.present() && context.popup() === node &&
          modal !== (context.props.modal !== false && context.closeCount() > 0))
          return;
        if (
          props.finalFocus !== false &&
          context.kind !== 'tooltip' &&
          context.kind !== 'preview-card' &&
          !(context.kind === 'popover' && context.openReason === 'trigger-hover')
        ) {
          const final =
            typeof props.finalFocus === 'function'
              ? props.finalFocus()
              : (props.finalFocus?.current ?? props.finalFocus);
          const target =
            final && typeof final.focus === 'function'
              ? final
              : openedProgrammaticallyInsideParent
                ? (openingFocus ?? context.trigger())
                : (context.trigger() ?? previousFocus);
          if (target?.isConnected) target.focus({ preventScroll: true });
        }
        openingFocus = null;
        openingFocusCaptured = false;
        openedProgrammaticallyInsideParent = false;
      };
    },
  );
  let search = '';
  function menuKeydown(event: KeyboardEvent) {
    if (!isMenu()) return;
    const element = event.currentTarget as HTMLElement;
    const items = menuItems(element);
    if (!items.length) return;
    const index = items.indexOf(activeElement(element) as HTMLElement);
    let next: number | undefined;
    if (event.key === 'ArrowDown') next = (index + 1) % items.length;
    if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = items.length - 1;
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && event.key !== ' ') {
      search += event.key.toLowerCase();
      timer.start(500, () => {
        search = '';
      });
      const candidates = [...items.slice(index + 1), ...items.slice(0, index + 1)];
      const match = candidates.find((item) =>
        item.textContent?.trim().toLowerCase().startsWith(search),
      );
      if (match) {
        event.preventDefault();
        match.focus();
      }
    }
    if (next !== undefined) {
      event.preventDefault();
      items[next]?.focus();
    }
  }
  return (
    <Show when={context.present() || props.keepMounted || context.portalKeepMounted}>
      <>
      <Show when={context.kind === 'popover' && context.props.modal !== false &&
        context.closeCount() > 0}>
        <span data-base-ui-focus-guard="" data-type="inside" aria-hidden="true" tabindex={0}
          style={{ position: 'fixed', width: '1px', height: '1px', overflow: 'hidden' }} />
      </Show>
      {renderElement(
        'div',
        props,
        {
          get open() {
            return context.open();
          },
          get closed() {
            return !context.open();
          },
          get startingStyle() {
            return context.transition() === 'starting';
          },
          get endingStyle() {
            return context.transition() === 'ending';
          },
          get side() {
            return context.placement().split('-')[0];
          },
          get align() {
            return context.placement().split('-')[1] ?? 'center';
          },
        },
        {
          id: context.kind === 'popover' ? props.id ?? context.id : context.id,
          role: popupRole(context.kind),
          tabIndex: -1,
          ref: (node: HTMLElement) => {
            context.setPopup(node);
            if (context.kind === 'tooltip' && props['data-instant'] === undefined)
              queueMicrotask(() => {
                const value = context.instant();
                if (value) node.setAttribute('data-instant', value);
                else node.removeAttribute('data-instant');
              });
          },
          get hidden() {
            return !context.present();
          },
          get 'aria-modal'() {
            return (context.props.modal ??
              ['dialog', 'alert-dialog', 'drawer'].includes(context.kind))
              ? true
              : undefined;
          },
          get 'aria-labelledby'() {
            return context.title();
          },
          get 'aria-describedby'() {
            return context.description();
          },
          onKeyDown: menuKeydown,
          onPointerEnter() {
            if (context.kind === 'tooltip' || context.kind === 'preview-card')
              context.hoverTimer.clear();
          },
          onMouseEnter() {
            if (context.kind === 'tooltip') context.hoverTimer.clear();
          },
          onMouseLeave(event: MouseEvent) {
            if (context.kind === 'tooltip' && !context.props.disableHoverablePopup)
              context.setOpen(false, event, 'trigger-hover');
          },
          onPointerLeave(event: PointerEvent) {
            if (context.kind === 'tooltip' || context.kind === 'preview-card')
              context.hoverTimer.start(context.props.closeDelay ?? 150, () =>
                context.setOpen(false, event, 'trigger-hover'),
              );
          },
        },
      )}
      <Show when={context.kind === 'popover' && context.props.modal !== false &&
        context.closeCount() > 0}>
        <span data-base-ui-focus-guard="" data-type="inside" aria-hidden="true" tabindex={0}
          style={{ position: 'fixed', width: '1px', height: '1px', overflow: 'hidden' }} />
      </Show>
      </>
    </Show>
  );
}
function PopupTitle(props: BaseProps) {
  const context = useContext(Popup)!;
  const id = props.id ?? `${context.id}-title`;
  createEffect(
    () => id,
    (value) => {
      context.setTitle(value);
      return () => context.setTitle(undefined);
    },
  );
  return renderElement('h2', props, {}, { id });
}
function PopupDescription(props: BaseProps) {
  const context = useContext(Popup)!;
  const id = props.id ?? `${context.id}-description`;
  createEffect(
    () => id,
    (value) => {
      context.setDescription(value);
      return () => context.setDescription(undefined);
    },
  );
  return renderElement('p', props, {}, { id });
}
function PopupClose(props: BaseProps) {
  const context = useContext(Popup)!;
  if (context.kind === 'popover') {
    createEffect(() => true, () => {
      context.setCloseCount((count) => count + 1);
      return () => context.setCloseCount((count) => count - 1);
    });
  }
  return renderElement(
    'button',
    props,
    {},
    {
      type: 'button',
      onClick: (event: MouseEvent) => context.setOpen(false, event, 'close-press'),
    },
  );
}
function PopupArrow(props: BaseProps) {
  const context = useContext(Popup)!;
  return renderElement(
    'div',
    props,
    {
      get side() {
        return context.placement().split('-')[0];
      },
    },
    {
      'aria-hidden': true,
      ref: context.setArrow,
      get style() {
        return context.arrowStyles();
      },
    },
  );
}
const baseParts = {
  Root: createPopupRoot('dialog'),
  Trigger: PopupTrigger,
  Portal: PopupPortal,
  Backdrop: PopupBackdrop,
  Popup: PopupPanel,
  Close: PopupClose,
  Title: PopupTitle,
  Description: PopupDescription,
  Viewport: (props: BaseProps) => renderElement('div', props),
  Handle: PopupHandle,
  createHandle: createPopupHandle,
};
export const Dialog = { ...baseParts };
export const AlertDialog = { ...baseParts, Root: createPopupRoot('alert-dialog') };
function PopoverTrigger(props: BaseProps) {
  if (!useContext(Popup) && !props.handle)
    throw new Error('Base UI: <Popover.Trigger> must be either used within a <Popover.Root> component or provided with a handle.');
  return PopupTrigger(props, true);
}
export const Popover = {
  ...baseParts,
  Root: createPopupRoot('popover'),
  Trigger: PopoverTrigger,
  Positioner: PopupPositioner,
  Arrow: PopupArrow,
};
export const Tooltip = {
  ...baseParts,
  Root: createPopupRoot('tooltip'),
  Positioner: PopupPositioner,
  Arrow: PopupArrow,
  Provider: (props: BaseProps) => {
    const group: TooltipGroup = { props, hasProvider: true };
    onCleanup(() => clearTimeout(group.resetTimer));
    return <TooltipOptions value={group}>{props.children}</TooltipOptions>;
  },
};
export const PreviewCard = {
  ...baseParts,
  Root: createPopupRoot('preview-card'),
  Positioner: PopupPositioner,
  Arrow: PopupArrow,
};

const MenuChecked = createContext<() => boolean>(() => false);
const MenuRadio = createContext<{
  value: () => unknown;
  setValue: (next: unknown, event?: Event, reason?: string) => boolean;
}>();
function MenuItem(props: BaseProps) {
  const context = useContext(Popup)!;
  const [highlighted, setHighlighted] = createSignal(false);
  function close(event: Event) {
    if (props.disabled) {
      event.preventDefault();
      return;
    }
    if (props.closeOnClick !== false) {
      let current: PopupContext | undefined = context;
      while (current && ['menu', 'context-menu'].includes(current.kind)) {
        current.setOpen(false, event, 'item-press');
        current = current.parent;
      }
    }
  }
  return renderElement(
    'div',
    props,
    {
      get highlighted() {
        return highlighted();
      },
      get disabled() {
        return !!props.disabled;
      },
    },
    {
      role: 'menuitem',
      get tabIndex() {
        return highlighted() && !props.disabled ? 0 : -1;
      },
      get 'aria-disabled'() {
        return props.disabled ? true : undefined;
      },
      onClick: close,
      onFocus: () => setHighlighted(true),
      onBlur: () => setHighlighted(false),
      onPointerMove(event: PointerEvent) {
        if (event.pointerType !== 'touch' && !props.disabled)
          (event.currentTarget as HTMLElement).focus();
      },
      onKeyDown(event: KeyboardEvent) {
        if (['Enter', ' '].includes(event.key)) {
          event.preventDefault();
          (event.currentTarget as HTMLElement).click();
        }
      },
    },
  );
}
function MenuCheckboxItem(props: BaseProps) {
  const [checked, setChecked] = createControllable(props, 'checked', false);
  return (
    <MenuChecked value={checked}>
      <MenuItem
        {...mergeProps(
          {
            role: 'menuitemcheckbox',
            closeOnClick: false,
            get 'aria-checked'() {
              return checked();
            },
            get 'data-checked'() {
              return checked() ? '' : undefined;
            },
            onClick: (event: MouseEvent) => {
              if (!props.disabled) setChecked(!checked(), event, 'item-press');
            },
          },
          props,
        )}
      />
    </MenuChecked>
  );
}
function MenuRadioGroup(props: BaseProps) {
  const [value, setValue] = createControllable<unknown>(props, 'value', undefined);
  return (
    <MenuRadio value={{ value, setValue }}>
      {renderElement('div', props, {}, { role: 'group' })}
    </MenuRadio>
  );
}
function MenuRadioItem(props: BaseProps) {
  const context = useContext(MenuRadio)!;
  const checked = () => context.value() === props.value;
  return (
    <MenuChecked value={checked}>
      <MenuItem
        {...mergeProps(
          {
            role: 'menuitemradio',
            get 'aria-checked'() {
              return checked();
            },
            get 'data-checked'() {
              return checked() ? '' : undefined;
            },
            onClick: (event: MouseEvent) => {
              if (!props.disabled) context.setValue(props.value, event, 'item-press');
            },
          },
          props,
        )}
      />
    </MenuChecked>
  );
}
function MenuIndicator(props: BaseProps) {
  const checked = useContext(MenuChecked);
  return (
    <Show when={checked() || props.keepMounted}>
      {renderElement(
        'span',
        props,
        {
          get checked() {
            return checked();
          },
        },
        {
          'aria-hidden': true,
          get hidden() {
            return !checked();
          },
        },
      )}
    </Show>
  );
}
function SubmenuTrigger(props: BaseProps) {
  const context = useContext(Popup)!;
  const timer = useTimeout();
  const direction = useDirection();
  return renderElement(
    'div',
    props,
    {
      get open() {
        return context.open();
      },
    },
    {
      role: 'menuitem',
      tabIndex: -1,
      'aria-haspopup': 'menu',
      get 'aria-expanded'() {
        return context.open();
      },
      ref: context.setTrigger,
      onClick: (event: MouseEvent) => context.setOpen(true, event, 'trigger-press'),
      onPointerMove: (event: PointerEvent) => {
        if (!props.disabled && event.pointerType !== 'touch')
          timer.start(props.delay ?? 100, () => context.setOpen(true, event, 'trigger-hover'));
      },
      onKeyDown: (event: KeyboardEvent) => {
        if (
          [direction() === 'rtl' ? 'ArrowLeft' : 'ArrowRight', 'Enter', ' '].includes(event.key)
        ) {
          event.preventDefault();
          context.setOpen(true, event, 'trigger-press');
        }
      },
    },
  );
}
export const Menu = {
  ...baseParts,
  Root: createPopupRoot('menu'),
  Positioner: PopupPositioner,
  Arrow: PopupArrow,
  Item: MenuItem,
  LinkItem: (props: BaseProps) => (
    <MenuItem
      {...mergeProps({ render: (attrs: Record<string, unknown>) => <a {...attrs} /> }, props)}
    />
  ),
  CheckboxItem: MenuCheckboxItem,
  CheckboxItemIndicator: MenuIndicator,
  RadioGroup: MenuRadioGroup,
  RadioItem: MenuRadioItem,
  RadioItemIndicator: MenuIndicator,
  Group: (props: BaseProps) => renderElement('div', props, {}, { role: 'group' }),
  GroupLabel: (props: BaseProps) => renderElement('div', props),
  Separator,
  SubmenuRoot: createPopupRoot('menu'),
  SubmenuTrigger,
};
function ContextTrigger(props: BaseProps) {
  const context = useContext(Popup)!;
  return renderElement(
    'div',
    props,
    {
      get open() {
        return context.open();
      },
    },
    {
      ref: context.setTrigger,
      onContextMenu(event: MouseEvent) {
        if (props.disabled) return;
        event.preventDefault();
        context.setPoint({
          getBoundingClientRect: () => ({
            x: event.clientX,
            y: event.clientY,
            left: event.clientX,
            right: event.clientX,
            top: event.clientY,
            bottom: event.clientY,
            width: 0,
            height: 0,
          }),
        });
        context.setOpen(true, event, 'trigger-press');
      },
    },
  );
}
export const ContextMenu = {
  ...Menu,
  Root: createPopupRoot('context-menu'),
  Trigger: ContextTrigger,
};

interface DrawerState {
  direction: () => string;
  vertical: () => boolean;
  sign: () => number;
  parent?: DrawerState;
  height: () => number;
  frontmostHeight: () => number;
  nested: () => number;
  hasNestedDrawer: () => boolean;
  nestedSwiping: () => boolean;
  nestedProgress: () => number;
  setChildren: (update: (previous: PopupContext[]) => PopupContext[]) => void;
  movement: () => number;
  setMovement: (value: number) => void;
  swiping: () => boolean;
  setSwiping: (value: boolean) => void;
  strength: () => number;
  setStrength: (value: number) => void;
  progress: () => number;
  backdropProgress: () => number;
  viewport: () => HTMLElement | undefined;
  setViewport: (element: HTMLElement) => void;
  snapPoint: () => number | string | null;
  changeSnapPoint: (value: number | string | null, event?: Event, reason?: string) => boolean;
  snapOffset: () => number;
  resolvedPoints: () => { value: number | string; height: number; offset: number }[];
}
function createDrawerState(context: PopupContext): DrawerState {
  const props = context.props;
  const [height, setHeight] = createSignal(0);
  const [viewport, setViewport] = createSignal<HTMLElement>();
  const [viewportHeight, setViewportHeight] = createSignal(0);
  const [rootFontSize, setRootFontSize] = createSignal(16);
  const [children, setChildren] = createSignal<PopupContext[]>([]);
  const [movement, setMovement] = createSignal(0);
  const [swiping, setSwiping] = createSignal(false);
  const [strength, setStrength] = createSignal(1);
  const [snapPoint, changeSnapPoint] = createControllable<number | string | null>(
    props,
    'snapPoint',
    props.snapPoints?.[0] ?? null,
  );
  const direction = () => props.swipeDirection ?? 'down';
  const vertical = () => direction() === 'down' || direction() === 'up';
  const sign = () => (direction() === 'up' || direction() === 'left' ? -1 : 1);
  const nested = (): number =>
    children().reduce(
      (count, child) => (child.open() ? count + 1 + (child.drawer?.nested() ?? 0) : count),
      0,
    );
  const hasNestedDrawer = (): boolean => children().length > 0;
  const frontmostHeight = (): number =>
    children().findLast((child) => child.open())?.drawer?.frontmostHeight() || height();
  const nestedSwiping = (): boolean =>
    children().some((child) => child.drawer?.swiping() || child.drawer?.nestedSwiping());
  const resolvedPoints = () => {
    const maximum = Math.min(height(), viewportHeight());
    const points = (props.snapPoints ?? []).flatMap((value: number | string) => {
      const resolved =
        typeof value === 'number'
          ? value <= 1
            ? Math.max(0, value) * viewportHeight()
            : value
          : value.trim().endsWith('rem')
            ? parseFloat(value) * rootFontSize()
            : value.trim().endsWith('px')
              ? parseFloat(value)
              : NaN;
      if (!Number.isFinite(resolved) || maximum <= 0) return [];
      const visible = Math.max(0, Math.min(maximum, resolved));
      return [{ value, height: visible, offset: height() - visible }];
    }) as { value: number | string; height: number; offset: number }[];
    return points.filter(
      (point, index) =>
        !points.slice(index + 1).some((next) => Math.abs(next.height - point.height) <= 1),
    );
  };
  const snapOffset = () =>
    vertical()
      ? (resolvedPoints().find((point) => Object.is(point.value, snapPoint()))?.offset ?? 0)
      : 0;
  const progress = () =>
    Math.max(
      0,
      Math.min(
        1,
        movement() /
          Math.max(1, vertical() ? height() - snapOffset() : (context.popup()?.offsetWidth ?? 0)),
      ),
    );
  const nestedProgress = (): number =>
    children().at(-1)?.drawer?.progress() || children().at(-1)?.drawer?.nestedProgress() || 0;
  const backdropProgress = () => {
    const offsets = vertical()
      ? resolvedPoints()
          .map((point) => point.offset)
          .sort((a, b) => a - b)
      : [];
    if (offsets.length < 2) return progress();
    return Math.max(
      0,
      Math.min(
        1,
        (snapOffset() + (swiping() ? movement() : 0) - offsets[0]) / (offsets[1] - offsets[0]),
      ),
    );
  };
  let ancestor = context.parent;
  while (ancestor && !ancestor.drawer) ancestor = ancestor.parent;
  const parent = ancestor?.drawer;
  createEffect(context.present, (present) => {
    if (!parent || !present) return;
    parent.setChildren((previous) => [...previous.filter((child) => child !== context), context]);
    return () =>
      queueMicrotask(() =>
        parent.setChildren((previous) => previous.filter((child) => child !== context)),
      );
  });
  createEffect(context.open, (open) => {
    if (!open) {
      setSwiping(false);
      setMovement(0);
      if (props.snapPoints?.length)
        changeSnapPoint(props.defaultSnapPoint ?? props.snapPoints[0], undefined, 'none');
    }
  });
  createEffect(
    () => ({ node: context.popup(), present: context.present(), hasNestedDrawer: hasNestedDrawer() }),
    ({ node, present, hasNestedDrawer }) => {
      if (!present || !node) {
        setHeight(0);
        return;
      }
      const measure = () => {
        if (!hasNestedDrawer || !height()) setHeight(node.offsetHeight);
      };
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(node);
      return () => observer.disconnect();
    },
  );
  createEffect(viewport, (node) => {
    if (!node) return;
    const measure = () => {
      setViewportHeight(node.offsetHeight || node.ownerDocument.documentElement.clientHeight);
      setRootFontSize(
        parseFloat(
          node.ownerDocument.defaultView!.getComputedStyle(node.ownerDocument.documentElement)
            .fontSize,
        ) || 16,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  });
  return {
    direction,
    vertical,
    sign,
    parent,
    height,
    frontmostHeight,
    nested,
    hasNestedDrawer,
    nestedSwiping,
    nestedProgress,
    setChildren,
    movement,
    setMovement,
    swiping,
    setSwiping,
    strength,
    setStrength,
    progress,
    backdropProgress,
    viewport,
    setViewport,
    snapPoint,
    changeSnapPoint,
    snapOffset,
    resolvedPoints,
  };
}
function DrawerPanel(props: BaseProps) {
  const context = useContext(Popup)!;
  const drawer = context.drawer!;
  let start: { x: number; y: number; time: number; firstMove: boolean } | undefined;
  let touchGesture:
    | { x: number; y: number; scrollTarget?: HTMLElement; axisLocked: boolean; yielded: boolean }
    | undefined;
  let suppressClick = false;
  const findScrollTarget = (target: EventTarget | null): HTMLElement | undefined => {
    const popup = context.popup();
    let node = target as Node | null;
    while (popup && node && contains(popup, node)) {
      if (node instanceof HTMLElement) {
        const style = node.ownerDocument.defaultView!.getComputedStyle(node);
        const vertical = drawer.vertical();
        const overflow = vertical ? style.overflowY : style.overflowX;
        const extent = vertical
          ? node.scrollHeight - node.clientHeight
          : node.scrollWidth - node.clientWidth;
        if ((overflow === 'auto' || overflow === 'scroll') && extent > 0) return node;
      }
      if (node === popup) break;
      node = node.parentNode ?? (node.getRootNode() as ShadowRoot).host ?? null;
    }
    return undefined;
  };
  createEffect(
    () => ({ node: context.popup(), open: context.open() }),
    ({ node, open }) => {
      if (!node || !open) return;
      const onTouchMove = (event: TouchEvent) => {
        const gesture = touchGesture;
        const touch = event.touches[0];
        if (!gesture || !touch || event.touches.length !== 1 || gesture.yielded) return;
        const axis = drawer.vertical() ? touch.clientY - gesture.y : touch.clientX - gesture.x;
        const cross = drawer.vertical() ? touch.clientX - gesture.x : touch.clientY - gesture.y;
        if (!gesture.axisLocked) {
          if (Math.abs(cross) >= 6 && Math.abs(cross) > Math.abs(axis) + 2) {
            gesture.yielded = true;
            return;
          }
          if (Math.abs(axis) < 6 || Math.abs(axis) <= Math.abs(cross)) return;
          gesture.axisLocked = true;
        }
        const scrollTarget = gesture.scrollTarget;
        if (scrollTarget) {
          const extent = drawer.vertical()
            ? scrollTarget.scrollHeight - scrollTarget.clientHeight
            : scrollTarget.scrollWidth - scrollTarget.clientWidth;
          const offset = drawer.vertical() ? scrollTarget.scrollTop : scrollTarget.scrollLeft;
          const atEdge = drawer.sign() > 0 ? offset <= 0 : offset >= extent;
          if (axis * drawer.sign() <= 0 || !atEdge) return;
        }
        if (event.cancelable) event.preventDefault();
      };
      node.ownerDocument.addEventListener('touchmove', onTouchMove, {
        capture: true,
        passive: false,
      });
      return () => {
        node.ownerDocument.removeEventListener('touchmove', onTouchMove, true);
        touchGesture = undefined;
      };
    },
  );
  return (
    <PopupPanel
      {...mergeProps(
        {
          get initialFocus() {
            return props.initialFocus === undefined ? () => context.popup() : props.initialFocus;
          },
          get 'data-swipe-direction'() {
            return drawer.direction();
          },
          get 'data-expanded'() {
            return drawer.snapPoint() === 1 ? '' : undefined;
          },
          get 'data-nested-drawer-open'() {
            return drawer.nested() > 0 ? '' : undefined;
          },
          get 'data-nested-drawer-swiping'() {
            return drawer.nestedSwiping() ? '' : undefined;
          },
          get 'data-swiping'() {
            return drawer.swiping() ? '' : undefined;
          },
          'data-base-ui-focusable': '',
          get style() {
            const raw = drawer.movement();
            const movement =
              drawer.vertical() &&
              drawer.direction() === 'down' &&
              context.props.snapPoints?.length &&
              drawer.snapOffset() + raw < 0
                ? -Math.sqrt(-(drawer.snapOffset() + raw)) - drawer.snapOffset()
                : raw;
            return {
              '--drawer-swipe-movement-y': `${drawer.vertical() ? movement * drawer.sign() : 0}px`,
              '--drawer-swipe-movement-x': `${drawer.vertical() ? 0 : movement * drawer.sign()}px`,
              '--drawer-swipe-progress': `${drawer.nestedProgress()}`,
              '--nested-drawers': drawer.nested(),
              '--drawer-height':
                drawer.height() && (drawer.hasNestedDrawer() || context.transition() === 'ending')
                  ? `${drawer.height()}px`
                  : undefined,
              '--drawer-frontmost-height': drawer.frontmostHeight()
                ? `${drawer.frontmostHeight()}px`
                : undefined,
              '--drawer-snap-point-offset': `${drawer.snapOffset() * drawer.sign()}px`,
              '--drawer-swipe-strength': drawer.strength(),
            };
          },
          onPointerDown(event: PointerEvent) {
            if (
              event.button !== 0 ||
              drawer.nested() ||
              (event.pointerType !== 'touch' &&
                (getTarget(event) as Element)?.closest('[data-drawer-content]')) ||
              (getTarget(event) as Element)?.closest(
                'input, textarea, select, button, a, label, [role="button"], [data-base-ui-swipe-ignore]',
              )
            )
              return;
            start = { x: event.clientX, y: event.clientY, time: event.timeStamp, firstMove: true };
            touchGesture = event.pointerType === 'touch'
              ? {
                  x: event.clientX,
                  y: event.clientY,
                  scrollTarget: findScrollTarget(getTarget(event)),
                  axisLocked: false,
                  yielded: false,
                }
              : undefined;
            suppressClick = false;
            drawer.setSwiping(true);
            (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
          },
          onPointerMove(event: PointerEvent) {
            if (!start) return;
            if (start.firstMove) {
              start = {
                x: event.clientX,
                y: event.clientY,
                time: event.timeStamp,
                firstMove: false,
              };
              return;
            }
            event.preventDefault();
            const distance =
              (drawer.vertical() ? event.clientY - start.y : event.clientX - start.x) *
              drawer.sign();
            if (!drawer.swiping() && Math.abs(distance) < 10) return;
            (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
            suppressClick = true;
            drawer.setSwiping(true);
            drawer.setMovement(
              drawer.vertical() && context.props.snapPoints?.length
                ? distance
                : Math.max(0, distance),
            );
          },
          onPointerUp(event: PointerEvent) {
            if (!start) return;
            const distance = drawer.movement();
            const velocity = distance / Math.max(1, event.timeStamp - start.time);
            const points = drawer.resolvedPoints();
            if (drawer.swiping() && drawer.vertical() && points.length) {
              const target = Math.max(
                0,
                drawer.snapOffset() +
                  distance +
                  (context.props.snapToSequentialPoints
                    ? 0
                    : Math.abs(velocity) > 0.5
                      ? Math.max(-4, Math.min(4, velocity)) * 300
                      : 0),
              );
              const candidates = [...points, { value: null, offset: drawer.height() }];
              const nearest = candidates.reduce((a, b) =>
                Math.abs(a.offset - target) <= Math.abs(b.offset - target) ? a : b,
              );
              if (nearest.value === null) context.setOpen(false, event, 'swipe');
              else drawer.changeSnapPoint(nearest.value, event, 'swipe');
            } else if (drawer.swiping() && (drawer.progress() >= 0.5 || velocity > 0.5))
              context.setOpen(false, event, 'swipe');
            start = undefined;
            touchGesture = undefined;
            drawer.setSwiping(false);
            drawer.setMovement(0);
          },
          onPointerCancel() {
            start = undefined;
            touchGesture = undefined;
            drawer.setSwiping(false);
            drawer.setMovement(0);
          },
          onClickCapture(event: MouseEvent) {
            if (suppressClick) {
              event.preventDefault();
              event.stopPropagation();
              suppressClick = false;
            }
          },
        },
        props,
      )}
    />
  );
}
function DrawerBackdrop(props: BaseProps) {
  const context = useContext(Popup)!;
  const drawer = context.drawer!;
  return (
    <Show when={!drawer.parent || props.forceRender}>
      <PopupBackdrop
        {...mergeProps(
          {
            role: 'presentation',
            get style() {
              return {
                'pointer-events': context.open() ? undefined : 'none',
                '--drawer-swipe-progress': `${drawer.backdropProgress()}`,
                '--drawer-height':
                  drawer.backdropProgress() > 0 ? `${drawer.frontmostHeight()}px` : undefined,
                '--drawer-swipe-strength': drawer.strength(),
                'user-select': 'none',
              };
            },
          },
          props,
        )}
      />
    </Show>
  );
}
function DrawerViewport(props: BaseProps) {
  const context = useContext(Popup)!;
  return renderElement(
    'div',
    props,
    {
      get open() {
        return context.open();
      },
      get closed() {
        return !context.open();
      },
    },
    {
      role: 'presentation',
      ref: context.drawer!.setViewport,
      get style() {
        return { 'pointer-events': context.open() ? undefined : 'none' };
      },
    },
  );
}
const DrawerSettings = createContext<BaseProps>({});
const drawerBox = (props: BaseProps) => renderElement('div', props);
export const Drawer = {
  ...baseParts,
  Root: createPopupRoot('drawer'),
  Popup: DrawerPanel,
  Backdrop: DrawerBackdrop,
  Viewport: DrawerViewport,
  Content: (props: BaseProps) => renderElement('div', props, {}, { 'data-drawer-content': '' }),
  SwipeArea: (props: BaseProps) => <DrawerPanel {...props} />,
  Provider: (props: BaseProps) => <DrawerSettings value={props}>{props.children}</DrawerSettings>,
  VirtualKeyboardProvider: (props: BaseProps) => (
    <DrawerSettings value={props}>{props.children}</DrawerSettings>
  ),
  Indent: drawerBox,
  IndentBackground: drawerBox,
};

type NavigationEntry = {
  value: () => unknown;
  id: string;
  trigger?: HTMLElement;
  content?: HTMLElement;
  contentId: () => string;
};
type NavigationDirection = 'left' | 'right' | 'up' | 'down' | null;
type NavigationContext = ReturnType<typeof createNavigation>;
const Navigation = createContext<NavigationContext | null>(null);
const NavigationItem = createContext<NavigationEntry | null>(null);

function createNavigation(props: BaseProps) {
  const [value, changeValue] = createControllable<unknown>(props, 'value', null);
  const initialValue = untrack(value);
  const [lastValue, setLastValue] = createSignal(() => initialValue);
  const [present, setPresent] = createSignal(untrack(() => value() != null));
  const [transition, setTransition] = createSignal<'starting' | 'ending' | undefined>();
  const [activationDirection, setActivationDirection] = createSignal<NavigationDirection>(null);
  const [entries, setEntries] = createSignal<NavigationEntry[]>([]);
  const [element, setElement] = createSignal<HTMLElement>();
  const [viewport, setViewport] = createSignal<HTMLElement>();
  const [popup, setPopup] = createSignal<HTMLElement>();
  const [positioner, setPositioner] = createSignal<HTMLElement>();
  const [placement, setPlacement] = createSignal<Placement>('bottom-start');
  const [focusRequest, setFocusRequest] = createSignal<'first' | 'last'>();
  const direction = useDirection();
  const hoverTimer = useTimeout();
  const frame = useAnimationFrame();
  const open = () => value() != null;
  const renderValue = () => value() ?? lastValue();
  const activeEntry = () => entries().find((entry) => Object.is(entry.value(), renderValue()));
  const trigger = () => activeEntry()?.trigger;
  const content = () => activeEntry()?.content;
  const orientation = () => props.orientation ?? 'horizontal';
  let hoverSuppressed = false;
  let closing = false;
  const orderedTriggers = () =>
    entries()
      .filter(
        (entry) =>
          entry.trigger?.isConnected &&
          !entry.trigger.hasAttribute('disabled') &&
          entry.trigger.getAttribute('aria-disabled') !== 'true',
      )
      .sort((a, b) =>
        a.trigger!.compareDocumentPosition(b.trigger!) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
      );
  const setValue = (next: unknown, event?: Event, reason?: string) => {
    const previous = value();
    const changed = changeValue(next, event, reason);
    if (!changed) return false;
    hoverSuppressed = next == null && reason !== 'trigger-hover';
    if (next != null) {
      const ordered = orderedTriggers();
      const before = ordered.findIndex((entry) => Object.is(entry.value(), previous));
      const after = ordered.findIndex((entry) => Object.is(entry.value(), next));
      setActivationDirection(
        before < 0 || after < 0 || before === after
          ? null
          : orientation() === 'vertical'
            ? after > before
              ? 'down'
              : 'up'
            : after > before !== (direction() === 'rtl')
              ? 'right'
              : 'left',
      );
      setLastValue(() => next);
    }
    return true;
  };
  const inside = (target: Node | null) =>
    contains(element(), target) || contains(positioner(), target) || contains(viewport(), target);
  const close = (event?: Event, reason = 'none', returnFocus = false) => {
    hoverTimer.clear();
    if (closing) return;
    const target = trigger();
    if (setValue(null, event, reason)) {
      closing = true;
      queueMicrotask(() => {
        closing = false;
      });
      if (returnFocus) target?.focus();
    }
  };
  const scheduleClose = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || inside(event.relatedTarget as Node | null)) return;
    const focusedContent = content();
    if (focusedContent && contains(focusedContent, activeElement(focusedContent))) return;
    hoverTimer.start(props.closeDelay ?? 50, () => close(event, 'trigger-hover'));
  };
  const register = (entry: NavigationEntry) => {
    setEntries((previous) => (previous.includes(entry) ? [...previous] : [...previous, entry]));
  };
  createEffect(value, (next) => {
    if (next != null) setLastValue(() => next);
  });
  createEffect(open, (next) => {
    if (next) {
      setPresent(true);
      setTransition('starting');
    } else if (present()) setTransition('ending');
  });
  createEffect(
    () => ({ open: open(), popup: popup() }),
    (state) => {
      if (!state.popup) return;
      let canceled = false;
      frame.request(() => {
        if (state.open) setTransition(undefined);
        frame.request(() => {
          Promise.allSettled(
            (state.popup!.getAnimations?.({ subtree: true }) ?? []).map(
              (animation) => animation.finished,
            ),
          ).then(() => {
            if (canceled) return;
            if (!state.open) setPresent(false);
            setTransition(undefined);
            props.onOpenChangeComplete?.(state.open);
          });
        });
      });
      return () => {
        canceled = true;
        frame.cancel();
      };
    },
  );
  createEffect(
    () => ({ node: content(), request: focusRequest(), open: open() }),
    (state) => {
      if (!state.open || !state.node || !state.request) return;
      const node = state.node;
      queueMicrotask(() => {
        if (!node.isConnected || node !== content() || !open()) return;
        const items = focusableElements(node);
        (state.request === 'last' ? items.at(-1) : items[0])?.focus();
        if (items.length === 0) node.focus();
        setFocusRequest(undefined);
      });
    },
  );
  createEffect(
    () => ({ node: element(), open: open() }),
    (state) => {
      if (!state.node || !state.open) return;
      const document = state.node.ownerDocument;
      const outsidePress = (event: PointerEvent) => {
        if (!props.disablePointerDismissal && !inside(getTarget(event) as Node | null))
          close(event, 'outside-press');
      };
      const focusOut = (event: FocusEvent) => {
        if (!inside(getTarget(event) as Node | null)) close(event, 'focus-out');
        else hoverTimer.clear();
      };
      const escape = (event: KeyboardEvent) => {
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        event.preventDefault();
        close(event, 'escape-key', true);
      };
      document.addEventListener('pointerdown', outsidePress, true);
      document.addEventListener('focusin', focusOut);
      document.addEventListener('keydown', escape);
      return () => {
        document.removeEventListener('pointerdown', outsidePress, true);
        document.removeEventListener('focusin', focusOut);
        document.removeEventListener('keydown', escape);
      };
    },
  );
  createEffect(
    () => props.actionsRef,
    (ref) => {
      assignRef(ref, { unmount: () => setPresent(false) });
      return () => assignRef(ref, null);
    },
  );
  return {
    props,
    value,
    setValue,
    open,
    present,
    transition,
    activationDirection,
    renderValue,
    entries,
    register,
    unregister(entry: NavigationEntry) {
      setEntries((previous) => previous.filter((value) => value !== entry));
    },
    element,
    setElement,
    viewport,
    setViewport,
    popup,
    setPopup,
    positioner,
    setPositioner,
    placement,
    setPlacement,
    trigger,
    content,
    orientation,
    direction,
    orderedTriggers,
    inside,
    close,
    scheduleClose,
    hoverTimer,
    hoverSuppressed: () => hoverSuppressed,
    resumeHover: () => {
      hoverSuppressed = false;
    },
    focusContent: setFocusRequest,
  };
}
function navigationState(root: NavigationContext) {
  return {
    get open() {
      return root.open();
    },
    get closed() {
      return !root.open();
    },
    get startingStyle() {
      return root.transition() === 'starting';
    },
    get endingStyle() {
      return root.transition() === 'ending';
    },
    get activationDirection() {
      return root.activationDirection();
    },
    get orientation() {
      return root.orientation();
    },
    get side() {
      return root.placement().split('-')[0];
    },
    get align() {
      return root.placement().split('-')[1] ?? 'center';
    },
  };
}
function NavigationRoot(props: BaseProps) {
  const parent = useContext(Navigation);
  const root = createNavigation(props);
  return (
    <Navigation value={root}>
      {renderElement(
        parent ? 'div' : 'nav',
        omitProps(props, ['value', 'delay', 'closeDelay', 'onOpenChangeComplete']),
        navigationState(root),
        {
          'aria-label': parent ? undefined : 'Main',
          ref: root.setElement,
          onPointerEnter: root.hoverTimer.clear,
          onPointerLeave: root.scheduleClose,
        },
      )}
    </Navigation>
  );
}
function NavigationItemRoot(props: BaseProps) {
  const root = useContext(Navigation)!;
  const id = createUniqueId();
  const entry: NavigationEntry = {
    value: () => props.value ?? id,
    id,
    contentId: () => `${id}-content`,
  };
  if (!isServer) onCleanup(() => root.unregister(entry));
  return (
    <NavigationItem value={entry}>
      {renderElement('li', omitProps(props, ['value']))}
    </NavigationItem>
  );
}
function NavigationTrigger(props: BaseProps) {
  const root = useContext(Navigation)!;
  const item = useContext(NavigationItem)!;
  const open = () => Object.is(root.value(), item.value());
  const enterContent = (event: KeyboardEvent, edge: 'first' | 'last') => {
    event.preventDefault();
    root.hoverTimer.clear();
    if (root.setValue(item.value(), event, 'trigger-press') || open()) root.focusContent(edge);
  };
  const hover = (event: PointerEvent) => {
    if (event.pointerType !== 'touch' && !props.disabled && !root.hoverSuppressed())
      root.hoverTimer.start(root.open() ? 0 : (root.props.delay ?? 50), () =>
        root.setValue(item.value(), event, 'trigger-hover'),
      );
  };
  return renderElement(
    'button',
    props,
    {
      get popupOpen() {
        return open();
      },
      get open() {
        return open();
      },
      get disabled() {
        return !!props.disabled;
      },
    },
    {
      type: 'button',
      id: `${item.id}-trigger`,
      ref: (element: HTMLElement) => {
        item.trigger = element;
        root.register(item);
      },
      get 'aria-controls'() {
        return open() ? item.contentId() : undefined;
      },
      get 'aria-disabled'() {
        return props.disabled ? true : undefined;
      },
      get role() {
        return props.nativeButton === false ? 'button' : undefined;
      },
      get tabIndex() {
        return props.disabled ? -1 : 0;
      },
      get 'aria-expanded'() {
        return open();
      },
      onClick: (event: MouseEvent) => {
        root.hoverTimer.clear();
        if (props.disabled) {
          event.preventDefault();
          return;
        }
        root.setValue(open() ? null : item.value(), event, 'trigger-press');
      },
      onPointerEnter: hover,
      onPointerMove: (event: PointerEvent) => {
        if (root.hoverSuppressed() && (event.movementX || event.movementY)) {
          root.resumeHover();
          hover(event);
        }
      },
      onPointerLeave: () => root.hoverTimer.clear(),
      onFocus: root.hoverTimer.clear,
      onKeyDown: (event: KeyboardEvent) => {
        if (props.disabled) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          root.close(event, 'escape-key', true);
          return;
        }
        const vertical = root.orientation() === 'vertical';
        const forward = vertical
          ? 'ArrowDown'
          : root.direction() === 'rtl'
            ? 'ArrowLeft'
            : 'ArrowRight';
        const backward = vertical
          ? 'ArrowUp'
          : root.direction() === 'rtl'
            ? 'ArrowRight'
            : 'ArrowLeft';
        const entries = root.orderedTriggers();
        const index = entries.indexOf(item);
        if ([forward, backward, 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          event.stopPropagation();
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? entries.length - 1
                : index + (event.key === forward ? 1 : -1);
          entries[Math.max(0, Math.min(entries.length - 1, next))]?.trigger?.focus();
          return;
        }
        const inward = vertical
          ? root.direction() === 'rtl'
            ? 'ArrowLeft'
            : 'ArrowRight'
          : 'ArrowDown';
        if (event.key === inward || (event.key === 'Tab' && !event.shiftKey && open()))
          enterContent(event, 'first');
        else if (!vertical && event.key === 'ArrowUp') enterContent(event, 'last');
        else if (props.nativeButton === false && ['Enter', ' '].includes(event.key)) {
          event.preventDefault();
          (event.currentTarget as HTMLElement).click();
        }
      },
    },
  );
}
function NavigationContent(props: BaseProps) {
  const root = useContext(Navigation)!;
  const item = useContext(NavigationItem)!;
  const [hasMountedInPortal, setHasMountedInPortal] = createSignal(false);
  item.contentId = () => props.id ?? `${item.id}-content`;
  const active = () => Object.is(root.renderValue(), item.value());
  const open = () => Object.is(root.value(), item.value());
  createEffect(root.viewport, (viewport) => {
    if (viewport) setHasMountedInPortal(true);
  });
  return (
    <>
      <Show when={props.keepMounted && !root.viewport() && !hasMountedInPortal()}>
        {renderElement(
          'div',
          props,
          mergeProps(navigationState(root), {
            get open() {
              return open();
            },
            get closed() {
              return !open();
            },
          }),
          { hidden: true },
        )}
      </Show>
      <Show when={root.viewport() && ((active() && root.present()) || props.keepMounted)}>
        <Portal mount={root.viewport()}>
          {renderElement(
            'div',
            props,
            mergeProps(navigationState(root), {
              get open() {
                return open();
              },
              get closed() {
                return !open();
              },
            }),
            {
              id: item.contentId(),
              get 'aria-labelledby'() {
                return item.trigger?.id ?? `${item.id}-trigger`;
              },
              tabIndex: -1,
              ref: (node: HTMLElement) => {
                item.content = node;
                root.register(item);
                onCleanup(() => {
                  if (item.content === node) {
                    item.content = undefined;
                    root.register(item);
                  }
                });
              },
              get hidden() {
                return !active() || !root.present();
              },
              get inert() {
                return !open();
              },
              onPointerEnter: root.hoverTimer.clear,
              onPointerLeave: root.scheduleClose,
              onKeyDown: (event: KeyboardEvent) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  root.close(event, 'escape-key', true);
                  return;
                }
                const node = event.currentTarget as HTMLElement;
                const items = focusableElements(node);
                const index = items.indexOf(activeElement(node) as HTMLElement);
                if (
                  ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) &&
                  !['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName)
                ) {
                  event.preventDefault();
                  const next =
                    event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? items.length - 1
                        : index + (event.key === 'ArrowDown' ? 1 : -1);
                  items[Math.max(0, Math.min(items.length - 1, next))]?.focus();
                }
                if (event.key === 'Tab' && event.shiftKey && index === 0) {
                  event.preventDefault();
                  root.trigger()?.focus();
                } else if (event.key === 'Tab' && !event.shiftKey && index === items.length - 1) {
                  event.preventDefault();
                  const trigger = root.trigger();
                  const outside = focusableElements(node.ownerDocument.body).filter(
                    (element) =>
                      !contains(root.positioner(), element) && !contains(root.viewport(), element),
                  );
                  const target = outside[outside.indexOf(trigger!) + 1];
                  root.close(event, 'focus-out');
                  (target ?? trigger)?.focus();
                }
              },
            },
          )}
        </Portal>
      </Show>
    </>
  );
}
function NavigationPositioner(props: BaseProps) {
  const root = useContext(Navigation)!;
  const [styles, setStyles] = createSignal<Record<string, string>>({
    position: 'absolute',
    left: '0px',
    top: '0px',
    '--positioner-width': 'auto',
    '--positioner-height': 'auto',
    '--popup-width': 'auto',
    '--popup-height': 'auto',
  });
  createEffect(
    () => ({
      node: root.positioner(),
      popup: root.popup(),
      viewport: root.viewport(),
      content: root.content(),
      open: root.open(),
      anchor:
        props.anchor?.current ??
        (typeof props.anchor === 'function' ? props.anchor() : props.anchor) ??
        root.trigger(),
      side: props.side ?? 'bottom',
      align: props.align ?? 'center',
      sideOffset: props.sideOffset ?? 0,
      alignOffset: props.alignOffset ?? 0,
      strategy: props.positionMethod ?? 'absolute',
    }),
    (state) => {
      const {
        node,
        popup,
        viewport,
        content,
        anchor,
        side,
        align,
        sideOffset,
        alignOffset,
        strategy,
      } = state;
      if (!state.open || !node || !popup || !viewport || !content || !anchor) return;
      let alive = true;
      let scheduled = 0;
      const update = async () => {
        if (!alive) return;
        // Clear the previous fixed size before reading the new content size. Offset
        // dimensions exclude the popup's entry scale transform.
        const saved = [
          '--positioner-width',
          '--positioner-height',
          '--popup-width',
          '--popup-height',
        ].map((name) => [name, node.style.getPropertyValue(name)] as const);
        for (const [name] of saved) node.style.setProperty(name, 'auto');
        const savedViewportHeight = viewport.style.height;
        viewport.style.height = 'auto';
        const width = Math.max(popup.offsetWidth, content.scrollWidth);
        const height = Math.max(popup.offsetHeight, content.offsetHeight);
        viewport.style.height = savedViewportHeight;
        for (const [name, previous] of saved)
          previous ? node.style.setProperty(name, previous) : node.style.removeProperty(name);
        node.style.setProperty('--positioner-width', `${width}px`);
        node.style.setProperty('--positioner-height', `${height}px`);
        node.style.setProperty('--popup-width', `${width}px`);
        node.style.setProperty('--popup-height', `${height}px`);
        const result = await computePosition(anchor, node, {
          strategy,
          placement: `${side}${align === 'center' ? '' : `-${align}`}` as Placement,
          middleware: [
            offset({ mainAxis: sideOffset, crossAxis: alignOffset, alignmentAxis: alignOffset }),
            flip({ padding: props.collisionPadding ?? 5 }),
            shift({ padding: props.collisionPadding ?? 5 }),
            size({
              padding: props.collisionPadding ?? 5,
              apply({ availableWidth, availableHeight, rects }) {
                if (alive) {
                  node.style.setProperty('--available-width', `${Math.max(0, availableWidth)}px`);
                  node.style.setProperty('--available-height', `${Math.max(0, availableHeight)}px`);
                  const dpr = node.ownerDocument.defaultView?.devicePixelRatio || 1;
                  const { x, y, width, height } = rects.reference;
                  node.style.setProperty('--anchor-width', `${(Math.round((x + width) * dpr) - Math.round(x * dpr)) / dpr}px`);
                  node.style.setProperty('--anchor-height', `${(Math.round((y + height) * dpr) - Math.round(y * dpr)) / dpr}px`);
                }
              },
            }),
          ],
        });
        if (!alive) return;
        root.setPlacement(result.placement);
        const actualSide = result.placement.split('-')[0];
        const actualAlign = result.placement.split('-')[1] ?? 'center';
        setStyles({
          position: strategy,
          left: `${result.x}px`,
          top: `${result.y}px`,
          '--positioner-width': `${width}px`,
          '--positioner-height': `${height}px`,
          '--popup-width': `${width}px`,
          '--popup-height': `${height}px`,
          '--transform-origin': `${actualAlign === 'start' ? 'left' : actualAlign === 'end' ? 'right' : 'center'} ${actualSide === 'top' ? 'bottom' : 'top'}`,
        });
        props.onPositioned?.();
      };
      const schedule = () => {
        if (!scheduled)
          scheduled = requestAnimationFrame(() => {
            scheduled = 0;
            void update();
          });
      };
      const cleanup = autoUpdate(anchor, node, schedule);
      const resize = new ResizeObserver(schedule);
      resize.observe(content);
      const mutations = new MutationObserver(schedule);
      mutations.observe(content, { childList: true, subtree: true, characterData: true });
      return () => {
        alive = false;
        cleanup();
        resize.disconnect();
        mutations.disconnect();
        if (scheduled) cancelAnimationFrame(scheduled);
      };
    },
  );
  return (
    <Show when={root.present() || props.keepMounted}>
      {renderElement('div', props, navigationState(root), {
        ref: root.setPositioner,
        get hidden() {
          return !root.present();
        },
        get style() {
          return styles();
        },
        onPointerEnter: root.hoverTimer.clear,
        onPointerLeave: root.scheduleClose,
      })}
    </Show>
  );
}
function NavigationViewport(props: BaseProps) {
  const root = useContext(Navigation)!;
  return renderElement(
    'div',
    props,
    {},
    {
      ref: (node: HTMLElement) => {
        root.setViewport(node);
        onCleanup(() => root.setViewport(undefined));
      },
      get inert() {
        return !root.open();
      },
    },
  );
}
function NavigationPopup(props: BaseProps) {
  const root = useContext(Navigation)!;
  return (
    <Show when={root.present() || props.keepMounted}>
      {renderElement('div', props, navigationState(root), {
        ref: root.setPopup,
        tabIndex: -1,
        get hidden() {
          return !root.present();
        },
        get inert() {
          return !root.open();
        },
        onPointerEnter: root.hoverTimer.clear,
        onPointerLeave: root.scheduleClose,
      })}
    </Show>
  );
}
function NavigationLink(props: BaseProps) {
  const root = useContext(Navigation)!;
  return renderElement(
    'a',
    omitProps(props, ['active', 'closeOnClick']),
    {
      get active() {
        return !!props.active;
      },
    },
    {
      get 'aria-current'() {
        return props.active ? 'page' : undefined;
      },
      onClick: (event: MouseEvent) => {
        if (props.closeOnClick) root.close(event, 'link-press');
      },
    },
  );
}
export const NavigationMenu = {
  Root: NavigationRoot,
  List: (props: BaseProps) => {
    const root = useContext(Navigation)!;
    return renderElement('ul', props, navigationState(root));
  },
  Item: NavigationItemRoot,
  Trigger: NavigationTrigger,
  Content: NavigationContent,
  Link: NavigationLink,
  Icon: (props: BaseProps) => {
    const root = useContext(Navigation)!,
      item = useContext(NavigationItem);
    return renderElement(
      'span',
      props,
      {
        get open() {
          return item ? Object.is(root.value(), item.value()) : root.open();
        },
      },
      { 'aria-hidden': true },
    );
  },
  Portal: (props: BaseProps) => {
    const root = useContext(Navigation)!;
    return (
      <Show when={root.present() || props.keepMounted}>
        <Portal mount={props.container?.current ?? props.container ?? props.mount}>
          {props.children}
        </Portal>
      </Show>
    );
  },
  Positioner: NavigationPositioner,
  Viewport: NavigationViewport,
  Popup: NavigationPopup,
  Backdrop: (props: BaseProps) => {
    const root = useContext(Navigation)!;
    return (
      <Show when={root.present() || props.keepMounted}>
        {renderElement('div', props, navigationState(root), {
          'aria-hidden': true,
          get hidden() {
            return !root.present();
          },
          onPointerDown: (event: PointerEvent) => root.close(event, 'outside-press'),
        })}
      </Show>
    );
  },
  Arrow: (props: BaseProps) => {
    const root = useContext(Navigation)!;
    return renderElement('div', props, navigationState(root), { 'aria-hidden': true });
  },
};
