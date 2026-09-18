import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  onCleanup,
  Show,
  untrack,
  useContext,
} from 'solid-js';
import { Portal as SolidPortal, type JSX } from '@solidjs/web';
import {
  arrow,
  autoUpdate,
  computePosition,
  flip,
  hide,
  offset,
  shift,
  size,
  type Placement,
  type VirtualElement,
} from '@floating-ui/dom';
import {
  acquireScrollLock,
  assignRef,
  createControllable,
  eventDetails,
  getTarget,
  mergeProps,
  omitProps,
  renderElement,
  ScrollbarStyle,
  useAnimationFrame,
  useDirection,
  useTimeout,
  type BaseProps,
  type ChangeEventDetails,
  type Ref,
} from './core';
import { useFieldContext } from './controls';

type Kind = 'select' | 'combobox' | 'autocomplete';
type ItemValue = any;
type ItemGroup<T> = { items: readonly T[]; [key: string]: unknown };
type ItemData<T> = readonly T[] | readonly ItemGroup<T>[];
type Item = {
  id: () => string;
  value: () => ItemValue;
  label: () => string;
  disabled: () => boolean;
  element: () => HTMLElement | undefined;
};

interface SelectionRootActions {
  unmount: () => void;
}
type SelectionRootChangeEventReason =
  | 'none'
  | 'trigger-press'
  | 'input-press'
  | 'outside-press'
  | 'item-press'
  | 'escape-key'
  | 'list-navigation'
  | 'focus-out'
  | 'input-change'
  | 'clear-press';
type SelectionRootHighlightEventReason = 'none' | 'keyboard' | 'pointer';
export type SelectRootActions = SelectionRootActions;
export type SelectRootChangeEventReason = Exclude<
  SelectionRootChangeEventReason,
  'input-press' | 'input-change' | 'clear-press'
>;
export type SelectRootChangeEventDetails = ChangeEventDetails & {
  reason: SelectRootChangeEventReason;
};
export type ComboboxRootActions = SelectionRootActions;
export type ComboboxRootChangeEventReason = SelectionRootChangeEventReason;
export type ComboboxRootChangeEventDetails = ChangeEventDetails & {
  reason: ComboboxRootChangeEventReason;
};
export type ComboboxRootHighlightEventReason = SelectionRootHighlightEventReason;
/** Native highlight details do not include the React `index` field. */
export type ComboboxRootHighlightEventDetails = ChangeEventDetails & {
  reason: ComboboxRootHighlightEventReason;
};
export type AutocompleteRootActions = SelectionRootActions;
export type AutocompleteRootChangeEventReason = SelectionRootChangeEventReason;
export type AutocompleteRootChangeEventDetails = ChangeEventDetails & {
  reason: AutocompleteRootChangeEventReason;
};
export type AutocompleteRootHighlightEventReason = SelectionRootHighlightEventReason;
/** Native highlight details do not include the React `index` field. */
export type AutocompleteRootHighlightEventDetails = ChangeEventDetails & {
  reason: AutocompleteRootHighlightEventReason;
};

export interface SelectionRootProps<
  Value = ItemValue,
  Multiple extends boolean | undefined = false,
> extends BaseProps {
  value?: (Multiple extends true ? readonly Value[] : Value) | null;
  defaultValue?: (Multiple extends true ? readonly Value[] : Value) | null;
  onValueChange?: (
    value: Multiple extends true ? Value[] : Value | null,
    details: ChangeEventDetails,
  ) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: ChangeEventDetails) => void;
  onOpenChangeComplete?: (open: boolean) => void;
  inputValue?: string;
  defaultInputValue?: string;
  onInputValueChange?: (value: string, details: ChangeEventDetails) => void;
  multiple?: Multiple;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  items?: ItemData<Value> | Record<string, JSX.Element> | ComboboxItemCollection<any, any>;
  filteredItems?: ItemData<Value>;
  filter?: ((item: Value, query: string, itemToString: (item: Value) => string) => boolean) | null;
  itemToStringLabel?: (value: Value) => string;
  itemToStringValue?: (value: Value) => string;
  isItemEqualToValue?: (item: Value, value: Value) => boolean;
  autoHighlight?: boolean | 'always';
  highlightItemOnHover?: boolean;
  loopFocus?: boolean;
  onItemHighlighted?: (value: Value | undefined, details: ChangeEventDetails) => void;
  actionsRef?: Ref<SelectionRootActions | null>;
}

/** The values supplied to the native Solid item render callback. */
export interface SelectItemState {
  disabled: boolean;
  selected: boolean;
  highlighted: boolean;
}
export interface SelectItemProps extends BaseProps<SelectItemState> {
  value?: ItemValue;
  disabled?: boolean;
  label?: string;
}
export interface SelectItemIndicatorState {
  selected: boolean;
}
export interface SelectItemIndicatorProps extends BaseProps<SelectItemIndicatorState> {
  keepMounted?: boolean;
}
export interface SelectListState {
  empty: boolean;
}
export type SelectListProps = Omit<BaseProps<SelectListState>, 'children'> & {
  children?: JSX.Element | ((item: ItemValue, index: number) => JSX.Element);
};
export interface SelectValueState {
  placeholder: boolean;
}
export type SelectValueProps = Omit<BaseProps<SelectValueState>, 'children'> & {
  children?: JSX.Element | ((value: ItemValue) => JSX.Element);
  placeholder?: JSX.Element;
};
export interface SelectScrollUpArrowState {
  visible: boolean;
  direction: 'up';
  side: string;
}
export interface SelectScrollUpArrowProps extends BaseProps<SelectScrollUpArrowState> {
  keepMounted?: boolean;
}
export interface SelectScrollDownArrowState {
  visible: boolean;
  direction: 'down';
  side: string;
}
export interface SelectScrollDownArrowProps extends BaseProps<SelectScrollDownArrowState> {
  keepMounted?: boolean;
}
/** State returned by the shared native popup state function. */
export type AutocompleteInputState = ReturnType<typeof popupState>;
export type AutocompleteInputProps = BaseProps<AutocompleteInputState>;
export type AutocompleteInputGroupState = ReturnType<typeof popupState>;
export type AutocompleteInputGroupProps = BaseProps<AutocompleteInputGroupState>;
export type AutocompleteItemState = SelectItemState;
export type AutocompleteItemProps = SelectItemProps;
export type AutocompleteListState = SelectListState;
export type AutocompleteListProps = SelectListProps;
export type AutocompleteIconState = ReturnType<typeof popupState>;
export type AutocompleteIconProps = BaseProps<AutocompleteIconState>;
export interface AutocompleteClearState {
  disabled: boolean;
}
export type AutocompleteClearProps = BaseProps<AutocompleteClearState>;
export type ComboboxInputState = AutocompleteInputState;
export type ComboboxInputProps = AutocompleteInputProps;
export type ComboboxInputGroupState = AutocompleteInputGroupState;
export type ComboboxInputGroupProps = AutocompleteInputGroupProps;
export type ComboboxItemState = SelectItemState;
export type ComboboxItemProps = SelectItemProps;
export type ComboboxItemIndicatorState = SelectItemIndicatorState;
export type ComboboxItemIndicatorProps = SelectItemIndicatorProps;
export type ComboboxListState = SelectListState;
export type ComboboxListProps = SelectListProps;
export type ComboboxIconState = AutocompleteIconState;
export type ComboboxIconProps = AutocompleteIconProps;
export type ComboboxClearState = AutocompleteClearState;
export type ComboboxClearProps = AutocompleteClearProps;
export interface ComboboxChipsState {
  disabled: boolean;
}
export type ComboboxChipsProps = BaseProps<ComboboxChipsState>;
export interface ComboboxChipState {
  disabled: boolean;
}
export interface ComboboxChipProps extends BaseProps<ComboboxChipState> {
  value?: ItemValue;
}
export interface ComboboxChipRemoveState {
  disabled: boolean;
}
export type ComboboxChipRemoveProps = BaseProps<ComboboxChipRemoveState>;

/** State values supplied by the native popup, positioner, arrow, and backdrop. */
type SelectionPopupState = ReturnType<typeof popupState> & { side: string; align: string };
type SelectionPositionerState = ReturnType<typeof popupState> & {
  side: string;
  align: string;
  anchorHidden: boolean;
};
type SelectionArrowState = ReturnType<typeof popupState> & {
  side: string | undefined;
  align: string | undefined;
  uncentered: boolean;
};
type SelectionBackdropState = ReturnType<typeof popupState>;
type SelectionPopupProps<State> = BaseProps<State> & { keepMounted?: boolean };
type SelectionPositionerProps<State> = BaseProps<State> & {
  anchor?: HTMLElement | VirtualElement | Ref<HTMLElement> | (() => HTMLElement | VirtualElement | undefined);
  positionMethod?: 'absolute' | 'fixed';
  alignItemWithTrigger?: boolean;
  arrowPadding?: number;
  collisionPadding?: number | Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>;
  collisionBoundary?: Element | Element[] | 'clipping-ancestors';
  collisionAvoidance?: { side?: 'none' | 'flip'; align?: 'none' | 'shift' };
  trackAnchor?: boolean;
};
type SelectionBackdropProps<State> = BaseProps<State> & { keepMounted?: boolean };

export type SelectPopupState = SelectionPopupState;
export type SelectPopupProps = SelectionPopupProps<SelectPopupState>;
export type SelectPositionerState = SelectionPositionerState;
export type SelectPositionerProps = SelectionPositionerProps<SelectPositionerState>;
export type SelectArrowState = SelectionArrowState;
export type SelectArrowProps = BaseProps<SelectArrowState>;
export type SelectBackdropState = SelectionBackdropState;
export type SelectBackdropProps = SelectionBackdropProps<SelectBackdropState>;
export type ComboboxPopupState = SelectionPopupState;
export type ComboboxPopupProps = SelectionPopupProps<ComboboxPopupState>;
export type ComboboxPositionerState = SelectionPositionerState;
export type ComboboxPositionerProps = SelectionPositionerProps<ComboboxPositionerState>;
export type ComboboxArrowState = SelectionArrowState;
export type ComboboxArrowProps = BaseProps<ComboboxArrowState>;
export type ComboboxBackdropState = SelectionBackdropState;
export type ComboboxBackdropProps = SelectionBackdropProps<ComboboxBackdropState>;
export type AutocompletePopupState = SelectionPopupState;
export type AutocompletePopupProps = SelectionPopupProps<AutocompletePopupState>;
export type AutocompletePositionerState = SelectionPositionerState;
export type AutocompletePositionerProps = SelectionPositionerProps<AutocompletePositionerState>;
export type AutocompleteArrowState = SelectionArrowState;
export type AutocompleteArrowProps = BaseProps<AutocompleteArrowState>;
export type AutocompleteBackdropState = SelectionBackdropState;
export type AutocompleteBackdropProps = SelectionBackdropProps<AutocompleteBackdropState>;

interface SelectionContext {
  kind: Kind;
  props: SelectionRootProps<ItemValue, boolean | undefined>;
  id: string;
  listId: string;
  open: () => boolean;
  mounted: () => boolean;
  forceMount: () => boolean;
  forceMountItems: () => void;
  phase: () => 'idle' | 'starting' | 'ending';
  setOpen: (open: boolean, event?: Event, reason?: string) => boolean;
  requestListFocus: () => void;
  value: () => ItemValue;
  setValue: (value: ItemValue, event?: Event, reason?: string) => boolean;
  values: () => ItemValue[];
  inputValue: () => string;
  setInputValue: (value: string, event?: Event, reason?: string) => boolean;
  label: (value: ItemValue) => string;
  hasNullLabel: () => boolean;
  serialize: (value: ItemValue) => string;
  equal: (item: ItemValue, value: ItemValue) => boolean;
  selected: (value: ItemValue) => boolean;
  itemValue: (item: ItemValue) => ItemValue;
  filtered: () => readonly ItemValue[];
  visible: (item: Item) => boolean;
  items: () => Item[];
  alignmentItem: () => Item | undefined;
  register: (item: Item) => () => void;
  active: () => string | undefined;
  highlight: (item: Item | undefined, event?: Event, reason?: string) => void;
  select: (item: Item, event: Event) => void;
  keydown: (event: KeyboardEvent, input?: boolean) => void;
  trigger: () => HTMLElement | undefined;
  setTrigger: (element: HTMLElement | undefined) => void;
  input: () => HTMLInputElement | undefined;
  inputInsidePopup: () => boolean;
  setInput: (element: HTMLInputElement | undefined, insidePopup?: boolean) => void;
  popup: () => HTMLElement | undefined;
  setPopup: (element: HTMLElement | undefined) => void;
  positioner: () => HTMLElement | undefined;
  setPositioner: (element: HTMLElement | undefined) => void;
  list: () => HTMLElement | undefined;
  setList: (element: HTMLElement | undefined) => void;
  anchor: () => HTMLElement | undefined;
  setAnchor: (element: HTMLElement | undefined) => void;
  labelId: () => string | undefined;
  setLabelId: (id: string | undefined) => void;
  chips: () => HTMLElement[];
  setChips: (chips: HTMLElement[]) => void;
  field: ReturnType<typeof useFieldContext>;
}

const SelectionContext = createContext<SelectionContext>();
const ItemContext = createContext<Item | null>(null);
const GroupContext = createContext<{
  labelId: () => string | undefined;
  setLabelId: (next: string | undefined) => void;
  items: () => readonly ItemValue[] | undefined;
} | null>(null);
const ChipContext = createContext<{
  value: () => ItemValue;
  element: () => HTMLElement | undefined;
} | null>(null);
const PositionContext = createContext<{
  side: () => string;
  align: () => string;
  arrow: () => { x?: number; y?: number; centerOffset?: number };
  setArrow: (element: HTMLElement) => void;
} | null>(null);

function useSelection() {
  const context = useContext(SelectionContext);
  if (!context)
    throw new Error(
      'Base UI: A selection part has no Root context. Place the part inside Select.Root, Combobox.Root, or Autocomplete.Root. See https://base-ui.com/react/components/combobox.',
    );
  return context;
}

function containsSelectionPortal(parent: Node | null | undefined, child: Node | null): boolean {
  if (!parent || !child) return false;
  const seen = new Set<Node>();
  for (let node: Node | null = child; node && !seen.has(node); ) {
    if (node === parent) return true;
    seen.add(node);
    node =
      (node as Node & { _$host?: Node })._$host ??
      node.parentNode ??
      (node.getRootNode() as ShadowRoot).host ??
      null;
  }
  return false;
}

const flatItems = (items: readonly ItemValue[]): ItemValue[] =>
  items.flatMap((item) => (Array.isArray(item?.items) ? flatItems(item.items) : [item]));
const textLabel = (value: ItemValue): string =>
  value == null ? '' : String(typeof value === 'object' && 'label' in value ? value.label : value);
const isCollection = (value: unknown): value is ComboboxItemCollection<any, any> =>
  Boolean(
    value &&
    typeof value === 'object' &&
    'itemLabel' in value &&
    'value' in value &&
    'data' in value,
  );
const hiddenInputStyle: JSX.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  'white-space': 'nowrap',
  border: '0',
};

export interface FilterOptions extends Intl.CollatorOptions {
  locale?: Intl.LocalesArgument;
  multiple?: boolean;
  value?: ItemValue;
}
export interface Filter {
  contains<T>(item: T, query: string, itemToString?: (value: T) => string): boolean;
  startsWith<T>(item: T, query: string, itemToString?: (value: T) => string): boolean;
  endsWith<T>(item: T, query: string, itemToString?: (value: T) => string): boolean;
}

export function useSelectionFilter(options: FilterOptions = {}): Filter {
  const collator = createMemo(
    () =>
      new Intl.Collator(options.locale, {
        usage: 'search',
        sensitivity: 'base',
        ignorePunctuation: true,
        ...options,
      }),
  );
  const matches = (value: string, query: string) => collator().compare(value, query) === 0;
  return {
    contains(item, query, stringify = textLabel) {
      if (
        !query ||
        (!options.multiple && options.value != null && matches(stringify(options.value), query))
      )
        return true;
      const label = stringify(item);
      for (let index = 0; index <= label.length - query.length; index++)
        if (matches(label.slice(index, index + query.length), query)) return true;
      return false;
    },
    startsWith(item, query, stringify = textLabel) {
      return !query || matches(stringify(item).slice(0, query.length), query);
    },
    endsWith(item, query, stringify = textLabel) {
      return !query || matches(stringify(item).slice(-query.length), query);
    },
  };
}

export interface CreateComboboxItemsOptions<Item, Value> {
  getValue: (item: Item) => Value;
  getLabel: (item: Item) => string;
}
export interface ComboboxItemCollection<Item, Value = Item> {
  readonly data: ItemData<Item> | undefined;
  value: (item: Item) => Value;
  itemLabel: (item: Item) => string;
  label: (
    value: Value,
    equal: (a: Value, b: Value) => boolean,
    fallback?: (value: Value) => string,
  ) => string;
  hasValue: (value: Value, equal: (a: Value, b: Value) => boolean) => boolean;
}
export function createComboboxItems<Item, Value>(
  data: ItemData<Item> | undefined,
  options: CreateComboboxItemsOptions<Item, Value>,
): ComboboxItemCollection<Item, Value> {
  let index: Map<Value, Item> | undefined;
  const indexed = () => {
    if (!index) {
      index = new Map();
      for (const item of flatItems(data ?? []) as Item[])
        if (item != null && !index.has(options.getValue(item)))
          index.set(options.getValue(item), item);
    }
    return index;
  };
  const find = (value: Value, equal: (a: Value, b: Value) => boolean) => {
    for (const [key, item] of indexed()) if (equal(key, value)) return item;
    return undefined;
  };
  return {
    data,
    value: options.getValue,
    itemLabel: options.getLabel,
    hasValue: (value, equal) => find(value, equal) !== undefined,
    label(value, equal, fallback = textLabel) {
      const item = find(value, equal);
      return item === undefined ? fallback(value) : options.getLabel(item);
    },
  };
}

function SelectionRoot(rootProps: SelectionRootProps<ItemValue, boolean | undefined>, kind: Kind) {
  const field = useFieldContext();
  const props = new Proxy(rootProps, {
    get(target, key) {
      if (key === 'name') return field?.props.name ?? target.name;
      if (key === 'disabled') return Boolean(target.disabled || field?.state.disabled);
      if (key === 'id') return target.id ?? field?.id;
      return Reflect.get(target, key);
    },
  });
  const id = createUniqueId();
  const direction = useDirection();
  const [open, changeOpen] = createControllable<boolean>(props, 'open', false);
  const [present, setPresent] = createSignal(untrack(open));
  const [forceMount, setForceMount] = createSignal(false);
  const [phase, setPhase] = createSignal<'idle' | 'starting' | 'ending'>('idle');
  const mounted = () => open() || present();
  createEffect(
    () => props.id,
    (controlId) => {
      field?.setControlId(controlId ?? field.id);
      return () => field?.setControlId(field.id);
    },
  );
  const [value, setValue] = createControllable<ItemValue>(
    props,
    'value',
    kind === 'autocomplete' ? '' : props.multiple ? [] : null,
  );
  const initialSelection = untrack(value);
  if (field) createEffect(() => value, (source) => field.bindValue(source));
  const [registered, setRegistered] = createSignal<Item[]>([]);
  const mountedItems = new Set<Item>();
  let disposed = false;
  onCleanup(() => {
    disposed = true;
    mountedItems.clear();
  });
  const [active, setActive] = createSignal<string>();
  let focusListOnOpen = false;
  const [trigger, setTrigger] = createSignal<HTMLElement>();
  const [input, setInput] = createSignal<HTMLInputElement>();
  const [inputInsidePopup, setInputInsidePopup] = createSignal(kind === 'combobox');
  const [popup, setPopup] = createSignal<HTMLElement>();
  const [positioner, setPositioner] = createSignal<HTMLElement>();
  const [list, setList] = createSignal<HTMLElement>();
  const [anchor, setAnchor] = createSignal<HTMLElement>();
  const [labelId, setLabelId] = createSignal<string>();
  const [chips, setChips] = createSignal<HTMLElement[]>([]);
  const labelCache = new Map<ItemValue, string>();
  const collection = () => (isCollection(props.items) ? props.items : undefined);
  const equal = (item: ItemValue, selectedValue: ItemValue) =>
    (props.isItemEqualToValue ?? Object.is)(item, selectedValue);
  let previousItemValues: ItemValue[] | undefined;
  let registryRevision = 0;
  createEffect(
    () => registered().map((item) => item.value()),
    () => {
      if (kind !== 'select') return;
      const revision = ++registryRevision;
      // Item registrations in one render must settle before we compare a list.
      queueMicrotask(() => {
        if (disposed || revision !== registryRevision) return;
        const currentItemValues = [...mountedItems].map((item) => item.value());
        if (!currentItemValues.length && !mounted()) return;
        const previous = previousItemValues;
        previousItemValues = currentItemValues;
        if (!previous?.length) return;
        if (
          previous.length === currentItemValues.length &&
          previous.every((item, index) => Object.is(item, currentItemValues[index]))
        ) return;
        const exists = (selectedValue: ItemValue) =>
          currentItemValues.some((item) => equal(item, selectedValue));
        if (props.multiple && Array.isArray(value())) {
          const next = (value() as ItemValue[]).filter(exists);
          if (next.length !== (value() as ItemValue[]).length) setValue(next, undefined, 'none');
        } else if (!props.multiple && value() != null && !exists(value())) {
          setValue(initialSelection != null && exists(initialSelection) ? initialSelection : null, undefined, 'none');
        }
      });
    },
  );
  const data = (): readonly ItemValue[] | undefined => {
    if (collection()) return collection()!.data;
    if (Array.isArray(props.items)) return props.items;
    if (props.items && typeof props.items === 'object')
      return Object.entries(props.items).map(([itemValue, label]) => ({ value: itemValue, label }));
    return undefined;
  };
  const itemValue = (item: ItemValue) =>
    collection()?.value(item) ??
    (kind === 'select' && item && typeof item === 'object' && 'value' in item ? item.value : item);
  const hasNullLabel = () => {
    if (kind !== 'select') return false;
    if (!Array.isArray(props.items) && !collection())
      return props.items != null && 'null' in props.items;
    return flatItems(data() ?? []).some(
      (item) => item != null && itemValue(item) == null && item.label != null,
    );
  };
  const label = (selectedValue: ItemValue): string => {
    if (selectedValue == null) {
      if (kind === 'select' && !Array.isArray(props.items) && !collection() && props.items)
        return textLabel((props.items as Record<string, ItemValue>)[String(selectedValue)]);
      const nullItem =
        kind === 'select'
          ? flatItems(data() ?? []).find((item) => itemValue(item) === selectedValue)
          : undefined;
      return nullItem == null ? '' : textLabel(nullItem);
    }
    if (collection()) return collection()!.label(selectedValue, equal, props.itemToStringLabel);
    if (props.itemToStringLabel) return props.itemToStringLabel(selectedValue);
    if (kind === 'autocomplete' && props.itemToStringValue)
      return props.itemToStringValue(selectedValue);
    const sourceItem = flatItems(data() ?? []).find((item) =>
      equal(itemValue(item), selectedValue),
    );
    if (sourceItem != null) return textLabel(sourceItem);
    // Select.Value falls back to the value when no `items` source supplies a label.
    if (kind === 'select' && data() === undefined) return textLabel(selectedValue);
    const rendered = registered().find((item) => equal(item.value(), selectedValue));
    if (rendered) return rendered.label();
    for (const [candidate, cached] of labelCache)
      if (equal(candidate, selectedValue)) return cached;
    return textLabel(selectedValue);
  };
  const serialize = (selectedValue: ItemValue) =>
    selectedValue == null
      ? ''
      : (props.itemToStringValue?.(selectedValue) ??
        String(
          typeof selectedValue === 'object' && 'value' in selectedValue
            ? selectedValue.value
            : selectedValue,
        ));
  const [query, setQuery] = createControllable<string>(
    props,
    'inputValue',
    kind !== 'combobox' || props.multiple ? '' : untrack(() => label(value())),
  );
  const [inlineValue, setInlineValue] = createSignal<string>();
  const enableInline = () =>
    kind === 'autocomplete' &&
    !props.readOnly &&
    (props.mode === 'inline' || props.mode === 'both');
  const typedValue = () =>
    kind === 'autocomplete' ? String(value() ?? '') : String(query() ?? '');
  const inputValue = () => (enableInline() ? (inlineValue() ?? typedValue()) : typedValue());
  const setInputValue = (next: string, event?: Event, reason?: string) => {
    setInlineValue(undefined);
    return kind === 'autocomplete' ? setValue(next, event, reason) : setQuery(next, event, reason);
  };
  const values = (): ItemValue[] =>
    props.multiple ? (Array.isArray(value()) ? value() : []) : value() == null ? [] : [value()];
  let pendingRemovedSelection: { value: ItemValue; fallback: ItemValue } | undefined;
  let initialPopupFocusPending = untrack(
    () => kind === 'select' && open() && props.highlightItemOnHover === false && !values().length,
  );
  let lastFocusedItem: Item | undefined;
  if (field && kind === 'select')
    onCleanup(
      field.bindFormValue(
        () => (props.multiple ? values().map(serialize) : serialize(value())),
        () => (props.multiple ? values().length > 0 : value() != null && serialize(value()) !== ''),
        () => {
          const current = value();
          if (Array.isArray(current) && Array.isArray(initialSelection))
            return (
              current.length !== initialSelection.length ||
              current.some((item, index) =>
                item == null || initialSelection[index] == null
                  ? !Object.is(item, initialSelection[index])
                  : !equal(item, initialSelection[index]),
              )
            );
          return current !== initialSelection;
        },
      ),
    );
  const selected = (item: ItemValue) =>
    pendingRemovedSelection && equal(item, pendingRemovedSelection.value)
      ? false
      : kind === 'select' && !props.multiple
      ? value() !== undefined && equal(item, value())
      : values().some((selectedValue) => equal(item, selectedValue));
  const filter = useSelectionFilter({
    get locale() {
      return props.locale;
    },
  });
  const filterQuery = () => {
    if (
      kind === 'select' ||
      props.filter === null ||
      (kind === 'autocomplete' && (props.mode === 'none' || props.mode === 'inline'))
    )
      return '';
    if (
      kind === 'combobox' &&
      !inputInsidePopup() &&
      !props.multiple &&
      inputValue() === label(value())
    )
      return '';
    return typedValue().trim();
  };
  const matches = (item: ItemValue, labelText?: string) =>
    !filterQuery() ||
    (props.filter
      ? props.filter(item, filterQuery(), label)
      : filter.contains(labelText ?? label(item), filterQuery()));
  const filtered = createMemo<readonly ItemValue[]>(() => {
    if (props.filteredItems) return props.filteredItems;
    const source = data() ?? registered().map((item) => item.value());
    const limit = props.limit ?? Infinity;
    let count = 0;
    const include = (item: ItemValue) =>
      count < limit && matches(itemValue(item), collection()?.itemLabel(item)) && ++count > 0;
    return source.flatMap((item) =>
      Array.isArray(item?.items)
        ? (() => {
            const items = item.items.filter(include);
            return items.length ? [{ ...item, items }] : [];
          })()
        : include(item)
          ? [item]
          : [],
    );
  });
  const visible = (item: Item) =>
    props.filteredItems
      ? flatItems(props.filteredItems).some((candidate) =>
          equal(itemValue(candidate), item.value()),
        )
      : matches(item.value(), item.label());
  const items = () =>
    registered()
      .filter((item) => item.element()?.isConnected && !item.disabled() && visible(item))
      .sort((a, b) => (a.element()!.compareDocumentPosition(b.element()!) & 2 ? 1 : -1));
  function highlight(item: Item | undefined, event?: Event, reason = 'none') {
    if (active() === item?.id()) return;
    setActive(item?.id());
    props.onItemHighlighted?.(item?.value(), eventDetails(event, reason));
    // Select uses roving DOM focus. Combobox keeps focus in its text input and
    // identifies the highlighted option with aria-activedescendant instead.
    if (kind === 'select' && item && open()) {
      item.element()?.focus({ preventScroll: true });
      lastFocusedItem = item;
    }
    if (kind === 'autocomplete' && reason !== 'pointer')
      setInlineValue(enableInline() && item ? label(item.value()) : undefined);
    if (reason === 'keyboard') item?.element()?.scrollIntoView?.({ block: 'nearest' });
  }
  function setOpen(next: boolean, event?: Event, reason = 'none') {
    if (next && props.disabled) return false;
    const changed = changeOpen(next, event, reason);
    if (changed && !next) {
      highlight(undefined, event);
      if (reason === 'focus-out' || reason === 'outside-press') {
        field?.focus(false);
        field?.touch();
      }
      if (kind === 'combobox' && !inputInsidePopup() && !props.multiple)
        setQuery(label(value()), event, 'none');
    }
    return changed;
  }
  const focusControl = () =>
    (kind === 'select' || inputInsidePopup() ? trigger() : (input() ?? trigger()))?.focus({
      preventScroll: true,
    });
  function select(item: Item, event: Event) {
    if (props.disabled || props.readOnly || item.disabled()) return;
    const next = props.multiple
      ? selected(item.value())
        ? values().filter((current) => !equal(item.value(), current))
        : [...values(), item.value()]
      : item.value();
    const didChange =
      kind === 'autocomplete'
        ? setInputValue(label(item.value()), event, 'item-press')
        : setValue(next, event, 'item-press');
    if (
      !didChange &&
      (kind === 'autocomplete' ? inputValue() !== label(item.value()) : !equal(value(), next))
    )
      return;
    if (props.multiple) {
      setInputValue('', event, 'item-press');
      input()?.focus({ preventScroll: true });
    } else {
      setOpen(false, event, 'item-press');
      focusControl();
    }
    if (kind === 'autocomplete' && props.submitOnItemClick) input()?.form?.requestSubmit();
  }
  const typeaheadTimer = useTimeout();
  let typeahead = '';
  function move(step: number, event: KeyboardEvent, edge?: 'start' | 'end') {
    const choices = items();
    if (!choices.length) return;
    let index = choices.findIndex((item) => item.id() === active());
    if (edge) index = edge === 'start' ? 0 : choices.length - 1;
    else if (index < 0) index = step < 0 ? choices.length - 1 : 0;
    else
      index =
        (kind === 'select' ? props.loopFocus === true : props.loopFocus !== false)
          ? (index + step + choices.length) % choices.length
          : Math.max(0, Math.min(choices.length - 1, index + step));
    highlight(choices[index], event, 'keyboard');
  }
  function keydown(event: KeyboardEvent, fromInput = false) {
    if (event.defaultPrevented || props.disabled || event.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (event.altKey && event.key === 'ArrowUp') {
        setOpen(false, event, 'list-navigation');
        return;
      }
      const wasOpen = open();
      setOpen(true, event, 'list-navigation');
      if (wasOpen) move(event.key === 'ArrowDown' ? 1 : -1, event);
      else if (event.key === 'ArrowUp' && !values().length)
        queueMicrotask(() =>
          move(-1, event, 'end'),
        );
    } else if (
      (event.key === 'Home' || event.key === 'End') &&
      open() &&
      (!fromInput || event.ctrlKey)
    ) {
      event.preventDefault();
      move(0, event, event.key === 'Home' ? 'start' : 'end');
    } else if (event.key === 'Enter' || (!fromInput && event.key === ' ')) {
      if (open()) {
        const current = items().find((item) => item.id() === active());
        if (current) {
          event.preventDefault();
          select(current, event);
        } else if (kind === 'select') {
          event.preventDefault();
          setOpen(false, event, 'trigger-press');
        }
      } else if (!fromInput) {
        event.preventDefault();
        setOpen(true, event, 'trigger-press');
      }
    } else if (event.key === 'Escape' && open()) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false, event, 'escape-key');
      focusControl();
    } else if (event.key === 'Tab' && open()) {
      if (kind === 'select' && popup()?.contains(event.target as Node)) {
        const control = trigger();
        const candidates = control
          ? Array.from(
              control.ownerDocument.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
              ),
            ).filter(
              (element) =>
                element.tabIndex >= 0 &&
                !element.closest('[hidden], [data-base-ui-portal]'),
            )
          : [];
        const index = control ? candidates.indexOf(control) : -1;
        const next = candidates[index + (event.shiftKey ? -1 : 1)];
        if (next) {
          event.preventDefault();
          next.focus();
        }
      }
      setOpen(false, event, 'focus-out');
    } else if (
      fromInput &&
      props.multiple &&
      !inputValue() &&
      chips().length &&
      event.key === (direction() === 'rtl' ? 'ArrowRight' : 'ArrowLeft')
    ) {
      event.preventDefault();
      chips().at(-1)?.focus();
    } else if (
      fromInput &&
      props.multiple &&
      !inputValue() &&
      event.key === 'Backspace' &&
      values().length
    ) {
      event.preventDefault();
      setValue(values().slice(0, -1), event, 'none');
    } else if (
      !fromInput &&
      (kind !== 'select' || open() || (!props.readOnly && !props.multiple)) &&
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey
    ) {
      typeahead += event.key;
      typeaheadTimer.start(500, () => {
        typeahead = '';
      });
      const choices = items();
      const previous = choices.findIndex((item) =>
        open() ? item.id() === active() : equal(item.value(), value()),
      );
      const ordered = [...choices.slice(previous + 1), ...choices.slice(0, previous + 1)];
      const repeated = [...typeahead].every((letter) => letter === typeahead[0]);
      const search = repeated
        ? typeahead[0]
        : typeahead;
      const current = choices[previous];
      const match =
        (!repeated && current && filter.startsWith(current.label(), search) ? current : undefined) ??
        ordered.find((item) => filter.startsWith(item.label(), search));
      if (match) {
        event.preventDefault();
        if (open()) highlight(match, event, 'keyboard');
        else setValue(match.value(), event, 'none');
      } else if (!open()) setOpen(true, event, 'list-navigation');
    }
  }
  const context: SelectionContext = {
    kind,
    props,
    id,
    listId: `${id}-list`,
    open,
    mounted,
    forceMount,
    forceMountItems: () => setForceMount(true),
    phase,
    setOpen,
    requestListFocus: () => { focusListOnOpen = true; },
    value,
    setValue,
    values,
    inputValue,
    setInputValue,
    field,
    label,
    hasNullLabel,
    serialize,
    equal,
    selected,
    itemValue,
    filtered,
    visible,
    items,
    alignmentItem() {
      const ordered = registered()
        .filter((item) => item.element()?.isConnected)
        .sort((a, b) => (a.element()!.compareDocumentPosition(b.element()!) & 2 ? 1 : -1));
      return (
        ordered.find((item) => selected(item.value())) ??
        (!values().length ? ordered[0] : undefined)
      );
    },
    active,
    highlight,
    select,
    keydown,
    register(item) {
      labelCache.set(item.value(), item.label());
      mountedItems.add(item);
      setRegistered([...mountedItems]);
      return () => {
        labelCache.set(item.value(), item.label());
        mountedItems.delete(item);
        const selectedValue = value();
        if (
          kind === 'select' &&
          !props.multiple &&
          selectedValue != null &&
          equal(item.value(), selectedValue) &&
          ![...mountedItems].some((candidate) => equal(candidate.value(), selectedValue))
        ) {
          const fallback =
            initialSelection != null &&
            [...mountedItems].some((candidate) => equal(candidate.value(), initialSelection))
              ? initialSelection
              : null;
          const pending = { value: selectedValue, fallback };
          pendingRemovedSelection = pending;
          queueMicrotask(() => {
            if (disposed || pendingRemovedSelection !== pending) return;
            if (equal(pending.value, value())) setValue(pending.fallback, undefined, 'none');
            pendingRemovedSelection = undefined;
          });
        }
        // Solid can dispose a filtered row while evaluating a list computation.
        // Publish the DOM registry change after that computation has finished.
        queueMicrotask(() => {
          if (!disposed) setRegistered([...mountedItems]);
        });
      };
    },
    trigger,
    setTrigger,
    input,
    inputInsidePopup,
    setInput(element, insidePopup = false) {
      setInputInsidePopup(insidePopup);
      if (insidePopup && props.inputValue === undefined && props.defaultInputValue === undefined)
        setQuery('', undefined, 'none');
      setInput(element);
    },
    popup,
    setPopup,
    positioner,
    setPositioner,
    list,
    setList,
    anchor,
    setAnchor,
    labelId,
    setLabelId,
    chips,
    setChips(next) {
      if (!disposed) setChips(next);
    },
  };
  createEffect(
    () => ({ value: value(), inputInsidePopup: inputInsidePopup() }),
    (current) => {
      if (kind === 'combobox' && !current.inputInsidePopup && !props.multiple)
        setQuery(label(current.value), undefined, 'none');
    },
  );
  createEffect(
    () => ({ value: props.value, mode: props.mode, readOnly: props.readOnly }),
    () => {
      setInlineValue(undefined);
    },
  );
  createEffect(
    () => ({ open: open(), items: items(), query: inputValue() }),
    (state) => {
      if (!state.open) return;
      if (initialPopupFocusPending && state.items.length) {
        initialPopupFocusPending = false;
        queueMicrotask(() => (list() ?? popup())?.focus());
        return;
      }
      const current = state.items.find((item) => item.id() === active());
      if (kind === 'select' && current && current === lastFocusedItem) {
        queueMicrotask(() => {
          if (disposed) return;
          const element = current.element();
          if (open() && active() === current.id() && element?.isConnected &&
              element.ownerDocument.activeElement === element.ownerDocument.body)
            element.focus({ preventScroll: true });
        });
      }
      if (!current) {
        const autoHighlight =
          props.autoHighlight === 'always' ||
          (props.autoHighlight === true && typedValue().length > 0);
        const next =
          state.items.find((item) => selected(item.value())) ??
          (kind === 'select' || autoHighlight ? state.items[0] : undefined);
        highlight(next);
      }
      if (focusListOnOpen) {
        focusListOnOpen = false;
        queueMicrotask(() => (list() ?? popup())?.focus());
      }
    },
  );
  let previousValue = untrack(value);
  createEffect(
    () => value(),
    (current) => {
      if (!Object.is(previousValue, current)) {
        previousValue = current;
        field?.change(current);
      }
    },
  );
  const transitionFrame = useAnimationFrame();
  let transitionSequence = 0;
  let didOpen = untrack(open);
  let completedOpen = false;
  const unmount = () => {
    if (open()) return;
    setPresent(false);
    setPhase('idle');
    if (kind === 'combobox' && inputInsidePopup() && props.inputValue === undefined)
      setQuery('', undefined, 'none');
    if (didOpen) {
      didOpen = false;
      completedOpen = false;
      props.onOpenChangeComplete?.(false);
    }
  };
  createEffect(
    () => ({ open: open(), element: popup(), manual: Boolean(props.actionsRef) }),
    (state) => {
      const sequence = ++transitionSequence;
      if (state.open) {
        setPresent(true);
        setPhase('starting');
        didOpen = true;
      } else if (!didOpen) return;
      else {
        setPhase('ending');
        if (state.manual) return;
      }
      const finish = () => {
        if (sequence !== transitionSequence) return;
        if (state.open) {
          setPhase('idle');
          if (!completedOpen) {
            completedOpen = true;
            props.onOpenChangeComplete?.(true);
          }
        } else unmount();
      };
      const waitForAnimation = () => {
        if (sequence !== transitionSequence) return;
        const animations =
          state.element
            ?.getAnimations?.()
            .filter(
              (animation) =>
                animation.playState !== 'finished' &&
                animation.effect?.getComputedTiming().iterations !== Infinity,
            ) ?? [];
        if (animations.length)
          void Promise.allSettled(animations.map((animation) => animation.finished)).then(finish);
        else finish();
      };
      transitionFrame.request(() => {
        if (state.open) {
          setPhase('idle');
          transitionFrame.request(waitForAnimation);
        } else waitForAnimation();
      });
      return () => {
        transitionFrame.cancel();
      };
    },
  );
  createEffect(
    () => ({
      active: mounted() && (props.modal ?? kind === 'select'),
      element: input() ?? trigger() ?? popup(),
    }),
    ({ active, element }) => {
      if (active && element) return acquireScrollLock(element.ownerDocument);
    },
  );
  createEffect(
    () => ({
      open: open(),
      trigger: trigger(),
      input: input(),
      popup: popup(),
      positioner: positioner(),
      anchor: anchor(),
    }),
    (state) => {
      if (!state.open) return;
      const document = (state.input ?? state.trigger ?? state.popup)?.ownerDocument;
      if (!document) return;
      const inside = (event: Event) =>
        [state.trigger, state.input, state.popup, state.positioner, state.anchor, ...chips()].some(
          (element) => containsSelectionPortal(element, getTarget(event) as Node),
        );
      const pointer = (event: PointerEvent) => {
        if (!inside(event) && setOpen(false, event, 'outside-press')) {
          if (props.modal ?? kind === 'select') {
            // A modal backdrop must not transfer focus to the page below it.
            event.preventDefault();
            focusControl();
          }
        }
      };
      const focus = (event: FocusEvent) => {
        if (!inside(event)) setOpen(false, event, 'focus-out');
      };
      document.addEventListener('pointerdown', pointer, true);
      document.addEventListener('focusin', focus);
      return () => {
        document.removeEventListener('pointerdown', pointer, true);
        document.removeEventListener('focusin', focus);
      };
    },
  );
  createEffect(
    () => props.actionsRef,
    (ref) => {
      if (!ref) return;
      assignRef(ref, { unmount });
      return () => assignRef(ref, null);
    },
  );
  const [formInput, setFormInput] = createSignal<HTMLInputElement>();
  createEffect(
    () => formInput()?.form,
    (form) => {
      if (!form) return;
      const reset = (event: Event) => {
        queueMicrotask(() => {
          if (event.defaultPrevented) return;
          setValue(
            props.defaultValue ?? (kind === 'autocomplete' ? '' : props.multiple ? [] : null),
            event,
            'none',
          );
          setInputValue(
            props.defaultInputValue ??
              (kind === 'combobox' && !props.multiple ? label(props.defaultValue) : ''),
            event,
            'none',
          );
          setOpen(false, event, 'none');
        });
      };
      form.addEventListener('reset', reset);
      return () => form.removeEventListener('reset', reset);
    },
  );
  return (
    <SelectionContext value={context}>
      {props.children}
      <Show when={kind !== 'autocomplete'}>
        <input
          ref={(element) => {
            setFormInput(element);
            field?.register(element, value());
            if (kind === 'select') assignRef(props.inputRef, element);
          }}
          type="text"
          id={props.name == null ? `${props.id ?? `${id}-trigger`}-hidden-input` : undefined}
          tabindex={-1}
          aria-hidden="true"
          style={hiddenInputStyle}
          name={props.multiple ? undefined : props.name}
          form={props.form}
          autocomplete={props.autoComplete}
          value={props.multiple ? values().map(serialize).join(',') : serialize(value())}
          disabled={props.disabled}
          required={props.required && (!props.multiple || values().length === 0)}
          readonly={props.readOnly}
          onFocus={focusControl}
          onInvalid={focusControl}
          onChange={(event) => {
            const input = event.currentTarget;
            if (event.defaultPrevented || props.disabled || props.readOnly || props.multiple) {
              input.value = props.multiple ? values().map(serialize).join(',') : serialize(value());
              return;
            }
            const nextValue = input.value.toLowerCase();
            if (kind === 'select') setForceMount(true);
            queueMicrotask(() => {
              if (disposed) return;
              const candidates = [
                ...flatItems(data() ?? []).map(itemValue),
                ...registered().map((item) => item.value()),
              ];
              const match =
                candidates.find((candidate) => serialize(candidate).toLowerCase() === nextValue) ??
                candidates.find((candidate) => label(candidate).toLowerCase() === nextValue) ??
                registered().find((item) => item.label().toLowerCase() === nextValue)?.value();
              if (match !== undefined) setValue(match, event, 'none');
              else input.value = serialize(value());
            });
          }}
        />
        <Show when={props.multiple && props.name}>
          <For each={values()}>
            {(item) => (
              <input
                type="hidden"
                name={props.name}
                form={props.form}
                value={serialize(item)}
                disabled={props.disabled}
              />
            )}
          </For>
        </Show>
      </Show>
    </SelectionContext>
  );
}

export function SelectRoot<Value = ItemValue, Multiple extends boolean | undefined = false>(
  props: SelectionRootProps<Value, Multiple>,
) {
  return SelectionRoot(props, 'select');
}
export namespace SelectRoot {
  export type Props<Value = ItemValue, Multiple extends boolean | undefined = false> =
    SelectRootProps<Value, Multiple>;
  export type Actions = SelectRootActions;
  export type ChangeEventReason = SelectRootChangeEventReason;
  export type ChangeEventDetails = SelectRootChangeEventDetails;
}
export function ComboboxRoot<Value = ItemValue, Multiple extends boolean | undefined = false>(
  props: SelectionRootProps<Value, Multiple>,
) {
  return SelectionRoot(props, 'combobox');
}
export namespace ComboboxRoot {
  export type Props<Value = ItemValue, Multiple extends boolean | undefined = false> =
    ComboboxRootProps<Value, Multiple>;
  export type Actions = ComboboxRootActions;
  export type ChangeEventReason = ComboboxRootChangeEventReason;
  export type ChangeEventDetails = ComboboxRootChangeEventDetails;
  export type HighlightEventReason = ComboboxRootHighlightEventReason;
  export type HighlightEventDetails = ComboboxRootHighlightEventDetails;
}
export function AutocompleteRoot<Value = ItemValue>(props: AutocompleteRootProps<Value>) {
  return SelectionRoot(props, 'autocomplete');
}
export namespace AutocompleteRoot {
  export type Props<Value = ItemValue> = AutocompleteRootProps<Value>;
  export type Actions = AutocompleteRootActions;
  export type ChangeEventReason = AutocompleteRootChangeEventReason;
  export type ChangeEventDetails = AutocompleteRootChangeEventDetails;
  export type HighlightEventReason = AutocompleteRootHighlightEventReason;
  export type HighlightEventDetails = AutocompleteRootHighlightEventDetails;
}

function popupState(context: SelectionContext) {
  return {
    get open() {
      return context.open();
    },
    get closed() {
      return !context.open();
    },
    get disabled() {
      return Boolean(context.props.disabled);
    },
    get readOnly() {
      return Boolean(context.props.readOnly);
    },
    get startingStyle() {
      return context.phase() === 'starting';
    },
    get endingStyle() {
      return context.phase() === 'ending';
    },
    get valid() {
      return context.field?.state.valid === true;
    },
    get invalid() {
      return context.field?.state.valid === false;
    },
    get dirty() {
      return context.field?.state.dirty;
    },
    get touched() {
      return context.field?.state.touched;
    },
  };
}

function fieldAttributes(context: SelectionContext) {
  return {
    get 'aria-invalid'() {
      return context.field?.state.valid === false || undefined;
    },
    get 'aria-describedby'() {
      return (
        [
          context.field?.description(),
          context.field?.state.valid === false && context.field?.errorId(),
        ]
          .filter(Boolean)
          .join(' ') || undefined
      );
    },
    onFocus() {
      context.field?.focus(true);
    },
    onBlur(event: FocusEvent) {
      if (
        [context.input(), context.trigger(), context.popup()].some((element) =>
          containsSelectionPortal(element, event.relatedTarget as Node),
        )
      )
        return;
      context.field?.focus(false);
      context.field?.touch();
    },
  };
}

export function SelectionTrigger(props: BaseProps) {
  const context = useSelection();
  const pressFrame = useAnimationFrame();
  let pointerType: string | undefined;
  createEffect(
    () => props.id,
    (explicitId) => {
      context.field?.setControlId(explicitId ?? context.props.id ?? context.field.id);
      return () => context.field?.setControlId(context.field.id);
    },
  );
  return renderElement(
    'button',
    omitProps(props, ['aria-describedby']),
    mergeProps(popupState(context), {
      get placeholder() {
        return context.kind === 'select' && !context.values().length;
      },
      get filled() {
        return context.field?.state.filled;
      },
      get focused() {
        return context.field?.state.focused;
      },
    }),
    mergeProps(fieldAttributes(context), {
      get 'aria-describedby'() {
        return (
          [
            props['aria-describedby'],
            context.field?.description(),
            context.field?.state.valid === false && context.field?.errorId(),
          ]
            .filter(Boolean)
            .join(' ') || undefined
        );
      },
      type: 'button',
      ref: context.setTrigger,
      get id() {
        return context.kind === 'select'
          ? (context.props.id ?? `${context.id}-trigger`)
          : `${context.id}-trigger`;
      },
      get disabled() {
        return context.props.disabled;
      },
      get role() {
        return context.kind === 'select' || context.inputInsidePopup() ? 'combobox' : undefined;
      },
      get 'aria-haspopup'() {
        return context.kind === 'combobox' && context.inputInsidePopup() ? 'dialog' : 'listbox';
      },
      get 'aria-controls'() {
        return context.open()
          ? context.kind === 'combobox' && context.inputInsidePopup()
            ? (context.popup()?.id ?? `${context.id}-popup`)
            : (context.list()?.id ?? context.popup()?.id ?? context.listId)
          : undefined;
      },
      get 'aria-expanded'() {
        return context.open();
      },
      get 'aria-labelledby'() {
        return context.field?.labelId() ?? context.labelId();
      },
      get 'aria-required'() {
        return context.props.required || undefined;
      },
      get 'aria-readonly'() {
        return context.props.readOnly || undefined;
      },
      get 'aria-activedescendant'() {
        return context.kind !== 'select' && !context.inputInsidePopup() && context.open()
          ? context.active()
          : undefined;
      },
      get tabIndex() {
        return context.kind !== 'select' && !context.inputInsidePopup() ? -1 : 0;
      },
      onPointerDown(event: PointerEvent) {
        if (context.kind === 'select') pointerType = event.pointerType;
        if (context.input() && !context.inputInsidePopup() && event.pointerType !== 'touch')
          event.preventDefault();
      },
      onMouseDown(event: MouseEvent) {
        if (context.kind !== 'select' || event.button !== 0 || props.disabled) return;
        const next = !context.open();
        // Match the pointer press contract: let the browser focus the trigger
        // before opening, so pointer use does not show a keyboard focus ring.
        pressFrame.request(() => context.setOpen(next, event, 'trigger-press'));
      },
      onClick(event: MouseEvent) {
        if (context.kind === 'select' && pointerType) {
          pointerType = undefined;
          return;
        }
        const fromFieldLabel = context.field?.consumeLabelActivation();
        if (fromFieldLabel) context.requestListFocus();
        context.setOpen(!context.open(), event, 'trigger-press');
        if (context.kind !== 'select') context.input()?.focus({ preventScroll: true });
      },
      onKeyDown(event: KeyboardEvent) {
        pointerType = undefined;
        context.keydown(event);
      },
      onFocus() {
        if (context.kind === 'select') context.forceMountItems();
      },
    }),
  );
}

export function SelectionInput(props: BaseProps<any>) {
  const context = useSelection();
  const position = useContext(PositionContext);
  const insidePopup = () => Boolean(position || context.props.inline);
  createEffect(
    () => ({ open: context.open(), input: context.input(), insidePopup: insidePopup() }),
    ({ open, input, insidePopup }) => {
      if (open && insidePopup) input?.focus({ preventScroll: true });
    },
  );
  return renderElement(
    'input',
    props,
    popupState(context),
    mergeProps(fieldAttributes(context), {
      role: 'combobox',
      type: 'text',
      ref(element: HTMLInputElement) {
        context.setInput(element, insidePopup());
        assignRef(context.props.inputRef, element);
        context.field?.register(
          element,
          context.kind === 'autocomplete' ? context.inputValue() : context.value(),
        );
      },
      get id() {
        return context.props.id ?? `${context.id}-input`;
      },
      get name() {
        return context.kind === 'autocomplete' ? context.props.name : undefined;
      },
      get form() {
        return context.props.form;
      },
      get value() {
        return context.inputValue();
      },
      get disabled() {
        return context.props.disabled;
      },
      get readOnly() {
        return context.props.readOnly;
      },
      get required() {
        return context.kind === 'autocomplete' ? context.props.required : undefined;
      },
      autocomplete: 'off',
      autocapitalize: 'none',
      spellcheck: false,
      'aria-haspopup': 'listbox',
      get 'aria-autocomplete'() {
        return context.props.readOnly
          ? 'none'
          : context.kind === 'autocomplete'
            ? (context.props.mode ?? 'list')
            : 'list';
      },
      get 'aria-expanded'() {
        return context.open();
      },
      get 'aria-controls'() {
        return context.open() ? context.listId : undefined;
      },
      get 'aria-labelledby'() {
        return context.labelId();
      },
      get 'aria-activedescendant'() {
        return context.open() ? context.active() : undefined;
      },
      get 'aria-required'() {
        return context.props.required || undefined;
      },
      onInput(event: InputEvent) {
        if (context.props.disabled || context.props.readOnly) return;
        context.setInputValue(
          (event.currentTarget as HTMLInputElement).value,
          event,
          'input-change',
        );
        context.setOpen(true, event, 'input-change');
      },
      onClick(event: MouseEvent) {
        if (context.props.openOnInputClick ?? context.kind === 'combobox')
          context.setOpen(true, event, 'input-press');
      },
      onKeyDown(event: KeyboardEvent) {
        context.keydown(event, true);
      },
    }),
  );
}

export function SelectionInputGroup(props: BaseProps<any>) {
  const context = useSelection();
  return renderElement('div', props, popupState(context), {
    ref: context.setAnchor,
    onClick() {
      context.input()?.focus();
    },
  });
}

export function SelectionLabel(props: BaseProps) {
  const context = useSelection();
  const fallbackId = createUniqueId();
  const id = () =>
    context.kind === 'select'
      ? `${context.props.id ?? context.id}-label`
      : (props.id ?? fallbackId);
  createEffect(
    id,
    (label) => {
      context.setLabelId(label);
      return () => queueMicrotask(() => {
        if (context.labelId() === label) context.setLabelId(undefined);
      });
    },
  );
  return renderElement(
    context.kind === 'select' ? 'div' : 'label',
    context.kind === 'select' ? omitProps(props, ['id']) : props,
    {},
    {
      get id() {
        return id();
      },
      get for() {
        return context.kind === 'select'
          ? undefined
          : (context.props.id ?? `${context.id}-input`);
      },
      onClick() {
        (context.input() ?? context.trigger())?.focus();
      },
    },
  );
}

export function SelectionValue(
  props: Omit<BaseProps<any>, 'children'> & {
    children?: JSX.Element | ((value: ItemValue) => JSX.Element);
  },
) {
  const context = useSelection();
  const content = () => {
    const current = context.kind === 'autocomplete' ? context.inputValue() : context.value();
    const children = props.children;
    if (typeof children === 'function') return children(current);
    if (children != null) return children;
    if (context.kind === 'autocomplete') return current;
    return context.values().length
      ? context.values().map(context.label).join(', ')
      : context.hasNullLabel()
        ? context.label(null)
        : (props.placeholder ?? context.label(null));
  };
  if (context.kind !== 'select') return <>{content()}</>;
  return renderElement(
    'span',
    mergeProps<BaseProps>(omitProps(props, ['placeholder', 'children'])),
    {
      get placeholder() {
        return !context.values().length;
      },
    },
    {
      'data-select-value': '',
      get children() {
        return content();
      },
    },
  );
}

export function SelectionIcon(props: BaseProps<any>) {
  const context = useSelection();
  return renderElement('span', props, popupState(context), { 'aria-hidden': true });
}

export function SelectionPortal(props: BaseProps) {
  const context = useSelection();
  const id = createUniqueId();
  const mount = () =>
    typeof props.container === 'function'
      ? props.container()
      : (props.container?.current ?? props.container);
  return (
    <Show when={context.mounted() || context.forceMount() || props.keepMounted || context.props.inline}>
      <SolidPortal mount={mount()}>
        {renderElement(
          'div',
          omitProps(props, ['container', 'keepMounted']),
          {},
          {
            id,
            'data-base-ui-portal': '',
          },
        )}
      </SolidPortal>
    </Show>
  );
}

export function SelectionBackdrop(props: BaseProps) {
  const context = useSelection();
  return (
    <Show when={context.mounted() || props.keepMounted}>
      {renderElement('div', props, popupState(context), {
        'aria-hidden': true,
        get hidden() {
          return !context.mounted();
        },
        style: { position: 'fixed', inset: '0' },
        onPointerDown(event: PointerEvent) {
          context.setOpen(false, event, 'outside-press');
        },
      })}
    </Show>
  );
}

export function SelectionPositioner(props: BaseProps) {
  const context = useSelection();
  const direction = useDirection();
  const [element, setElement] = createSignal<HTMLElement>();
  const [arrowElement, setArrow] = createSignal<HTMLElement>();
  const openCycle = createMemo((previous: { open: boolean; cycle: number } | undefined) => {
    const open = context.open() || Boolean(context.props.inline);
    return {
      open,
      cycle: open && !previous?.open ? (previous?.cycle ?? 0) + 1 : (previous?.cycle ?? 0),
    };
  });
  const [positionedCycle, setPositionedCycle] = createSignal(0);
  const [position, setPosition] = createSignal({
    x: 0,
    y: 0,
    placement: 'bottom' as Placement,
    aligned: false,
    hidden: false,
    positioned: false,
    height: undefined as number | undefined,
    arrow: {} as { x?: number; y?: number; centerOffset?: number },
  });
  const [dimensions, setDimensions] = createSignal({
    width: 0,
    height: 0,
    availableWidth: 0,
    availableHeight: 0,
  });
  const side = () => (position().aligned ? 'none' : position().placement.split('-')[0]);
  const align = () => position().placement.split('-')[1] ?? 'center';
  const backdropClipPath = () => {
    // Position updates also refresh the cutout after an anchor moves or resizes.
    position();
    const cutout =
      context.kind === 'select' || context.inputInsidePopup()
        ? context.trigger()
        : (context.anchor() ?? context.input() ?? context.trigger());
    if (!cutout) return undefined;
    const rect = cutout.getBoundingClientRect();
    return `polygon(0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${rect.left}px ${rect.top}px,${rect.left}px ${rect.bottom}px,${rect.right}px ${rect.bottom}px,${rect.right}px ${rect.top}px,${rect.left}px ${rect.top}px)`;
  };
  createEffect(
    () => ({
      open: context.open() || context.props.inline,
      element: element(),
      reference:
        (typeof props.anchor === 'function'
          ? props.anchor()
          : (props.anchor?.current ?? props.anchor)) ??
        (context.inputInsidePopup()
          ? context.trigger()
          : (context.anchor() ?? context.input() ?? context.trigger())),
      side: String(props.side ?? 'bottom'),
      align: props.align ?? 'center',
      sideOffset: props.sideOffset ?? 0,
      alignOffset: props.alignOffset ?? 0,
      collisionPadding: props.collisionPadding ?? 5,
      collisionBoundary: props.collisionBoundary,
      collisionAvoidance: props.collisionAvoidance,
      positionMethod:
        context.kind === 'select' && props.alignItemWithTrigger !== false
          ? 'fixed'
          : (props.positionMethod ?? 'absolute'),
      arrow: arrowElement(),
      arrowPadding: props.arrowPadding ?? 5,
      trackAnchor: props.trackAnchor,
      direction: direction(),
      alignedItem:
        context.kind === 'select' && props.alignItemWithTrigger !== false
          ? context.alignmentItem()?.element()
          : undefined,
      trigger: context.trigger(),
    }),
    (config) => {
      if (!config.open || !config.reference || !config.element) return;
      const currentOpenCycle = openCycle().cycle;
      let alive = true;
      let request = 0;
      const logicalSide =
        config.side === 'inline-start'
          ? config.direction === 'rtl'
            ? 'right'
            : 'left'
          : config.side === 'inline-end'
            ? config.direction === 'rtl'
              ? 'left'
              : 'right'
            : config.side;
      const placement =
        `${logicalSide}${config.align === 'center' ? '' : `-${config.align}`}` as Placement;
      const padding = config.collisionPadding;
      const boundary = config.collisionBoundary;
      const update = async () => {
        const currentRequest = ++request;
        let naturalPopupHeight: number | undefined;
        if (config.alignedItem) {
          const list = context.list();
          const popup = context.popup();
          const previousListMaxHeight = list?.style.maxHeight;
          if (list) list.style.maxHeight = 'none';
          naturalPopupHeight = list?.scrollHeight ?? popup?.scrollHeight;
          if (list) list.style.maxHeight = previousListMaxHeight ?? '';
        }
        const result = await computePosition(
          config.reference as HTMLElement | VirtualElement,
          config.element!,
          {
            strategy: config.positionMethod,
            placement,
            middleware: [
              offset({ mainAxis: config.sideOffset, crossAxis: config.alignOffset }),
              config.collisionAvoidance?.side !== 'none' && flip({ padding, boundary }),
              config.collisionAvoidance?.align !== 'none' && shift({ padding, boundary }),
              size({
                padding,
                boundary,
                apply({ availableWidth, availableHeight, rects }) {
                  const ownerWindow = config.element!.ownerDocument.defaultView;
                  const dpr = ownerWindow?.devicePixelRatio || 1;
                  const { x, y, width, height } = rects.reference;
                  if (alive)
                    setDimensions({
                      width: (Math.round((x + width) * dpr) - Math.round(x * dpr)) / dpr,
                      height: (Math.round((y + height) * dpr) - Math.round(y * dpr)) / dpr,
                      availableWidth,
                      availableHeight,
                    });
                },
              }),
              hide({ padding, boundary }),
              config.arrow && arrow({ element: config.arrow, padding: config.arrowPadding }),
            ],
          },
        );
        if (!alive || currentRequest !== request) return;
        let { x, y } = result;
        const aligned = Boolean(
          config.alignedItem && config.trigger && config.alignedItem.isConnected,
        );
        if (aligned) {
          const ownerWindow = config.element!.ownerDocument.defaultView;
          const selectedRect = config.alignedItem!.getBoundingClientRect();
          const itemText =
            config.alignedItem!.querySelector('[data-item-text]') ?? config.alignedItem!;
          const itemTextRect = itemText.getBoundingClientRect();
          const triggerRect = config.trigger!.getBoundingClientRect();
          const triggerTextRect = (
            config.trigger!.querySelector('[data-select-value]') ?? config.trigger!
          ).getBoundingClientRect();
          const floatingRect = config.element!.getBoundingClientRect();
          const paddingTop = typeof padding === 'number' ? padding : (padding?.top ?? 0);
          const paddingBottom = typeof padding === 'number' ? padding : (padding?.bottom ?? 0);
          const paddingLeft = typeof padding === 'number' ? padding : (padding?.left ?? 0);
          const paddingRight = typeof padding === 'number' ? padding : (padding?.right ?? 0);
          const desiredTop =
            floatingRect.top +
            triggerRect.top +
            triggerRect.height / 2 -
            selectedRect.top -
            selectedRect.height / 2;
          const desiredLeft =
            floatingRect.left +
            (config.direction === 'rtl'
              ? triggerTextRect.right - itemTextRect.right
              : triggerTextRect.left - itemTextRect.left);
          const viewportHeight = ownerWindow?.innerHeight ?? floatingRect.bottom;
          const viewportWidth = ownerWindow?.innerWidth ?? floatingRect.right;
          const top = Math.max(
            paddingTop,
            Math.min(viewportHeight - floatingRect.height - paddingBottom, desiredTop),
          );
          const left = Math.max(
            paddingLeft,
            Math.min(viewportWidth - floatingRect.width - paddingRight, desiredLeft),
          );
          x =
            (config.positionMethod === 'fixed' ? floatingRect.left : config.element!.offsetLeft) +
            left -
            floatingRect.left;
          y =
            (config.positionMethod === 'fixed' ? floatingRect.top : config.element!.offsetTop) +
            top -
            floatingRect.top;
        }
        const dpr = config.element!.ownerDocument.defaultView?.devicePixelRatio || 1;
        setPosition({
          x: aligned ? x : Math.round(x * dpr) / dpr,
          y: aligned ? y : Math.round(y * dpr) / dpr,
          placement: result.placement,
          aligned,
          hidden: Boolean(result.middlewareData.hide?.referenceHidden),
          positioned: true,
          height:
            aligned && naturalPopupHeight
              ? Math.min(
                  naturalPopupHeight,
                  (config.element!.ownerDocument.defaultView?.innerHeight ?? Infinity) - 20,
                  (config.element!.ownerDocument.defaultView?.innerHeight ?? Infinity) - 10 - y,
                )
              : undefined,
          arrow: result.middlewareData.arrow ?? {},
        });
        setPositionedCycle(currentOpenCycle);
        props.onPositioned?.();
      };
      const ownerWindow = config.element.ownerDocument.defaultView;
      const view = ownerWindow ?? window;
      let initialUpdate = true;
      let updateFrame: number | undefined;
      const scheduleUpdate = () => {
        if (initialUpdate) {
          initialUpdate = false;
          void update();
          return;
        }
        if (updateFrame !== undefined) return;
        updateFrame = view.requestAnimationFrame(() => {
          updateFrame = undefined;
          void update();
        });
      };
      const cleanup = autoUpdate(
        config.reference,
        config.element,
        scheduleUpdate,
        {
          elementResize: Boolean(ownerWindow && 'ResizeObserver' in ownerWindow),
          layoutShift: Boolean(ownerWindow && 'IntersectionObserver' in ownerWindow),
          animationFrame: Boolean(config.trackAnchor),
        },
      );
      return () => {
        alive = false;
        cleanup();
        if (updateFrame !== undefined) view.cancelAnimationFrame(updateFrame);
      };
    },
  );
  return (
    <PositionContext value={{ side, align, arrow: () => position().arrow, setArrow }}>
      <Show when={context.mounted() && (context.props.modal ?? context.kind === 'select')}>
        {/* The backdrop blocks outside pointer targets. The root owns dismissal
            and restores focus; the cutout keeps the trigger/input interactive. */}
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
      <Show when={context.mounted() || context.forceMount() || props.keepMounted || context.props.inline}>
        {renderElement(
          'div',
          omitProps(props, ['alignItemWithTrigger']),
          mergeProps(popupState(context), {
            get side() {
              return side();
            },
            get align() {
              return align();
            },
            get anchorHidden() {
              return position().hidden;
            },
          }),
          {
            ref(element: HTMLElement) {
              setElement(element);
              context.setPositioner(element);
            },
            get hidden() {
              return !context.mounted() && !context.props.inline;
            },
            get style() {
              const current = position();
              const reference =
                (typeof props.anchor === 'function'
                  ? props.anchor()
                  : (props.anchor?.current ?? props.anchor)) ??
                (context.inputInsidePopup()
                  ? context.trigger()
                  : (context.anchor() ?? context.input() ?? context.trigger()));
              const referenceRect = reference?.getBoundingClientRect();
              const dpr =
                (reference as HTMLElement | undefined)?.ownerDocument?.defaultView?.devicePixelRatio ||
                element()?.ownerDocument.defaultView?.devicePixelRatio ||
                1;
              const measuredWidth = referenceRect
                ? (Math.round((referenceRect.x + referenceRect.width) * dpr) -
                    Math.round(referenceRect.x * dpr)) /
                  dpr
                : 0;
              const positionedForOpen = current.positioned && positionedCycle() === openCycle().cycle;
              const windowHeight = element()?.ownerDocument.defaultView?.innerHeight ?? 0;
              // An item-aligned Select that reaches the lower viewport edge is
              // anchored by its bottom margin, as in the upstream positioner.
              const bottomAligned =
                context.kind === 'select' &&
                current.aligned &&
                current.height !== undefined &&
                Math.abs(current.y + current.height - (windowHeight - 10)) < 1;
              return {
                position:
                  context.kind === 'select' && props.alignItemWithTrigger !== false
                    ? 'fixed'
                    : (props.positionMethod ?? 'absolute'),
                left: `${current.x}px`,
                top: bottomAligned ? undefined : `${current.y}px`,
                bottom: bottomAligned ? '0px' : undefined,
                height: current.height === undefined ? undefined : `${current.height}px`,
                'max-height': bottomAligned ? 'none' : undefined,
                'margin-top': bottomAligned ? '10px' : undefined,
                'margin-bottom': bottomAligned ? '10px' : undefined,
                '--anchor-width': `${positionedForOpen ? dimensions().width : measuredWidth}px`,
                '--anchor-height': `${dimensions().height}px`,
                '--available-width': `${dimensions().availableWidth}px`,
                '--available-height': `${dimensions().availableHeight}px`,
                '--transform-origin': `${align() === 'start' ? 'left' : align() === 'end' ? 'right' : 'center'} ${side() === 'top' ? 'bottom' : 'top'}`,
                transition: context.phase() === 'starting' ? 'none' : undefined,
                opacity:
                  measuredWidth > 0 &&
                  (context.open() || context.props.inline) &&
                  !positionedForOpen
                    ? 0
                    : undefined,
                'pointer-events': context.open() ? undefined : 'none',
              };
            },
          },
        )}
      </Show>
    </PositionContext>
  );
}

export function SelectionPopup(props: BaseProps) {
  const context = useSelection();
  const position = useContext(PositionContext);
  return (
    <Show when={context.mounted() || context.forceMount() || props.keepMounted || context.props.inline}>
      <Show when={context.kind === 'select'}>
        <ScrollbarStyle />
      </Show>
      {renderElement(
        'div',
        props,
        mergeProps(popupState(context), {
          get side() {
            return position?.side() ?? 'bottom';
          },
          get align() {
            return position?.align() ?? 'center';
          },
        }),
        {
          get class() {
            return context.kind === 'select' && position?.side() === 'none' && !context.list()
              ? 'base-ui-disable-scrollbar'
              : undefined;
          },
          ref: context.setPopup,
          get id() {
            return context.inputInsidePopup() || context.list()
              ? `${context.id}-popup`
              : context.listId;
          },
          get role() {
            return context.kind === 'combobox' && context.inputInsidePopup()
              ? 'dialog'
              : context.list()
                ? 'presentation'
                : 'listbox';
          },
          get 'aria-multiselectable'() {
            return !context.list() && context.props.multiple ? true : undefined;
          },
          get 'aria-readonly'() {
            return !context.list() && context.props.readOnly ? true : undefined;
          },
          get 'aria-labelledby'() {
            return !context.list() ? context.labelId() : undefined;
          },
          get hidden() {
            return !context.mounted() && !context.props.inline;
          },
          get style() {
            const mountTransition = context.phase() === 'starting' ? 'none' : undefined;
            const aligned = context.kind === 'select' && position?.side() === 'none';
            const item = context.alignmentItem()?.element();
            const text = item?.querySelector('[data-item-text]') ?? item;
            const popup = context.popup();
            const textRect = aligned ? text?.getBoundingClientRect() : undefined;
            const popupRect = aligned ? popup?.getBoundingClientRect() : undefined;
            const origin =
              textRect && popupRect?.height
                ? `50% ${Math.max(0, Math.min(100, ((textRect.top + textRect.height / 2 - popupRect.top) / popupRect.height) * 100))}%`
                : undefined;
            return aligned
              ? context.list()
                ? { height: '100%', '--transform-origin': origin, transition: mountTransition }
                : {
                    position: 'relative',
                    'max-height': '100%',
                    'overflow-x': 'hidden',
                    'overflow-y': 'auto',
                    '--transform-origin': origin,
                    transition: mountTransition,
                  }
              : { transition: mountTransition };
          },
          tabindex: -1,
          onKeyDown(event: KeyboardEvent) {
            context.keydown(event, event.target === context.input());
          },
          onBlur(event: FocusEvent) {
            if (
              [context.trigger(), context.input(), context.popup(), context.positioner()].some(
                (element) => containsSelectionPortal(element, event.relatedTarget as Node),
              )
            ) return;
            context.setOpen(false, event, 'focus-out');
          },
        },
      )}
    </Show>
  );
}

export function SelectionCollection(props: {
  children: (item: ItemValue, index: number) => JSX.Element;
}) {
  const context = useSelection();
  const group = useContext(GroupContext);
  return (
    <For each={group?.items() ?? context.filtered()}>
      {(item, index) => props.children(item, index())}
    </For>
  );
}

export function SelectionList(
  props: Omit<BaseProps<any>, 'children'> & {
    children?: JSX.Element | ((item: ItemValue, index: number) => JSX.Element);
  },
) {
  const context = useSelection();
  const position = useContext(PositionContext);
  const children = createMemo(() => props.children);
  return renderElement(
    'div',
    omitProps(props, ['children']) as BaseProps,
    {
      get empty() {
        return context.filtered().length === 0;
      },
    },
    {
      ref: context.setList,
      id: context.listId,
      role: 'listbox',
      tabindex: -1,
      get 'aria-multiselectable'() {
        return context.props.multiple || undefined;
      },
      get 'aria-labelledby'() {
        return context.labelId();
      },
      get 'aria-readonly'() {
        return context.props.readOnly || undefined;
      },
      get style() {
        return context.kind === 'select' && position?.side() === 'none'
          ? {
              position: 'relative',
              'max-height': '100%',
              'overflow-x': 'hidden',
              'overflow-y': 'auto',
            }
          : undefined;
      },
      get children() {
        const content = children();
        return typeof content === 'function' && content.length > 0 ? (
          <SelectionCollection>{content}</SelectionCollection>
        ) : (
          content
        );
      },
      onKeyDown(event: KeyboardEvent) {
        context.keydown(event);
      },
      onPointerLeave(event: PointerEvent) {
        if (context.kind === 'autocomplete' && !context.props.keepHighlight)
          context.highlight(undefined, event, 'pointer');
      },
    },
  );
}

export function SelectionItem(props: BaseProps<any>) {
  const context = useSelection();
  const uid = createUniqueId();
  const [element, setElement] = createSignal<HTMLElement>();
  let pointerType: string | undefined;
  let allowMouseSelection = false;
  const item: Item = {
    id: () => props.id ?? uid,
    value: () => context.kind === 'select' && props.value === undefined ? null : props.value,
    label: () =>
      props.label ??
      element()?.querySelector('[data-item-text]')?.textContent ??
      element()?.textContent ??
      textLabel(props.value),
    disabled: () => Boolean(props.disabled || context.props.disabled),
    element,
  };
  createEffect(
    () => item,
    (registeredItem) => context.register(registeredItem),
  );
  return (
    <ItemContext value={item}>
      {renderElement(
        'div',
        omitProps(props, ['value', 'label', 'index']),
        {
          get disabled() {
            return item.disabled();
          },
          get selected() {
            return context.kind !== 'autocomplete' && context.selected(item.value());
          },
          get highlighted() {
            return context.active() === item.id();
          },
        },
        {
          ref: setElement,
          get id() {
            return item.id();
          },
          role: 'option',
          get tabindex() {
            return context.kind === 'select'
              ? context.open() && context.active() === item.id()
                ? 0
                : -1
              : undefined;
          },
          get 'aria-disabled'() {
            return item.disabled() || undefined;
          },
          get 'aria-selected'() {
            return context.kind === 'autocomplete'
              ? context.active() === item.id()
              : context.selected(item.value());
          },
          get hidden() {
            return !context.visible(item);
          },
          onPointerMove(event: PointerEvent) {
            if (
              event.pointerType !== 'touch' &&
              context.props.highlightItemOnHover !== false &&
              !item.disabled()
            )
              context.highlight(item, event, 'pointer');
          },
          onPointerDown(event: PointerEvent) {
            pointerType = event.pointerType;
            allowMouseSelection = true;
            if (event.pointerType !== 'touch') event.preventDefault();
          },
          onClick(event: MouseEvent) {
            if (context.kind === 'select') {
              const clickPointerType = (event as PointerEvent).pointerType;
              const virtualClick =
                event.detail === 0 &&
                (clickPointerType !== undefined || context.active() === item.id());
              if (pointerType !== 'touch' && !allowMouseSelection && !virtualClick) return;
              allowMouseSelection = false;
            }
            context.select(item, event);
          },
          onFocus(event: FocusEvent) {
            if (!item.disabled()) context.highlight(item, event, 'keyboard');
          },
          onKeyDown(event: KeyboardEvent) {
            context.keydown(event);
          },
        },
      )}
    </ItemContext>
  );
}

export function SelectionItemIndicator(props: BaseProps<any>) {
  const context = useSelection();
  const item = useContext(ItemContext);
  const selected = () => Boolean(item && context.selected(item.value()));
  return (
    <Show when={selected() || props.keepMounted}>
      {renderElement(
        'span',
        props,
        {
          get selected() {
            return selected();
          },
        },
        {
          'aria-hidden': true,
          get hidden() {
            return !selected();
          },
        },
      )}
    </Show>
  );
}
export function SelectionItemText(props: BaseProps) {
  if (!useContext(ItemContext)) {
    throw new Error('Base UI: SelectItemContext is missing. SelectItem parts must be placed within <Select.Item>.');
  }
  return renderElement('div', props, {}, { 'data-item-text': '' });
}

export function SelectionGroup(props: BaseProps) {
  const [labelId, setLabelId] = createSignal<string>();
  return (
    <GroupContext value={{ labelId, setLabelId, items: () => props.items }}>
      {renderElement(
        'div',
        omitProps(props, ['items']),
        {},
        {
          role: 'group',
          get 'aria-labelledby'() {
            return labelId();
          },
        },
      )}
    </GroupContext>
  );
}
export function SelectionGroupLabel(props: BaseProps) {
  const context = useContext(GroupContext);
  if (!context) {
    const kind = useSelection().kind;
    const family = kind[0].toUpperCase() + kind.slice(1);
    throw new Error(`Base UI: ${family}GroupContext is missing. ${family}Group parts must be placed within <${family}.Group>.`);
  }
  const generatedId = createUniqueId();
  const id = () => props.id ?? generatedId;
  let registeredId: string | undefined;
  createEffect(id, (currentId) => {
    registeredId = currentId;
    context.setLabelId(currentId);
  });
  onCleanup(() => {
    if (context.labelId() === registeredId) context.setLabelId(undefined);
  });
  return renderElement('div', props, {}, {
    get id() {
      return id();
    },
    get 'aria-hidden'() {
      return 'aria-hidden' in props ? props['aria-hidden'] : true;
    },
  });
}
export function SelectionSeparator(props: BaseProps) {
  return renderElement('div', props, {}, { role: 'separator', 'aria-orientation': 'horizontal' });
}
export function SelectionRow(props: BaseProps) {
  return renderElement('div', props, {}, { role: 'row' });
}
export function SelectionStatus(props: BaseProps) {
  return renderElement(
    'div',
    props,
    {},
    { role: 'status', 'aria-live': 'polite', 'aria-atomic': true },
  );
}
export function SelectionEmpty(props: BaseProps) {
  const context = useSelection();
  return (
    <Show when={context.filtered().length === 0 || props.keepMounted}>
      {renderElement(
        'div',
        props,
        {},
        {
          role: 'status',
          get hidden() {
            return context.filtered().length > 0;
          },
        },
      )}
    </Show>
  );
}

export function SelectionArrow(props: BaseProps) {
  const context = useSelection();
  const position = useContext(PositionContext);
  return renderElement(
    'div',
    props,
    mergeProps(popupState(context), {
      get side() {
        return position?.side();
      },
      get align() {
        return position?.align();
      },
      get uncentered() {
        return Boolean(position?.arrow().centerOffset);
      },
    }),
    {
      ref: position?.setArrow,
      'aria-hidden': true,
      get style() {
        const coordinates = position?.arrow() ?? {};
        const opposite: Record<string, string> = {
          top: 'bottom',
          bottom: 'top',
          left: 'right',
          right: 'left',
        };
        return {
          position: 'absolute',
          left: coordinates.x == null ? undefined : `${coordinates.x}px`,
          top: coordinates.y == null ? undefined : `${coordinates.y}px`,
          [opposite[position?.side() ?? 'bottom']]: '-4px',
        };
      },
    },
  );
}

export function SelectionClear(props: BaseProps<any>) {
  const context = useSelection();
  return renderElement(
    'button',
    props,
    {
      get disabled() {
        return Boolean(context.props.disabled);
      },
    },
    {
      type: 'button',
      'aria-label': 'Clear',
      get disabled() {
        return context.props.disabled || context.props.readOnly;
      },
      onPointerDown(event: PointerEvent) {
        event.preventDefault();
      },
      onClick(event: MouseEvent) {
        if (context.props.disabled || context.props.readOnly) return;
        if (context.kind !== 'autocomplete')
          context.setValue(context.props.multiple ? [] : null, event, 'clear-press');
        context.setInputValue('', event, 'clear-press');
        context.input()?.focus();
      },
    },
  );
}

export function SelectionChips(props: BaseProps<any>) {
  const context = useSelection();
  return renderElement(
    'div',
    props,
    {
      get disabled() {
        return Boolean(context.props.disabled);
      },
    },
    {
      onClick(event: MouseEvent) {
        if (event.target === event.currentTarget) context.input()?.focus();
      },
    },
  );
}

function focusAfterRemoval(context: SelectionContext, index: number) {
  queueMicrotask(() =>
    (
      context.chips()[Math.max(0, Math.min(index, context.chips().length - 1))] ?? context.input()
    )?.focus(),
  );
}
export function SelectionChip(props: BaseProps<any>) {
  const context = useSelection();
  const direction = useDirection();
  const [element, setElement] = createSignal<HTMLElement>();
  const index = () => context.chips().indexOf(element()!);
  const value = () => (props.value !== undefined ? props.value : context.values()[index()]);
  onCleanup(() => {
    const removed = element();
    queueMicrotask(() => context.setChips(context.chips().filter((chip) => chip !== removed)));
  });
  return (
    <ChipContext value={{ value, element }}>
      {renderElement(
        'div',
        omitProps(props, ['value']),
        {
          get disabled() {
            return Boolean(context.props.disabled);
          },
        },
        {
          ref(element: HTMLElement) {
            setElement(element);
            context.setChips([...context.chips(), element]);
          },
          tabindex: -1,
          get 'aria-disabled'() {
            return context.props.disabled || undefined;
          },
          get 'aria-readonly'() {
            return context.props.readOnly || undefined;
          },
          onKeyDown(event: KeyboardEvent) {
            if (context.props.disabled || context.props.readOnly) return;
            const previous = direction() === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
            const next = direction() === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
            if (event.key === previous || event.key === next) {
              event.preventDefault();
              event.stopPropagation();
              (
                context.chips()[index() + (event.key === previous ? -1 : 1)] ?? context.input()
              )?.focus();
            } else if (event.key === 'Backspace' || event.key === 'Delete') {
              event.preventDefault();
              event.stopPropagation();
              const currentIndex = index();
              context.setValue(
                context.values().filter((item) => !context.equal(item, value())),
                event,
                'none',
              );
              focusAfterRemoval(context, currentIndex);
            } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              context.input()?.focus();
              context.keydown(event, true);
            } else if (event.key === 'Enter' || event.key === 'Escape') {
              event.preventDefault();
              context.input()?.focus();
            }
          },
        },
      )}
    </ChipContext>
  );
}

export function SelectionChipRemove(props: BaseProps<any>) {
  const context = useSelection();
  const chip = useContext(ChipContext);
  return renderElement(
    'button',
    props,
    {
      get disabled() {
        return Boolean(context.props.disabled);
      },
    },
    {
      type: 'button',
      tabindex: -1,
      get 'aria-label'() {
        return `Remove ${context.label(chip?.value())}`;
      },
      get disabled() {
        return context.props.disabled || context.props.readOnly;
      },
      onPointerDown(event: PointerEvent) {
        event.preventDefault();
      },
      onClick(event: MouseEvent) {
        if (!chip || context.props.disabled || context.props.readOnly) return;
        const index = context.chips().indexOf(chip.element()!);
        context.setValue(
          context.values().filter((item) => !context.equal(item, chip.value())),
          event,
          'none',
        );
        context.highlight(undefined, event);
        focusAfterRemoval(context, index);
      },
    },
  );
}

const scrollEdgeTolerance = 1;

function normalizeScrollOffset(value: number, max: number) {
  if (max <= 0) return 0;
  const clamped = Math.max(0, Math.min(max, value));
  const nearStart = clamped <= scrollEdgeTolerance;
  const nearEnd = max - clamped <= scrollEdgeTolerance;
  if (nearStart && nearEnd) return clamped <= max - clamped ? 0 : max;
  if (nearStart) return 0;
  if (nearEnd) return max;
  return clamped;
}

function targetScrollTop(
  items: HTMLElement[],
  direction: -1 | 1,
  scrollTop: number,
  clientHeight: number,
  arrowHeight: number,
  max: number,
) {
  if (direction < 0) {
    let firstVisible = 0;
    const visibleTop = scrollTop + arrowHeight - scrollEdgeTolerance;
    for (let index = 0; index < items.length; index += 1) {
      if (items[index].offsetTop >= visibleTop) {
        firstVisible = index;
        break;
      }
    }
    const targetIndex = Math.max(0, firstVisible - 1);
    return targetIndex < firstVisible
      ? normalizeScrollOffset(items[targetIndex].offsetTop - arrowHeight, max)
      : 0;
  }

  let lastVisible = items.length - 1;
  const visibleBottom = scrollTop + clientHeight - arrowHeight + scrollEdgeTolerance;
  for (let index = 0; index < items.length; index += 1) {
    if (items[index].offsetTop + items[index].offsetHeight > visibleBottom) {
      lastVisible = Math.max(0, index - 1);
      break;
    }
  }
  const targetIndex = Math.min(items.length - 1, lastVisible + 1);
  return targetIndex > lastVisible
    ? normalizeScrollOffset(
        items[targetIndex].offsetTop + items[targetIndex].offsetHeight - clientHeight + arrowHeight,
        max,
      )
    : max;
}

function SelectionScrollArrow(props: BaseProps, direction: -1 | 1) {
  const context = useSelection();
  const position = useContext(PositionContext);
  const timeout = useTimeout();
  const [arrow, setArrow] = createSignal<HTMLElement>();
  const [visible, setVisible] = createSignal(false);
  const scroller = () => context.list() ?? context.popup();
  const update = () => {
    const element = scroller();
    const max = element ? Math.max(0, element.scrollHeight - element.clientHeight) : 0;
    const normalized = element ? normalizeScrollOffset(element.scrollTop, max) : 0;
    setVisible(
      Boolean(
        context.mounted() && element && (direction < 0 ? normalized > 0 : normalized < max),
      ),
    );
  };
  createEffect(
    () => ({ element: scroller(), mounted: context.mounted() }),
    ({ element }) => {
      if (!element) return;
      update();
      element.addEventListener('scroll', update);
      const observer =
        typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update);
      observer?.observe(element);
      return () => {
        element.removeEventListener('scroll', update);
        observer?.disconnect();
      };
    },
  );
  const scroll = () => {
    const element = scroller();
    if (!element) return;
    context.highlight(undefined);
    update();
    const max = Math.max(0, element.scrollHeight - element.clientHeight);
    const normalized = normalizeScrollOffset(element.scrollTop, max);
    if (normalized !== element.scrollTop) element.scrollTop = normalized;
    if (normalized === (direction < 0 ? 0 : max)) {
      timeout.clear();
      return;
    }
    const items = context.items().map((item) => item.element()).filter((item): item is HTMLElement => Boolean(item));
    if (items.length > 0) {
      element.scrollTop = targetScrollTop(
        items,
        direction,
        normalized,
        element.clientHeight,
        arrow()?.offsetHeight || 0,
        max,
      );
    }
    timeout.start(40, scroll);
  };
  return (
    <Show when={visible() || props.keepMounted}>
      {renderElement(
        'div',
        props,
        {
          get visible() { return visible(); },
          direction: direction < 0 ? 'up' : 'down',
          get side() { return position?.side() ?? 'bottom'; },
        },
        {
          ref: setArrow,
          'aria-hidden': true,
          children: direction < 0 ? '▲' : '▼',
          style: { position: 'absolute' },
          get hidden() {
            return !visible();
          },
          onMouseMove(event: MouseEvent) {
            if ((event.movementX === 0 && event.movementY === 0) || timeout.isStarted()) return;
            context.highlight(undefined);
            timeout.start(40, scroll);
          },
          onMouseLeave: timeout.clear,
        },
      )}
    </Show>
  );
}
export function SelectScrollUpArrow(props: BaseProps<any>) {
  return SelectionScrollArrow(props, -1);
}
export function SelectScrollDownArrow(props: BaseProps<any>) {
  return SelectionScrollArrow(props, 1);
}

export function useFilteredItems<T = ItemValue>(): () => readonly T[] {
  const context = useSelection();
  return () => context.filtered() as readonly T[];
}

const shared = {
  Trigger: SelectionTrigger,
  Value: SelectionValue,
  Icon: SelectionIcon,
  Portal: SelectionPortal,
  Backdrop: SelectionBackdrop,
  Positioner: SelectionPositioner,
  Popup: SelectionPopup,
  List: SelectionList,
  Item: SelectionItem,
  Arrow: SelectionArrow,
  Group: SelectionGroup,
  GroupLabel: SelectionGroupLabel,
  Separator: SelectionSeparator,
};
export const Select = {
  ...shared,
  Root: SelectRoot,
  Label: SelectionLabel,
  ItemIndicator: SelectionItemIndicator,
  ItemText: SelectionItemText,
  ScrollUpArrow: SelectScrollUpArrow,
  ScrollDownArrow: SelectScrollDownArrow,
};
const searchable = {
  ...shared,
  Input: SelectionInput,
  InputGroup: SelectionInputGroup,
  Empty: SelectionEmpty,
  Status: SelectionStatus,
  Row: SelectionRow,
  Collection: SelectionCollection,
  Clear: SelectionClear,
  useFilter: useSelectionFilter,
  useFilteredItems,
};
export const Combobox = {
  ...searchable,
  Root: ComboboxRoot,
  Label: SelectionLabel,
  ItemIndicator: SelectionItemIndicator,
  Chips: SelectionChips,
  Chip: SelectionChip,
  ChipRemove: SelectionChipRemove,
  createItems: createComboboxItems,
};
export const Autocomplete = { ...searchable, Root: AutocompleteRoot };

export type SelectRootProps<
  Value = ItemValue,
  Multiple extends boolean | undefined = false,
> = SelectionRootProps<Value, Multiple>;
export type ComboboxRootProps<
  Value = ItemValue,
  Multiple extends boolean | undefined = false,
> = SelectionRootProps<Value, Multiple>;
export type AutocompleteRootProps<Value = ItemValue> = Omit<
  SelectionRootProps<Value>,
  'value' | 'defaultValue' | 'onValueChange' | 'multiple'
> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string, details: ChangeEventDetails) => void;
};
