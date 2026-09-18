import { dataValue } from '../utils';
import { createContext, createSignal, createUniqueId, useContext, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { omitProps, type ComponentProps } from '../utils';
type ItemEntry = {
  id: string;
  value: () => string;
  keywords: () => string[];
  disabled: () => boolean;
  element: HTMLElement;
  select: () => void;
};
type RootProps = Omit<ComponentProps<'div'>, 'onChange'> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  shouldFilter?: boolean;
  filter?: (value: string, search: string, keywords?: string[]) => number;
  loop?: boolean;
  label?: string;
};
const Context = createContext<ReturnType<typeof makeController> | null>(null);
function makeController(props: RootProps) {
  const [search, setSearch] = createSignal('');
  const [value, setValue] = createSignal(props.defaultValue ?? '');
  const [entries, setEntries] = createSignal<ItemEntry[]>([]);
  const current = () => props.value ?? value();
  const matches = (entry: ItemEntry) =>
    props.shouldFilter === false ||
    !search() ||
    (props.filter
      ? props.filter(entry.value(), search(), entry.keywords()) > 0
      : [entry.value(), ...entry.keywords()]
          .join(' ')
          .toLocaleLowerCase()
          .includes(search().toLocaleLowerCase()));
  const visible = () => entries().filter((entry) => matches(entry) && !entry.disabled());
  const change = (next: string) => {
    setValue(next);
    props.onValueChange?.(next);
  };
  let disposed = false;
  let selectionScheduled = false;
  onCleanup(() => {
    disposed = true;
  });
  const selectFirstItemAfterRegistration = () => {
    if (selectionScheduled) return;
    selectionScheduled = true;
    // Item text is complete after the commit. Coalesce registrations so the
    // first enabled item is chosen once, without replacing an existing value.
    queueMicrotask(() => {
      selectionScheduled = false;
      if (disposed || current()) return;
      const first = visible()[0];
      if (first) change(first.value());
    });
  };
  const move = (key: string) => {
    const items = visible();
    if (!items.length) return;
    let index = items.findIndex((entry) => entry.value() === current());
    if (key === 'Home') index = 0;
    else if (key === 'End') index = items.length - 1;
    else index += key === 'ArrowUp' ? -1 : 1;
    index = props.loop
      ? (index + items.length) % items.length
      : Math.max(0, Math.min(index, items.length - 1));
    const item = items[index];
    change(item.value());
    item.element.scrollIntoView?.({ block: 'nearest' });
  };
  return {
    search,
    setSearch,
    current,
    entries,
    visible,
    matches,
    shouldFilter: () => props.shouldFilter !== false,
    change,
    move,
    listId: createUniqueId(),
    register(entry: ItemEntry) {
      setEntries((previous) => [...previous, entry]);
      selectFirstItemAfterRegistration();
      onCleanup(() => setEntries((previous) => previous.filter((item) => item !== entry)));
    },
  };
}
function useCommand() {
  const context = useContext(Context);
  if (!context) throw new Error('Command parts must be inside Command.');
  return context;
}
function Root(props: RootProps) {
  const context = makeController(props);
  return (
    <Context value={context}>
      <div
        cmdk-root=""
        {...omitProps(props, [
          'value',
          'defaultValue',
          'onValueChange',
          'shouldFilter',
          'filter',
          'loop',
          'label',
        ])}
        aria-label={props.label}
        onKeyDown={(event) => {
          if (typeof props.onKeyDown === 'function') props.onKeyDown(event);
          if (event.defaultPrevented) return;
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            context.move(event.key);
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            context
              .visible()
              .find((entry) => entry.value() === context.current())
              ?.select();
          }
        }}
      />
    </Context>
  );
}
function Input(
  props: Omit<ComponentProps<'input'>, 'onChange'> & {
    onValueChange?: (value: string) => void;
  },
) {
  const context = useCommand();
  return (
    <input
      cmdk-input=""
      role="combobox"
      aria-expanded="true"
      aria-autocomplete="list"
      aria-controls={context.listId}
      aria-activedescendant={
        context.entries().find((item) => item.value() === context.current())?.id
      }
      {...omitProps(props, ['onValueChange'])}
      value={props.value ?? context.search()}
      onInput={(event) => {
        context.setSearch(event.currentTarget.value);
        props.onValueChange?.(event.currentTarget.value);
        if (typeof props.onInput === 'function') props.onInput(event);
        queueMicrotask(() => context.move('Home'));
      }}
    />
  );
}
function List(props: ComponentProps<'div'>) {
  const context = useCommand();
  return <div cmdk-list="" role="listbox" id={context.listId} {...props} />;
}
function Item(
  props: Omit<ComponentProps<'div'>, 'onSelect'> & {
    value?: string;
    keywords?: string[];
    disabled?: boolean;
    forceMount?: boolean;
    onSelect?: (value: string) => void;
  },
) {
  const context = useCommand();
  const id = createUniqueId();
  let element!: HTMLDivElement;
  const entry: ItemEntry = {
    id,
    value: () => props.value ?? element?.textContent?.trim() ?? '',
    keywords: () => props.keywords ?? [],
    disabled: () => !!props.disabled,
    get element() {
      return element;
    },
    select: () => {
      if (!props.disabled) {
        context.change(entry.value());
        props.onSelect?.(entry.value());
      }
    },
  };
  return (
    <div
      cmdk-item=""
      role="option"
      id={id}
      {...omitProps(props, ['value', 'keywords', 'disabled', 'forceMount', 'onSelect'])}
      ref={(node) => {
        element = node;
        context.register(entry);
      }}
      hidden={!props.forceMount && !context.matches(entry)}
      aria-disabled={props.disabled ? 'true' : 'false'}
      aria-selected={context.current() === entry.value() ? 'true' : 'false'}
      data-disabled={dataValue(!!props.disabled)}
      data-selected={dataValue(context.current() === entry.value())}
      onPointerMove={() => {
        if (!props.disabled) context.change(entry.value());
      }}
      onClick={() => entry.select()}
    />
  );
}
function Empty(props: ComponentProps<'div'>) {
  const context = useCommand();
  return <div cmdk-empty="" role="status" {...props} hidden={context.visible().length > 0} />;
}
function Group(
  props: ComponentProps<'div'> & {
    heading?: JSX.Element;
    forceMount?: boolean;
  },
) {
  const context = useCommand();
  let element: HTMLDivElement | undefined;
  const filteredOut = () =>
    !props.forceMount &&
    context.shouldFilter() &&
    !!context.search() &&
    !context.entries().some((entry) =>
      element?.contains(entry.element) && context.matches(entry),
    );
  return (
    <div
      cmdk-group=""
      role="group"
      {...omitProps(props, ['heading', 'forceMount', 'children'])}
      ref={element}
      hidden={filteredOut()}
    >
      <div cmdk-group-heading="">{props.heading}</div>
      {props.children}
    </div>
  );
}
function Separator(
  props: ComponentProps<'div'> & {
    alwaysRender?: boolean;
  },
) {
  const context = useCommand();
  return (
    <div
      cmdk-separator=""
      role="separator"
      {...omitProps(props, ['alwaysRender'])}
      hidden={!props.alwaysRender && !!context.search()}
    />
  );
}
export const Command = Object.assign(Root, { Input, List, Item, Empty, Group, Separator });
