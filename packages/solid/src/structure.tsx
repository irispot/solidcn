import {
  createContext,
  createSignal,
  createEffect,
  createMemo,
  createUniqueId,
  sharedConfig,
  useContext,
  Show,
  onCleanup,
  untrack,
} from 'solid-js';
import { isServer, Portal, type JSX } from '@solidjs/web';
import {
  renderElement,
  createControllable,
  eventDetails,
  mergeProps,
  assignRef,
  useDirection,
  useTimeout,
  useAnimationFrame,
  ScrollbarStyle,
  CSPContext,
  omitProps,
  focusableElements,
  contains,
  getTarget,
  type BaseProps,
  type ChangeEventDetails,
} from './core';
import { tabsIndicatorPrehydrationScript } from './tabs-indicator-prehydration-script';

export interface SeparatorState {
  orientation: 'horizontal' | 'vertical';
}
export interface SeparatorProps extends BaseProps<SeparatorState> {
  orientation?: SeparatorState['orientation'] | undefined;
  decorative?: boolean | undefined;
}
export function Separator(props: SeparatorProps) {
  return renderElement(
    'div',
    props,
    {
      get orientation() {
        return props.orientation ?? 'horizontal';
      },
    },
    {
      get role() {
        return props.decorative ? 'none' : 'separator';
      },
      get 'aria-orientation'() {
        return props.decorative ? undefined : (props.orientation ?? 'horizontal');
      },
    },
  );
}
export namespace Separator {
  export type Props = SeparatorProps;
  export type State = SeparatorState;
}
interface DisclosureContext {
  open: () => boolean;
  setOpen: (value: boolean, event?: Event, reason?: string) => boolean;
  disabled: () => boolean;
  id: string;
  index?: () => number;
  triggerId?: () => string | undefined;
  setTriggerId?: (id: string | undefined) => void;
  panelId?: () => string | undefined;
  setPanelId?: (id: string | undefined) => void;
  panelProps?: { hiddenUntilFound?: boolean; keepMounted?: boolean };
}
const Disclosure = createContext<DisclosureContext | null>(null);
export type CollapsibleRootChangeEventReason = 'trigger-press' | 'none';
export type CollapsibleRootChangeEventDetails = ChangeEventDetails & {
  reason: CollapsibleRootChangeEventReason;
};
/** The values supplied to the native Solid root render callback. */
export interface CollapsibleRootState {
  open: boolean;
  disabled: boolean;
}
export interface CollapsibleRootProps extends BaseProps<CollapsibleRootState> {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: CollapsibleRootChangeEventDetails) => void;
  disabled?: boolean;
}
export interface CollapsibleTriggerState extends CollapsibleRootState {}
export interface CollapsibleTriggerProps extends BaseProps<CollapsibleTriggerState> {
  disabled?: boolean;
}
/** The values supplied to the native Solid panel render callback. */
export interface CollapsiblePanelState {
  open: boolean;
  closed: boolean;
  startingStyle: boolean;
  endingStyle: boolean;
}
export interface CollapsiblePanelProps extends BaseProps<CollapsiblePanelState> {
  hiddenUntilFound?: boolean;
  keepMounted?: boolean;
}
function CollapsibleRoot(props: CollapsibleRootProps): JSX.Element;
function CollapsibleRoot(props: BaseProps<any>) {
  const [open, setOpen] = createControllable(props, 'open', false);
  const context: DisclosureContext = {
    open,
    setOpen,
    disabled: () => !!props.disabled,
    id: createUniqueId(),
    panelProps: props as { hiddenUntilFound?: boolean; keepMounted?: boolean },
  };
  return (
    <Disclosure value={context}>
      {renderElement('div', props, {
        get open() {
          return open();
        },
        get disabled() {
          return context.disabled();
        },
      })}
    </Disclosure>
  );
}
namespace CollapsibleRoot {
  export type State = CollapsibleRootState;
  export type Props = CollapsibleRootProps;
  export type ChangeEventReason = CollapsibleRootChangeEventReason;
  export type ChangeEventDetails = CollapsibleRootChangeEventDetails;
}
function CollapsibleTrigger(props: CollapsibleTriggerProps): JSX.Element;
function CollapsibleTrigger(props: BaseProps<any>) {
  const context = useContext(Disclosure)!;
  return renderElement(
    'button',
    props,
    {
      get open() {
        return context.open();
      },
      get disabled() {
        return context.disabled();
      },
    },
    {
      type: 'button',
      get disabled() {
        return props.disabled ?? context.disabled();
      },
      get 'aria-expanded'() {
        return context.open();
      },
      'aria-controls': context.id,
      onClick: (event: MouseEvent) => context.setOpen(!context.open(), event, 'trigger-press'),
    },
  );
}
namespace CollapsibleTrigger {
  export type State = CollapsibleTriggerState;
  export type Props = CollapsibleTriggerProps;
}
function CollapsiblePanel(props: CollapsiblePanelProps): JSX.Element;
function CollapsiblePanel(props: BaseProps<any>) {
  const context = useContext(Disclosure)!;
  const [element, setElement] = createSignal<HTMLElement | undefined>(undefined);
  const initiallyOpen = untrack(context.open);
  const [present, setPresent] = createSignal(initiallyOpen);
  const [phase, setPhase] = createSignal<'starting' | 'ending'>();
  const [suppressMountMotion, setSuppressMountMotion] = createSignal(initiallyOpen);
  const [dimensions, setDimensions] = createSignal<{ height?: number; width?: number }>({});
  const frame = useAnimationFrame();
  const hiddenUntilFound = () => props.hiddenUntilFound ?? context.panelProps?.hiddenUntilFound;
  const keepMounted = () => props.keepMounted ?? context.panelProps?.keepMounted;
  const panelProps = new Proxy(props, {
    get(target, key) {
      if (key !== 'style') return Reflect.get(target, key);
      return (state: unknown) => {
        const incoming = typeof target.style === 'function' ? target.style(state) : target.style;
        if (!context.open() || !suppressMountMotion()) return incoming;
        return typeof incoming === 'string'
          ? `${incoming};animation-name:none`
          : { ...(incoming ?? {}), 'animation-name': 'none' };
      };
    },
  });
  let firstMeasurement = true;
  createEffect(
    () => ({ element: element(), open: context.open() }),
    ({ element, open }) => {
      if (!element) return;
      let canceled = false;
      if (open) setPresent(true);
      if (firstMeasurement && initiallyOpen && open) {
        firstMeasurement = false;
        return;
      }
      firstMeasurement = false;
      if (!open) setSuppressMountMotion(false);

      // Consumer children can size themselves from these variables. Measure
      // their natural size, not the previous pixel value fed back into layout.
      const names = [
        '--collapsible-panel-height',
        '--collapsible-panel-width',
        '--accordion-panel-height',
        '--accordion-panel-width',
      ];
      const previous = names.map((name) => element.style.getPropertyValue(name));
      names.forEach((name) => element.style.setProperty(name, 'auto'));
      const measured = { height: element.scrollHeight, width: element.scrollWidth };
      names.forEach((name, index) => element.style.setProperty(name, previous[index]));
      setDimensions(measured);
      setPhase(open ? 'starting' : 'ending');

      const finish = () => {
        if (canceled || context.open() !== open) return;
        if (!open) setPresent(false);
        // At rest, retain natural layout. Writing measurements on every resize
        // would make padding accumulate and can cause a ResizeObserver loop.
        setDimensions({});
        setPhase(undefined);
      };
      const waitForMotion = () => {
        const animations = (element.getAnimations?.() ?? []).filter(
          (animation) => animation.effect?.getComputedTiming().iterations !== Infinity,
        );
        if (animations.length)
          void Promise.allSettled(animations.map((animation) => animation.finished)).then(finish);
        else finish();
      };
      const style = element.ownerDocument.defaultView?.getComputedStyle(element);
      const hasDuration = (value: string | undefined) =>
        (value ?? '').split(',').some((part) => Number.parseFloat(part) > 0);
      const hasAnimation = hasDuration(style?.animationDuration) &&
        (style?.animationName ?? '').split(',').some((name) => name.trim() !== '' && name.trim() !== 'none');
      const hasTransition = hasDuration(style?.transitionDuration);
      if (!open && !hasAnimation && !hasTransition) {
        finish();
        return;
      }
      frame.request(() => {
        if (open) {
          setPhase(undefined);
          frame.request(waitForMotion);
        } else waitForMotion();
      });
      return () => {
        canceled = true;
        frame.cancel();
      };
    },
  );
  return (
    <Show when={context.open() || present() || keepMounted() || hiddenUntilFound()}>
      {renderElement(
        'div',
        panelProps,
        {
          get open() {
            return context.open();
          },
          get disabled() {
            return context.disabled();
          },
          get closed() {
            return !context.open();
          },
          get startingStyle() {
            return phase() === 'starting';
          },
          get endingStyle() {
            return phase() === 'ending';
          },
        },
        {
          id: context.id,
          ref: setElement,
          get hidden() {
            return !context.open() && !present()
              ? hiddenUntilFound()
                ? 'until-found'
                : true
              : undefined;
          },
          onBeforeMatch: (event: Event) => context.setOpen(true, event, 'none'),
          get style() {
            return {
              '--collapsible-panel-height':
                dimensions().height === undefined ? 'auto' : `${dimensions().height}px`,
              '--collapsible-panel-width':
                dimensions().width === undefined ? 'auto' : `${dimensions().width}px`,
              '--accordion-panel-height':
                dimensions().height === undefined ? 'auto' : `${dimensions().height}px`,
              '--accordion-panel-width':
                dimensions().width === undefined ? 'auto' : `${dimensions().width}px`,
              'animation-name': context.open() && suppressMountMotion() ? 'none' : undefined,
            };
          },
        },
      )}
    </Show>
  );
}
namespace CollapsiblePanel {
  export type State = CollapsiblePanelState;
  export type Props = CollapsiblePanelProps;
}
export const Collapsible = {
  Root: CollapsibleRoot,
  Trigger: CollapsibleTrigger,
  Panel: CollapsiblePanel,
};

interface AccordionContext {
  props: AccordionRootProps<any>;
  value: () => unknown[];
  setValue: (value: unknown[], event?: Event, reason?: string) => boolean;
  id: string;
  itemOrder: () => string[];
  registerItem: (id: string) => () => void;
}
export type AccordionValue<Value = any> = Value[];
export type AccordionRootChangeEventReason = 'trigger-press' | 'none';
export type AccordionRootChangeEventDetails = ChangeEventDetails & {
  reason: AccordionRootChangeEventReason;
};
/** The values supplied to the native Solid root render callback. */
export interface AccordionRootState {
  orientation: 'horizontal' | 'vertical';
}
export interface AccordionRootProps<Value = any> extends BaseProps<AccordionRootState> {
  value?: AccordionValue<Value>;
  defaultValue?: AccordionValue<Value>;
  onValueChange?: (
    value: AccordionValue<Value>,
    details: AccordionRootChangeEventDetails,
  ) => void;
  disabled?: boolean;
  multiple?: boolean;
  collapsible?: boolean;
  orientation?: AccordionRootState['orientation'];
  keepMounted?: boolean;
  hiddenUntilFound?: boolean;
}
export interface AccordionItemState {
  open: boolean;
  disabled: boolean;
}
export interface AccordionItemProps extends BaseProps<AccordionItemState> {
  value?: unknown;
  disabled?: boolean;
  onOpenChange?: (open: boolean, details: ChangeEventDetails) => void;
}
export interface AccordionTriggerState {
  panelOpen: boolean;
  disabled: boolean;
}
export interface AccordionTriggerProps extends BaseProps<AccordionTriggerState> {
  disabled?: boolean;
}
export interface AccordionPanelState {
  open: boolean;
  closed: boolean;
  startingStyle: boolean;
  endingStyle: boolean;
}
export interface AccordionPanelProps extends BaseProps<AccordionPanelState> {
  keepMounted?: boolean;
  hiddenUntilFound?: boolean;
}
export type AccordionHeaderProps = BaseProps;
const Accordions = createContext<AccordionContext | null>(null);
function AccordionRoot<Value = any>(props: AccordionRootProps<Value>) {
  const [value, setValue] = createControllable<unknown[]>(props, 'value', []);
  const [itemOrder, setItemOrder] = createSignal<string[]>([]);
  const direction = useDirection();
  const context = {
    props,
    value,
    setValue,
    id: createUniqueId(),
    itemOrder,
    registerItem(id: string) {
      setItemOrder((current) => [...current, id]);
      return () => setItemOrder((current) => current.filter((item) => item !== id));
    },
  };
  if (process.env.NODE_ENV !== 'production' && props.hiddenUntilFound && props.keepMounted === false)
    console.warn('Base UI: The `keepMounted={false}` prop on `Accordion.Root` is ignored when `hiddenUntilFound` is enabled, since panels must remain mounted while closed.');
  return (
    <Accordions value={context}>
      {renderElement(
        'div',
        props,
        {
          get orientation() {
            return props.orientation ?? 'vertical';
          },
          get disabled() {
            return !!props.disabled;
          },
        },
        {
          onKeyDown(event: KeyboardEvent) {
            const horizontal = props.orientation === 'horizontal';
            const nextKey = horizontal
              ? direction() === 'rtl'
                ? 'ArrowLeft'
                : 'ArrowRight'
              : 'ArrowDown';
            const previousKey = horizontal
              ? direction() === 'rtl'
                ? 'ArrowRight'
                : 'ArrowLeft'
              : 'ArrowUp';
            if (![nextKey, previousKey, 'Home', 'End'].includes(event.key)) return;
            const items = Array.from(
              (event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>(
                '[data-accordion-trigger]:not(:disabled)',
              ),
            );
            const index = items.indexOf(event.target as HTMLButtonElement);
            if (index < 0 || !items.length) return;
            event.preventDefault();
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? items.length - 1
                  : (index + (event.key === nextKey ? 1 : -1) + items.length) % items.length;
            items[next]?.focus();
          },
        },
      )}
    </Accordions>
  );
}
function AccordionItem(props: AccordionItemProps) {
  const root = useContext(Accordions);
  if (!root)
    throw new Error('Base UI: AccordionRootContext is missing. Accordion parts must be placed within <Accordion.Root>.');
  const id = createUniqueId();
  const [triggerId, setTriggerId] = createSignal<string | undefined>();
  const [panelId, setPanelId] = createSignal<string | undefined>();
  createEffect(() => id, (itemId) => root.registerItem(itemId));
  const value = () => props.value ?? id;
  const open = () => root.value().includes(value());
  const disabled = () => !!(props.disabled || root.props.disabled);
  const setOpen = (next: boolean, event?: Event, reason = 'trigger-press') => {
    if (disabled() || (!next && root.props.collapsible === false)) return false;
    if (next === open()) return false;
    const details = eventDetails(event, reason);
    props.onOpenChange?.(next, details);
    if (details.isCanceled) return false;
    return root.setValue(
      next
        ? !root.props.multiple
          ? [value()]
          : [...root.value(), value()]
        : root.value().filter((item) => item !== value()),
      event,
      reason,
    );
  };
  return (
    <Disclosure value={{ id, open, setOpen, disabled, index: () => root.itemOrder().indexOf(id), triggerId, setTriggerId, panelId, setPanelId, panelProps: root.props }}>
      {renderElement('div', props, {
        get open() {
          return open();
        },
        get disabled() {
          return disabled();
        },
      })}
    </Disclosure>
  );
}
function AccordionTrigger(props: AccordionTriggerProps) {
  const context = useContext(Disclosure)!;
  const disabled = () => Boolean(props.disabled || context.disabled());
  let spacePressed = false;
  createEffect(() => props.id ?? `${context.id}-trigger`, (id) => {
    context.setTriggerId?.(id);
    return () => context.setTriggerId?.(undefined);
  });
  return renderElement(
    'button',
    omitProps(props, ['disabled']),
    {
      get panelOpen() {
        return context.open();
      },
      get disabled() {
        return disabled();
      },
    },
    {
      get id() {
        return props.id ?? `${context.id}-trigger`;
      },
      type: props.nativeButton === false ? undefined : 'button',
      role: props.nativeButton === false ? 'button' : undefined,
      'data-accordion-trigger': '',
      get 'data-index'() {
        const index = context.index?.() ?? -1;
        return index < 0 ? undefined : String(index);
      },
      tabIndex: 0,
      get 'aria-disabled'() {
        return disabled();
      },
      get 'aria-expanded'() {
        return context.open();
      },
      get 'aria-controls'() {
        return context.open()
          ? context.panelId?.() ?? (isServer ? context.id : undefined)
          : undefined;
      },
      onClick(event: MouseEvent) {
        if (disabled()) event.preventDefault();
        else context.setOpen(!context.open(), event, 'trigger-press');
      },
      onKeyDown(event: KeyboardEvent) {
        if (disabled() && ['Enter', ' '].includes(event.key)) {
          event.preventDefault();
          return;
        }
        if (props.nativeButton === false && event.key === ' ') {
          event.preventDefault();
          spacePressed = true;
        } else if (props.nativeButton === false && event.key === 'Enter') {
          event.preventDefault();
          context.setOpen(!context.open(), event, 'trigger-press');
        }
      },
      onKeyUp(event: KeyboardEvent) {
        if (props.nativeButton === false && event.key === ' ' && spacePressed) {
          spacePressed = false;
          if (!disabled()) context.setOpen(!context.open(), event, 'trigger-press');
        }
      },
    },
  );
}
function AccordionPanel(props: AccordionPanelProps) {
  const context = useContext(Disclosure)!;
  createEffect(() => props.id ?? context.id, (id) => {
    context.setPanelId?.(id);
    return () => context.setPanelId?.(undefined);
  });
  if (
    process.env.NODE_ENV !== 'production' &&
    props.keepMounted === false &&
    (props.hiddenUntilFound ?? context.panelProps?.hiddenUntilFound)
  )
    console.warn('Base UI: The `keepMounted={false}` prop on an `Accordion.Panel` is ignored when `hiddenUntilFound` is enabled on the panel or root, since the panel must remain mounted while closed.');
  const panelProps = new Proxy(props, {
    ownKeys: (target) => [...new Set([...Reflect.ownKeys(target), 'role', 'aria-labelledby'])],
    getOwnPropertyDescriptor: (_target, key) => ({
      configurable: true,
      enumerable: true,
      get: () => panelProps[key as keyof typeof panelProps],
    }),
    get: (target, key) => key === 'role'
      ? target.role ?? 'region'
      : key === 'aria-labelledby'
        ? target['aria-labelledby'] ?? context.triggerId?.() ??
          (isServer ? `${context.id}-trigger` : undefined)
        : Reflect.get(target, key),
  });
  return CollapsiblePanel(panelProps);
}
function AccordionHeader(props: AccordionHeaderProps) {
  const context = useContext(Disclosure);
  if (!context)
    throw new Error('Base UI: AccordionItemContext is missing. Accordion parts must be placed within <Accordion.Item>.');
  return renderElement('h3', props, {
    get open() {
      return context.open();
    },
    get disabled() {
      return context.disabled();
    },
  });
}
export const Accordion = {
  Root: AccordionRoot,
  Item: AccordionItem,
  Header: AccordionHeader,
  Trigger: AccordionTrigger,
  Panel: AccordionPanel,
};
export namespace Accordion {
  export namespace Root {
    export type Props<Value = any> = AccordionRootProps<Value>;
    export type State = AccordionRootState;
    export type Value<Item = any> = AccordionValue<Item>;
    export type ChangeEventReason = AccordionRootChangeEventReason;
    export type ChangeEventDetails = AccordionRootChangeEventDetails;
  }
}

interface TabsContext {
  props: BaseProps;
  value: () => unknown;
  setValue: (value: unknown, event?: Event, reason?: string) => boolean;
  id: string;
  active: () => HTMLElement | undefined;
  setActive: (element: HTMLElement | undefined) => void;
  listElement: () => HTMLElement | undefined;
  setListElement: (element: HTMLElement | undefined) => void;
  values: Map<unknown, string>;
  tabIds: Map<unknown, string>;
  mountedPanels: () => Map<unknown, { id: string; token: object }>;
  registerPanel: (value: unknown, id: string) => () => void;
  tabs: () => TabsEntry[];
  registerTab: (entry: TabsEntry) => () => void;
  highlighted: () => unknown;
  setHighlighted: (value: unknown) => void;
  activateOnFocus: () => boolean;
  setActivateOnFocus: (value: boolean) => void;
  activationDirection: () => 'left' | 'right' | 'up' | 'down' | 'none';
}
interface TabsEntry {
  token: object;
  value: unknown;
  disabled: boolean;
  element: HTMLElement;
}
type TabDirection = 'left' | 'right' | 'up' | 'down' | 'none';
function tabDirection(
  oldValue: unknown,
  nextValue: unknown,
  orientation: unknown,
  entries: TabsEntry[],
): TabDirection {
  if (oldValue == null || nextValue == null) return 'none';
  const vertical = orientation === 'vertical';
  const previous = entries.find((entry) => Object.is(entry.value, oldValue))?.element;
  const next = entries.find((entry) => Object.is(entry.value, nextValue))?.element;
  if (!previous || !next) {
    if (previous !== next &&
        (typeof oldValue === 'number' || typeof oldValue === 'string') &&
        typeof oldValue === typeof nextValue)
      return (nextValue as number | string) > (oldValue as number | string)
        ? vertical ? 'down' : 'right'
        : vertical ? 'up' : 'left';
    return 'none';
  }
  const oldPosition = previous.getBoundingClientRect()[vertical ? 'top' : 'left'];
  const nextPosition = next.getBoundingClientRect()[vertical ? 'top' : 'left'];
  return nextPosition < oldPosition ? vertical ? 'up' : 'left' :
    nextPosition > oldPosition ? vertical ? 'down' : 'right' : 'none';
}
const TabsContext = createContext<TabsContext | null>(null);
const TabsListContext = createContext(false);
function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context)
    throw new Error('Base UI: TabsRootContext is missing. Tabs parts must be placed within <Tabs.Root>.');
  return context;
}
function TabsRoot(props: BaseProps) {
  const initialDefault = untrack(() => props.defaultValue === undefined ? 0 : props.defaultValue);
  const [localValue, setLocalValue] = createSignal<unknown>(initialDefault);
  const value = () => props.value !== undefined ? props.value : localValue();
  const setValue = (next: unknown, event?: Event, reason = 'none') => {
    if (Object.is(value(), next)) return false;
    const details = Object.assign(eventDetails(event, reason), {
      activationDirection: tabDirection(value(), next, props.orientation, orderedTabs()),
    });
    props.onValueChange?.(next, details);
    if (details.isCanceled) return false;
    if (props.value === undefined) setLocalValue(() => next);
    return true;
  };
  const [active, setActive] = createSignal<HTMLElement | undefined>(undefined);
  const [listElement, setListElement] = createSignal<HTMLElement | undefined>(undefined);
  const [mountedPanels, setMountedPanels] = createSignal(new Map<unknown, { id: string; token: object }>());
  const [tabs, setTabs] = createSignal<TabsEntry[]>([]);
  const [highlighted, setHighlighted] = createSignal<unknown>(initialDefault);
  const [activateOnFocus, setActivateOnFocus] = createSignal(false);
  let shouldNotifyInitial = untrack(() => props.defaultValue === undefined);
  let shouldHonorDisabledDefault = !shouldNotifyInitial;
  let didRegisterTabs = false;
  let previousTabEntries: TabsEntry[] = [];
  let revision = 0;
  let disposed = false;
  onCleanup(() => {
    disposed = true;
    ++revision;
  });
  const orderedTabs = () => tabs().filter((entry) => entry.element.isConnected).toSorted((a, b) =>
    a.element === b.element ? 0 :
      a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );
  let previousValue = untrack(value);
  let transitionFrom = previousValue;
  let lastDirection: TabDirection = 'none';
  const activationDirection = createMemo(() => {
    const current = value();
    const entries = orderedTabs();
    if (!Object.is(previousValue, current)) {
      transitionFrom = previousValue;
      previousValue = current;
      lastDirection = tabDirection(transitionFrom, current, props.orientation, entries);
    } else if (!Object.is(transitionFrom, current)) {
      lastDirection = tabDirection(transitionFrom, current, props.orientation, entries);
    }
    return lastDirection;
  });
  const notifyAutomatic = (next: unknown, reason: 'initial' | 'disabled' | 'missing') => {
    previousValue = next;
    transitionFrom = next;
    lastDirection = 'none';
    setLocalValue(() => next);
    props.onValueChange?.(next, Object.assign(eventDetails(undefined, reason), {
      activationDirection: 'none',
    }));
    shouldNotifyInitial = false;
  };
  function reconcileTabs() {
    const entries = orderedTabs();
    const selectedValue = value();
    const formerSelectedIndex = previousTabEntries.findIndex((entry) =>
      Object.is(entry.value, selectedValue));
    previousTabEntries = entries;
    const focused = typeof document === 'undefined'
      ? undefined
      : entries.find((entry) => entry.element === document.activeElement);
    if (!focused) {
      const selectedEntry = entries.find((entry) => Object.is(entry.value, selectedValue));
      const selectedForFocus = selectedEntry && !selectedEntry.disabled ? selectedEntry : undefined;
      const priorHighlight = entries.find((entry) => Object.is(entry.value, highlighted()));
      const successor = !selectedEntry && formerSelectedIndex >= 0 && entries.length
        ? entries[formerSelectedIndex % entries.length]
        : undefined;
      setHighlighted(() => selectedForFocus?.value ??
        (selectedEntry?.disabled
          ? priorHighlight && !priorHighlight.disabled ? priorHighlight.value : undefined
          : successor?.value ?? priorHighlight?.value) ??
        entries.find((entry) => !entry.disabled)?.value);
    }
    if (props.value !== undefined) return;
    if (!entries.length) {
      if (didRegisterTabs && selectedValue !== null)
        notifyAutomatic(null, 'missing');
      return;
    }
    didRegisterTabs = true;
    const selected = entries.find((entry) => Object.is(entry.value, selectedValue));
    const firstEnabled = entries.find((entry) => !entry.disabled)?.value ?? null;
    const selectionIsMissing = !selected && selectedValue !== null;
    if (!selected?.disabled && Object.is(selectedValue, initialDefault))
      shouldHonorDisabledDefault = false;
    if (shouldHonorDisabledDefault && selected?.disabled &&
        Object.is(selectedValue, initialDefault)) return;
    if (selected?.disabled || selectionIsMissing) {
      if (Object.is(selectedValue, firstEnabled)) {
        shouldNotifyInitial = false;
        return;
      }
      notifyAutomatic(firstEnabled,
        shouldNotifyInitial ? 'initial' : selected?.disabled ? 'disabled' : 'missing');
      return;
    }
    if (shouldNotifyInitial && selected) {
      props.onValueChange?.(selectedValue, Object.assign(eventDetails(undefined, 'initial'), {
        activationDirection: 'none',
      }));
      shouldNotifyInitial = false;
    }
  }
  createEffect(
    () => [tabs(), value(), props.value] as const,
    () => {
      const current = ++revision;
      queueMicrotask(() => {
        if (!disposed && current === revision) reconcileTabs();
      });
    },
  );
  const context: TabsContext = {
    props,
    value,
    setValue,
    id: createUniqueId(),
    active,
    setActive,
    listElement,
    setListElement,
    values: new Map(),
    tabIds: new Map(),
    mountedPanels,
    tabs,
    highlighted,
    setHighlighted: (next) => setHighlighted(() => next),
    activateOnFocus,
    setActivateOnFocus,
    activationDirection,
    registerTab(entry) {
      setTabs((previous) => {
        const index = previous.findIndex((item) => item.token === entry.token);
        if (index < 0) return [...previous, entry];
        const next = [...previous];
        next[index] = entry;
        return next;
      });
      return () => queueMicrotask(() => setTabs((previous) =>
        previous.filter((item) => item !== entry)));
    },
    registerPanel(panelValue, id) {
      const token = {};
      setMountedPanels((previous) => new Map(previous).set(panelValue, { id, token }));
      return () => queueMicrotask(() => setMountedPanels((previous) => {
        if (previous.get(panelValue)?.token !== token) return previous;
        const next = new Map(previous);
        next.delete(panelValue);
        return next;
      }));
    },
  };
  let lastDefault = untrack(() => props.defaultValue);
  let defaultObserved = false;
  createEffect(
    () => props.defaultValue,
    (next) => {
      if (defaultObserved && !Object.is(next, lastDefault) && untrack(() => props.value) === undefined)
        console.error('Base UI: A component is changing the default value state of an uncontrolled Tabs after being initialized.');
      defaultObserved = true;
      lastDefault = next;
    },
  );
  return (
    <TabsContext value={context}>
      {renderElement('div', omitProps(props, ['value']), {
        get orientation() {
          return props.orientation ?? 'horizontal';
        },
        get tabActivationDirection() {
          return activationDirection();
        },
      }, {
        get 'data-activation-direction'() {
          return activationDirection();
        },
      })}
    </TabsContext>
  );
}
function TabsList(props: BaseProps) {
  const context = useTabsContext();
  const dir = useDirection();
  createEffect(() => Boolean(props.activateOnFocus), (value) => {
    context.setActivateOnFocus(value);
  });
  return <TabsListContext value={true}>{renderElement(
    'div',
    props,
    {
      get orientation() {
        return context.props.orientation ?? 'horizontal';
      },
      get tabActivationDirection() {
        return context.activationDirection();
      },
    },
    {
      role: 'tablist',
      ref(element: HTMLElement) {
        context.setListElement(element);
      },
      get 'aria-orientation'() {
        return context.props.orientation === 'vertical' ? 'vertical' : undefined;
      },
      get 'data-activation-direction'() {
        return context.activationDirection();
      },
      onKeyDown(event: KeyboardEvent) {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        const vertical = context.props.orientation === 'vertical';
        const next = vertical ? 'ArrowDown' : dir() === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
        const previous = vertical ? 'ArrowUp' : dir() === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
        if (![next, previous, 'Home', 'End'].includes(event.key)) return;
        const tabs = Array.from(
          (event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(
            '[role="tab"]',
          ),
        );
        const index = tabs.indexOf(event.target as HTMLElement);
        if (index < 0 || !tabs.length) return;
        event.preventDefault();
        const offset = event.key === next ? 1 : -1;
        let i =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tabs.length - 1
              : props.loopFocus === false
                ? Math.max(0, Math.min(tabs.length - 1, index + offset))
                : (index + offset + tabs.length) % tabs.length;
        for (let attempts = 0; attempts < tabs.length && tabs[i]?.matches(':disabled, [hidden]'); attempts++) {
          const candidate = i + offset;
          i = props.loopFocus === false
            ? Math.max(0, Math.min(tabs.length - 1, candidate))
            : (candidate + tabs.length) % tabs.length;
        }
        tabs[i]?.focus();
      },
    },
  )}</TabsListContext>;
}
function tabId(context: TabsContext, value: unknown) {
  if (!context.values.has(value)) context.values.set(value, `${context.id}-${context.values.size}`);
  return context.values.get(value)!;
}
function TabsTab(props: BaseProps) {
  const context = useTabsContext();
  if (!useContext(TabsListContext))
    throw new Error('Base UI: TabsListContext is missing. TabsList parts must be placed within <Tabs.List>.');
  const selected = () => context.value() === props.value;
  const token = {};
  let pressing = false;
  let mainButton = false;
  const generatedId = `${tabId(context, untrack(() => props.value))}-tab`;
  const actualId = () => props.id ?? generatedId;
  context.tabIds.set(untrack(() => props.value), untrack(actualId));
  createEffect(() => [props.value, actualId()] as const, ([value, id]) => {
    context.tabIds.set(value, id);
  });
  onCleanup(() => {
    const value = untrack(() => props.value);
    if (context.tabIds.get(value) === untrack(actualId)) context.tabIds.delete(value);
  });
  const [element, setElement] = createSignal<HTMLElement | undefined>(undefined);
  createEffect(
    () => [props.value, Boolean(props.disabled), element()] as const,
    ([value, disabled, node]) => node
      ? context.registerTab({ token, value, disabled, element: node })
      : undefined,
  );
  createEffect(
    () => ({ selected: selected(), element: element() }),
    ({ selected, element }) => {
      if (selected) context.setActive(element);
    },
  );
  return createMemo(() => {
    // A render target can change element type after mount.
    props.render;
    return untrack(() => renderElement(
    'button',
    omitProps(props, ['value', 'disabled', 'ref']),
    {
      get active() {
        return selected();
      },
      get disabled() {
        return !!props.disabled;
      },
      get orientation() {
        return context.props.orientation ?? 'horizontal';
      },
      get tabActivationDirection() {
        return context.activationDirection();
      },
    },
    {
      type: 'button',
      role: 'tab',
      ref(element: HTMLElement) {
        setElement(element);
        assignRef(props.ref, element);
      },
      get id() {
        return actualId();
      },
      get 'aria-controls'() {
        return context.mountedPanels().get(props.value)?.id;
      },
      get 'aria-selected'() {
        return selected();
      },
      get 'data-activation-direction'() {
        return context.activationDirection();
      },
      get 'aria-disabled'() {
        return props.disabled || undefined;
      },
      get tabIndex() {
        return Object.is(context.highlighted(), props.value) &&
          !(props.disabled && selected()) ? 0 : -1;
      },
      onFocus(event: FocusEvent) {
        context.setHighlighted(props.value);
        if (!props.disabled && !selected() && context.activateOnFocus() &&
            (!pressing || mainButton))
          context.setValue(props.value, event, 'none');
      },
      onPointerDown(event: PointerEvent) {
        pressing = true;
        mainButton = event.button === 0;
        const owner = (event.currentTarget as HTMLElement).ownerDocument;
        const end = () => {
          pressing = false;
          mainButton = false;
          owner.removeEventListener('pointerup', end);
          owner.removeEventListener('pointercancel', end);
        };
        owner.addEventListener('pointerup', end);
        owner.addEventListener('pointercancel', end);
      },
      onClick(event: MouseEvent) {
        if (!props.disabled && event.button === 0) context.setValue(props.value, event, 'none');
      },
    },
    ));
  }) as unknown as JSX.Element;
}
function TabsPanel(props: BaseProps) {
  const context = useTabsContext();
  const selected = () => context.value() === props.value;
  const [mounted, setMounted] = createSignal(untrack(selected));
  const [phase, setPhase] = createSignal<'starting' | 'ending' | 'idle'>('idle');
  let panelElement: HTMLElement | undefined;
  let frame = 0;
  let exitTimer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  const animationsDisabled = () =>
    (globalThis as typeof globalThis & { BASE_UI_ANIMATIONS_DISABLED?: boolean })
      .BASE_UI_ANIMATIONS_DISABLED === true;
  createEffect(selected, (open) => {
    const current = ++generation;
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
    if (exitTimer !== undefined) clearTimeout(exitTimer);
    if (open) {
      setMounted(true);
      if (animationsDisabled()) {
        setPhase('idle');
      } else {
        setPhase('starting');
        frame = requestAnimationFrame(() => {
          if (current === generation) setPhase('idle');
        });
      }
      return;
    }
    if (props.keepMounted || animationsDisabled()) {
      setPhase('idle');
      setMounted(false);
      return;
    }
    setPhase('ending');
    frame = requestAnimationFrame(() => {
      if (current !== generation) return;
      const animations = (panelElement?.getAnimations() ?? []).filter((animation) =>
        animation.effect?.getComputedTiming().iterations !== Infinity);
      const finish = () => {
        if (current === generation) {
          setMounted(false);
          setPhase('idle');
        }
      };
      if (animations.length)
        void Promise.allSettled(animations.map((animation) => animation.finished)).then(finish);
      else {
        const style = panelElement ? getComputedStyle(panelElement) : undefined;
        const duration = (value: string | undefined) => Math.max(0, ...String(value ?? '0s')
          .split(',').map((part) => {
            const amount = parseFloat(part);
            return Number.isFinite(amount) ? amount * (part.trim().endsWith('ms') ? 1 : 1000) : 0;
          }));
        const animationTime = style?.animationName === 'none' ? 0 : duration(style?.animationDuration);
        const transitionTime = style?.transitionProperty === 'none' ? 0 : duration(style?.transitionDuration);
        const remaining = Math.max(animationTime, transitionTime);
        if (remaining > 0) exitTimer = setTimeout(finish, remaining + 20);
        else finish();
      }
    });
  });
  onCleanup(() => {
    ++generation;
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
    if (exitTimer !== undefined) clearTimeout(exitTimer);
  });
  const generatedId = createUniqueId();
  const actualId = () => props.id ?? generatedId;
  createEffect(
    () => [props.value, actualId(), mounted(), Boolean(props.keepMounted)] as const,
    ([value, id, isMounted, keepMounted]) =>
      isMounted || keepMounted ? context.registerPanel(value, id) : undefined,
  );
  return (
    <Show when={mounted() || props.keepMounted}>
      {renderElement(
        'div',
        omitProps(props, ['value']),
        {
          get hidden() {
            return !selected();
          },
          get orientation() {
            return context.props.orientation ?? 'horizontal';
          },
          get tabActivationDirection() {
            return context.activationDirection();
          },
          get transitionStatus() {
            return phase();
          },
        },
        {
          role: 'tabpanel',
          ref(element: HTMLElement) {
            panelElement = element;
            assignRef(props.ref, element);
          },
          get tabIndex() {
            return selected() ? 0 : -1;
          },
          get id() {
            return actualId();
          },
          get 'data-index'() {
            const index = context.tabs().findIndex((entry) => Object.is(entry.value, props.value));
            return index < 0 ? undefined : index;
          },
          get 'aria-labelledby'() {
            return context.tabIds.get(props.value);
          },
          get 'data-activation-direction'() {
            return context.activationDirection();
          },
          get hidden() {
            return !selected();
          },
          get 'data-starting-style'() {
            return phase() === 'starting' ? '' : undefined;
          },
          get 'data-ending-style'() {
            return phase() === 'ending' ? '' : undefined;
          },
        },
      )}
    </Show>
  );
}
interface TabsIndicatorGeometry {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}
function tabsIndicatorCssDimensions(element: HTMLElement) {
  const computed = element.ownerDocument.defaultView!.getComputedStyle(element);
  let width = parseFloat(computed.width) || 0;
  let height = parseFloat(computed.height) || 0;
  if (Math.round(width) !== element.offsetWidth || Math.round(height) !== element.offsetHeight) {
    width = element.offsetWidth;
    height = element.offsetHeight;
  }
  return { width, height };
}
function tabsIndicatorCumulativeOffset(element: HTMLElement) {
  let left = 0;
  let top = 0;
  let current: HTMLElement | null = element;
  while (current) {
    left += current.offsetLeft;
    top += current.offsetTop;
    const parent = current.offsetParent as HTMLElement | null;
    if (parent) {
      left += parent.clientLeft;
      top += parent.clientTop;
    }
    current = parent;
  }
  return { left, top };
}
function tabsIndicatorLayoutOffset(element: HTMLElement, list: HTMLElement) {
  const tabOffset = tabsIndicatorCumulativeOffset(element);
  const listOffset = tabsIndicatorCumulativeOffset(list);
  let left = tabOffset.left - listOffset.left - list.clientLeft;
  let top = tabOffset.top - listOffset.top - list.clientTop;
  let node = element.parentElement;
  while (node && node !== list) {
    left -= node.scrollLeft;
    top -= node.scrollTop;
    node = node.parentElement;
  }
  return { left, top };
}
function tabsIndicatorTranslation(element: HTMLElement) {
  const style = element.ownerDocument.defaultView!.getComputedStyle(element);
  let x = 0;
  let y = 0;
  const match = style.transform?.match(/matrix(?:3d)?\(([^)]+)\)/);
  if (match) {
    const values = match[1].split(',').map(parseFloat);
    if (values.length === 6) {
      x = values[4];
      y = values[5];
    } else if (values.length === 16) {
      x = values[12];
      y = values[13];
    }
  }
  if (style.translate && style.translate !== 'none') {
    const [translateX, translateY] = style.translate.split(' ');
    const resolve = (value: string | undefined, size: number) => {
      const number = parseFloat(value ?? '');
      if (!Number.isFinite(number)) return 0;
      return value?.endsWith('%') ? (number / 100) * size : number;
    };
    x += resolve(translateX, element.offsetWidth);
    y += resolve(translateY, element.offsetHeight);
  }
  return { x, y };
}
function measureTabsIndicator(element: HTMLElement | undefined, list: HTMLElement | undefined): TabsIndicatorGeometry | null {
  if (!element || !list) return null;
  const { width, height } = tabsIndicatorCssDimensions(element);
  const { width: listWidth, height: listHeight } = tabsIndicatorCssDimensions(list);
  const tabRect = element.getBoundingClientRect();
  const listRect = list.getBoundingClientRect();
  const scaleX = listWidth > 0 ? listRect.width / listWidth : 1;
  const scaleY = listHeight > 0 ? listRect.height / listHeight : 1;
  const layout = tabsIndicatorLayoutOffset(element, list);
  const rectLeft = (tabRect.left - listRect.left) / scaleX + list.scrollLeft - list.clientLeft;
  const rectTop = (tabRect.top - listRect.top) / scaleY + list.scrollTop - list.clientTop;
  const translation = tabsIndicatorTranslation(element);
  const useRect =
    Math.abs(rectLeft - translation.x - layout.left) <= 2 &&
    Math.abs(rectTop - translation.y - layout.top) <= 2;
  const left = useRect ? rectLeft : layout.left;
  const top = useRect ? rectTop : layout.top;
  return {
    left,
    right: list.scrollWidth - left - width,
    top,
    bottom: list.scrollHeight - top - height,
    width,
    height,
  };
}
function TabsIndicator(props: BaseProps) {
  const context = useTabsContext();
  const csp = useContext(CSPContext);
  const [showPrehydrationScript, setShowPrehydrationScript] = createSignal(
    isServer || sharedConfig.hydrating,
  );
  if (!isServer && sharedConfig.hydrating)
    queueMicrotask(() => setShowPrehydrationScript(false));
  const [resizeRevision, setResizeRevision] = createSignal(0);
  createEffect(
    () => ({ list: context.listElement(), tabs: context.tabs().map((entry) => entry.element) }),
    ({ list, tabs }) => {
      if (!list) return;
      const Resize = list.ownerDocument.defaultView?.ResizeObserver;
      if (!Resize) return;
      const observer = new Resize(() => setResizeRevision((revision) => revision + 1));
      observer.observe(list);
      for (const tab of tabs) observer.observe(tab);
      return () => observer?.disconnect();
    },
  );
  const geometry = createMemo(() => {
    resizeRevision();
    const selected = context.tabs().find((entry) => Object.is(entry.value, context.value()));
    return measureTabsIndicator(selected?.element, context.listElement());
  });
  return (
    <Show when={context.value() != null}>
      {renderElement(
        'span',
        omitProps(props, ['renderBeforeHydration']),
        {
          get orientation() {
            return context.props.orientation ?? 'horizontal';
          },
          get tabActivationDirection() {
            return context.activationDirection();
          },
          get activeTabPosition() {
            const measured = geometry();
            if (!measured) return null;
            const { left, right, top, bottom } = measured;
            return { left, right, top, bottom };
          },
          get activeTabSize() {
            const measured = geometry();
            if (!measured) return null;
            const { width, height } = measured;
            return { width, height };
          },
        },
        {
          role: 'presentation',
          get hidden() {
            const measured = geometry();
            return !measured || measured.width <= 0 || measured.height <= 0;
          },
          get style() {
            const measured = geometry();
            if (!measured) return undefined;
            return Object.fromEntries(
              (['left', 'right', 'top', 'bottom', 'width', 'height'] as const)
                .map((key) => [`--active-tab-${key}`, `${measured[key]}px`]),
            );
          },
        },
      )}
      <Show when={props.renderBeforeHydration && showPrehydrationScript()}>
        <script nonce={csp().nonce} innerHTML={isServer ? tabsIndicatorPrehydrationScript : ''} />
      </Show>
    </Show>
  );
}
export const Tabs = {
  Root: TabsRoot,
  List: TabsList,
  Tab: TabsTab,
  Panel: TabsPanel,
  Indicator: TabsIndicator,
};

export type ImageLoadingStatus = 'idle' | 'loading' | 'loaded' | 'error';
export interface AvatarRootState {
  imageLoadingStatus: ImageLoadingStatus;
}
export interface AvatarRootProps extends BaseProps<AvatarRootState> {}
export interface AvatarImageState extends AvatarRootState {
  transitionStatus: 'starting' | 'ending' | 'idle' | undefined;
}
export interface AvatarImageProps extends BaseProps<AvatarImageState> {
  onLoadingStatusChange?: (status: ImageLoadingStatus) => void;
  keepMounted?: boolean;
}
export interface AvatarFallbackState extends AvatarRootState {}
export interface AvatarFallbackProps extends BaseProps<AvatarFallbackState> {
  delay?: number;
}
const avatarStateAttributes = {
  'data-image-loading-status': null,
  'data-imageloadingstatus': null,
};
const AvatarContext = createContext<{
  status: () => ImageLoadingStatus;
  setStatus: (value: ImageLoadingStatus) => void;
  element: () => HTMLElement | undefined;
}>();
export function AvatarRoot(props: AvatarRootProps) {
  const [status, setStatus] = createSignal<ImageLoadingStatus>('idle');
  let element: HTMLElement | undefined;
  return (
    <AvatarContext value={{ status, setStatus, element: () => element }}>
      {renderElement(
        'span',
        props,
        {
          get imageLoadingStatus() {
            return status();
          },
        },
        {
          ...avatarStateAttributes,
          ref: (node: HTMLElement) => {
            element = node;
          },
        },
      )}
    </AvatarContext>
  );
}
export namespace AvatarRoot {
  export type Props = AvatarRootProps;
  export type State = AvatarRootState;
}
export function AvatarImage(props: AvatarImageProps) {
  const context = useContext(AvatarContext)!;
  const [status, setStatus] = createSignal<ImageLoadingStatus>('idle');
  const [element, setElement] = createSignal<HTMLImageElement>();
  const [present, setPresent] = createSignal(false);
  const [phase, setPhase] = createSignal<'starting' | 'ending'>();
  const frame = useAnimationFrame();
  let initialCommit = true;
  let skipInitialMotion = false;

  // Like upstream useImageLoadingStatus, default mode loads off-DOM first.
  // A hidden mounted img is not equivalent: it changes layout/paint history,
  // accessibility, ref timing, and loading="lazy" behavior.
  createEffect(
    () => ({
      src: props.src,
      srcSet: props.srcSet,
      sizes: props.sizes,
      crossOrigin: props.crossOrigin,
      referrerPolicy: props.referrerPolicy,
      keepMounted: !!props.keepMounted,
    }),
    ({ src, srcSet, sizes, crossOrigin, referrerPolicy, keepMounted }) => {
      if (keepMounted) return;
      if (!src && !srcSet) {
        setStatus('error');
        return;
      }
      let active = true;
      const owner = context.element()?.ownerDocument.defaultView ?? window;
      const image = new owner.Image();
      setStatus('loading');
      image.onload = () => {
        if (active) setStatus('loaded');
      };
      image.onerror = () => {
        if (active) setStatus('error');
      };
      if (referrerPolicy) image.referrerPolicy = referrerPolicy;
      image.crossOrigin = crossOrigin ?? null;
      if (sizes) image.sizes = sizes;
      if (srcSet) image.srcset = srcSet;
      if (src) image.src = src;
      if (image.complete) setStatus(image.naturalWidth > 0 ? 'loaded' : 'error');
      return () => {
        active = false;
        image.onload = null;
        image.onerror = null;
      };
    },
  );
  createEffect(
    () => ({
      element: element(),
      keepMounted: !!props.keepMounted,
      src: props.src,
      srcSet: props.srcSet,
      sizes: props.sizes,
      crossOrigin: props.crossOrigin,
      referrerPolicy: props.referrerPolicy,
      render: props.render,
    }),
    ({ element, keepMounted }) => {
      if (!keepMounted || !element) return;
      const first = initialCommit;
      initialCommit = false;
      if (!element.complete) {
        setStatus('loading');
        return;
      }
      const loaded = element.naturalWidth > 0;
      skipInitialMotion = loaded && first;
      setStatus(loaded ? 'loaded' : 'error');
    },
  );
  createEffect(status, (value) => {
    if (value !== 'idle') {
      props.onLoadingStatusChange?.(value);
      context.setStatus(value);
    }
  });
  onCleanup(() => context.setStatus('idle'));
  createEffect(
    () => ({ loaded: status() === 'loaded', keepMounted: !!props.keepMounted }),
    ({ loaded, keepMounted }) => {
      let canceled = false;
      if (loaded) {
        setPresent(true);
        setPhase(skipInitialMotion ? undefined : 'starting');
        skipInitialMotion = false;
        frame.request(() => setPhase(undefined));
      } else if (keepMounted) {
        setPresent(false);
        setPhase(undefined);
      } else if (untrack(present)) {
        setPhase('ending');
        frame.request(() => {
          const animations = (element()?.getAnimations() ?? []).filter(
            (animation) => animation.effect?.getComputedTiming().iterations !== Infinity,
          );
          const finish = () => {
            if (!canceled && status() !== 'loaded') {
              setPresent(false);
              setPhase(undefined);
            }
          };
          if (animations.length)
            void Promise.allSettled(animations.map((animation) => animation.finished)).then(finish);
          else finish();
        });
      }
      return () => {
        canceled = true;
        frame.cancel();
      };
    },
  );
  return (
    <Show when={props.keepMounted || present()}>
      {renderElement(
        'img',
        props,
        {
          get imageLoadingStatus() {
            return status();
          },
          get transitionStatus() {
            return props.keepMounted && phase() === 'ending' ? undefined : phase();
          },
        },
        {
          ...avatarStateAttributes,
          'data-transition-status': null,
          'data-transitionstatus': null,
          ref: setElement,
          get 'data-starting-style'() {
            return phase() === 'starting' ? '' : undefined;
          },
          get 'data-ending-style'() {
            return !props.keepMounted && phase() === 'ending' ? '' : undefined;
          },
          get 'data-loading'() {
            return props.keepMounted && status() === 'loading' ? '' : undefined;
          },
          get 'data-error'() {
            return props.keepMounted && status() === 'error' ? '' : undefined;
          },
          get 'aria-hidden'() {
            return props.keepMounted && status() !== 'loaded' ? true : undefined;
          },
          onLoad() {
            if (props.keepMounted) setStatus('loaded');
          },
          onError() {
            if (props.keepMounted) setStatus('error');
          },
        },
      )}
    </Show>
  );
}
export namespace AvatarImage {
  export type Props = AvatarImageProps;
  export type State = AvatarImageState;
}
export function AvatarFallback(props: AvatarFallbackProps) {
  const context = useContext(AvatarContext)!;
  const [ready, setReady] = createSignal(untrack(() => (props.delay ?? 0) === 0));
  const timer = useTimeout();
  createEffect(
    () => props.delay ?? 0,
    (delay) => {
      if (delay > 0) timer.start(delay, () => setReady(true));
      else setReady(true);
      return timer.clear;
    },
  );
  return (
    <Show when={ready() && context.status() !== 'loaded'}>
      {renderElement(
        'span',
        props,
        {
          get imageLoadingStatus() {
            return context.status();
          },
        },
        avatarStateAttributes,
      )}
    </Show>
  );
}
export namespace AvatarFallback {
  export type Props = AvatarFallbackProps;
  export type State = AvatarFallbackState;
}
export const Avatar = { Root: AvatarRoot, Image: AvatarImage, Fallback: AvatarFallback };

export type ToolbarRootOrientation = import('./types').Orientation;
/** Orientation supplied to the native Solid toolbar render callback. */
export interface ToolbarRootState {
  disabled: boolean;
  orientation: ToolbarRootOrientation;
}
export interface ToolbarRootProps extends BaseProps<ToolbarRootState> {
  orientation?: ToolbarRootOrientation;
  disabled?: boolean;
  loopFocus?: boolean;
}
export type ToolbarSeparatorState = SeparatorState;
export type ToolbarSeparatorProps = SeparatorProps;
interface ToolbarContextValue {
  readonly orientation: ToolbarRootOrientation;
  readonly disabled: boolean;
  ensureTabStop: () => void;
}
const ToolbarContext = createContext<ToolbarContextValue | null>(null);
const ToolbarGroupContext = createContext<(() => boolean) | null>(null);

export function useToolbarRootContext(optional?: boolean): ToolbarContextValue | undefined {
  const context = useContext(ToolbarContext);
  if (!context && !optional)
    throw new Error(
      'Base UI: ToolbarRootContext is missing. Toolbar parts must be placed within <Toolbar.Root>.',
    );
  return context ?? undefined;
}

export function ToolbarRoot(props: ToolbarRootProps) {
  const dir = useDirection();
  let root: HTMLElement | undefined;
  const items = () =>
    Array.from(root?.querySelectorAll<HTMLElement>('[data-toolbar-item]') ?? []).filter(
      (element) =>
        !element.hasAttribute('disabled') &&
        !element.closest('[hidden],[inert],[aria-hidden="true"]') &&
        (element.tagName !== 'A' || element.hasAttribute('href')),
    );
  const setTabStop = (element: HTMLElement) => {
    for (const item of items()) item.tabIndex = item === element ? 0 : -1;
  };
  const ensureTabStop = () => {
    const available = items();
    if (!available.some((item) => item.tabIndex === 0) && available[0]) setTabStop(available[0]);
  };
  const context: ToolbarContextValue = {
    get orientation() {
      return props.orientation ?? 'horizontal';
    },
    get disabled() {
      return !!props.disabled;
    },
    ensureTabStop,
  };
  return (
    <ToolbarContext value={context}>
      {renderElement(
        'div',
        omitProps(props, ['disabled']),
        {
          get orientation() {
            return context.orientation;
          },
          get disabled() {
            return context.disabled;
          },
        },
        {
          role: 'toolbar',
          get 'aria-orientation'() {
            return context.orientation;
          },
          ref(element: HTMLElement) {
            root = element;
            queueMicrotask(ensureTabStop);
          },
          onFocusIn(event: FocusEvent) {
            const target = (event.target as HTMLElement).closest<HTMLElement>('[data-toolbar-item]');
            if (target && root?.contains(target)) setTabStop(target);
          },
          onKeyDown(event: KeyboardEvent) {
            const vertical = context.orientation === 'vertical';
            const next = vertical ? 'ArrowDown' : dir() === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
            const previous = vertical ? 'ArrowUp' : dir() === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
            if (![next, previous, 'Home', 'End'].includes(event.key)) return;
            const elements = items();
            const current = (event.target as HTMLElement).closest<HTMLElement>('[data-toolbar-item]');
            const index = current ? elements.indexOf(current) : -1;
            if (index < 0 || !elements.length) return;
            event.preventDefault();
            let target =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? elements.length - 1
                  : index + (event.key === next ? 1 : -1);
            target = props.loopFocus === false
              ? Math.max(0, Math.min(elements.length - 1, target))
              : (target + elements.length) % elements.length;
            elements[target]?.focus();
          },
        },
      )}
    </ToolbarContext>
  );
}
export namespace ToolbarRoot {
  export type Orientation = ToolbarRootOrientation;
  export type State = ToolbarRootState;
  export type Props = ToolbarRootProps;
}
function ToolbarGroup(props: BaseProps) {
  const root = useToolbarRootContext()!;
  const disabled = () => root.disabled || !!props.disabled;
  return (
    <ToolbarGroupContext value={disabled}>
      {renderElement('div', omitProps(props, ['disabled']), {
        get disabled() { return disabled(); },
        get orientation() { return root.orientation; },
      }, { role: 'group' })}
    </ToolbarGroupContext>
  );
}
function toolbarItem(tag: 'button' | 'input', props: BaseProps) {
  const root = useToolbarRootContext()!;
  const group = useContext(ToolbarGroupContext);
  const disabled = () => root.disabled || !!group?.() || !!props.disabled;
  const focusable = () => props.focusableWhenDisabled !== false;
  return renderElement(tag, omitProps(props, ['disabled', 'focusableWhenDisabled']), {
    get disabled() { return disabled(); },
    get orientation() { return root.orientation; },
    get focusable() { return focusable(); },
  }, {
    ...(tag === 'button' ? { type: 'button' } : {}),
    'data-toolbar-item': '',
    get 'aria-disabled'() { return disabled() || undefined; },
    get disabled() { return disabled() && !focusable(); },
    tabIndex: -1,
    ref() { queueMicrotask(root.ensureTabStop); },
    onClick(event: MouseEvent) { if (disabled()) event.preventDefault(); },
    onPointerDown(event: PointerEvent) { if (disabled()) event.preventDefault(); },
  });
}
function ToolbarButton(props: BaseProps) { return toolbarItem('button', props); }
function ToolbarInput(props: BaseProps) { return toolbarItem('input', props); }
function ToolbarLink(props: BaseProps) {
  const root = useToolbarRootContext()!;
  return renderElement('a', props, { get orientation() { return root.orientation; } }, {
    'data-toolbar-item': '', tabIndex: -1, ref() { queueMicrotask(root.ensureTabStop); },
  });
}
export const Toolbar = {
  Root: ToolbarRoot,
  Group: ToolbarGroup,
  Button: ToolbarButton,
  Link: ToolbarLink,
  Input: ToolbarInput,
  Separator,
};
export function Menubar(props: BaseProps) {
  return <ToolbarRoot {...(mergeProps({ role: 'menubar' }, props) as ToolbarRootProps)} />;
}

interface ScrollContext {
  viewport: () => HTMLElement | undefined;
  setViewport: (element: HTMLElement) => void;
  state: {
    readonly scrolling: boolean;
    readonly hasOverflowX: boolean;
    readonly hasOverflowY: boolean;
    readonly overflowXStart: boolean;
    readonly overflowXEnd: boolean;
    readonly overflowYStart: boolean;
    readonly overflowYEnd: boolean;
  };
  recordScroll: (x: number, y: number) => void;
  cornerSize: () => { width: number; height: number };
  setScrollbar: (horizontal: boolean, element: HTMLElement) => void;
  metrics: () => {
    width: number;
    height: number;
    scrollWidth: number;
    scrollHeight: number;
    top: number;
    left: number;
  };
  update: () => void;
}
const Scroll = createContext<ScrollContext>();
/** Internal context bridge for unchanged upstream Scroll Area diagnostics. */
export const ScrollAreaRootContext = Scroll;
const Scrollbar = createContext<{
  horizontal: () => boolean;
  metrics: () => { length: number; padding: number };
  setThumb: (element: HTMLElement) => void;
}>();
/** Overflow values supplied to the native Solid viewport render callback. */
export interface ScrollAreaViewportState {
  overflowX: boolean;
  overflowY: boolean;
}
export type ScrollAreaViewportProps = BaseProps<ScrollAreaViewportState>;
/** Track values supplied to the native Solid scrollbar render callback. */
export interface ScrollAreaScrollbarState {
  orientation: 'horizontal' | 'vertical';
  hidden: boolean;
}
export interface ScrollAreaScrollbarProps extends BaseProps<ScrollAreaScrollbarState> {
  orientation?: ScrollAreaScrollbarState['orientation'];
  keepMounted?: boolean;
}
/** Orientation supplied to the native Solid thumb render callback. */
export interface ScrollAreaThumbState {
  orientation: 'horizontal' | 'vertical';
}
export type ScrollAreaThumbProps = BaseProps<ScrollAreaThumbState>;
function ScrollRoot(props: BaseProps) {
  const [viewport, setViewport] = createSignal<HTMLElement | undefined>(undefined);
  const [scrollingX, setScrollingX] = createSignal(false);
  const [scrollingY, setScrollingY] = createSignal(false);
  const [cornerSize, setCornerSize] = createSignal({ width: 0, height: 0 });
  let scrollbarX: HTMLElement | undefined;
  let scrollbarY: HTMLElement | undefined;
  let previousX = 0;
  let previousY = 0;
  let xTimeout: ReturnType<typeof setTimeout> | undefined;
  let yTimeout: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    clearTimeout(xTimeout);
    clearTimeout(yTimeout);
  });
  const [metrics, setMetrics] = createSignal({
    width: 0,
    height: 0,
    scrollWidth: 0,
    scrollHeight: 0,
    top: 0,
    left: 0,
  });
  const update = (node = viewport()) => {
    if (node) {
      const width = node.clientWidth;
      const height = node.clientHeight;
      const maxX = Math.max(0, node.scrollWidth - width);
      const maxY = Math.max(0, node.scrollHeight - height);
      const fromX = Math.max(0, Math.min(maxX, Math.abs(node.scrollLeft)));
      const fromY = Math.max(0, Math.min(maxY, node.scrollTop));
      node.style.setProperty('--scroll-area-overflow-x-start', `${fromX}px`);
      node.style.setProperty('--scroll-area-overflow-x-end', `${maxX - fromX}px`);
      node.style.setProperty('--scroll-area-overflow-y-start', `${fromY}px`);
      node.style.setProperty('--scroll-area-overflow-y-end', `${maxY - fromY}px`);
      setMetrics({
        width,
        height,
        scrollWidth: node.scrollWidth,
        scrollHeight: node.scrollHeight,
        top: node.scrollTop,
        left: node.scrollLeft,
      });
      const nextCorner = node.scrollWidth > width && node.scrollHeight > height
        ? { width: scrollbarY?.offsetWidth ?? 0, height: scrollbarX?.offsetHeight ?? 0 }
        : { width: 0, height: 0 };
      setCornerSize((previous) => previous.width === nextCorner.width &&
        previous.height === nextCorner.height ? previous : nextCorner);
    }
  };
  const setScrollbar = (horizontal: boolean, element: HTMLElement) => {
    if (horizontal) scrollbarX = element;
    else scrollbarY = element;
    queueMicrotask(update);
  };
  const threshold = (edge: 'xStart' | 'xEnd' | 'yStart' | 'yEnd') => {
    const value = props.overflowEdgeThreshold;
    return typeof value === 'number' ? value : (value?.[edge] ?? 0);
  };
  const hasOverflowX = () => metrics().scrollWidth > metrics().width;
  const hasOverflowY = () => metrics().scrollHeight > metrics().height;
  const xStart = () => Math.abs(metrics().left);
  const yStart = () => Math.max(0, metrics().top);
  const xEnd = () => Math.max(0, metrics().scrollWidth - metrics().width - xStart());
  const yEnd = () => Math.max(0, metrics().scrollHeight - metrics().height - yStart());
  const state = {
    get scrolling() { return scrollingX() || scrollingY(); },
    get hasOverflowX() { return hasOverflowX(); },
    get hasOverflowY() { return hasOverflowY(); },
    get overflowXStart() { return hasOverflowX() && xStart() > threshold('xStart'); },
    get overflowXEnd() { return hasOverflowX() && xEnd() > threshold('xEnd'); },
    get overflowYStart() { return hasOverflowY() && yStart() > threshold('yStart'); },
    get overflowYEnd() { return hasOverflowY() && yEnd() > threshold('yEnd'); },
  };
  const recordScroll = (x: number, y: number) => {
    if (x !== previousX) {
      previousX = x;
      setScrollingX(true);
      clearTimeout(xTimeout);
      xTimeout = setTimeout(() => setScrollingX(false), 500);
    }
    if (y !== previousY) {
      previousY = y;
      setScrollingY(true);
      clearTimeout(yTimeout);
      yTimeout = setTimeout(() => setScrollingY(false), 500);
    }
  };
  createEffect(
    () => viewport(),
    (element) => {
      if (!element) return;
      update(element);
      const Resize = element.ownerDocument.defaultView?.ResizeObserver;
      const observer = Resize ? new Resize(() => update(element)) : undefined;
      observer?.observe(element);
      if (element.firstElementChild) observer?.observe(element.firstElementChild);
      const mutations = new MutationObserver(() => {
        if (element.firstElementChild) observer?.observe(element.firstElementChild);
        update(element);
      });
      mutations.observe(element, { childList: true, subtree: true });
      return () => {
        observer?.disconnect();
        mutations.disconnect();
      };
    },
  );
  return (
    <Scroll value={{ viewport, setViewport, metrics, update, state, recordScroll, cornerSize, setScrollbar }}>
      <ScrollbarStyle />
      {renderElement('div', omitProps(props, ['overflowEdgeThreshold']), state, {
        role: 'presentation',
        get style() {
          const corner = cornerSize();
          return {
            position: 'relative',
            '--scroll-area-corner-width': `${corner.width}px`,
            '--scroll-area-corner-height': `${corner.height}px`,
          };
        },
      })}
    </Scroll>
  );
}
function ScrollViewport(props: ScrollAreaViewportProps): JSX.Element;
function ScrollViewport(props: BaseProps<any>) {
  const root = useContext(Scroll)!;
  let userInteracted = false;
  return renderElement(
    'div',
    props,
    root.state,
    {
      class: 'base-ui-disable-scrollbar',
      ref: root.setViewport,
      role: 'presentation',
      get tabIndex() {
        const metrics = root.metrics();
        return metrics.scrollWidth > metrics.width || metrics.scrollHeight > metrics.height
          ? 0
          : -1;
      },
      style: { overflow: 'scroll', 'scrollbar-width': 'none' },
      onPointerEnter() { userInteracted = true; },
      onPointerMove() { userInteracted = true; },
      onWheel() { userInteracted = true; },
      onKeyDown() { userInteracted = true; },
      onScroll() {
        root.update();
        const node = root.viewport();
        if (node && userInteracted) root.recordScroll(node.scrollLeft, node.scrollTop);
      },
    },
  );
}
namespace ScrollViewport {
  export type Props = ScrollAreaViewportProps;
  export type State = ScrollAreaViewportState;
}
function ScrollScrollbar(props: ScrollAreaScrollbarProps): JSX.Element;
function ScrollScrollbar(props: BaseProps<any>) {
  const root = useContext(Scroll)!;
  const direction = useDirection();
  const horizontal = () => props.orientation === 'horizontal';
  const overflowing = () => {
    const metrics = root.metrics();
    return horizontal() ? metrics.scrollWidth > metrics.width : metrics.scrollHeight > metrics.height;
  };
  const [thumb, setThumb] = createSignal<HTMLElement>();
  let stopDrag: (() => void) | undefined;
  onCleanup(() => stopDrag?.());
  const [element, setElement] = createSignal<HTMLElement>();
  const [metrics, setMetrics] = createSignal({ length: 0, padding: 0 });
  const thumbSize = () => {
    const viewportMetrics = root.metrics();
    const total = horizontal() ? viewportMetrics.scrollWidth : viewportMetrics.scrollHeight;
    const size = horizontal() ? viewportMetrics.width : viewportMetrics.height;
    const track = metrics();
    const thumbElement = thumb();
    const thumbStyle = thumbElement?.ownerDocument.defaultView?.getComputedStyle(thumbElement);
    const margin = thumbStyle
      ? horizontal()
        ? parseFloat(thumbStyle.marginInlineStart) + parseFloat(thumbStyle.marginInlineEnd)
        : parseFloat(thumbStyle.marginBlockStart) + parseFloat(thumbStyle.marginBlockEnd)
      : 0;
    const safeMargin = Number.isFinite(margin) ? margin : 0;
    return Math.max(16, Math.min(track.length || size, size - track.padding - safeMargin) *
      (total ? size / total : 1));
  };
  createEffect(
    () => ({ element: element(), horizontal: horizontal() }),
    ({ element, horizontal }) => {
      if (!element) return;
      const measure = () => {
        const style = element.ownerDocument.defaultView!.getComputedStyle(element);
        setMetrics({
          length: horizontal ? element.offsetWidth : element.offsetHeight,
          padding: horizontal
            ? (parseFloat(style.paddingInlineStart) || 0) + (parseFloat(style.paddingInlineEnd) || 0)
            : (parseFloat(style.paddingBlockStart) || 0) + (parseFloat(style.paddingBlockEnd) || 0),
        });
      };
      measure();
      const Resize = element.ownerDocument.defaultView?.ResizeObserver;
      const observer = Resize ? new Resize(measure) : undefined;
      observer?.observe(element);
      const wheel = (event: WheelEvent) => {
        const viewport = root.viewport();
        if (!viewport || event.ctrlKey) return;
        const property = horizontal ? 'scrollLeft' : 'scrollTop';
        const delta = horizontal ? event.deltaX : event.deltaY;
        if (!delta) return;
        const distance = horizontal
          ? viewport.scrollWidth - viewport.clientWidth
          : viewport.scrollHeight - viewport.clientHeight;
        const rtl = horizontal && direction() === 'rtl';
        const minimum = rtl ? -distance : 0;
        const maximum = rtl ? 0 : distance;
        const current = viewport[property];
        if ((current <= minimum && delta < 0) || (current >= maximum && delta > 0)) return;
        event.preventDefault();
        viewport[property] = Math.min(maximum, Math.max(minimum, current + delta));
        root.update();
      };
      element.addEventListener('wheel', wheel, { passive: false });
      return () => {
        observer?.disconnect();
        element.removeEventListener('wheel', wheel);
      };
    },
  );
  return (
    <Show when={props.keepMounted || overflowing()}>
    <Scrollbar
      value={{
        horizontal,
        metrics,
        setThumb,
      }}
    >
      {renderElement(
        'div',
        props,
        {
          get orientation() {
            return horizontal() ? 'horizontal' : 'vertical';
          },
          get hidden() {
            return !overflowing();
          },
          get scrolling() { return root.state.scrolling; },
          get hasOverflowX() { return root.state.hasOverflowX; },
          get hasOverflowY() { return root.state.hasOverflowY; },
          get overflowXStart() { return root.state.overflowXStart; },
          get overflowXEnd() { return root.state.overflowXEnd; },
          get overflowYStart() { return root.state.overflowYStart; },
          get overflowYEnd() { return root.state.overflowYEnd; },
        },
        {
          'aria-hidden': true,
          ref: [setElement, (node: HTMLElement) => root.setScrollbar(horizontal(), node)],
          get style() {
            return {
              position: 'absolute',
              'touch-action': 'none',
              'user-select': 'none',
              '-webkit-user-select': 'none',
              visibility: overflowing() ? undefined : 'hidden',
              bottom: 0,
              [horizontal() ? '--scroll-area-thumb-width' : '--scroll-area-thumb-height']:
                `${thumbSize()}px`,
              ...(horizontal()
                ? { 'inset-inline-start': 0, 'inset-inline-end': 0 }
                : { top: 0, 'inset-inline-end': 0 }),
            };
          },
          onMouseDown(event: MouseEvent) {
            event.preventDefault();
          },
          onPointerDown(event: PointerEvent) {
            const viewport = root.viewport();
            if (!viewport || !thumb() || event.button !== 0) return;
            stopDrag?.();
            const track = event.currentTarget as HTMLElement;
            const rect = track.getBoundingClientRect();
            const isHorizontal = horizontal();
            const property = isHorizontal ? 'scrollLeft' : 'scrollTop';
            const thumbNode = thumb()!;
            const thumbStyle = thumbNode.ownerDocument.defaultView!.getComputedStyle(thumbNode);
            const margin = isHorizontal
              ? parseFloat(thumbStyle.marginInlineStart) * 2
              : parseFloat(thumbStyle.marginBlockStart) + parseFloat(thumbStyle.marginBlockEnd);
            const pressedThumbSize = isHorizontal ? thumbNode.offsetWidth : thumbNode.offsetHeight;
            const travel = metrics().length - metrics().padding - margin - pressedThumbSize;
            if (travel <= 0) return;
            const distance = isHorizontal
              ? viewport.scrollWidth - viewport.clientWidth
              : viewport.scrollHeight - viewport.clientHeight;
            const savedSnap = viewport.style.scrollSnapType;
            viewport.style.scrollSnapType = 'none';
            if (!contains(thumbNode, getTarget(event) as Node | null)) {
              const coordinate = isHorizontal
                ? event.clientX - rect.left
                : event.clientY - rect.top;
              const ratio = (coordinate - pressedThumbSize / 2 - metrics().padding + margin / 2) / travel;
              viewport[property] =
                isHorizontal && direction() === 'rtl' ? -(1 - ratio) * distance : ratio * distance;
              root.update();
            }
            const start = isHorizontal ? event.clientX : event.clientY;
            const startScroll = viewport[property];
            const pointerId = event.pointerId;
            const capture = thumbNode;
            const up = (event?: PointerEvent) => {
              if (event && event.pointerId !== pointerId) return;
              track.removeEventListener('pointermove', move);
              track.removeEventListener('pointerup', up);
              track.removeEventListener('pointercancel', up);
              viewport.style.scrollSnapType = savedSnap;
              if (capture.hasPointerCapture(pointerId)) capture.releasePointerCapture(pointerId);
              stopDrag = undefined;
            };
            const move = (event: PointerEvent) => {
              if (event.pointerId !== pointerId) return;
              if (!(event.buttons & 1)) {
                up(event);
                return;
              }
              const coordinate = isHorizontal ? event.clientX : event.clientY;
              viewport[property] = startScroll + ((coordinate - start) / travel) * distance;
              event.preventDefault();
              root.update();
            };
            stopDrag = up;
            capture.setPointerCapture(pointerId);
            track.addEventListener('pointermove', move);
            track.addEventListener('pointerup', up);
            track.addEventListener('pointercancel', up);
          },
        },
      )}
    </Scrollbar>
    </Show>
  );
}
namespace ScrollScrollbar {
  export type Props = ScrollAreaScrollbarProps;
  export type State = ScrollAreaScrollbarState;
}
function ScrollThumb(props: ScrollAreaThumbProps): JSX.Element;
function ScrollThumb(props: BaseProps<any>) {
  const root = useContext(Scroll)!;
  const scrollbar = useContext(Scrollbar)!;
  const horizontal = scrollbar.horizontal;
  const direction = useDirection();
  return renderElement(
    'div',
    props,
    {
      get orientation() {
        return horizontal() ? 'horizontal' : 'vertical';
      },
    },
    {
      ref: scrollbar.setThumb,
      get style() {
        const m = root.metrics();
        const total = horizontal() ? m.scrollWidth : m.scrollHeight;
        const size = horizontal() ? m.width : m.height;
        const offset = horizontal() ? m.left : m.top;
        const track = scrollbar.metrics();
        const thumbSize = Math.max(
          16,
          Math.min(track.length, size - track.padding) * (total ? size / total : 1),
        );
        const maxOffset = Math.max(0, track.length - track.padding - thumbSize);
        const thumbOffset = total > size ? (Math.abs(offset) / (total - size)) * maxOffset : 0;
        return {
          [horizontal() ? 'width' : 'height']: `${thumbSize}px`,
          transform: horizontal()
            ? `translate3d(${direction() === 'rtl' ? -thumbOffset : thumbOffset}px, 0px, 0px)`
            : `translate3d(0px, ${thumbOffset}px, 0px)`,
        };
      },
    },
  );
}
namespace ScrollThumb {
  export type Props = ScrollAreaThumbProps;
  export type State = ScrollAreaThumbState;
}
function ScrollContent(props: BaseProps) {
  const root = useContext(Scroll)!;
  return renderElement('div', props, root.state, {
    style: { 'min-width': '100%', display: 'table' },
  });
}
function ScrollCorner(props: BaseProps) {
  const root = useContext(Scroll)!;
  return (
    <Show when={root.state.hasOverflowX && root.state.hasOverflowY}>
      {renderElement('div', props, {}, {
        'aria-hidden': true,
        get style() {
          const size = root.cornerSize();
          return {
            position: 'absolute',
            bottom: 0,
            'inset-inline-end': 0,
            width: `${size.width}px`,
            height: `${size.height}px`,
          };
        },
      })}
    </Show>
  );
}
export const ScrollArea = {
  Root: ScrollRoot,
  Viewport: ScrollViewport,
  Content: ScrollContent,
  Scrollbar: ScrollScrollbar,
  Thumb: ScrollThumb,
  Corner: ScrollCorner,
};
