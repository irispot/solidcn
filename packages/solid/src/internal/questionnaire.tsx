import { dataValue } from '../utils';
import { createContext, createEffect, createMemo, createSignal, createUniqueId, useContext, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useRender } from '@solid-cn/base-ui/use-render';
import { mergeRenderProps, omitProps, type ComponentProps } from '../utils';
type Definition = {
  name: string;
  disabled?: boolean;
  required?: boolean;
  choices?: readonly {
    value: string;
    disabled?: boolean;
  }[];
};
type RootProps = ComponentProps<'form'> & {
  items?: readonly Definition[];
  item?: string;
  defaultItem?: string;
  onItemChange?: (name: string) => void;
  shortcuts?: 'letters' | 'numbers';
  noValidate?: boolean;
};
type ItemProps = ComponentProps<'fieldset'> & {
  name: string;
  multiple?: boolean;
  invalid?: boolean;
  required?: boolean;
  onStatusChange?: (status: 'unanswered' | 'answered' | 'skipped') => void;
};
type Entry = {
  props: ItemProps;
  node: HTMLFieldSetElement;
  choices: () => ChoiceRegistration[];
  registerChoice: (choice: ChoiceRegistration) => () => void;
  answers: () => AnswerRegistration[];
  registerAnswer: (answer: AnswerRegistration) => () => void;
  selected: () => string[];
  select: (id: string, value: boolean) => void;
  skip: () => void;
  reset: () => void;
  descriptions: () => string[];
  errors: () => string[];
  registerDescription: (id: string) => () => void;
  registerError: (id: string) => () => void;
  invalid: () => boolean;
  setInvalid: (value: boolean) => void;
  status: () => string;
};
type ChoiceRegistration = {
  node: HTMLLabelElement;
  value: string;
  disabled: boolean;
};
type AnswerRegistration = {
  id: string;
  node: HTMLInputElement;
  type: 'choice' | 'input';
  disabled: () => boolean;
  defaultSelected: () => boolean;
  resetValue?: () => void;
};
const RootContext = createContext<ReturnType<typeof controller> | null>(null);
const ItemContext = createContext<Entry | null>(null);
const ChoiceContext = createContext<{
  props: ChoiceProps;
  checked: () => boolean;
  item: Entry;
  id: string;
  shortcut: () => string;
} | null>(null);
function controller(props: RootProps) {
  const [item, setItem] = createSignal(props.defaultItem),
    [entries, setEntries] = createSignal<Entry[]>([], { ownedWrite: true });
  const orderedEntries = () => [...entries()].sort((left, right) =>
    left.node.compareDocumentPosition(right.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
  const list = () =>
    props.items?.filter((entry) => !entry.disabled) ??
    orderedEntries()
      .filter((entry) => !entry.props.disabled)
      .map((entry) => ({ name: entry.props.name }));
  const name = () => {
    if (props.item !== undefined) return props.item;
    const requested = item();
    return requested && list().some((entry) => entry.name === requested)
      ? requested
      : list()[0]?.name;
  };
  const index = () =>
    Math.max(
      0,
      list().findIndex((entry) => entry.name === name()),
    );
  const required = () => {
    if (!list().some((entry) => entry.name === name())) return null;
    const definition = props.items?.find((entry) => entry.name === name());
    return definition
      ? Boolean(definition.required)
      : (entries().find((entry) => entry.props.name === name())?.props.required ?? false);
  };
  const status = () => entries().find((entry) => entry.props.name === name())?.status()
    ?? (name() ? 'unanswered' : undefined);
  // The server selects the first enabled definition without side effects.
  // After mount, keep that fallback as the uncontrolled value when definitions change.
  let mounted = false;
  createEffect(
    () => ({ next: name(), requested: item(), controlled: props.item, onItemChange: props.onItemChange }),
    ({ next, requested, controlled, onItemChange }) => {
      if (!next) return;
      if (controlled !== undefined || next === requested) {
        mounted = true;
        return;
      }
      setItem(next);
      if (mounted && next) onItemChange?.(next);
      mounted = true;
    },
    { ssrSource: 'client' },
  );
  let previousControlledItem = props.item;
  createEffect(
    () => props.item,
    (controlledItem) => {
      if (controlledItem && previousControlledItem !== undefined && controlledItem !== previousControlledItem)
        queueMicrotask(() => entries().find((entry) => entry.props.name === controlledItem)?.node.focus());
      previousControlledItem = controlledItem;
    },
    { ssrSource: 'client' },
  );
  let activeWarnings = new Set<string>();
  let warningRevision = 0;
  onCleanup(() => { warningRevision += 1; });
  createEffect(() => ({
      definitions: props.items,
      defaultItem: props.defaultItem,
      shortcuts: props.shortcuts,
      registrations: entries().map((entry) => ({
        name: entry.props.name,
        disabled: Boolean(entry.props.disabled),
        required: Boolean(entry.props.required),
        choices: entry.choices().map((choice) => ({
          value: choice.value,
          disabled: choice.disabled,
          node: choice.node,
        })).sort((left, right) => left.node.compareDocumentPosition(right.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1),
      })),
    }), ({ definitions, defaultItem, shortcuts, registrations }) => {
      const revision = ++warningRevision;
      queueMicrotask(() => {
        if (revision !== warningRevision) return;
        const warnings = definitions
          ? questionnaireWarnings(definitions, registrations, defaultItem, shortcuts)
          : [];
        const nextWarnings = new Set(warnings);
        for (const warning of nextWarnings) {
          if (!activeWarnings.has(warning)) console.warn(`[Questionnaire] ${warning}`);
        }
        activeWarnings = nextWarnings;
      });
    }, { ssrSource: 'client' });
  const change = (value: string) => {
    if (value === name()) return;
    setItem(value);
    props.onItemChange?.(value);
    queueMicrotask(() => entries().find((entry) => entry.props.name === value)?.node.focus());
  };
  const validateEntry = (current: Entry) => {
    const selected = current.answers().filter((answer) =>
      !answer.disabled() && current.selected().includes(answer.id));
    const valid = !current.props.invalid && (current.status() === 'skipped' || selected.length > 0)
      && (props.noValidate !== false || selected.every((answer) => answer.node.checkValidity()));
    current.setInvalid(true);
    if (!valid) {
      const filledInput = current.answers().find((answer) =>
        answer.type === 'input' && !answer.disabled() && current.selected().includes(answer.id) &&
        answer.node.value.trim());
      const first = filledInput ?? current.answers().find((answer) => !answer.disabled());
      (first?.node ?? current.node).focus();
    }
    return valid;
  };
  const validate = () => {
    const current = entries().find((entry) => entry.props.name === name());
    return current ? validateEntry(current) : true;
  };
  return {
    props,
    entries,
    list,
    name,
    index,
    required,
    status,
    change,
    validate,
    validateEntry,
    activeEntry: () => entries().find((entry) => entry.props.name === name()),
    orderedAnswers: (entry: Entry) => [...entry.answers()].filter((answer) => !answer.disabled())
      .sort((left, right) => left.node.compareDocumentPosition(right.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1),
    register(entry: Entry) {
      let active = true;
      queueMicrotask(() => {
        if (active) setEntries((previous) => previous.includes(entry) ? previous : [...previous, entry]);
      });
      return () => {
        active = false;
        setEntries((previous) => previous.filter((value) => value !== entry));
      };
    },
    move(delta: number, skip = false) {
      if (delta > 0 && !skip && !validate()) return;
      if (skip) {
        const current = entries().find((entry) => entry.props.name === name());
        current?.skip();
      }
      const next = list()[index() + delta];
      if (next) change(next.name);
      else if (skip && delta > 0) queueMicrotask(() =>
        entries().find((entry) => entry.props.name === name())?.node.closest('form')?.requestSubmit());
    },
  };
}
function questionnaireWarnings(
  definitions: readonly Definition[],
  registrations: readonly {
    name: string;
    disabled: boolean;
    required: boolean;
    choices: readonly (ChoiceRegistration & { node: HTMLLabelElement })[];
  }[],
  defaultItem: string | undefined,
  shortcuts: RootProps['shortcuts'],
) {
  const warnings: string[] = [];
  const names = new Set<string>();
  const byName = new Map(definitions.map((definition) => [definition.name, definition]));
  const registeredByName = new Map(registrations.map((registration) => [registration.name, registration]));
  for (const definition of definitions) {
    if (names.has(definition.name))
      warnings.push(`Item name "${definition.name}" is defined more than once.`);
    names.add(definition.name);
    const values = new Set<string>();
    for (const choice of definition.choices ?? []) {
      if (values.has(choice.value))
        warnings.push(`Choice value "${choice.value}" is defined more than once in item "${definition.name}".`);
      values.add(choice.value);
    }
  }
  if (defaultItem && (!byName.has(defaultItem) || byName.get(defaultItem)?.disabled))
    warnings.push(`defaultItem "${defaultItem}" does not identify an enabled item. The first enabled item will be used instead.`);
  for (const definition of definitions) {
    const registration = registeredByName.get(definition.name);
    if (!registration) {
      if (!definition.disabled)
        warnings.push(`Item "${definition.name}" is defined but has no rendered Questionnaire.Item.`);
      continue;
    }
    if (registration.disabled !== Boolean(definition.disabled))
      warnings.push(`Item "${definition.name}" has different disabled values in Root.items and Questionnaire.Item.`);
    if (registration.required !== Boolean(definition.required))
      warnings.push(`Item "${definition.name}" has different required values in Root.items and Questionnaire.Item.`);
    const definedChoices = definition.choices ?? [];
    const definedByValue = new Map(definedChoices.map((choice) => [choice.value, choice]));
    const registeredByValue = new Map(registration.choices.map((choice) => [choice.value, choice]));
    for (const choice of definedChoices) {
      const rendered = registeredByValue.get(choice.value);
      if (!rendered) {
        warnings.push(`Choice "${choice.value}" is defined for item "${definition.name}" but has no rendered Questionnaire.Choice.`);
        continue;
      }
      if (rendered.disabled !== Boolean(choice.disabled))
        warnings.push(`Choice "${choice.value}" in item "${definition.name}" has different disabled values in Root.items and Questionnaire.Choice.`);
    }
    if (shortcuts) {
      for (const choice of registration.choices)
        if (!definedByValue.has(choice.value))
          warnings.push(`Rendered choice "${choice.value}" in item "${definition.name}" is missing from Root.items and will not receive a shortcut.`);
      const definedOrder = definedChoices.filter((choice) => !choice.disabled).map((choice) => choice.value);
      const renderedOrder = registration.choices.filter((choice) => !choice.disabled).map((choice) => choice.value);
      const sameChoices = definedOrder.length > 0 && definedOrder.length === renderedOrder.length
        && definedOrder.every((value) => renderedOrder.includes(value));
      if (sameChoices && definedOrder.some((value, index) => value !== renderedOrder[index]))
        warnings.push(`Choice order for item "${definition.name}" differs between Root.items and the rendered Questionnaire.Choice elements.`);
    }
  }
  for (const registration of registrations)
    if (!registration.disabled && !byName.has(registration.name))
      warnings.push(`Rendered item "${registration.name}" is missing from Root.items and is excluded from the questionnaire collection.`);
  return warnings;
}
function useRoot() {
  const context = useContext(RootContext);
  if (!context) throw new Error('Questionnaire parts require Questionnaire.');
  return context;
}
function useItem() {
  const context = useContext(ItemContext);
  if (!context) throw new Error('Questionnaire item parts require QuestionnaireItem.');
  return context;
}
function useChoice() {
  const context = useContext(ChoiceContext);
  if (!context) throw new Error('Questionnaire choice parts require QuestionnaireChoice.');
  return context;
}
function Root(props: RootProps) {
  const context = controller(props);
  return (
    <RootContext value={context}>
      <form
        {...omitProps(props, ['items', 'item', 'defaultItem', 'onItemChange', 'shortcuts', 'noValidate'])}
        data-current={context.list().length ? context.index() + 1 : undefined}
        data-total={context.list().length}
        data-first={context.list().length && context.index() === 0 ? '' : undefined}
        data-last={context.list().length && context.index() === context.list().length - 1 ? '' : undefined}
        data-shortcuts={props.shortcuts}
        novalidate={props.noValidate ?? true}
        onSubmit={(event) => {
          const ordered = context.list().flatMap((definition) =>
            context.entries().filter((entry) => entry.props.name === definition.name));
          for (const entry of ordered) {
            if (!context.validateEntry(entry)) {
              event.preventDefault();
              if (entry.props.name !== context.name()) context.change(entry.props.name);
              return;
            }
          }
          if (typeof props.onSubmit === 'function') props.onSubmit(event);
        }}
        onReset={(event) => {
          if (typeof props.onReset === 'function') props.onReset(event);
          if (event.defaultPrevented) return;
          for (const entry of context.entries()) entry.reset();
          const initial = props.defaultItem && context.list().some((definition) => definition.name === props.defaultItem)
            ? props.defaultItem : context.list()[0]?.name;
          if (initial && initial !== context.name()) context.change(initial);
        }}
        onKeyDown={(event) => {
          if (typeof props.onKeyDown === 'function') props.onKeyDown(event as any);
          const current = context.activeEntry();
          const target = event.target;
          if (event.defaultPrevented || event.isComposing || event.keyCode === 229 ||
              !current || !(target instanceof Element)) return;
          const textEntry = target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement ||
            target instanceof HTMLInputElement && !['button', 'checkbox', 'radio', 'reset', 'submit'].includes(target.type) ||
            target instanceof HTMLElement && target.isContentEditable;
          const radio = target instanceof HTMLInputElement && target.type === 'radio';
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
            event.preventDefault();
            if (!event.repeat) {
              if (context.index() === context.list().length - 1) current.node.closest('form')?.requestSubmit();
              else context.move(1);
            }
            return;
          }
          if (event.metaKey || event.ctrlKey || event.altKey) return;
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            const answers = context.orderedAnswers(current);
            const position = answers.findIndex((answer) => answer.node === target);
            const activeAnswer = answers[position];
            const emptyNavigableInput = activeAnswer?.type === 'input' &&
              ['email', 'password', 'search', 'tel', 'text', 'url'].includes(activeAnswer.node.type) &&
              !activeAnswer.node.value.trim();
            if (answers.length && (!textEntry || emptyNavigableInput) &&
                (position >= 0 || target === current.node)) {
              const next = position < 0
                ? answers.find((answer) => current.selected().includes(answer.id)) ??
                  answers[event.key === 'ArrowDown' ? 0 : answers.length - 1]
                : answers[(position + (event.key === 'ArrowDown' ? 1 : -1) + answers.length) % answers.length];
              if (next && next.node !== target &&
                  !(radio && next.node.type === 'radio')) {
                event.preventDefault();
                next.node.focus();
                if (next.type === 'choice' && next.node.type === 'radio') next.node.click();
                return;
              }
            }
          }
          if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !textEntry && !radio) {
            event.preventDefault();
            if (!event.repeat) {
              if (event.key === 'ArrowLeft') context.move(-1);
              else if (current.status() !== 'unanswered') context.move(1);
            }
            return;
          }
          if (event.key === 'Enter') {
            const answer = context.orderedAnswers(current).find((value) => value.node === target);
            if (!answer) return;
            event.preventDefault();
            if (!event.repeat && current.selected().includes(answer.id)) {
              if (context.index() === context.list().length - 1) current.node.closest('form')?.requestSubmit();
              else context.move(1);
            }
            return;
          }
          if (props.shortcuts && !textEntry) {
            const shortcut = props.shortcuts === 'letters' ? event.key.toUpperCase() : event.key;
            const choice = [...current.node.querySelectorAll<HTMLLabelElement>('[data-shortcut]')]
              .find((element) => element.dataset.shortcut === shortcut);
            const input = choice?.querySelector<HTMLInputElement>('input:not([disabled])');
            if (input) {
              event.preventDefault();
              if (!event.repeat) {
                input.focus();
                input.click();
              }
            }
          }
        }}
      />
    </RootContext>
  );
}
function Item(props: ItemProps) {
  const root = useRoot();
  const [validationAttempted, setValidationAttempted] = createSignal(false),
    [choices, setChoices] = createSignal<ChoiceRegistration[]>([], { ownedWrite: true }),
    [answers, setAnswers] = createSignal<AnswerRegistration[]>([], { ownedWrite: true }),
    [selected, setSelected] = createSignal<string[]>([]),
    [skipped, setSkipped] = createSignal(false),
    [descriptions, setDescriptions] = createSignal<string[]>([]),
    [errors, setErrors] = createSignal<string[]>([]);
  let wasMultiple = Boolean(props.multiple);
  createEffect(
    () => Boolean(props.multiple),
    (multiple) => {
      if (wasMultiple && !multiple) {
        const first = [...answers()].sort((left, right) =>
          left.node.compareDocumentPosition(right.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)
          .find((answer) => selected().includes(answer.id));
        setSelected(first ? [first.id] : []);
      }
      wasMultiple = multiple;
    },
    { ssrSource: 'client' },
  );
  let element!: HTMLFieldSetElement;
  let unregister = () => {};
  onCleanup(() => unregister());
  const status = () => skipped() ? 'skipped' : answers().some((answer) =>
    !answer.disabled() && selected().includes(answer.id)) ? 'answered' : 'unanswered';
  const invalid = () => status() !== 'skipped' &&
    (Boolean(props.invalid) || validationAttempted() && status() !== 'answered');
  const setInvalid = (value: boolean) => setValidationAttempted(value);
  const entry: Entry = {
    props,
    get node() {
      return element;
    },
    choices,
    registerChoice(choice) {
      let active = true;
      queueMicrotask(() => {
        if (active) setChoices((previous) => previous.some((value) => value.node === choice.node)
          ? previous : [...previous, choice]);
      });
      return () => {
        active = false;
        setChoices((previous) => previous.filter((value) => value !== choice));
      };
    },
    answers,
    registerAnswer(answer) {
      setAnswers((previous) => previous.some((value) => value.node === answer.node)
        ? previous : [...previous, answer]);
      return () => setAnswers((previous) => previous.filter((value) => value !== answer));
    },
    selected,
    select(id, value) {
      setSkipped(false);
      setSelected((previous) => value
        ? props.multiple
          ? previous.includes(id) ? previous : [...previous, id]
          : [id]
        : previous.filter((candidate) => candidate !== id));
    },
    skip() {
      setSelected([]);
      setSkipped(true);
      for (const answer of answers())
        if (answer.type === 'choice') answer.node.checked = false;
    },
    reset() {
      for (const answer of answers()) answer.resetValue?.();
      setSelected(answers().filter((answer) => answer.defaultSelected()).map((answer) => answer.id));
      setSkipped(false);
      setValidationAttempted(false);
    },
    descriptions,
    errors,
    registerDescription(id) {
      setDescriptions((previous) => previous.includes(id) ? previous : [...previous, id]);
      return () => queueMicrotask(() =>
        setDescriptions((previous) => previous.filter((value) => value !== id)));
    },
    registerError(id) {
      setErrors((previous) => previous.includes(id) ? previous : [...previous, id]);
      return () => queueMicrotask(() =>
        setErrors((previous) => previous.filter((value) => value !== id)));
    },
    invalid,
    setInvalid,
    status,
  };
  let previousStatus = status();
  createEffect(
    () => ({ status: status(), onStatusChange: props.onStatusChange }),
    ({ status: currentStatus, onStatusChange }) => {
      if (currentStatus !== previousStatus) onStatusChange?.(currentStatus as 'unanswered' | 'answered' | 'skipped');
      previousStatus = currentStatus;
    },
    { ssrSource: 'client' },
  );
  const keyShortcuts = () => [
    props['aria-keyshortcuts'],
    root.name() === props.name ? 'Meta+Enter Control+Enter' : undefined,
    root.name() === props.name && choices().length ? 'ArrowUp ArrowDown' : undefined,
    root.name() === props.name && root.index() > 0 ? 'ArrowLeft' : undefined,
    root.name() === props.name && root.index() < root.list().length - 1 && status() !== 'unanswered'
      ? 'ArrowRight' : undefined,
  ].filter(Boolean).join(' ') || undefined;
  const describedBy = () => [
    ...descriptions(),
    ...(invalid() ? errors() : []),
    props['aria-describedby'],
  ].filter(Boolean).join(' ') || undefined;
  return (
    <ItemContext value={entry}>
      <fieldset
        {...omitProps(props, ['multiple', 'invalid', 'required', 'onStatusChange', 'ref', 'name', 'aria-describedby', 'aria-keyshortcuts'])}
        ref={(node) => {
          element = node;
          props.ref?.(node);
          unregister = root.register(entry);
        }}
        hidden={root.name() !== props.name}
        inert={root.name() !== props.name}
        tabindex={-1}
        aria-describedby={describedBy()}
        aria-keyshortcuts={keyShortcuts()}
        data-active={dataValue(root.name() === props.name ? '' : undefined)}
        data-status={dataValue(status())}
        data-multiple={props.multiple ? '' : undefined}
        data-invalid={dataValue(invalid() ? '' : undefined)}
        aria-invalid={invalid() ? 'true' : undefined}
      />
    </ItemContext>
  );
}
function Progress(props: ComponentProps<'div'>) {
  const root = useRoot();
  const label = () =>
    root.list().length ? `Question ${root.index() + 1} of ${root.list().length}` : undefined;
  return useRender({
    defaultTagName: 'div',
    get render() {
      return props.render;
    },
    props: mergeRenderProps(
      {
        role: 'progressbar',
        'aria-label': 'Questionnaire progress',
        'aria-live': 'polite',
        get 'aria-valuemin'() {
          return root.list().length ? 1 : undefined;
        },
        get 'aria-valuemax'() {
          return root.list().length || undefined;
        },
        get 'aria-valuenow'() {
          return root.list().length ? root.index() + 1 : undefined;
        },
        get 'aria-valuetext'() {
          return label();
        },
        get 'data-first'() { return root.list().length && root.index() === 0 ? '' : undefined; },
        get 'data-last'() { return root.list().length && root.index() === root.list().length - 1 ? '' : undefined; },
      },
      omitProps(props, ['render', 'children']),
      {
        get children() {
          return props.children ?? label();
        },
      },
    ),
    state: {
      get current() {
        return root.list().length ? root.index() + 1 : 0;
      },
      get first() {
        return root.index() === 0;
      },
      get last() {
        return root.index() === root.list().length - 1;
      },
      get total() {
        return root.list().length;
      },
    },
  });
}
function Title(props: ComponentProps<'legend'>) {
  useItem();
  return useRender({
    defaultTagName: 'legend',
    get render() { return props.render; },
    props: omitProps(props, ['render']),
  });
}
function Description(props: ComponentProps<'p'>) {
  const item = useItem();
  const generatedId = createUniqueId();
  const id = () => props.id ?? generatedId;
  let unregister = () => {};
  onCleanup(() => unregister());
  return useRender({
    defaultTagName: 'p',
    get render() { return props.render; },
    props: mergeRenderProps(omitProps(props, ['render', 'id', 'ref']), {
      get id() { return id(); },
      ref(node: HTMLElement) {
        props.ref?.(node);
        unregister = item.registerDescription(id());
      },
    }),
  });
}
function Choices(props: ComponentProps<'div'>) {
  const root = useRoot();
  useItem();
  return useRender({
    defaultTagName: 'div',
    get render() { return props.render; },
    props: mergeRenderProps(omitProps(props, ['render']), {
      get 'data-shortcuts'() { return root.props.shortcuts; },
    }),
  });
}
type ChoiceProps = Omit<ComponentProps<'label'>, 'onChange'> & {
  value: string;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onChange?: JSX.ChangeEventHandler<HTMLInputElement, Event>;
};
function Choice(props: ChoiceProps) {
  const item = useItem(),
    root = useRoot();
  let unregister = () => {};
  let element: HTMLLabelElement | undefined;
  onCleanup(() => unregister());
  const id = createUniqueId();
  const ownChecked = () => item.selected().includes(id);
  const checked = () => item.status() === 'skipped' ? false : props.checked ?? ownChecked();
  let initialized = false;
  let previousControlledChecked: boolean | undefined;
  createEffect(
    () => ({ checked: props.checked, defaultChecked: props.defaultChecked }),
    ({ checked, defaultChecked }) => {
      if (checked !== undefined && (!initialized || checked !== previousControlledChecked))
        item.select(id, checked);
      else if (!initialized && defaultChecked) item.select(id, true);
      previousControlledChecked = checked;
      initialized = true;
    },
    { ssrSource: 'client' },
  );
  const shortcut = () => {
    if (!root.props.shortcuts || props.disabled || item.props.disabled) return '';
    const definition = root.props.items?.find((entry) => entry.name === item.props.name);
    if (!definition && !item.answers().some((answer) => answer.id === id)) return '';
    const choices = definition
      ? definition.choices?.filter((entry) => !entry.disabled).map((entry) => entry.value) ?? []
      : [...item.choices()]
          .filter((choice) => !choice.disabled)
          .sort((left, right) => left.node.compareDocumentPosition(right.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)
          .map((choice) => choice.value);
    const index = choices.indexOf(props.value);
    return index < 0 ? '' : root.props.shortcuts === 'letters' && index < 26
      ? String.fromCharCode(65 + index)
      : root.props.shortcuts === 'numbers' && index < 9
        ? String(index + 1)
        : '';
  };
  return (
    <ChoiceContext value={{ props, checked, item, id, shortcut }}>
      <label
        {...omitProps(props, ['value', 'checked', 'defaultChecked', 'disabled', 'onChange', 'ref'])}
        ref={(node) => {
          element = node;
          props.ref?.(node);
          unregister = item.registerChoice({ node, value: props.value, disabled: Boolean(props.disabled) });
        }}
        for={id}
        data-type={dataValue(item.props.multiple ? 'checkbox' : 'radio')}
        data-disabled={dataValue(props.disabled || item.props.disabled ? '' : undefined)}
        data-checked={dataValue(checked() ? '' : undefined)}
        data-unchecked={dataValue(checked() ? undefined : '')}
        data-shortcut={shortcut() || null}
      />
    </ChoiceContext>
  );
}
function ChoiceInput(props: ComponentProps<'input'>) {
  const context = useChoice();
  const hasInputAnswer = createMemo(() => context.item.answers().some((answer) => answer.type === 'input'));
  let unregister = () => {};
  onCleanup(() => unregister());
  return (
    <input
      {...omitProps(props, ['ref'])}
      ref={(node) => {
        props.ref?.(node);
        node.defaultChecked = untrack(() => Boolean(context.props.checked ?? context.props.defaultChecked));
        unregister = context.item.registerAnswer({
          id: context.id,
          node,
          type: 'choice',
          disabled: () => Boolean(context.props.disabled || context.item.props.disabled),
          defaultSelected: () => Boolean(context.props.checked ?? context.props.defaultChecked),
          resetValue: () => {
            node.defaultChecked = Boolean(context.props.checked ?? context.props.defaultChecked);
            queueMicrotask(() => { node.checked = context.checked(); });
          },
        });
      }}
      id={context.id}
      name={context.item.status() === 'skipped' ? undefined : context.item.props.name}
      value={context.props.value}
      type={context.item.props.multiple ? 'checkbox' : 'radio'}
      checked={context.checked()}
      disabled={context.props.disabled || context.item.props.disabled}
      required={context.item.props.required && !context.item.props.multiple &&
        !hasInputAnswer()}
      aria-invalid={context.item.invalid() ? 'true' : undefined}
      aria-keyshortcuts={context.shortcut()
        ? `${context.shortcut()}${context.checked() ? ' Enter' : ''}`
        : context.checked() ? 'Enter' : undefined}
      onChange={(event) => {
        context.props.onChange?.(event);
        if (event.defaultPrevented) return;
        if (context.props.checked === undefined)
          context.item.select(context.id, event.currentTarget.checked);
        else if (context.item.status() === 'skipped' && context.props.checked === event.currentTarget.checked)
          context.item.select(context.id, context.props.checked);
      }}
    />
  );
}
function ChoiceLabel(props: ComponentProps<'span'>) {
  useChoice();
  return <span {...props} />;
}
function ChoiceShortcut(props: ComponentProps<'span'>) {
  const context = useChoice();
  return (
    <span aria-hidden="true" {...omitProps(props, [])} hidden={!context.shortcut()}
      data-shortcut={context.shortcut() || null}>
      {props.children ?? context.shortcut()}
    </span>
  );
}
function Input(props: ComponentProps<'input'>) {
  const item = useItem();
  const id = createUniqueId();
  const [uncontrolledValue, setUncontrolledValue] = createSignal(String(props.defaultValue ?? ''));
  const filled = () => String(props.value ?? uncontrolledValue()).trim().length > 0;
  let unregister = () => {};
  let input: HTMLInputElement | undefined;
  onCleanup(() => unregister());
  let initialized = false;
  createEffect(
    () => ({ value: props.value, defaultValue: props.defaultValue }),
    ({ value, defaultValue }) => {
      if (value !== undefined) item.select(id, String(value).trim().length > 0);
      else if (!initialized && String(defaultValue ?? '').trim()) item.select(id, true);
      initialized = true;
    },
    { ssrSource: 'client' },
  );
  return useRender({
    defaultTagName: 'input',
    get render() { return props.render; },
    props: mergeRenderProps(
      omitProps(props, ['render', 'ref', 'onInput', 'onChange', 'name', 'form', 'id', 'required', 'disabled', 'value', 'defaultValue', 'type']),
      {
        get id() { return id; },
        get name() { return item.selected().includes(id) && item.status() !== 'skipped' ? item.props.name : undefined; },
        get form() { return item.selected().includes(id) ? undefined : ''; },
        get required() { return item.props.required && item.answers().filter((answer) => !answer.disabled()).length === 1; },
        get disabled() { return item.props.disabled || props.disabled; },
        get 'aria-invalid'() { return item.invalid() ? 'true' : undefined; },
        get 'aria-keyshortcuts'() { return filled() && item.selected().includes(id) ? 'Enter' : undefined; },
        get type() { return props.type ?? 'text'; },
        get value() { return props.value ?? uncontrolledValue(); },
        get defaultValue() { return props.value === undefined ? props.defaultValue : undefined; },
        ref(node: HTMLInputElement) {
          input = node;
          props.ref?.(node);
          unregister = item.registerAnswer({
            id,
            node,
            type: 'input',
            disabled: () => Boolean(item.props.disabled || props.disabled),
            defaultSelected: () => String(props.value ?? props.defaultValue ?? '').trim().length > 0,
            resetValue: () => {
              const controlled = props.value !== undefined;
              const initial = String(controlled ? props.value : props.defaultValue ?? '');
              if (!controlled) setUncontrolledValue(initial);
              node.defaultValue = initial;
              queueMicrotask(() => { node.value = initial; });
            },
          });
        },
        onInput(event: InputEvent & { currentTarget: HTMLInputElement }) {
          const editedValue = event.currentTarget.value;
          if (typeof props.onInput === 'function') props.onInput(event as any);
          if (typeof props.onChange === 'function') props.onChange(event as any);
          if (event.defaultPrevented) return;
          if (props.value === undefined) {
            setUncontrolledValue(editedValue);
            item.select(id, editedValue.trim().length > 0);
          } else {
            queueMicrotask(() => {
              if (!input) return;
              input.value = String(props.value ?? '');
              item.select(id, String(props.value ?? '').trim().length > 0);
            });
          }
        },
      },
    ),
    state: {
      get disabled() { return Boolean(item.props.disabled || props.disabled); },
      get filled() { return filled(); },
      get invalid() { return item.invalid() || Boolean(item.props.invalid); },
    },
    stateAttributesMapping: { filled: (filled) => filled
      ? { 'data-filled': '' } as Record<string, string>
      : { 'data-empty': '' } as Record<string, string> },
  });
}
function ErrorMessage(props: ComponentProps<'p'>) {
  const item = useItem();
  const generatedId = createUniqueId();
  const id = () => props.id ?? generatedId;
  let unregister = () => {};
  onCleanup(() => unregister());
  return useRender({
    defaultTagName: 'p',
    get render() { return props.render; },
    props: mergeRenderProps(omitProps(props, ['render', 'id', 'ref', 'children', 'hidden', 'role']), {
      get id() { return id(); },
      get hidden() { return !item.invalid(); },
      get role() { return item.invalid() ? 'alert' : undefined; },
      get children() {
        return props.children ?? (item.props.required
          ? 'Choose an answer to continue.'
          : 'Choose an answer or skip this question.');
      },
      ref(node: HTMLElement) {
        props.ref?.(node);
        unregister = item.registerError(id());
      },
    }),
    state: { get invalid() { return item.invalid(); } },
  });
}
type NavigationProps = ComponentProps<'button'> & { tabIndex?: number };
function navigation(
  props: NavigationProps,
  visible: () => boolean,
  text: string,
  type: 'button' | 'submit',
  action?: () => void,
  shortcut = false,
) {
  const root = useRoot();
  const activeShortcut = () => shortcut && visible() && !props.disabled ? 'Enter' : undefined;
  if (!untrack(() => props.render)) return (
    <button
      {...omitProps(props, ['render', 'onClick', 'children', 'type', 'disabled', 'tabIndex', 'tabindex'])}
      type={props.type ?? type}
      disabled={props.disabled ?? false}
      hidden={!visible()}
      inert={!visible()}
      aria-hidden={!visible() ? 'true' : undefined}
      aria-keyshortcuts={activeShortcut()}
      tabindex={visible() ? props.tabIndex : -1}
      data-disabled={props.disabled ? '' : undefined}
      data-status={root.status()}
      data-shortcut={activeShortcut()}
      data-visible={visible() ? '' : undefined}
      data-hidden={visible() ? undefined : ''}
      onClick={(event) => {
        if (typeof props.onClick === 'function') props.onClick(event as any);
        if (!event.defaultPrevented) action?.();
      }}
    >{props.children ?? text}</button>
  );
  return useRender({
    defaultTagName: 'button',
    get render() { return props.render; },
    props: mergeRenderProps(
      omitProps(props, ['render', 'onClick', 'children', 'type', 'disabled', 'tabIndex']),
      {
        get children() { return props.children ?? text; },
        get type() { return props.type ?? type; },
        get disabled() { return props.disabled ?? false; },
        get hidden() { return !visible(); },
        get inert() { return !visible(); },
        get 'aria-hidden'() { return !visible() || undefined; },
        get 'aria-keyshortcuts'() { return activeShortcut(); },
        get 'data-visible'() { return visible() ? '' : undefined; },
        get 'data-hidden'() { return visible() ? undefined : ''; },
        get 'data-status'() { return root.status(); },
        get 'data-shortcut'() { return activeShortcut(); },
        get tabIndex() { return visible() ? props.tabIndex : -1; },
        onClick(event: MouseEvent) {
          if (typeof props.onClick === 'function') props.onClick(event as any);
          if (!event.defaultPrevented) action?.();
        },
      },
    ),
    state: {
      get disabled() { return Boolean(props.disabled); },
      get shortcut() { return activeShortcut(); },
      get status() { return root.status(); },
      get visible() { return visible(); },
    },
    stateAttributesMapping: {
      visible: (value) => value
        ? { 'data-visible': '' } as Record<string, string>
        : { 'data-hidden': '' } as Record<string, string>,
    },
  });
}
function Previous(props: NavigationProps) {
  const root = useRoot();
  return navigation(props, () => root.list().length > 1 && root.index() > 0, 'Previous', 'button', () => root.move(-1));
}
function Next(props: NavigationProps) {
  const root = useRoot();
  return navigation(props, () => root.list().length > 1 && root.index() < root.list().length - 1, 'Next', 'button', () => root.move(1), true);
}
function Skip(props: NavigationProps) {
  const root = useRoot();
  return navigation(props, () => root.required() === false, 'Skip', 'button', () => root.move(1, true));
}
function Submit(props: NavigationProps) {
  const root = useRoot();
  return navigation(props, () => root.list().length > 0 && root.index() === root.list().length - 1, 'Submit', 'submit', undefined, true);
}
export const Questionnaire = {
  Root,
  Item,
  Progress,
  Title,
  Description,
  Choices,
  Choice,
  ChoiceInput,
  ChoiceLabel,
  ChoiceShortcut,
  Input,
  Error: ErrorMessage,
  Previous,
  Next,
  Skip,
  Submit,
};
