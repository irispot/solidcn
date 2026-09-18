import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  flush,
  onCleanup,
  Show,
  untrack,
  useContext,
} from 'solid-js';
import { isServer, type JSX } from '@solidjs/web';
import {
  activeElement,
  assignRef,
  contains,
  createControllable,
  eventDetails,
  mergeProps,
  omitProps,
  renderElement,
  useDirection,
  useTimeout,
  type BaseProps,
} from './core';
import { getSliderValue } from './slider/utils/getSliderValue';
import { resolveThumbCollision } from './slider/utils/resolveThumbCollision';
import { getDecimalPrecision, roundValueToStep } from './slider/utils/roundValueToStep';
import { validateMinimumDistance } from './slider/utils/validateMinimumDistance';

type ChangeDetails = ReturnType<typeof eventDetails>;
type Change<T> = (value: T, details: ChangeDetails) => void;
type NativeControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
function isEligibleFieldControl(element: NativeControl, form: HTMLFormElement | null) {
  if (!element.isConnected || element.matches(':disabled')) return false;
  return !form || element.form === form ||
    (element.form === null && !element.hasAttribute('form'));
}
function comesBeforeInSameTree(element: Node, reference: Node) {
  const position = element.compareDocumentPosition(reference);
  return (position & Node.DOCUMENT_POSITION_DISCONNECTED) === 0 &&
    (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}
type Ref<T> = ((element: T) => void) | { current: T | null };
type PartProps<S = Record<string, unknown>> = BaseProps<S>;
type Orientation = 'horizontal' | 'vertical';
const hiddenStyle: JSX.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  'white-space': 'nowrap',
  border: '0',
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
function defaultFormSubmitter(form: HTMLFormElement | null) {
  if (!form) return null;
  for (const element of form.elements) {
    if ((element.tagName === 'BUTTON' || element.tagName === 'INPUT') &&
        (element as HTMLButtonElement | HTMLInputElement).type === 'submit')
      return element as HTMLButtonElement | HTMLInputElement;
  }
  return null;
}
function fieldAttributes(
  field: FieldContextValue | null | undefined,
  describedBy?: () => string | undefined,
) {
  return {
    get 'aria-invalid'() {
      return field?.state.valid === false || undefined;
    },
    get 'aria-describedby'() {
      return [
        describedBy?.(),
        field?.description(),
        field?.state.valid === false && field.errorId(),
      ]
        .filter(Boolean)
        .join(' ') || undefined;
    },
  };
}
function registerReset(element: () => HTMLInputElement | undefined, reset: () => void) {
  createEffect(element, (input) => {
    const form = input?.form;
    if (!form) return;
    const listener = (event: Event) =>
      queueMicrotask(() => {
        if (!event.defaultPrevented) reset();
      });
    form.addEventListener('reset', listener);
    return () => form.removeEventListener('reset', listener);
  });
}
function useInputLabels(
  element: () => HTMLInputElement | undefined,
  sourceId?: () => string | undefined,
) {
  const baseId = createUniqueId();
  const [labelledBy, setLabelledBy] = createSignal<string>();
  createEffect(() => [element(), sourceId?.()] as const, ([input]) => {
    const labels = Array.from(input?.labels ?? []);
    const assigned: HTMLLabelElement[] = [];
    for (let index = 0; index < labels.length; index++)
      if (!labels[index].id) {
        labels[index].id = `${baseId}-label-${index}`;
        assigned.push(labels[index]);
      }
    setLabelledBy(labels.map((label) => label.id).join(' ') || undefined);
    return () => {
      for (const label of assigned) label.removeAttribute('id');
    };
  });
  return labelledBy;
}
function controlEvents(field: FieldContextValue | null | undefined) {
  return {
    onFocus: () => field?.focus(true),
    onBlur: () => {
      field?.focus(false);
      field?.touch();
    },
  };
}
function bindFieldValue(field: FieldContextValue | null | undefined, value: () => unknown) {
  if (!field) return;
  createEffect(
    () => value,
    (source) => field.bindValue(source),
  );
  createEffect(value, (current) => field.syncValue(current));
}

export interface FieldRootState {
  disabled: boolean;
  touched: boolean;
  dirty: boolean;
  valid: boolean | null;
  filled: boolean;
  focused: boolean;
}
const defaultFieldState: FieldRootState = {
  disabled: false,
  touched: false,
  dirty: false,
  valid: null,
  filled: false,
  focused: false,
};
export interface FieldValidityData {
  state: Partial<Omit<ValidityState, 'valid'>> & { valid: boolean | null };
  error: string;
  errors: string[];
  value: unknown;
  initialValue: unknown;
}
export interface FieldRootProps extends BaseProps<FieldRootState> {
  disabled?: boolean;
  name?: string;
  invalid?: boolean;
  dirty?: boolean;
  touched?: boolean;
  validationMode?: 'onSubmit' | 'onBlur' | 'onChange';
  validationDebounceTime?: number;
  validate?: (
    value: unknown,
    values: Record<string, unknown>,
  ) => string | string[] | null | void | Promise<string | string[] | null | void>;
  actionsRef?: Ref<{ validate: () => void }>;
}
interface FieldContextValue {
  props: FieldRootProps;
  state: FieldRootState;
  id: string;
  labelScope: 'root' | 'item';
  suppressLabelFor: () => boolean;
  setSuppressLabelFor: (value: boolean) => void;
  controlId: () => string;
  setControlId: (id: string) => void;
  labelId: () => string | undefined;
  setLabelId: (id: string | undefined) => void;
  markLabelActivation: () => void;
  consumeLabelActivation: () => boolean;
  description: () => string | undefined;
  setDescription: (id: string | undefined) => void;
  errorId: () => string | undefined;
  setErrorId: (id: string | undefined) => void;
  validity: () => FieldValidityData;
  validate: () => boolean | undefined;
  focusTarget: () => HTMLElement | null;
  value: () => unknown;
  formValue: () => unknown;
  bindValue: (source: () => unknown) => () => void;
  bindFormValue: (source: () => unknown, filled: () => boolean, dirty?: () => boolean) => () => void;
  syncValue: (value: unknown) => void;
  register: (element: NativeControl, initialValue?: unknown, exposed?: HTMLElement) => void;
  change: (value: unknown) => void;
  focus: (value: boolean) => void;
  touch: () => void;
  reset: () => void;
}
const FieldContext = createContext<FieldContextValue | null>(null);
const FieldsetContext = createContext<{
  disabled: () => boolean;
  legendId: () => string | undefined;
  setLegendId: (id: string | undefined) => void;
} | null>(null);
interface FormContextValue {
  props: Pick<FormProps, 'validationMode' | 'errors'>;
  element: () => HTMLFormElement | undefined;
  fields: Set<FieldContextValue>;
  submitted: () => boolean;
  errors: () => Record<string, string | string[] | undefined>;
  clear: (name?: string) => void;
}
const FormContext = createContext<FormContextValue | null>(null);
export function useFieldContext() {
  return useContext(FieldContext);
}
export function useFieldsetDisabled() {
  const fieldset = useContext(FieldsetContext);
  return () => Boolean(fieldset?.disabled());
}

export function FieldRoot(props: FieldRootProps) {
  const form = useContext(FormContext);
  const fieldset = useContext(FieldsetContext);
  // The root's DOM id and the labelable control's id have separate owners.
  const id = createUniqueId();
  const [controlId, setControlId] = createSignal(id, { ownedWrite: true });
  const [suppressLabelFor, setSuppressLabelFor] = createSignal(false, { ownedWrite: true });
  const [storedValue, setValue] = createSignal<unknown>('');
  // Control teardown can replace this source during a keyed child update.
  const [valueSource, setValueSource] = createSignal<(() => unknown) | undefined>(undefined, {
    ownedWrite: true,
  });
  const value = () => {
    const source = valueSource();
    return source ? source() : storedValue();
  };
  const [touched, setTouched] = createSignal(false);
  const [focused, setFocused] = createSignal(false);
  const [labelId, setLabelId] = createSignal<string | undefined>(undefined, { ownedWrite: true });
  const [description, setDescription] = createSignal<string>();
  const [errorId, setErrorId] = createSignal<string>();
  const [validity, setValidity] = createSignal<FieldValidityData>({
    state: { valid: null },
    error: '',
    errors: [],
    value: '',
    initialValue: '',
  });
  let initialValue: unknown = '';
  let initialized = false;
  let formValueSource: (() => unknown) | undefined;
  let filledSource: (() => boolean) | undefined;
  let dirtySource: (() => boolean) | undefined;
  let labelActivation = false;
  let control: NativeControl | undefined;
  const controls = new Set<NativeControl>();
  const exposedControls = new WeakMap<NativeControl, HTMLElement>();
  let validationRequest = 0;
  const validationTimer = useTimeout();
  const externalErrors = () => {
    const error = props.name ? form?.errors()[props.name] : undefined;
    return typeof error === 'string' ? [error] : (error ?? []);
  };
  const state: FieldRootState = {
    get disabled() {
      return Boolean(props.disabled || fieldset?.disabled());
    },
    get touched() {
      return props.touched ?? touched();
    },
    get focused() {
      return focused();
    },
    get dirty() {
      return props.dirty ?? dirtySource?.() ?? !Object.is(value(), initialValue);
    },
    get valid() {
      return props.invalid || externalErrors().length
        ? false
        : state.disabled
          ? null
          : validity().state.valid;
    },
    get filled() {
      if (filledSource) return filledSource();
      const current = value();
      return (
        current != null &&
        current !== '' &&
        current !== false &&
        (!Array.isArray(current) || current.length > 0)
      );
    },
  };
  function validate() {
    const request = ++validationRequest;
    const current = value();
    const flags: { -readonly [Key in keyof ValidityState]?: boolean } = {};
    for (const element of controls)
      if (element.isConnected) element.setCustomValidity('');
    const mountedControls = Array.from(controls).filter((element) =>
      isEligibleFieldControl(element, form?.element() ?? null));
    let nativeError = '';
    for (const element of mountedControls) {
      for (const key of [
        'badInput',
        'customError',
        'patternMismatch',
        'rangeOverflow',
        'rangeUnderflow',
        'stepMismatch',
        'tooLong',
        'tooShort',
        'typeMismatch',
        'valueMissing',
      ] as const)
        flags[key] = Boolean(flags[key] || element.validity[key]);
      if (!element.validity.valid && !nativeError) nativeError = element.validationMessage;
    }
    flags.valid = !nativeError;
    const values = Object.fromEntries(
      Array.from(form?.fields ?? [])
        .filter((field) => field.props.name)
        .map((field) => [field.props.name!, field.formValue()]),
    );
    if (!form && props.name) values[props.name] = formValueSource?.() ?? current;
    const result = props.validate?.(current, values);
    const apply = (result: string | string[] | null | void): boolean | undefined => {
      if (request !== validationRequest) return;
      const custom = (Array.isArray(result) ? result : result ? [result] : []).filter(Boolean);
      const errors = externalErrors().length
        ? externalErrors()
        : custom.length
          ? custom
          : nativeError
            ? [nativeError]
            : [];
      if (custom.length) (mountedControls.find((element) => !element.validity.valid) ??
        mountedControls[0])?.setCustomValidity(custom.join('\n'));
      setValidity({
        state: {
          ...flags,
          customError: Boolean(custom.length),
          valid: !errors.length && !props.invalid,
        },
        error: errors[0] ?? '',
        errors,
        value: current,
        initialValue,
      });
      return !errors.length && !props.invalid;
    };
    if (result instanceof Promise)
      void result.then(apply, (error) =>
        apply(error instanceof Error ? error.message : String(error)),
      );
    else return apply(result);
  }
  const context: FieldContextValue = {
    props,
    state,
    id,
    labelScope: 'root',
    suppressLabelFor,
    setSuppressLabelFor,
    controlId,
    setControlId,
    labelId,
    setLabelId,
    markLabelActivation() {
      labelActivation = true;
      queueMicrotask(() => { labelActivation = false; });
    },
    consumeLabelActivation() {
      const wasLabel = labelActivation;
      labelActivation = false;
      return wasLabel;
    },
    description,
    setDescription,
    errorId,
    setErrorId,
    value,
    formValue: () => formValueSource?.() ?? value(),
    bindValue(source) {
      if (!initialized) {
        initialized = true;
        initialValue = untrack(source);
        setValue(() => initialValue);
      }
      setValueSource(() => source);
      return () => {
        if (untrack(valueSource) === source) setValueSource(undefined);
      };
    },
    bindFormValue(source, filled, dirty) {
      formValueSource = source;
      filledSource = filled;
      dirtySource = dirty;
      return () => {
        if (formValueSource === source) formValueSource = undefined;
        if (filledSource === filled) filledSource = undefined;
        if (dirtySource === dirty) dirtySource = undefined;
      };
    },
    syncValue(current) {
      // Event handlers already synchronize their accepted value. Only external
      // value changes need a second path into validation.
      const previous = storedValue();
      if (Object.is(previous, current) ||
          (Array.isArray(previous) && Array.isArray(current) &&
            previous.length === current.length && previous.every((item, index) => item === current[index])))
        return;
      context.change(current);
    },
    validity: () => ({
      ...validity(),
      errors: externalErrors().length ? externalErrors() : validity().errors,
      error: externalErrors()[0] ?? validity().error,
      state: { ...validity().state, valid: state.valid },
    }),
    validate,
    focusTarget() {
      const eligible = Array.from(controls).filter((element) =>
        isEligibleFieldControl(element, form?.element() ?? null));
      const input = eligible.find((element) => !element.validity.valid) ?? eligible[0];
      return input ? exposedControls.get(input) ?? input : null;
    },
    register(element, initial, exposed) {
      controls.add(element);
      if (exposed) exposedControls.set(element, exposed);
      if (!control) {
        control = element;
        if (!initialized) {
          initialized = true;
          initialValue =
            arguments.length > 1
              ? initial
              : element.type === 'checkbox'
                ? (element as HTMLInputElement).checked
                : element.value;
          setValue(() => initialValue);
        }
      }
    },
    change(next) {
      setValue(() => next);
      flush();
      form?.clear(props.name);
      const mode = props.validationMode ?? form?.props.validationMode ?? 'onSubmit';
      const hasLiveControl = Array.from(controls).some((element) =>
        isEligibleFieldControl(element, form?.element() ?? null));
      if (
        !state.disabled &&
        (mode === 'onChange' ||
          (mode === 'onSubmit' && (form?.submitted() || validity().state.valid === false)) ||
          (mode === 'onBlur' && hasLiveControl && validity().state.valid === false))
      ) {
        validationTimer.clear();
        if (props.validationDebounceTime)
          validationTimer.start(props.validationDebounceTime, validate);
        else validate();
      }
    },
    focus: setFocused,
    touch() {
      setTouched(true);
      if ((props.validationMode ?? form?.props.validationMode) === 'onBlur') validate();
    },
    reset() {
      validationTimer.clear();
      ++validationRequest;
      setTouched(false);
      setFocused(false);
      setValue(() => initialValue);
      setValidity({
        state: { valid: null },
        error: '',
        errors: [],
        value: initialValue,
        initialValue,
      });
      for (const element of controls) element.setCustomValidity('');
    },
  };
  form?.fields.add(context);
  assignRef(props.actionsRef, { validate });
  onCleanup(() => {
    validationTimer.clear();
    ++validationRequest;
    form?.fields.delete(context);
  });
  return <FieldContext value={context}>{renderElement('div', props, state)}</FieldContext>;
}
export namespace FieldRoot {
  export type Props = FieldRootProps;
  export type State = FieldRootState;
  export type Actions = { validate: () => void };
}

export interface InputProps extends BaseProps<FieldRootState> {
  value?: string | number;
  defaultValue?: string | number;
  onValueChange?: Change<string>;
  disabled?: boolean;
  name?: string;
}
export function Input(props: InputProps) {
  const field = useContext(FieldContext);
  const inheritedDisabled = useFieldsetDisabled();
  createEffect(
    () => props.id,
    (explicitId) => {
      field?.setControlId(explicitId ?? field.id);
      return () => field?.setControlId(field.id);
    },
  );
  const [value, setValue] = createControllable<string | number>(
    props,
    'value',
    props.defaultValue ?? '',
  );
  const [input, setInput] = createSignal<HTMLInputElement>();
  bindFieldValue(field, value);
  registerReset(input, () => {
    setValue(props.defaultValue ?? '');
    field?.reset();
  });
  return renderElement(
    'input',
    omitProps(props, ['disabled', 'name', 'aria-describedby']),
    field?.state ?? defaultFieldState,
    mergeProps(fieldAttributes(field, () => props['aria-describedby']), controlEvents(field), {
      get id() {
        return props.id ?? field?.id;
      },
      get name() {
        return field?.props.name ?? props.name;
      },
      get disabled() {
        return field?.state.disabled || props.disabled || inheritedDisabled();
      },
      get value() {
        return value();
      },
      ref(element: HTMLInputElement) {
        setInput(element);
        field?.register(element, value());
      },
      onInput(event: InputEvent) {
        const input = event.currentTarget as HTMLInputElement;
        if (setValue(input.value, event, 'none')) field?.change(input.value);
        input.value = String(value());
      },
    }),
  );
}
export namespace Input {
  export type Props = InputProps;
  export type State = FieldRootState;
}
export const FieldControl = Input;
export type FieldControlProps = InputProps;
export function FieldLabel(props: PartProps<FieldRootState> & { nativeLabel?: boolean }) {
  const field = useContext(FieldContext);
  const id = props.id ?? createUniqueId();
  createEffect(
    () => id,
    (nextId) => {
      field?.setLabelId(nextId);
      return () => field?.setLabelId(undefined);
    },
  );
  return renderElement(
    props.nativeLabel === false ? 'span' : 'label',
    props,
    field?.state ?? defaultFieldState,
    {
      id,
      get for() {
        return props.nativeLabel === false || field?.suppressLabelFor() ? undefined : field?.controlId();
      },
      onClick(event: MouseEvent) {
        if (props.nativeLabel !== false) field?.markLabelActivation();
        if (props.nativeLabel === false && field)
          (event.currentTarget as HTMLElement).ownerDocument
            .getElementById(field.controlId())
            ?.focus();
      },
    },
  );
}
export namespace FieldLabel {
  export type Props = PartProps<FieldRootState> & { nativeLabel?: boolean };
}
export function FieldDescription(props: PartProps<FieldRootState>) {
  const field = useContext(FieldContext);
  const id = props.id ?? createUniqueId();
  createEffect(
    () => id,
    (value) => {
      field?.setDescription(value);
      return () => field?.setDescription(undefined);
    },
  );
  return renderElement('p', props, field?.state ?? defaultFieldState, { id });
}
export namespace FieldDescription {
  export type Props = PartProps<FieldRootState>;
}
export function FieldError(
  props: PartProps<FieldRootState> & { match?: boolean | keyof ValidityState },
) {
  const field = useContext(FieldContext);
  const id = props.id ?? createUniqueId();
  createEffect(
    () => id,
    (value) => {
      field?.setErrorId(value);
      return () => field?.setErrorId(undefined);
    },
  );
  const visible = () =>
    props.match === true ||
    (typeof props.match === 'string'
      ? field?.validity().state[props.match]
      : field?.state.valid === false);
  return (
    <Show when={visible()}>
      {renderElement('div', props, field?.state ?? defaultFieldState, {
        id,
        get children() {
          return props.children ?? field?.validity().error;
        },
      })}
    </Show>
  );
}
export namespace FieldError {
  export type Props = PartProps<FieldRootState> & { match?: boolean | keyof ValidityState };
}
export function FieldValidity(props: {
  children: (
    state: Omit<FieldValidityData, 'state'> & {
      validity: FieldValidityData['state'];
      transitionStatus: 'idle';
    },
  ) => JSX.Element;
}) {
  const field = useContext(FieldContext);
  return (
    <>
      {props.children({
        get validity() {
          return field?.validity().state ?? { valid: null };
        },
        get error() {
          return field?.validity().error ?? '';
        },
        get errors() {
          return field?.validity().errors ?? [];
        },
        get value() {
          return field?.value();
        },
        get initialValue() {
          return field?.validity().initialValue;
        },
        transitionStatus: 'idle',
      })}
    </>
  );
}
export namespace FieldValidity {
  export type Props = Parameters<typeof FieldValidity>[0];
}
export function FieldItem(props: PartProps<FieldRootState>) {
  const field = useContext(FieldContext);
  const id = createUniqueId();
  const [controlId, setControlId] = createSignal(id, { ownedWrite: true });
  const [labelId, setLabelId] = createSignal<string | undefined>(undefined, { ownedWrite: true });
  const [itemDescription, setItemDescription] = createSignal<string>();
  const [suppressLabelFor, setSuppressLabelFor] = createSignal(false, { ownedWrite: true });
  const state: FieldRootState = {
    get disabled() {
      return Boolean(field?.state.disabled || props.disabled);
    },
    get touched() {
      return field?.state.touched ?? false;
    },
    get dirty() {
      return field?.state.dirty ?? false;
    },
    get valid() {
      return field?.state.valid ?? null;
    },
    get filled() {
      return field?.state.filled ?? false;
    },
    get focused() {
      return field?.state.focused ?? false;
    },
  };
  return (
    <FieldContext value={field ? { ...field, id, state, labelScope: 'item', controlId,
      setControlId, labelId, setLabelId, description: () => itemDescription() ?? field.description(),
      setDescription: setItemDescription, suppressLabelFor, setSuppressLabelFor } : null}>
      {renderElement('div', props, state)}
    </FieldContext>
  );
}
export namespace FieldItem {
  export type Props = PartProps<FieldRootState>;
}
export const Field = {
  Root: FieldRoot,
  Label: FieldLabel,
  Description: FieldDescription,
  Control: FieldControl,
  Error: FieldError,
  Validity: FieldValidity,
  Item: FieldItem,
};
export namespace Field {
  export type ValidityData = FieldValidityData;
}

export interface FieldsetRootProps extends BaseProps<{ disabled: boolean }> {
  disabled?: boolean;
}
export function FieldsetRoot(props: FieldsetRootProps) {
  const inherited = useContext(FieldsetContext);
  const [legendId, setLegendId] = createSignal<string | undefined>(undefined, { ownedWrite: true });
  const disabled = () => Boolean(props.disabled || inherited?.disabled());
  return (
    <FieldsetContext value={{ disabled, legendId, setLegendId }}>
      {renderElement(
        'fieldset',
        omitProps(props, ['disabled']),
        {
          get disabled() {
            return disabled();
          },
        },
        {
          get disabled() {
            return disabled();
          },
          get 'aria-labelledby'() {
            return legendId();
          },
        },
      )}
    </FieldsetContext>
  );
}
export namespace FieldsetRoot {
  export type Props = FieldsetRootProps;
}
export function FieldsetLegend(props: PartProps) {
  const fieldset = useContext(FieldsetContext);
  if (!fieldset) {
    throw new Error(
      'Base UI: FieldsetRootContext is missing. Fieldset parts must be placed within <Fieldset.Root>.',
    );
  }
  const generatedId = createUniqueId();
  const id = () => props.id ?? generatedId;
  createEffect(
    id,
    (id) => {
      fieldset.setLegendId(id);
      return () => fieldset.setLegendId(undefined);
    },
  );
  return renderElement(
    'div',
    props,
    {
      get disabled() {
        return fieldset.disabled();
      },
    },
    {
      get id() {
        return id();
      },
    },
  );
}
export namespace FieldsetLegend {
  export type Props = PartProps;
}
export const Fieldset = { Root: FieldsetRoot, Legend: FieldsetLegend };

export interface FormProps<Values extends object = Record<string, unknown>> extends BaseProps {
  validationMode?: 'onSubmit' | 'onBlur' | 'onChange';
  errors?: Record<string, string | string[] | undefined>;
  onFormSubmit?: (values: Values, details: ChangeDetails) => void;
  actionsRef?: Ref<{ validate: (name?: string) => void }>;
}
export function Form<Values extends object = Record<string, unknown>>(props: FormProps<Values>) {
  const fields = new Set<FieldContextValue>();
  const [element, setElement] = createSignal<HTMLFormElement | undefined>(undefined, { ownedWrite: true });
  const [submitted, setSubmitted] = createSignal(false);
  const [cleared, setCleared] = createSignal<Set<string>>(new Set());
  let focusAfterExternalErrors = false;
  function focusInvalidFields(isInvalid: (field: FieldContextValue) => boolean) {
    let firstControl: HTMLElement | null = null;
    for (const field of fields) {
      if (!isInvalid(field)) continue;
      const candidate = field.focusTarget();
      if (candidate && (!firstControl || comesBeforeInSameTree(candidate, firstControl)))
        firstControl = candidate;
    }
    firstControl?.focus();
    if (firstControl?.tagName === 'INPUT') (firstControl as HTMLInputElement).select();
  }
  createEffect(
    () => props.errors,
    () => {
      setCleared(new Set<string>());
      if (focusAfterExternalErrors) {
        focusAfterExternalErrors = false;
        queueMicrotask(() => focusInvalidFields((field) => field.state.valid === false));
      }
    },
  );
  const context: FormContextValue = {
    props,
    element,
    fields,
    submitted,
    errors: () =>
      Object.fromEntries(
        Object.entries(props.errors ?? {}).filter(([name]) => !cleared().has(name)),
      ),
    clear(name) {
      if (name) setCleared((previous) => new Set([...previous, name]));
    },
  };
  assignRef(props.actionsRef, {
    validate(name?: string) {
      for (const field of fields) if (!name || field.props.name === name) field.validate();
    },
  });
  return (
    <FormContext value={context}>
      {renderElement(
        'form',
        omitProps(props, ['onSubmit', 'ref']),
        {},
        {
          noValidate: true,
          ref(formElement: HTMLFormElement) {
            setElement(formElement);
            assignRef(props.ref, formElement);
          },
          onSubmit(event: SubmitEvent) {
            setSubmitted(true);
            let hasInvalid = false;
            const invalidFields = new Set<FieldContextValue>();
            for (const field of fields) {
              if (field.validate() !== false) continue;
              hasInvalid = true;
              invalidFields.add(field);
            }
            if (hasInvalid) {
              event.preventDefault();
              focusInvalidFields((field) => invalidFields.has(field));
              return;
            }
            focusAfterExternalErrors = true;
            props.onSubmit?.(event);
            if (props.onFormSubmit) {
              event.preventDefault();
              const data = new FormData(event.currentTarget as HTMLFormElement, event.submitter);
              const values: Record<string, unknown> = Object.fromEntries(data);
              for (const field of fields)
                if (field.props.name) values[field.props.name] = field.formValue();
              props.onFormSubmit(values as Values, eventDetails(event, 'none'));
            }
          },
          onReset(event: Event) {
            queueMicrotask(() => {
              if (!event.defaultPrevented) {
                setSubmitted(false);
                setCleared(new Set<string>());
                for (const field of fields) field.reset();
              }
            });
          },
        },
      )}
    </FormContext>
  );
}
export namespace Form {
  export type Props<TValues extends object = Record<string, unknown>> = FormProps<TValues>;
  export type Values = Record<string, unknown>;
  export type ValidationMode = 'onSubmit' | 'onBlur' | 'onChange';
  export type Actions = FormActions;
  export type SubmitEventDetails = ChangeDetails;
}

export interface ButtonProps extends BaseProps<{ disabled: boolean }> {
  disabled?: boolean;
  focusableWhenDisabled?: boolean;
  nativeButton?: boolean;
}
export function Button(props: ButtonProps) {
  const disabled = () => Boolean(props.disabled);
  const native = () => props.nativeButton !== false;
  const activate = (event: KeyboardEvent) => {
    const target = event.currentTarget as HTMLElement;
    const view = target.ownerDocument.defaultView;
    const ClickEvent = view?.PointerEvent ?? view?.MouseEvent ?? MouseEvent;
    target.dispatchEvent(
      new ClickEvent('click', {
        bubbles: true,
        cancelable: true,
        composed: true,
        detail: 0,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
      }),
    );
  };
  return renderElement(
    'button',
    omitProps(props, [
      'disabled',
      'focusableWhenDisabled',
      'onClick',
      'onMouseDown',
      'onPointerDown',
      'onKeyDown',
      'onKeyUp',
    ]),
    {
      get disabled() {
        return disabled();
      },
    },
    {
      get type() {
        return native() ? 'button' : undefined;
      },
      get disabled() {
        return native() && disabled() && !props.focusableWhenDisabled;
      },
      get 'aria-disabled'() {
        return props.focusableWhenDisabled || !native() ? disabled() : null;
      },
      get role() {
        return props.nativeButton === false ? 'button' : undefined;
      },
      get tabIndex() {
        return !native() && disabled() && !props.focusableWhenDisabled ? -1 : 0;
      },
      onClick(event: MouseEvent) {
        if (disabled()) {
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        props.onClick?.(event);
      },
      onMouseDown(event: MouseEvent) {
        if (!disabled()) props.onMouseDown?.(event);
      },
      onPointerDown(event: PointerEvent) {
        if (disabled()) event.preventDefault();
        else props.onPointerDown?.(event);
      },
      onKeyDown(event: KeyboardEvent) {
        if (disabled()) {
          if (props.focusableWhenDisabled && event.key !== 'Tab') event.preventDefault();
          return;
        }
        props.onKeyDown?.(event);
        if (
          event.defaultPrevented ||
          (event as Event & { baseUIHandlerPrevented?: boolean }).baseUIHandlerPrevented
        )
          return;
        if (
          !native() &&
          event.target === event.currentTarget &&
          (event.key === ' ' || event.key === 'Enter')
        ) {
          const target = event.currentTarget as HTMLElement;
          if (event.key === 'Enter' && target.tagName === 'A' && target.hasAttribute('href'))
            return;
          event.preventDefault();
          if (event.key === 'Enter') activate(event);
        }
      },
      onKeyUp(event: KeyboardEvent) {
        if (disabled()) return;
        props.onKeyUp?.(event);
        if (
          !native() &&
          event.target === event.currentTarget &&
          event.key === ' ' &&
          !event.defaultPrevented &&
          !(event as Event & { baseUIHandlerPrevented?: boolean }).baseUIHandlerPrevented
        )
          activate(event);
      },
    },
  );
}
export namespace Button {
  export type Props = ButtonProps;
  export type State = { disabled: boolean };
}

export interface CheckboxGroupProps extends BaseProps<FieldRootState> {
  value?: string[];
  defaultValue?: string[];
  onValueChange?: Change<string[]>;
  allValues?: string[];
  disabled?: boolean;
}
interface CheckboxGroupValue {
  props: CheckboxGroupProps;
  value: () => string[];
  setValue: (value: string[], event?: Event, reason?: string, details?: ChangeDetails) => boolean;
  parentChecked: () => boolean;
  parentIndeterminate: () => boolean;
  parentControls: () => string | undefined;
  registerChild: (value: string, node: HTMLElement, input: HTMLInputElement, disabled: () => boolean) => () => void;
  toggleParent: (details: ChangeDetails) => void;
  toggleChild: (value: string, checked: boolean, details: ChangeDetails) => void;
}
const CheckboxGroupContext = createContext<CheckboxGroupValue | null>(null);
export function CheckboxGroup(props: CheckboxGroupProps) {
  const field = useContext(FieldContext);
  const form = useContext(FormContext);
  createEffect(
    () => field,
    (scope) => {
      scope?.setSuppressLabelFor(true);
      return () => scope?.setSuppressLabelFor(false);
    },
  );
  const [localValue, setLocalValue] = createSignal<string[]>(untrack(() => props.defaultValue ?? []));
  const value = () => props.value ?? localValue();
  const [children, setChildren] = createSignal<{
    value: string; node: HTMLElement; input: HTMLInputElement; disabled: () => boolean;
  }[]>([], { ownedWrite: true });
  const [cycleStatus, setCycleStatus] = createSignal<'mixed' | 'on' | 'off'>('mixed');
  let snapshot = untrack(value);
  const initialValue = untrack(() => [...value()]);
  bindFieldValue(field, value);
  const unregisterFormValue = field?.bindFormValue(
    () => {
      if (!form) return value();
      const formElement = form?.element() ?? null;
      const successful = new Set(children()
        .filter((child) => child.input.isConnected && child.input.checked &&
          !child.input.matches(':disabled') && !child.disabled() &&
          (!formElement || child.input.form === formElement ||
            child.input.form === null && !child.input.hasAttribute('form')))
        .map((child) => child.value));
      return value().filter((item) => successful.has(item));
    },
    () => value().length > 0,
    () => value().length !== initialValue.length ||
      value().some((item, index) => item !== initialValue[index]),
  );
  if (unregisterFormValue) onCleanup(unregisterFormValue);
  const update: CheckboxGroupValue['setValue'] = (next, event, reason, suppliedDetails) => {
    const details = suppliedDetails ?? eventDetails(event, reason);
    props.onValueChange?.(next, details);
    if (details.isCanceled) return false;
    if (props.value === undefined) setLocalValue(next);
    field?.change(next);
    return true;
  };
  const parentChecked = () => Boolean(props.allValues?.length) &&
    value().length === props.allValues!.length;
  const parentIndeterminate = () => Boolean(props.allValues?.length) &&
    value().length > 0 && value().length !== props.allValues!.length;
  const parentControls = () => props.allValues?.flatMap((item) => children()
    .filter((child) => child.value === item)
    .sort((left, right) => left.node.compareDocumentPosition(right.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)
    .map((child) => child.node.id)
    .filter(Boolean)).join(' ') || undefined;
  const registerChild: CheckboxGroupValue['registerChild'] = (item, node, input, disabled) => {
    const child = { value: item, node, input, disabled };
    setChildren((previous) => previous.some((entry) => entry.node === node) ? previous : [...previous, child]);
    return () => setChildren((previous) => previous.filter((entry) => entry !== child));
  };
  const toggleParent: CheckboxGroupValue['toggleParent'] = (details) => {
    const allValues = props.allValues ?? [];
    const disabled = new Map(children().map((child) => [child.value, child.disabled()]));
    const none = allValues.filter((item) => disabled.get(item) && snapshot.includes(item));
    const all = allValues.filter((item) => !disabled.get(item) || snapshot.includes(item));
    const allOnOrOff = snapshot.length === all.length || snapshot.length === 0;
    if (allOnOrOff) {
      update(value().length === all.length ? none : all, details.event, 'none', details);
      return;
    }
    const status = cycleStatus();
    const nextStatus = status === 'mixed' ? 'on' : status === 'on' ? 'off' : 'mixed';
    const next = status === 'mixed' ? all : status === 'on' ? none : snapshot;
    if (update(next, details.event, 'none', details)) setCycleStatus(nextStatus);
  };
  const toggleChild: CheckboxGroupValue['toggleChild'] = (item, checked, details) => {
    const next = checked ? [...value(), item] : value().filter((entry) => entry !== item);
    if (update(next, details.event, 'none', details)) {
      snapshot = next;
      setCycleStatus('mixed');
    }
  };
  return (
    <CheckboxGroupContext value={{ props, value, setValue: update, parentChecked,
      parentIndeterminate, parentControls, registerChild, toggleParent, toggleChild }}>
      {renderElement(
        'div',
        omitProps(props, ['aria-describedby']),
        mergeProps(field?.state ?? defaultFieldState, {
          get disabled() {
            return props.disabled || field?.state.disabled || false;
          },
        }),
        mergeProps(fieldAttributes(field, () => props['aria-describedby']), {
          role: 'group',
          get 'aria-labelledby'() {
            return field?.labelId();
          },
          get 'aria-disabled'() {
            return props.disabled || field?.state.disabled || undefined;
          },
        }),
      )}
    </CheckboxGroupContext>
  );
}
export namespace CheckboxGroup {
  export type Props = CheckboxGroupProps;
  export type State = FieldRootState;
  export type ChangeEventDetails = ChangeDetails;
}

export interface CheckboxRootState extends FieldRootState {
  checked: boolean;
  indeterminate: boolean;
  readOnly: boolean;
  required: boolean;
}
export const PARENT_CHECKBOX = 'data-parent' as const;
export interface CheckboxRootProps extends BaseProps<CheckboxRootState> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: Change<boolean>;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  indeterminate?: boolean;
  name?: string;
  form?: string;
  value?: string;
  uncheckedValue?: string;
  parent?: boolean;
  nativeButton?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}
interface CheckContextValue {
  checked: () => boolean;
  state: CheckboxRootState;
}
const CheckboxContext = createContext<CheckContextValue | null>(null);
export const CheckboxRootContext = CheckboxContext;
let activeCheckboxIndicatorExitBatch: Set<() => void> | undefined;
function checkboxIndicatorExitBatch() {
  if (!activeCheckboxIndicatorExitBatch) {
    activeCheckboxIndicatorExitBatch = new Set();
    queueMicrotask(() => { activeCheckboxIndicatorExitBatch = undefined; });
  }
  return activeCheckboxIndicatorExitBatch;
}
// Keep the Switch context shaped like the pinned internal provider. This also
// lets unchanged part tests give a Thumb state without a synthetic UI root.
export type SwitchRootContext = Omit<CheckboxRootState, 'indeterminate'>;
export const SwitchRootContext = createContext<SwitchRootContext | null>(null);
function CheckControl(props: CheckboxRootProps, kind: 'checkbox' | 'switch') {
  const field = useContext(FieldContext);
  const group = kind === 'checkbox' ? useContext(CheckboxGroupContext) : undefined;
  const inheritedDisabled = useFieldsetDisabled();
  const generatedId = createUniqueId();
  const visibleId = createUniqueId();
  const [registeredExplicitId, setRegisteredExplicitId] = createSignal<string | undefined>();
  createEffect(() => props.id, (id) => {
    if (!isServer) queueMicrotask(() => setRegisteredExplicitId(id));
  });
  const controlId = () => (group && !isServer ? props.id : undefined) || registeredExplicitId() ||
    (!group || field?.labelScope === 'item' ? field?.id : undefined) || generatedId;
  createEffect(controlId, (id) => {
    if (group && field?.labelScope !== 'item') return;
    field?.setControlId(id);
    return () => field?.setControlId(field.id);
  });
  const [localChecked, setLocalChecked] = createControllable(
    props,
    'checked',
    props.defaultChecked ?? false,
  );
  const [input, setInput] = createSignal<HTMLInputElement>();
  const [root, setRoot] = createSignal<HTMLElement>();
  const labelledBy = useInputLabels(input, controlId);
  let inputClickEvent: MouseEvent | undefined;
  const itemValue = () => props.value ?? field?.props.name ?? props.name;
  const checked = () =>
    group
      ? props.parent
        ? group.props.allValues ? group.parentChecked() : localChecked()
        : itemValue() !== undefined ? group.value().includes(itemValue()!) : localChecked()
      : localChecked();
  if (!group) bindFieldValue(field, checked);
  const state = mergeProps(
    field?.state ?? { touched: false, dirty: false, valid: null, filled: false, focused: false },
    {
      get checked() {
        return checked();
      },
      get indeterminate() {
        return (
          props.indeterminate ||
          Boolean(props.parent && group?.props.allValues && group.parentIndeterminate())
        );
      },
      get disabled() {
        return Boolean(
          props.disabled || group?.props.disabled || field?.state.disabled || inheritedDisabled(),
        );
      },
      get readOnly() {
        return Boolean(props.readOnly);
      },
      get required() {
        return Boolean(props.required);
      },
    },
  ) as CheckboxRootState;
  function update(next: boolean, event?: Event) {
    if (state.disabled || state.readOnly) return;
    if (group) {
      if ((props.parent && !group.props.allValues) || (!props.parent && itemValue() === undefined)) {
        setLocalChecked(next, event, 'none');
        return;
      }
      const details = eventDetails(event, 'none');
      props.onCheckedChange?.(next, details);
      if (details.isCanceled) return;
      if (props.parent && group.props.allValues) group.toggleParent(details);
      else if (group.props.allValues) group.toggleChild(itemValue()!, next, details);
      else
        group.setValue(
          next
            ? [...new Set([...group.value(), itemValue()!])]
            : group.value().filter((value) => value !== itemValue()),
          event, 'none', details,
        );
    } else if (setLocalChecked(next, event, 'none')) field?.change(next);
  }
  createEffect(
    () => [root(), input(), itemValue(), state.disabled, props.parent] as const,
    ([element, nativeInput, item, , parent]) => {
      if (!group || !element || !nativeInput || parent || item === undefined) return;
      return group.registerChild(item, element, nativeInput, () => state.disabled);
    },
  );
  registerReset(input, () => {
    if (group) group.setValue(group.props.defaultValue ?? []);
    else if (kind === 'switch') {
      // A native form reset changes the input, not the Switch's managed state.
      const element = input();
      if (element) element.checked = checked();
    } else setLocalChecked(props.defaultChecked ?? false);
    field?.reset();
  });
  createEffect(
    () => [input(), state.indeterminate, checked()] as const,
    ([element, indeterminate]) => {
      if (element) element.indeterminate = indeterminate;
    },
  );
  const inputProps = mergeProps({
    ref(element: HTMLInputElement) {
      setInput(element);
      assignRef(props.inputRef, element);
      if (!(group && props.parent))
        field?.register(element, group ? group.value() : checked(), root());
    },
    type: 'checkbox',
    tabindex: -1,
    'aria-hidden': 'true',
    style: hiddenStyle,
    get id() { return props.nativeButton ? undefined : controlId(); },
    get name() { return props.parent ? undefined : props.name ?? field?.props.name; },
    get form() { return props.form; },
    get checked() { return checked(); },
    get disabled() { return state.disabled; },
    get required() { return state.required; },
    get 'aria-describedby'() { return field?.description(); },
    onClick(event: MouseEvent) {
      inputClickEvent = event;
      queueMicrotask(() => {
        if (inputClickEvent === event) inputClickEvent = undefined;
      });
      event.stopPropagation();
    },
    onFocus() { root()?.focus(); },
    onChange(event: Event & { currentTarget: HTMLInputElement }) {
      update(event.currentTarget.checked, inputClickEvent ?? event);
      inputClickEvent = undefined;
      event.currentTarget.checked = checked();
    },
  }, () => props.value === undefined ? {} : {
    value: kind === 'checkbox' && group ? (checked() ? props.value : '') : props.value,
  });
  const content = () => (
    <>
      {renderElement(
        'span',
        omitProps(props, ['id', 'name', 'value', 'required', 'checked', 'disabled', 'parent', 'aria-describedby']),
        state,
        mergeProps(fieldAttributes(field, () => props['aria-describedby']), {
          ref: setRoot,
          get type() {
            return props.nativeButton ? 'button' : undefined;
          },
          role: kind,
          get id() {
            return props.nativeButton ? controlId() : visibleId;
          },
          get disabled() {
            return props.nativeButton ? state.disabled : undefined;
          },
          get 'aria-disabled'() {
            return state.disabled || undefined;
          },
          get tabIndex() {
            return state.disabled ? -1 : 0;
          },
          get 'aria-checked'() {
            return state.indeterminate ? 'mixed' : checked();
          },
          get 'aria-controls'() {
            return props.parent && group?.props.allValues ? group.parentControls() : undefined;
          },
          get 'aria-labelledby'() {
            return group && field?.labelScope === 'root' ? labelledBy() : field?.labelId() ?? labelledBy();
          },
          get 'aria-readonly'() {
            return state.readOnly || undefined;
          },
          get 'aria-required'() {
            return state.required || undefined;
          },
          get 'data-checked'() {
            return checked() ? '' : undefined;
          },
          get 'data-unchecked'() {
            return checked() ? undefined : '';
          },
          get [PARENT_CHECKBOX]() {
            return kind === 'checkbox' && props.parent ? '' : undefined;
          },
          onClick(event: MouseEvent) {
            if (!state.disabled && !state.readOnly) {
              event.preventDefault();
              const target = input();
              if (target) {
                const View = target.ownerDocument.defaultView!;
                const ClickEvent = View.PointerEvent ?? View.MouseEvent;
                target.dispatchEvent(new ClickEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  composed: true,
                  detail: event.detail,
                  shiftKey: event.shiftKey,
                  ctrlKey: event.ctrlKey,
                  altKey: event.altKey,
                  metaKey: event.metaKey,
                }));
              }
            }
          },
          onFocus() {
            if (!state.disabled) field?.focus(true);
          },
          onBlur() {
            if (!state.disabled) {
              field?.focus(false);
              field?.touch();
            }
          },
          onKeyDown(event: KeyboardEvent) {
            if (kind === 'checkbox' && event.key === 'Enter' && !state.disabled) {
              if (event.defaultPrevented) return;
              const form = input()?.form ?? null;
              const preventDefault = event.preventDefault;
              let preventedByConsumer = false;
              event.preventDefault = () => {
                preventedByConsumer = true;
                preventDefault.call(event);
              };
              // Cancel the native button click, but leave an uncanceled view
              // for ancestor handlers so they can veto implicit submission.
              preventDefault.call(event);
              Object.defineProperty(event, 'defaultPrevented', {
                configurable: true,
                get: () => preventedByConsumer,
              });
              queueMicrotask(() => {
                event.preventDefault = preventDefault;
                Reflect.deleteProperty(event, 'defaultPrevented');
                if (!preventedByConsumer) defaultFormSubmitter(form)?.click();
              });
            } else if (!state.disabled && !state.readOnly) {
              if (!props.nativeButton && (event.key === ' ' || event.key === 'Enter')) {
                event.preventDefault();
                const target = input();
                if (target) {
                  const View = target.ownerDocument.defaultView!;
                  const ClickEvent = View.PointerEvent ?? View.MouseEvent;
                  target.dispatchEvent(new ClickEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    shiftKey: event.shiftKey,
                    ctrlKey: event.ctrlKey,
                    altKey: event.altKey,
                    metaKey: event.metaKey,
                  }));
                }
              }
            }
          },
        }),
      )}
      <input {...inputProps} />
      <Show when={props.uncheckedValue !== undefined && Boolean(props.name ?? field?.props.name) && !checked()}>
        <input
          type="hidden"
          name={props.name ?? field?.props.name}
          form={props.form}
          value={props.uncheckedValue}
          disabled={state.disabled}
        />
      </Show>
    </>
  );
  return kind === 'checkbox'
    ? <CheckboxContext value={{ checked, state }}>{content()}</CheckboxContext>
    : <SwitchRootContext value={state}>{content()}</SwitchRootContext>;
}
export function CheckboxRoot(props: CheckboxRootProps) {
  return CheckControl(props, 'checkbox');
}
export namespace CheckboxRoot {
  export type Props = CheckboxRootProps;
  export type State = CheckboxRootState;
  export type ChangeEventDetails = ChangeDetails;
}
export function CheckboxIndicator(props: BaseProps<CheckboxRootState> & { keepMounted?: boolean }) {
  const context = useContext(CheckboxContext);
  if (!context) {
    throw new Error(
      'Base UI: CheckboxRootContext is missing. Checkbox parts must be placed within <Checkbox.Root>.',
    );
  }
  const rendered = () => context.checked() || context.state.indeterminate;
  const [mounted, setMounted] = createSignal(untrack(rendered));
  const [transitionStatus, setTransitionStatus] = createSignal<'idle' | 'starting' | 'ending'>('idle');
  let element: HTMLSpanElement | undefined;
  let initialized = false;
  let frame = 0;
  let exitBatch: Set<() => void> | undefined;
  const finishExit = () => {
    if (transitionStatus() !== 'ending') return;
    exitBatch?.delete(finishExit);
    setTransitionStatus('idle');
    setMounted(false);
  };
  const finishExitBatch = () => {
    for (const finish of [...exitBatch ?? []]) finish();
  };
  createEffect(rendered, (visible) => {
    if (!initialized) {
      initialized = true;
      return;
    }
    cancelAnimationFrame(frame);
    if (visible) {
      exitBatch?.delete(finishExit);
      setMounted(true);
      setTransitionStatus('starting');
      frame = requestAnimationFrame(() => {
        // Establish the starting style before the attribute is removed.
        if (element) void element.offsetWidth;
        setTransitionStatus('idle');
      });
    } else {
      exitBatch = checkboxIndicatorExitBatch();
      exitBatch.add(finishExit);
      setTransitionStatus('ending');
      frame = requestAnimationFrame(() => {
        if (!element) return finishExit();
        const style = getComputedStyle(element);
        const hasAnimation = style.animationName !== 'none' && style.animationDuration !== '0s';
        const hasTransition = style.transitionProperty !== 'all' &&
          style.transitionProperty !== 'none' && style.transitionDuration !== '0s';
        if (!hasAnimation && !hasTransition) finishExitBatch();
      });
    }
  });
  onCleanup(() => {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
    exitBatch?.delete(finishExit);
  });
  const indicatorProps = omitProps(props, ['ref', 'onAnimationEnd', 'onTransitionEnd']);
  return (
    <Show when={props.keepMounted || mounted()}>
      {renderElement('span', indicatorProps, context.state, {
        ref: (node: HTMLSpanElement) => {
          element = node;
          assignRef(props.ref, node);
        },
        get 'data-starting-style'() {
          return transitionStatus() === 'starting' ? '' : undefined;
        },
        get 'data-ending-style'() {
          return transitionStatus() === 'ending' ? '' : undefined;
        },
        onAnimationEnd: (event: AnimationEvent) => {
          props.onAnimationEnd?.(event);
          if (event.target === element) finishExitBatch();
        },
        onTransitionEnd: (event: TransitionEvent) => {
          props.onTransitionEnd?.(event);
          if (event.target === element) finishExitBatch();
        },
      })}
    </Show>
  );
}
export namespace CheckboxIndicator {
  export type Props = BaseProps<CheckboxRootState> & { keepMounted?: boolean };
}
export const Checkbox = { Root: CheckboxRoot, Indicator: CheckboxIndicator };
export type SwitchRootProps = CheckboxRootProps;
export function SwitchRoot(props: SwitchRootProps) {
  return CheckControl(props, 'switch');
}
export namespace SwitchRoot {
  export type Props = SwitchRootProps;
  export type State = CheckboxRootState;
  export type ChangeEventDetails = ChangeDetails;
}
export function SwitchThumb(props: BaseProps<SwitchRootContext>) {
  const context = useContext(SwitchRootContext);
  if (!context) {
    throw new Error(
      'Base UI: SwitchRootContext is missing. Switch parts must be placed within <Switch.Root>.',
    );
  }
  return renderElement('span', props, context, {
    'aria-hidden': true,
  });
}
export namespace SwitchThumb {
  export type Props = BaseProps<SwitchRootContext>;
}
export const Switch = { Root: SwitchRoot, Thumb: SwitchThumb };

export interface RadioGroupProps<Value = unknown> extends BaseProps<FieldRootState> {
  value?: Value;
  defaultValue?: Value;
  onValueChange?: Change<Value>;
  name?: string;
  form?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}
interface RadioGroupValue {
  props: RadioGroupProps;
  value: () => unknown;
  setValue: (value: unknown, event?: Event) => boolean;
  name: () => string;
  registerInput: (input: HTMLInputElement, root: HTMLElement, value: () => unknown,
    disabled: () => boolean) => () => void;
  roving: RovingGroup;
}
const RadioGroupContext = createContext<RadioGroupValue>();
const RadioContext = createContext<{ checked: () => boolean; state: Record<string, unknown> }>();
export function RadioGroup<Value = unknown>(props: RadioGroupProps<Value>) {
  const field = useContext(FieldContext);
  const form = useContext(FormContext);
  const fieldset = useContext(FieldsetContext);
  const direction = useDirection();
  const roving = createRovingGroup('[role="radio"]', true);
  const [value, setValue] = createControllable<Value | null | undefined>(
    props,
    'value',
    props.defaultValue ?? null,
  );
  const initialValue = untrack(value);
  const generatedName = createUniqueId();
  const name = () => field?.props.name ?? props.name ?? generatedName;
  const [inputs, setInputs] = createSignal<{
    input: HTMLInputElement; root: HTMLElement; value: () => unknown; disabled: () => boolean;
  }[]>([], { ownedWrite: true });
  let forwardedInput: HTMLInputElement | null = null;
  let forwardedRef: Ref<HTMLInputElement> | undefined;
  let detachedValue: unknown;
  let detached = false;
  const forwardInput = (input: HTMLInputElement | null, ref = props.inputRef) => {
    if (forwardedInput === input && forwardedRef === ref) return;
    if (forwardedRef && forwardedInput) assignRef(forwardedRef, null as any);
    forwardedInput = input;
    forwardedRef = ref;
    if (ref && input) assignRef(ref, input);
  };
  createEffect(
    () => ({ entries: inputs(), selectedValue: value(), ref: props.inputRef,
      disabled: inputs().map((entry) => entry.disabled() || entry.input.matches(':disabled')) }),
    ({ entries, selectedValue, ref }) => {
      const live = entries.filter((entry) => entry.input.isConnected &&
        !entry.disabled() && !entry.input.matches(':disabled'));
      if (forwardedInput && !live.some((entry) => entry.input === forwardedInput)) {
        forwardInput(null, ref);
        detached = true;
        detachedValue = selectedValue;
        return;
      }
      if (detached && Object.is(selectedValue, detachedValue)) return;
      detached = false;
      const selected = live.find((entry) => Object.is(entry.value(), selectedValue));
      forwardInput((selected ?? live[0])?.input ?? null, ref);
    },
  );
  onCleanup(() => forwardInput(null));
  const formValue = () => {
    if (!form) return value() ?? null;
    const selected = inputs().find((entry) =>
      Object.is(entry.value(), value()) && entry.input.checked &&
      isEligibleFieldControl(entry.input, form.element() ?? null));
    return selected ? value() ?? null : null;
  };
  createEffect(
    () => formValue,
    (source) => field?.bindValue(source),
  );
  let sawInitialValue = false;
  createEffect(value, (current) => {
    if (!sawInitialValue) {
      sawInitialValue = true;
      return;
    }
    field?.syncValue(current);
  });
  const unregisterFormValue = field?.bindFormValue(
    formValue,
    () => value() != null,
    () => !Object.is(value(), initialValue),
  );
  if (unregisterFormValue) onCleanup(unregisterFormValue);
  createEffect(
    () => field,
    (scope) => {
      scope?.setSuppressLabelFor(true);
      return () => scope?.setSuppressLabelFor(false);
    },
  );
  const context: RadioGroupValue = {
    props: props as RadioGroupProps,
    value,
    name,
    roving,
    setValue(next, event) {
      if (!setValue(next as Value, event, 'none')) return false;
      field?.change(next);
      field?.touch();
      return true;
    },
    registerInput(input, root, itemValue, disabled) {
      const entry = { input, root, value: itemValue, disabled };
      setInputs((previous) => [...previous, entry]);
      return () => setInputs((previous) => previous.filter((item) => item !== entry));
    },
  };
  const state = mergeProps(field?.state ?? defaultFieldState, {
    get disabled() { return Boolean(props.disabled || field?.state.disabled); },
    get readOnly() { return Boolean(props.readOnly); },
    get required() { return Boolean(props.required); },
  }) as FieldRootState & { readOnly: boolean; required: boolean } & Record<string, unknown>;
  return (
    <RadioGroupContext value={context}>
      {renderElement(
        'div',
        omitProps(props, ['value', 'defaultValue', 'name', 'form', 'disabled', 'readOnly',
          'required', 'inputRef', 'aria-describedby']),
        state,
        mergeProps(fieldAttributes(field, () => props['aria-describedby']), {
          ref: roving.ref,
          role: 'radiogroup',
          'data-base-ui-roving-group': '',
          get 'aria-labelledby'() { return field?.labelId() ?? fieldset?.legendId(); },
          get 'aria-required'() {
            return props.required || undefined;
          },
          get 'aria-disabled'() {
            return state.disabled || undefined;
          },
          get 'aria-readonly'() {
            return props.readOnly || undefined;
          },
          onFocus() {
            field?.focus(true);
          },
          onBlur(event: FocusEvent) {
            const target = event.currentTarget as HTMLElement;
            if (!contains(target, event.relatedTarget as Node | null)) {
              field?.focus(false);
              field?.touch();
            }
          },
          onKeyDown(event: KeyboardEvent) {
            if (state.disabled || event.metaKey || event.ctrlKey || event.altKey) return;
            const before = activeElement(event.currentTarget as HTMLElement);
            const enabled = (event.currentTarget as HTMLElement)
              .querySelectorAll('[role="radio"]:not([aria-disabled="true"]):not([disabled])');
            if (enabled.length < 2) return;
            rove(
              event,
              '[role="radio"]:not([aria-disabled="true"]):not([disabled])',
              direction(),
              true,
              !props.readOnly,
            );
            if (activeElement(event.currentTarget as HTMLElement) !== before && !props.readOnly)
              roving.focus(activeElement(event.currentTarget as HTMLElement) as HTMLElement);
          },
        }),
      )}
    </RadioGroupContext>
  );
}
export namespace RadioGroup {
  export type Props<Value = unknown> = RadioGroupProps<Value>;
  export type ChangeEventDetails = ChangeDetails;
}
export interface RadioRootProps<Value = unknown> extends BaseProps {
  value: Value;
  disabled?: boolean;
  required?: boolean;
  readOnly?: boolean;
  nativeButton?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}
export function RadioRoot(props: RadioRootProps) {
  const group = useContext(RadioGroupContext);
  const field = useContext(FieldContext);
  const inheritedDisabled = useFieldsetDisabled();
  const generatedId = createUniqueId();
  const visibleId = createUniqueId();
  const inputId = () => props.id ?? (field?.labelScope === 'item' ? field.id : generatedId);
  createEffect(inputId, (id) => {
    if (field?.labelScope !== 'item') return;
    field.setControlId(id);
    return () => field.setControlId(field.id);
  });
  const [input, setInput] = createSignal<HTMLInputElement>();
  const [root, setRoot] = createSignal<HTMLElement>();
  let inputClickEvent: MouseEvent | undefined;
  const checked = () => Object.is(group?.value(), props.value);
  const labelledBy = useInputLabels(input, inputId);
  const disabled = () =>
    Boolean(
      props.disabled || group?.props.disabled || field?.state.disabled || inheritedDisabled(),
    );
  const state = mergeProps(field?.state ?? defaultFieldState, {
    get checked() {
      return checked();
    },
    get disabled() {
      return disabled();
    },
    get readOnly() {
      return Boolean(props.readOnly || group?.props.readOnly);
    },
    get required() {
      return Boolean(props.required || group?.props.required);
    },
  }) as FieldRootState & { checked: boolean; readOnly: boolean; required: boolean } &
    Record<string, unknown>;
  const select = (event?: Event) => {
    if (!disabled() && !state.readOnly) group?.setValue(props.value, event);
  };
  createEffect(
    () => [input(), root()] as const,
    ([nativeInput, element]) => {
      if (!group || !nativeInput || !element) return;
      return group.registerInput(nativeInput, element, () => props.value, disabled);
    },
  );
  registerReset(input, () => {
    group?.setValue(group.props.defaultValue);
    field?.reset();
  });
  return (
    <RadioContext value={{ checked, state }}>
      {renderElement(
        'span',
        omitProps(props, ['id', 'value', 'disabled', 'required', 'readOnly', 'inputRef',
          'nativeButton', 'aria-describedby']),
        state,
        mergeProps(fieldAttributes(field, () => props['aria-describedby']), {
          ref: setRoot,
          get type() {
            return props.nativeButton ? 'button' : undefined;
          },
          role: 'radio',
          get id() {
            return props.nativeButton ? inputId() : visibleId;
          },
          get disabled() {
            return props.nativeButton ? disabled() : undefined;
          },
          get 'aria-disabled'() {
            return disabled() || undefined;
          },
          get 'aria-checked'() {
            return checked();
          },
          get 'aria-readonly'() {
            return state.readOnly || undefined;
          },
          get 'aria-required'() {
            return state.required || undefined;
          },
          get tabIndex() {
            return disabled() ? -1 : group.roving.tabStop() === root() ? 0 : -1;
          },
          onFocus() {
            group.roving.focus(root());
          },
          get 'aria-labelledby'() {
            return field?.labelId() ?? labelledBy();
          },
          get 'data-checked'() { return checked() ? '' : undefined; },
          get 'data-unchecked'() {
            return checked() ? undefined : '';
          },
          onClick(event: MouseEvent) {
            if (!disabled() && !state.readOnly) {
              event.preventDefault();
              const target = input();
              if (target) {
                inputClickEvent = event;
                const View = target.ownerDocument.defaultView!;
                const ClickEvent = View.PointerEvent ?? View.MouseEvent;
                target.dispatchEvent(new ClickEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  composed: true,
                  detail: event.detail,
                  shiftKey: event.shiftKey,
                  ctrlKey: event.ctrlKey,
                  altKey: event.altKey,
                  metaKey: event.metaKey,
                }));
                inputClickEvent = undefined;
              }
            }
          },
          onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Enter') event.preventDefault();
            if (event.key === ' ' && !disabled() && !state.readOnly) {
              event.preventDefault();
            }
          },
          onKeyUp(event: KeyboardEvent) {
            if (event.key === ' ' && !disabled() && !state.readOnly) {
              event.preventDefault();
              root()?.click();
            }
          },
        }),
      )}
      <input
        type="radio"
        ref={(element) => {
          setInput(element);
          assignRef(props.inputRef, element);
          field?.register(element, group?.value() ?? props.value, root());
        }}
        style={hiddenStyle}
        id={props.nativeButton ? undefined : inputId()}
        name={group?.name()}
        form={group?.props.form}
        value={props.value === undefined ? undefined : String(props.value)}
        checked={checked()}
        disabled={disabled()}
        required={state.required}
        readonly={state.readOnly}
        tabindex={-1}
        aria-hidden="true"
        onClick={(event) => event.stopPropagation()}
        onFocus={() => root()?.focus()}
        onChange={(event) => {
          select(inputClickEvent ?? event);
          event.currentTarget.checked = checked();
        }}
      />
    </RadioContext>
  );
}
export namespace RadioRoot {
  export type Props = RadioRootProps;
}
export function RadioIndicator(props: BaseProps & { keepMounted?: boolean }) {
  const context = useContext(RadioContext);
  return (
    <Show when={props.keepMounted || context?.checked()}>
      {renderElement('span', props, context?.state, {
        'aria-hidden': true,
        get hidden() {
          return !context?.checked();
        },
      })}
    </Show>
  );
}
export namespace RadioIndicator {
  export type Props = BaseProps & { keepMounted?: boolean };
}
export const Radio = { Root: RadioRoot, Indicator: RadioIndicator };

interface RovingGroup {
  ref: (element: HTMLElement) => void;
  tabStop: () => HTMLElement | undefined;
  focus: (element: HTMLElement | undefined) => void;
}

function belongsToRovingGroup(element: HTMLElement, container: HTMLElement) {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (parent.hasAttribute('data-base-ui-roving-group')) return parent === container;
  }
  return false;
}

function createRovingGroup(selector: string, preferSelected: boolean): RovingGroup {
  const [root, setRoot] = createSignal<HTMLElement>();
  const [tabStop, setTabStop] = createSignal<HTMLElement>();
  const enabled = (element: HTMLElement) =>
    !element.matches(':disabled') &&
    element.getAttribute('aria-disabled') !== 'true' &&
    !element.hidden;

  createEffect(root, (container) => {
    if (!container) return;
    const refresh = () => {
      const candidates = Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
        (element) => belongsToRovingGroup(element, container) && enabled(element),
      );
      const selected = candidates.find(
        (element) =>
          element.getAttribute('aria-checked') === 'true' ||
          element.getAttribute('aria-pressed') === 'true',
      );
      const previous = untrack(tabStop);
      const next =
        preferSelected && selected
          ? selected
          : previous && candidates.includes(previous)
            ? previous
            : (selected ?? candidates[0]);
      if (next !== previous) setTabStop(next);
    };
    refresh();
    const Observer = container.ownerDocument.defaultView?.MutationObserver;
    if (!Observer) return;
    const observer = new Observer(refresh);
    observer.observe(container, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['disabled', 'aria-disabled', 'aria-checked', 'aria-pressed', 'hidden'],
    });
    return () => observer.disconnect();
  });
  return {
    ref: setRoot,
    tabStop,
    focus(element) {
      if (element && enabled(element) && contains(root(), element)) setTabStop(element);
    },
  };
}

function rove(
  event: KeyboardEvent,
  selector: string,
  direction: 'ltr' | 'rtl',
  loop: boolean,
  select = false,
  orientation?: Orientation,
) {
  const horizontal = orientation !== 'vertical';
  const vertical = orientation !== 'horizontal';
  let offset = 0;
  if (horizontal && event.key === 'ArrowRight') offset = direction === 'rtl' ? -1 : 1;
  if (horizontal && event.key === 'ArrowLeft') offset = direction === 'rtl' ? 1 : -1;
  if (vertical && event.key === 'ArrowDown') offset = 1;
  if (vertical && event.key === 'ArrowUp') offset = -1;
  if (!offset && event.key !== 'Home' && event.key !== 'End') return;
  const root = event.currentTarget as HTMLElement;
  const items = Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
    (element) => belongsToRovingGroup(element, root) && !element.hidden,
  );
  const current = items.findIndex(
    (item) => item === activeElement(root) || contains(item, activeElement(root)),
  );
  if (!items.length || current === -1) return;
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : loop
          ? (current + offset + items.length) % items.length
          : clamp(current + offset, 0, items.length - 1);
  event.preventDefault();
  items[next].focus();
  if (select) items[next].click();
}
export interface ToggleGroupProps<Value extends string = string> extends BaseProps {
  value?: readonly Value[];
  defaultValue?: readonly Value[];
  onValueChange?: Change<readonly Value[]>;
  disabled?: boolean;
  multiple?: boolean;
  orientation?: Orientation;
  loopFocus?: boolean;
}
interface ToggleGroupValue {
  props: ToggleGroupProps;
  value: () => readonly string[];
  toggle: (value: string, pressed: boolean, details: ChangeDetails) => void;
  roving: RovingGroup;
}
const ToggleGroupContext = createContext<ToggleGroupValue | null>(null);
export function ToggleGroup<Value extends string = string>(props: ToggleGroupProps<Value>) {
  const direction = useDirection();
  const roving = createRovingGroup('[data-toggle]', false);
  const [internalValue, setValue] = createSignal<readonly Value[]>(
    () => untrack(() => props.defaultValue ?? []),
  );
  const value = () => props.value ?? internalValue();
  const context: ToggleGroupValue = {
    props: props as unknown as ToggleGroupProps,
    value,
    roving,
    toggle(item, nextPressed, details) {
      const next = props.multiple
        ? nextPressed
          ? [...value(), item as Value]
          : value().filter((entry) => entry !== item)
        : nextPressed
          ? [item as Value]
          : [];
      props.onValueChange?.(next, details);
      if (!details.isCanceled && props.value === undefined) setValue(() => next);
    },
  };
  const state = {
    get disabled() {
      return Boolean(props.disabled);
    },
    get multiple() {
      return Boolean(props.multiple);
    },
    get orientation() {
      return props.orientation ?? 'horizontal';
    },
  };
  return (
    <ToggleGroupContext value={context}>
      {renderElement('div', props, state, {
        ref: roving.ref,
        role: 'group',
        'data-base-ui-roving-group': '',
        get 'aria-orientation'() {
          return props.orientation ?? 'horizontal';
        },
        onKeyDown(event: KeyboardEvent) {
          rove(
            event,
            '[data-toggle]:not([disabled])',
            direction(),
            props.loopFocus !== false,
            false,
            props.orientation ?? 'horizontal',
          );
        },
      })}
    </ToggleGroupContext>
  );
}
export namespace ToggleGroup {
  export type Props<Value extends string = string> = ToggleGroupProps<Value>;
  export type ChangeEventDetails = ChangeDetails;
}
export interface ToggleProps<Value extends string = string> extends ButtonProps {
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: Change<boolean>;
  value?: Value;
}
export function Toggle<Value extends string = string>(props: ToggleProps<Value>) {
  const group = useContext(ToggleGroupContext);
  const [root, setRoot] = createSignal<HTMLElement>();
  const [pressed, setPressed] = createControllable(props, 'pressed', props.defaultPressed ?? false);
  const state = {
    get pressed() {
      return group && props.value !== undefined ? group.value().includes(props.value) : pressed();
    },
    get disabled() {
      return Boolean(props.disabled || group?.props.disabled);
    },
  };
  return renderElement('button', omitProps(props, ['disabled', 'form', 'type']), state, {
    ref: setRoot,
    type: 'button',
    'data-toggle': '',
    get disabled() {
      return state.disabled;
    },
    get tabIndex() {
      return group ? (state.disabled || group.roving.tabStop() !== root() ? -1 : 0) : undefined;
    },
    onFocus() {
      group?.roving.focus(root());
    },
    get 'aria-pressed'() {
      return state.pressed;
    },
    get 'data-state'() {
      return state.pressed ? 'on' : 'off';
    },
    onClick(event: MouseEvent) {
      if (!state.disabled) {
        group?.roving.focus(root());
        if (group && props.value !== undefined) {
          const nextPressed = !state.pressed;
          const details = eventDetails(event, 'none');
          props.onPressedChange?.(nextPressed, details);
          if (!details.isCanceled) group.toggle(props.value, nextPressed, details);
        } else setPressed(!pressed(), event, 'none');
      }
    },
    onKeyDown(event: KeyboardEvent) {
      if (props.nativeButton === false && (event.key === ' ' || event.key === 'Enter')) {
        event.preventDefault();
        if (!state.disabled) (event.currentTarget as HTMLElement).click();
      }
    },
  });
}
export namespace Toggle {
  export type Props<Value extends string = string> = ToggleProps<Value>;
  export type State = { pressed: boolean; disabled: boolean };
  export type ChangeEventDetails = ChangeDetails;
}

export interface NumberFieldRootState extends FieldRootState {
  value: number | null;
  inputValue: string;
  required: boolean;
  readOnly: boolean;
  scrubbing: boolean;
}
export interface NumberFieldRootProps extends BaseProps<NumberFieldRootState> {
  value?: number | null;
  defaultValue?: number;
  onValueChange?: Change<number | null>;
  onValueCommitted?: Change<number | null>;
  min?: number;
  max?: number;
  step?: number | 'any';
  smallStep?: number;
  largeStep?: number;
  allowOutOfRange?: boolean;
  snapOnStep?: boolean;
  allowWheelScrub?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  name?: string;
  form?: string;
  format?: Intl.NumberFormatOptions;
  locale?: Intl.LocalesArgument;
  inputRef?: Ref<HTMLInputElement>;
}
interface NumberContextValue {
  props: NumberFieldRootProps;
  state: NumberFieldRootState;
  value: () => number | null;
  text: () => string;
  setText: (value: string) => void;
  input: () => HTMLInputElement | undefined;
  setInput: (element: HTMLInputElement) => void;
  setValue: (value: number | null, event?: Event, reason?: string) => boolean;
  increment: (amount: number, event?: Event, reason?: string) => number | undefined;
  commit: (event?: Event, reason?: string) => void;
  step: (event?: Pick<KeyboardEvent, 'shiftKey' | 'altKey'>) => number;
  parse: (text: string) => number | null;
  format: (value: number | null) => string;
  setScrubbing: (value: boolean) => void;
}
const NumberContext = createContext<NumberContextValue>();
function parseNumber(
  text: string,
  locale?: Intl.LocalesArgument,
  options?: Intl.NumberFormatOptions,
): number | null {
  if (!text.trim()) return null;
  const formatter = new Intl.NumberFormat(locale, options);
  const parts = formatter.formatToParts(-12345.6);
  const group = parts.find((part) => part.type === 'group')?.value;
  const decimal = parts.find((part) => part.type === 'decimal')?.value ?? '.';
  const minus = parts.find((part) => part.type === 'minusSign')?.value ?? '-';
  let normalized = text;
  const digitFormatter = new Intl.NumberFormat(locale, { useGrouping: false });
  for (let digit = 0; digit < 10; digit++)
    normalized = normalized.split(digitFormatter.format(digit)).join(String(digit));
  if (group) normalized = normalized.split(group).join('');
  normalized = normalized.split(decimal).join('.').split(minus).join('-');
  for (const part of parts)
    if (['currency', 'percentSign', 'unit', 'literal'].includes(part.type))
      normalized = normalized.split(part.value).join('');
  normalized = normalized.replace(/[\s\u200e\u200f\u061c]/g, '');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)) return Number.NaN;
  return Number(normalized) / (options?.style === 'percent' ? 100 : 1);
}
function roundStep(value: number, step: number, min: number) {
  if (!step || !Number.isFinite(step)) return value;
  const rounded = Math.round((value - min) / step) * step + min;
  return Number(rounded.toPrecision(14));
}
export function NumberFieldRoot(props: NumberFieldRootProps) {
  const field = useContext(FieldContext);
  const inheritedDisabled = useFieldsetDisabled();
  const [value, setValue] = createControllable<number | null>(
    props,
    'value',
    props.defaultValue ?? null,
  );
  bindFieldValue(field, value);
  const format = (value: number | null) =>
    value === null ? '' : new Intl.NumberFormat(props.locale, props.format).format(value);
  const [text, setText] = createSignal(untrack(() => format(value())));
  const [input, setInput] = createSignal<HTMLInputElement>();
  const [hidden, setHidden] = createSignal<HTMLInputElement>();
  const [scrubbing, setScrubbing] = createSignal(false);
  createEffect(
    () => [value(), props.locale, props.format] as const,
    ([next]) => {
      setText(format(next));
    },
  );
  const state = mergeProps(
    field?.state ?? { touched: false, dirty: false, valid: null, filled: false, focused: false },
    {
      get value() {
        return value();
      },
      get inputValue() {
        return text();
      },
      get disabled() {
        return Boolean(props.disabled || field?.state.disabled || inheritedDisabled());
      },
      get readOnly() {
        return Boolean(props.readOnly);
      },
      get required() {
        return Boolean(props.required);
      },
      get scrubbing() {
        return scrubbing();
      },
    },
  ) as NumberFieldRootState;
  const write: NumberContextValue['setValue'] = (next, event, reason = 'input-change') => {
    if (state.disabled || state.readOnly || (next !== null && !Number.isFinite(next))) return false;
    const bounded =
      next === null || props.allowOutOfRange
        ? next
        : clamp(next, props.min ?? -Infinity, props.max ?? Infinity);
    const changed = setValue(bounded, event, reason);
    if (changed) field?.change(bounded);
    return changed;
  };
  const context: NumberContextValue = {
    props,
    state,
    value,
    text,
    setText,
    input,
    setInput,
    setValue: write,
    setScrubbing,
    format,
    parse: (text) => parseNumber(text, props.locale, props.format),
    step(event) {
      return event?.shiftKey
        ? (props.largeStep ?? 10)
        : event?.altKey
          ? (props.smallStep ?? 0.1)
          : props.step === 'any'
            ? 1
            : (props.step ?? 1);
    },
    increment(amount, event, reason = 'increment-press') {
      const current = value() ?? (props.min !== undefined ? props.min - amount : 0);
      const next =
        !props.snapOnStep || props.step === 'any'
          ? Number((current + amount).toPrecision(14))
          : roundStep(current + amount, Math.abs(amount), props.min ?? 0);
      const accepted = props.allowOutOfRange
        ? next
        : clamp(next, props.min ?? -Infinity, props.max ?? Infinity);
      const changed = write(next, event, reason);
      setText(format(value()));
      return changed ? accepted : undefined;
    },
    commit(event, reason = 'input-blur') {
      const parsed = context.parse(text());
      if (parsed === null || Number.isFinite(parsed)) {
        const next =
          parsed === null ? null : clamp(parsed, props.min ?? -Infinity, props.max ?? Infinity);
        write(next, event, reason);
      }
      setText(format(value()));
      props.onValueCommitted?.(value(), eventDetails(event, reason));
    },
  };
  registerReset(hidden, () => {
    setValue(props.defaultValue ?? null);
    setText(format(props.defaultValue ?? null));
    field?.reset();
  });
  return (
    <NumberContext value={context}>
      {renderElement('div', omitProps(props, ['children', 'id']), state, {
        get children() {
          return (
            <>
              {props.children}
              <input
                type="hidden"
                ref={setHidden}
                value={value() ?? ''}
                name={props.name ?? field?.props.name}
                form={props.form}
                disabled={state.disabled}
              />
            </>
          );
        },
      })}
    </NumberContext>
  );
}
export namespace NumberFieldRoot {
  export type Props = NumberFieldRootProps;
  export type State = NumberFieldRootState;
  export type ChangeEventDetails = ChangeDetails;
  export type CommitEventDetails = ChangeDetails;
}
export function NumberFieldInput(props: BaseProps<NumberFieldRootState>) {
  const context = useContext(NumberContext)!;
  const field = useContext(FieldContext);
  return renderElement(
    'input',
    props,
    context.state,
    mergeProps(fieldAttributes(field), controlEvents(field), {
      type: 'text',
      inputMode: 'decimal',
      autoComplete: 'off',
      'aria-roledescription': 'Number field',
      get id() {
        return props.id ?? context.props.id ?? field?.id;
      },
      get value() {
        return context.text();
      },
      get disabled() {
        return context.state.disabled;
      },
      get readOnly() {
        return context.state.readOnly;
      },
      get required() {
        return context.state.required;
      },
      ref(element: HTMLInputElement) {
        context.setInput(element);
        assignRef(context.props.inputRef, element);
        field?.register(element, context.value());
      },
      onInput(event: InputEvent) {
        const text = (event.currentTarget as HTMLInputElement).value;
        context.setText(text);
        const parsed = context.parse(text);
        if (parsed === null || Number.isFinite(parsed)) context.setValue(parsed, event);
      },
      onBlur(event: FocusEvent) {
        context.commit(event);
      },
      onKeyDown(event: KeyboardEvent) {
        if (context.state.disabled || context.state.readOnly) return;
        if (event.key === 'Enter') context.commit(event, 'input-commit');
        else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          event.stopPropagation();
          const multiplier = event.key.includes('Up') ? 1 : -1;
          const committed = context.increment(multiplier * context.step(event), event, 'keyboard');
          if (committed !== undefined)
            context.props.onValueCommitted?.(committed, eventDetails(event, 'keyboard'));
        } else if (event.key === 'Home' && context.props.min !== undefined) {
          event.preventDefault();
          event.stopPropagation();
          if (context.setValue(context.props.min, event, 'keyboard'))
            context.props.onValueCommitted?.(context.props.min, eventDetails(event, 'keyboard'));
        } else if (event.key === 'End' && context.props.max !== undefined) {
          event.preventDefault();
          event.stopPropagation();
          if (context.setValue(context.props.max, event, 'keyboard'))
            context.props.onValueCommitted?.(context.props.max, eventDetails(event, 'keyboard'));
        }
      },
      onWheel(event: WheelEvent) {
        if (
          context.props.allowWheelScrub &&
          !context.state.disabled &&
          !context.state.readOnly &&
          activeElement(event.currentTarget as HTMLElement) === event.currentTarget
        ) {
          event.preventDefault();
          context.increment(event.deltaY < 0 ? context.step() : -context.step(), event, 'wheel');
        }
      },
    }),
  );
}
export namespace NumberFieldInput {
  export type Props = BaseProps<NumberFieldRootState>;
}
export function NumberFieldGroup(props: BaseProps<NumberFieldRootState>) {
  return renderElement('div', props, useContext(NumberContext)?.state ?? {}, { role: 'group' });
}
export namespace NumberFieldGroup {
  export type Props = BaseProps<NumberFieldRootState>;
}
function NumberStepper(props: BaseProps<NumberFieldRootState>, direction: number) {
  const context = useContext(NumberContext)!;
  const timer = useTimeout();
  let held = false;
  let repeated = false;
  function repeat() {
    if (!held) return;
    repeated = true;
    context.increment(
      direction * context.step(),
      undefined,
      direction > 0 ? 'increment-press' : 'decrement-press',
    );
    timer.start(60, repeat);
  }
  const disabled = () =>
    props.disabled ||
    context.state.disabled ||
    context.state.readOnly ||
    (context.value() !== null &&
      (direction > 0
        ? context.value()! >= (context.props.max ?? Infinity)
        : context.value()! <= (context.props.min ?? -Infinity)));
  return renderElement('button', omitProps(props, ['disabled']), context.state, {
    type: 'button',
    tabIndex: -1,
    get disabled() {
      return disabled();
    },
    'aria-label': direction > 0 ? 'Increase' : 'Decrease',
    onPointerDown(event: PointerEvent) {
      if (event.button !== 0 || disabled()) return;
      held = true;
      repeated = false;
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
      timer.start(400, repeat);
    },
    onPointerUp(event: PointerEvent) {
      held = false;
      timer.clear();
      if (repeated) context.commit(event, 'press');
    },
    onPointerCancel() {
      held = false;
      timer.clear();
    },
    onClick(event: MouseEvent) {
      if (disabled()) return;
      if (!repeated) {
        context.increment(
          direction * context.step(event),
          event,
          direction > 0 ? 'increment-press' : 'decrement-press',
        );
        context.props.onValueCommitted?.(context.value(), eventDetails(event, 'press'));
      }
      repeated = false;
      context.input()?.focus();
    },
  });
}
export function NumberFieldIncrement(props: BaseProps<NumberFieldRootState>) {
  return NumberStepper(props, 1);
}
export namespace NumberFieldIncrement {
  export type Props = BaseProps<NumberFieldRootState>;
}
export function NumberFieldDecrement(props: BaseProps<NumberFieldRootState>) {
  return NumberStepper(props, -1);
}
export namespace NumberFieldDecrement {
  export type Props = BaseProps<NumberFieldRootState>;
}
const ScrubContext = createContext<{ x: () => number; y: () => number; active: () => boolean }>();
export function NumberFieldScrubArea(
  props: BaseProps<NumberFieldRootState> & {
    direction?: Orientation;
    pixelSensitivity?: number;
    teleportDistance?: number;
  },
) {
  const context = useContext(NumberContext)!;
  const [x, setX] = createSignal(0);
  const [y, setY] = createSignal(0);
  const [active, setActive] = createSignal(false);
  let last = 0;
  let remainder = 0;
  const finish = (event: PointerEvent) => {
    if (!active()) return;
    setActive(false);
    context.setScrubbing(false);
    context.props.onValueCommitted?.(context.value(), eventDetails(event, 'scrub'));
  };
  return (
    <ScrubContext value={{ x, y, active }}>
      {renderElement('span', props, context.state, {
        style: { 'touch-action': 'none', 'user-select': 'none', '-webkit-user-select': 'none' },
        onPointerDown(event: PointerEvent) {
          if (event.button !== 0 || context.state.disabled || context.state.readOnly) return;
          event.preventDefault();
          setX(event.clientX);
          setY(event.clientY);
          last = props.direction === 'vertical' ? -event.clientY : event.clientX;
          remainder = 0;
          setActive(true);
          context.setScrubbing(true);
          (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
        },
        onPointerMove(event: PointerEvent) {
          if (!active()) return;
          setX(event.clientX);
          setY(event.clientY);
          const position = props.direction === 'vertical' ? -event.clientY : event.clientX;
          remainder += position - last;
          last = position;
          const pixels = props.pixelSensitivity ?? 2;
          const steps = Math.trunc(remainder / pixels);
          if (steps) {
            remainder -= steps * pixels;
            context.increment(steps * context.step(event), event, 'scrub');
          }
        },
        onPointerUp: finish,
        onPointerCancel: finish,
      })}
    </ScrubContext>
  );
}
export namespace NumberFieldScrubArea {
  export type Props = BaseProps<NumberFieldRootState> & {
    direction?: Orientation;
    pixelSensitivity?: number;
    teleportDistance?: number;
  };
}
export function NumberFieldScrubAreaCursor(props: BaseProps<NumberFieldRootState>) {
  const context = useContext(NumberContext)!;
  const scrub = useContext(ScrubContext);
  return (
    <Show when={scrub?.active()}>
      {renderElement('span', props, context.state, {
        'aria-hidden': true,
        get style() {
          return {
            position: 'fixed',
            left: `${scrub?.x()}px`,
            top: `${scrub?.y()}px`,
            'pointer-events': 'none',
          };
        },
      })}
    </Show>
  );
}
export namespace NumberFieldScrubAreaCursor {
  export type Props = BaseProps<NumberFieldRootState>;
}
export const NumberField = {
  Root: NumberFieldRoot,
  Group: NumberFieldGroup,
  Input: NumberFieldInput,
  Increment: NumberFieldIncrement,
  Decrement: NumberFieldDecrement,
  ScrubArea: NumberFieldScrubArea,
  ScrubAreaCursor: NumberFieldScrubAreaCursor,
};

export interface SliderRootState extends FieldRootState {
  activeThumbIndex: number;
  dragging: boolean;
  min: number;
  max: number;
  minStepsBetweenValues: number;
  orientation: Orientation;
  step: number;
  values: readonly number[];
}
export interface SliderRootProps<
  Value extends number | readonly number[] = number | readonly number[],
> extends BaseProps<SliderRootState> {
  value?: Value;
  defaultValue?: Value;
  onValueChange?: Change<Value>;
  onValueCommitted?: Change<Value>;
  min?: number;
  max?: number;
  step?: number;
  largeStep?: number;
  minStepsBetweenValues?: number;
  thumbAlignment?: 'center' | 'edge' | 'edge-client-only';
  thumbCollisionBehavior?: 'push' | 'swap' | 'none';
  disabled?: boolean;
  orientation?: Orientation;
  name?: string;
  form?: string;
  format?: Intl.NumberFormatOptions;
  locale?: Intl.LocalesArgument;
}
interface SliderContextValue {
  props: SliderRootProps;
  state: SliderRootState;
  rootId: () => string;
  values: () => readonly number[];
  control: () => HTMLElement | undefined;
  setControl: (element: HTMLElement) => void;
  setValue: (value: number, index: number, event?: Event, reason?: string) => boolean;
  appliedValue: () => number | readonly number[] | undefined;
  commit: (event?: Event, reason?: string, value?: number | readonly number[]) => void;
  active: () => number;
  setActive: (index: number) => void;
  setDragging: (dragging: boolean) => void;
  labelId: () => string | undefined;
  setLabelId: (id: string | undefined) => void;
  percent: (value: number) => number;
  indicatorPosition: () => readonly (number | undefined)[];
  setIndicatorPosition: (index: number, position: number | undefined) => void;
  thumbCount: number;
  thumbs: Map<number, HTMLInputElement>;
}
const SliderContext = createContext<SliderContextValue>();
export function SliderRoot<Value extends number | readonly number[]>(
  props: SliderRootProps<Value>,
) {
  createEffect(
    () => [props.min ?? 0, props.max ?? 100] as const,
    ([min, max]) => {
      if (process.env.NODE_ENV !== 'production' && min >= max)
        console.warn('Base UI: Slider `max` must be greater than `min`.');
    },
  );
  const field = useContext(FieldContext);
  const inheritedDisabled = useFieldsetDisabled();
  const generatedId = createUniqueId();
  const [active, setActive] = createSignal(-1);
  const [dragging, setDragging] = createSignal(false);
  const [value, setValue] = createControllable<number | readonly number[]>(
    {
      get value() {
        return props.value;
      },
      get defaultValue() {
        return props.defaultValue ?? props.min;
      },
      onValueChange(value: Value, details: ChangeDetails) {
        Object.assign(details, { activeThumbIndex: active() });
        const nativeEvent = details.event;
        const Constructor = nativeEvent.constructor as new (type: string, init: Event) => Event;
        const clonedEvent = new Constructor(nativeEvent.type, nativeEvent);
        Object.defineProperty(clonedEvent, 'target', {
          configurable: true,
          value: { name: props.name ?? field?.props.name, value },
        });
        details.event = clonedEvent;
        props.onValueChange?.(value, details);
      },
    },
    'value',
    0,
  );
  const values = createMemo(() => {
    const current = value();
    const min = props.min ?? 0;
    const max = props.max ?? 100;
    return Array.isArray(current)
      ? (current as readonly number[]).map((item) => clamp(item, min, max)).sort((a, b) => a - b)
      : [clamp(current as number, min, max)];
  });
  bindFieldValue(field, value);
  if (field) {
    const initial = untrack(values).slice();
    onCleanup(field.bindFormValue(
      () => Array.isArray(value()) ? values() : values()[0],
      () => true,
      () => {
        const current = values();
        return current.length !== initial.length || current.some((item, index) => item !== initial[index]);
      },
    ));
  }
  const [control, setControl] = createSignal<HTMLElement>();
  let latestAppliedValue: number | readonly number[] | undefined;
  const [labelId, setLabelId] = createSignal<string>();
  const [indicatorPosition, updateIndicatorPosition] = createSignal<readonly (number | undefined)[]>([
    undefined,
    undefined,
  ]);
  const state = mergeProps(
    field?.state ?? { touched: false, dirty: false, valid: null, filled: false, focused: false },
    {
      get activeThumbIndex() {
        return active();
      },
      get disabled() {
        return Boolean(props.disabled || field?.state.disabled || inheritedDisabled());
      },
      get dragging() {
        return dragging();
      },
      get min() {
        return props.min ?? 0;
      },
      get max() {
        return props.max ?? 100;
      },
      get minStepsBetweenValues() {
        return props.minStepsBetweenValues ?? 0;
      },
      get orientation() {
        return props.orientation ?? 'horizontal';
      },
      get step() {
        return props.step ?? 1;
      },
      get values() {
        return values();
      },
    },
  ) as SliderRootState;
  const context: SliderContextValue = {
    props: props as unknown as SliderRootProps,
    state,
    rootId: () => props.id ?? generatedId,
    values,
    appliedValue: () => latestAppliedValue,
    active,
    setActive,
    setDragging,
    control,
    setControl,
    labelId: () => field?.labelId() ?? labelId(),
    setLabelId,
    indicatorPosition,
    setIndicatorPosition(index, position) {
      updateIndicatorPosition((previous) =>
        previous[index] === position
          ? previous
          : index === 0
            ? [position, previous[1]]
            : [previous[0], position],
      );
    },
    thumbCount: 0,
    thumbs: new Map(),
    percent: (value) =>
      state.max === state.min
        ? 0
        : clamp(((value - state.min) / (state.max - state.min)) * 100, 0, 100),
    setValue(next, index, event, reason = 'input-change') {
      if (state.disabled) return false;
      const current = values();
      next = clamp(reason === 'keyboard' ? next : roundValueToStep(next, state.step, state.min), state.min, state.max);
      const pointerChange = reason === 'track-press' || reason === 'drag';
      const result = pointerChange
        ? resolveThumbCollision(
            props.thumbCollisionBehavior ?? 'push',
            current,
            current,
            undefined,
            index,
            next,
            state.min,
            state.max,
            state.step,
            state.minStepsBetweenValues,
          )
        : {
            value: getSliderValue(next, index, state.min, state.max, current.length > 1, current),
            thumbIndex: index,
          };
      if (!pointerChange &&
          !validateMinimumDistance(result.value, state.step, state.minStepsBetweenValues)) return false;
      const output = result.value;
      const raw = value();
      const alreadyApplied = Array.isArray(output)
        ? output.every((entry, itemIndex) => entry === current[itemIndex])
        : output === current[0];
      const rawMatchesOutput = Array.isArray(output) && Array.isArray(raw)
        ? output.length === raw.length && output.every((entry, itemIndex) => entry === raw[itemIndex])
        : output === raw;
      if (alreadyApplied && rawMatchesOutput) return false;
      const priorIndex = active();
      setActive(result.thumbIndex);
      flush();
      const applied = setValue(output, event, reason);
      if (applied) {
        latestAppliedValue = output;
        field?.change(output);
      } else setActive(priorIndex);
      return applied;
    },
    commit(event, reason = 'none', committedValue) {
      props.onValueCommitted?.((committedValue ?? value()) as Value, eventDetails(event, reason));
    },
  };
  return (
    <SliderContext value={context}>
      {renderElement(
        'div',
        omitProps(props, ['id', 'aria-describedby']),
        state,
        mergeProps(fieldAttributes(field, () => props['aria-describedby']), {
          get id() {
            return props.id ?? generatedId;
          },
          get 'aria-labelledby'() {
            return props['aria-labelledby'] ?? field?.labelId() ?? labelId();
          },
          role: 'group',
        }),
      )}
    </SliderContext>
  );
}
export namespace SliderRoot {
  export type Props<Value extends number | readonly number[] = number | readonly number[]> =
    SliderRootProps<Value>;
  export type State = SliderRootState;
  export type ChangeEventDetails = ChangeDetails & { activeThumbIndex: number };
  export type CommitEventDetails = ChangeDetails;
}
export function SliderControl(props: BaseProps<SliderRootState>) {
  const context = useContext(SliderContext)!;
  const direction = useDirection();
  let dragIndex = -1;
  let touchId: number | null = null;
  let moveCount = 0;
  let interactionValue: number | readonly number[] | undefined;
  let interactionReason = 'track-press';
  function pointerValue(event: { clientX: number; clientY: number }) {
    const rect = context.control()!.getBoundingClientRect();
    const vertical = context.state.orientation === 'vertical';
    const ratio = vertical
      ? 1 - (event.clientY - rect.top) / rect.height
      : direction() === 'rtl'
        ? 1 - (event.clientX - rect.left) / rect.width
        : (event.clientX - rect.left) / rect.width;
    return context.state.min + clamp(ratio, 0, 1) * (context.state.max - context.state.min);
  }
  function stopListening() {
    const document = context.control()?.ownerDocument;
    document?.removeEventListener('pointermove', onPointerMove);
    document?.removeEventListener('pointerup', finish);
    document?.removeEventListener('touchmove', onTouchMove);
    document?.removeEventListener('touchend', onTouchEnd);
  }
  function finish(event: Event) {
    if (dragIndex < 0) return;
    context.setDragging(false);
    context.setActive(-1);
    if (interactionValue !== undefined)
      context.commit(event, interactionReason, interactionValue);
    dragIndex = -1;
    touchId = null;
    interactionValue = undefined;
    stopListening();
  }
  function applyPointer(coords: { clientX: number; clientY: number }, event: Event, reason: string) {
    if (dragIndex < 0 || context.state.disabled) return;
    if (context.setValue(pointerValue(coords), context.active() >= 0 ? context.active() : dragIndex,
      event, reason)) {
      interactionValue = context.appliedValue();
      interactionReason = reason;
      const before = dragIndex;
      dragIndex = context.active();
      if (dragIndex !== before)
        context.thumbs.get(dragIndex)?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
    }
  }
  function selectThumb(coords: { clientX: number; clientY: number }, target: EventTarget | null) {
    const control = context.control();
    const thumb = target instanceof Element ? target.closest('[data-index]') : null;
    const thumbIndex = thumb && control?.contains(thumb)
      ? Number(thumb.getAttribute('data-index')) : -1;
    const enabled = context.values().map((_, index) => index)
      .filter((index) => !context.thumbs.get(index)?.disabled);
    if (!enabled.length || thumbIndex >= 0 && !enabled.includes(thumbIndex)) return -1;
    if (thumbIndex >= 0) return thumbIndex;
    const targetValue = pointerValue(coords);
    return enabled.reduce((best, index) =>
      Math.abs(context.values()[index] - targetValue) <=
      Math.abs(context.values()[best] - targetValue) ? index : best);
  }
  function onPointerMove(event: PointerEvent) {
    if (dragIndex < 0) return;
    if (event.buttons === 0) {
      finish(event);
      return;
    }
    moveCount += 1;
    applyPointer(event, event, 'drag');
  }
  function touchFrom(event: TouchEvent) {
    return Array.from(event.changedTouches).find((touch) => touch.identifier === touchId);
  }
  function onTouchMove(event: TouchEvent) {
    const touch = touchFrom(event);
    if (!touch || dragIndex < 0) return;
    moveCount += 1;
    if (moveCount > 2) context.setDragging(true);
    applyPointer(touch, event, 'drag');
  }
  function onTouchEnd(event: TouchEvent) {
    if (touchFrom(event)) finish(event);
  }
  function onTouchStart(event: TouchEvent) {
    if (context.state.disabled || dragIndex >= 0) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    dragIndex = selectThumb(touch, event.target);
    if (dragIndex < 0) return;
    touchId = touch.identifier;
    moveCount = 0;
    interactionValue = undefined;
    interactionReason = 'track-press';
    context.setActive(dragIndex);
    context.thumbs.get(dragIndex)?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
    applyPointer(touch, event, 'track-press');
    const document = context.control()!.ownerDocument;
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
  }
  createEffect(context.control, (control) => {
    if (!control) return;
    control.addEventListener('touchstart', onTouchStart, { passive: true });
    return () => control.removeEventListener('touchstart', onTouchStart);
  });
  createEffect(() => context.state.disabled, (disabled) => {
    if (disabled) {
      dragIndex = -1;
      interactionValue = undefined;
      stopListening();
    }
  });
  onCleanup(stopListening);
  return renderElement('div', props, context.state, {
    ref: context.setControl,
    style: {
      position: 'relative',
      'touch-action': 'none',
      'user-select': 'none',
      '-webkit-user-select': 'none',
    },
    onPointerDown(event: PointerEvent) {
      if (context.state.disabled || event.button !== 0) return;
      event.preventDefault();
      const thumb = event.target instanceof Element ? event.target.closest('[data-index]') : null;
      const thumbIndex = thumb && (event.currentTarget as HTMLElement).contains(thumb)
        ? Number(thumb.getAttribute('data-index')) : -1;
      dragIndex = selectThumb(event, event.target);
      if (dragIndex < 0) return;
      context.setActive(dragIndex);
      context.setDragging(true);
      moveCount = 0;
      interactionValue = undefined;
      interactionReason = 'track-press';
      // The upstream tests dispatch pointer events through MouseEvent. Such an
      // event has no active pointer to capture, but the direct move path works.
      if (Number.isInteger(event.pointerId)) {
        try {
          (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
        } catch (error) {
          if (!(error instanceof DOMException) || error.name !== 'NotFoundError') throw error;
        }
      }
      if (thumbIndex < 0)
        applyPointer(event, event, 'track-press');
      context.thumbs.get(dragIndex)?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
      const document = (event.currentTarget as HTMLElement).ownerDocument;
      document.addEventListener('pointermove', onPointerMove, { passive: true });
      document.addEventListener('pointerup', finish, { once: true });
    },
    onPointerCancel: finish,
  });
}
export namespace SliderControl {
  export type Props = BaseProps<SliderRootState>;
}
export function SliderTrack(props: BaseProps<SliderRootState>) {
  return renderElement('div', props, useContext(SliderContext)?.state ?? {}, {
    style: { position: 'relative' },
  });
}
export namespace SliderTrack {
  export type Props = BaseProps<SliderRootState>;
}
export function SliderIndicator(props: BaseProps<SliderRootState>) {
  const context = useContext(SliderContext)!;
  return renderElement('div', props, context.state, {
    get style() {
      const values = context.values();
      const range = values.length > 1;
      const inset = context.props.thumbAlignment !== undefined && context.props.thumbAlignment !== 'center';
      const vertical = context.state.orientation === 'vertical';
      const measured = context.indicatorPosition();
      const start = inset ? measured[0] : context.percent(values[0]);
      const end = inset ? measured[1] : context.percent(values[values.length - 1]);
      const startValue = `${start ?? 0}%`;
      const sizeValue = `${(end ?? 0) - (start ?? 0)}%`;
      return {
        visibility: inset && (start === undefined || (range && end === undefined)) ? 'hidden' : undefined,
        position: vertical ? 'absolute' : 'relative',
        [vertical ? 'width' : 'height']: 'inherit',
        ...(inset ? { '--start-position': startValue } : {}),
        ...(inset && range ? { '--relative-size': sizeValue } : {}),
        [vertical ? 'bottom' : 'inset-inline-start']: range
          ? inset ? 'var(--start-position)' : startValue
          : '0',
        [vertical ? 'height' : 'width']: range
          ? inset ? 'var(--relative-size)' : sizeValue
          : inset ? 'var(--start-position)' : startValue,
      };
    },
  });
}
export namespace SliderIndicator {
  export type Props = BaseProps<SliderRootState>;
}
export interface ThumbMetadata {
  inputId: string | undefined;
}
export interface SliderThumbProps extends BaseProps<SliderRootState> {
  index?: number;
  disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  getAriaLabel?: (index: number) => string;
  getAriaValueText?: (formatted: string, value: number, index: number) => string;
}
export function SliderThumb(props: SliderThumbProps) {
  const context = useContext(SliderContext)!;
  const field = useContext(FieldContext);
  const direction = useDirection();
  const initialIndex = context.thumbCount++;
  const index = () => (context.values().length > 1 ? (props.index ?? initialIndex) : 0);
  const [input, setInput] = createSignal<HTMLInputElement>();
  const [thumb, setThumb] = createSignal<HTMLElement>();
  let restoringFocusVisible = false;
  const [insetPosition, setInsetPosition] = createSignal<number>();
  createEffect(
    () => [thumb(), context.control(), context.state.orientation, context.props.thumbAlignment, context.percent(context.values()[index()] ?? context.state.min)] as const,
    ([element, control, orientation, alignment, percent]) => {
      if (!element || !control || !alignment || alignment === 'center') return;
      const measure = () => {
        const side = orientation === 'vertical' ? 'height' : 'width';
        const thumbSize = element.getBoundingClientRect()[side];
        const controlSize = control.getBoundingClientRect()[side];
        const position = (thumbSize / 2 + (controlSize - thumbSize) * percent / 100) / controlSize * 100;
        setInsetPosition(Number.isFinite(position) ? position : undefined);
        if (index() === 0 || index() === context.values().length - 1)
          context.setIndicatorPosition(index() === 0 ? 0 : 1, Number.isFinite(position) ? position : undefined);
      };
      measure();
      const Observer = element.ownerDocument.defaultView?.ResizeObserver;
      if (!Observer) return;
      const observer = new Observer(measure);
      observer.observe(element);
      observer.observe(control);
      return () => observer.disconnect();
    },
  );
  registerReset(input, () => {
    const initial = context.props.defaultValue ?? context.state.min;
    context.setValue(Array.isArray(initial) ? initial[index()] : (initial as number), index());
    field?.reset();
  });
  const value = () => context.values()[index()] ?? context.state.min;
  const formatted = () =>
    new Intl.NumberFormat(context.props.locale, context.props.format).format(value());
  const disabled = () => props.disabled || context.state.disabled;
  createEffect(() => [disabled(), input()] as const, ([isDisabled, element]) => {
    if (isDisabled) element?.blur();
  });
  const inputProps = mergeProps(fieldAttributes(field), controlEvents(field), {
    type: 'range',
    get value() {
      return value();
    },
    get min() {
      return context.state.min;
    },
    get max() {
      return context.state.max;
    },
    get step() {
      return context.state.step;
    },
    get disabled() {
      return disabled();
    },
    get name() {
      return context.props.name ?? field?.props.name;
    },
    get form() {
      return context.props.form;
    },
    get id() {
      return props.id ?? (index() === 0 ? field?.id : undefined);
    },
    get 'aria-label'() {
      return props.getAriaLabel?.(index()) ?? props['aria-label'];
    },
    get 'aria-labelledby'() {
      const label = props.getAriaLabel?.(index()) ?? props['aria-label'];
      return props['aria-labelledby'] ?? (label == null
        ? context.props['aria-labelledby'] ?? context.labelId()
        : undefined);
    },
    get 'aria-valuenow'() {
      return value();
    },
    get 'aria-valuetext'() {
      return (
        props.getAriaValueText?.(formatted(), value(), index()) ??
        props['aria-valuetext'] ??
        (context.values().length === 2
          ? `${formatted()} ${index() === 0 ? 'start' : 'end'} range`
          : context.props.format ? formatted() : undefined)
      );
    },
    get 'aria-orientation'() {
      return context.state.orientation;
    },
    get tabIndex() {
      return props.tabIndex;
    },
    // Keep the native range input in the same paint layer and focus box as
    // upstream SliderThumb. A one-pixel clipped absolute input alters the
    // thumb's edge anti-aliasing even when its visible geometry is identical.
    style: {
      'clip-path': 'inset(50%)',
      overflow: 'hidden',
      'white-space': 'nowrap',
      border: '0',
      padding: '0',
      width: '100%',
      height: '100%',
      margin: '0',
      position: 'fixed',
      top: '0',
      left: '0',
    },
    ref(element: HTMLInputElement) {
      setInput(element);
      context.thumbs.set(index(), element);
      assignRef(props.inputRef, element);
      field?.register(
        element,
        Array.isArray(context.props.value ?? context.props.defaultValue)
          ? context.values()
          : value(),
      );
    },
    onFocus() {
      context.setActive(index());
      if (restoringFocusVisible) restoringFocusVisible = false;
    },
    onInput(event: InputEvent) {
      context.setValue((event.currentTarget as HTMLInputElement).valueAsNumber, index(), event);
    },
    onChange(event: Event) {
      if (context.setValue((event.currentTarget as HTMLInputElement).valueAsNumber, index(), event))
        context.commit(event, 'input-change');
    },
    onBlur(event: FocusEvent) {
      if (restoringFocusVisible) return;
      context.setActive(-1);
    },
    onKeyDown(event: KeyboardEvent) {
      if (disabled()) return;
      let next: number;
      const large = context.props.largeStep ?? context.state.step * 10;
      const amount = event.shiftKey ? large : context.state.step;
      const rounded = roundValueToStep(value(), context.state.step, context.state.min);
      if (event.key === 'Home') next = context.state.min;
      else if (event.key === 'End') next = context.state.max;
      else if (event.key === 'PageUp') next = rounded + large;
      else if (event.key === 'PageDown') next = rounded - large;
      else if (event.key === 'ArrowUp') next = rounded + amount;
      else if (event.key === 'ArrowDown') next = rounded - amount;
      else if (event.key === 'ArrowRight')
        next = rounded + (direction() === 'rtl' ? -amount : amount);
      else if (event.key === 'ArrowLeft')
        next = rounded + (direction() === 'rtl' ? amount : -amount);
      else return;
      next = Number(next.toFixed(Math.max(
        getDecimalPrecision(rounded),
        getDecimalPrecision(event.key.startsWith('Page') ? large : amount),
        getDecimalPrecision(context.state.min),
      )));
      event.preventDefault();
      const element = event.currentTarget as HTMLInputElement;
      if (!element.matches(':focus-visible')) {
        restoringFocusVisible = true;
        element.blur();
        element.focus({ preventScroll: true, focusVisible: true } as FocusOptions);
      }
      if (context.setValue(next, index(), event, 'keyboard'))
        context.commit(event, 'keyboard');
    },
  });
  onCleanup(() => context.thumbs.delete(index()));
  const inputElement = renderElement(
    'input',
    mergeProps(inputProps, {
      get onKeyDown() { return props.onKeyDown; },
      get onFocus() { return props.onFocus; },
      get onBlur() { return props.onBlur; },
    }),
  );
  return renderElement(
    'div',
    omitProps(props, [
      'children',
      'id',
      'tabIndex',
      'aria-label',
      'aria-labelledby',
      'aria-valuetext',
      'onKeyDown',
      'onFocus',
      'onBlur',
    ]),
    context.state,
    {
      ref: setThumb,
      get 'data-index'() {
        return index();
      },
      get style() {
        const position = context.percent(value());
        const vertical = context.state.orientation === 'vertical';
        const inset = context.props.thumbAlignment && context.props.thumbAlignment !== 'center';
        const offset = inset ? 'var(--position)' : `${position}%`;
        const measured = inset ? { '--position': `${insetPosition() ?? 0}%`, visibility: insetPosition() === undefined ? 'hidden' : undefined } : {};
        return vertical
          ? { position: 'absolute', bottom: offset, left: '50%', translate: '-50% 50%', ...measured }
          : {
              position: 'absolute',
              'inset-inline-start': offset,
              top: '50%',
              translate: direction() === 'rtl' ? '50% -50%' : '-50% -50%',
              ...measured,
            };
      },
      get children() {
        return (
          <>
            {props.children}
            {inputElement}
          </>
        );
      },
    },
  );
}
export namespace SliderThumb {
  export type Props = SliderThumbProps;
}
export function SliderLabel(props: BaseProps<SliderRootState>) {
  const context = useContext(SliderContext)!;
  const id = () => props.id ?? `${context.rootId()}-label`;
  createEffect(
    id,
    (value) => {
      context.setLabelId(value);
      return () => context.setLabelId(undefined);
    },
  );
  return renderElement('label', props, context.state, {
    get id() { return id(); },
    onClick() {
      if (context.values().length === 1) context.thumbs.get(0)?.focus();
    },
  });
}
export namespace SliderLabel {
  export type Props = BaseProps<SliderRootState>;
}
export interface SliderValueProps extends Omit<BaseProps<SliderRootState>, 'children'> {
  children?: (formatted: string[], values: readonly number[]) => JSX.Element;
}
export function SliderValue(props: SliderValueProps) {
  const context = useContext(SliderContext)!;
  return renderElement(
    'output',
    omitProps(props, ['children']) as BaseProps<SliderRootState>,
    context.state,
    {
      get children() {
        const formatted = context
          .values()
          .map((value) =>
            new Intl.NumberFormat(context.props.locale, context.props.format).format(value),
          );
        return props.children ? props.children(formatted, context.values()) : formatted.join(' – ');
      },
    },
  );
}
export namespace SliderValue {
  export type Props = SliderValueProps;
}
export const Slider = {
  Root: SliderRoot,
  Control: SliderControl,
  Track: SliderTrack,
  Indicator: SliderIndicator,
  Thumb: SliderThumb,
  Label: SliderLabel,
  Value: SliderValue,
};

export interface MeterRootProps extends BaseProps {
  value: number;
  min?: number;
  max?: number;
  locale?: Intl.LocalesArgument;
  format?: Intl.NumberFormatOptions;
  getAriaValueText?: (formatted: string, value: number) => string;
}
export type ProgressStatus = 'indeterminate' | 'progressing' | 'complete';
export interface ProgressRootProps extends Omit<MeterRootProps, 'value' | 'getAriaValueText'> {
  value: number | null;
  getAriaValueText?: (formatted: string, value: number | null) => string;
}
interface MeterContextValue {
  props: MeterRootProps | ProgressRootProps;
  value: () => number | null;
  percent: () => number | null;
  formatted: () => string;
  label: () => string | undefined;
  setLabel: (id: string | undefined) => void;
  state: Record<string, unknown>;
}
const MeterContext = createContext<MeterContextValue | null>(null);
const ProgressContext = createContext<MeterContextValue | null>(null);
function useMeterContext(progress: boolean) {
  const context = useContext(progress ? ProgressContext : MeterContext);
  if (!context) {
    const name = progress ? 'Progress' : 'Meter';
    throw new Error(
      `Base UI: ${name}RootContext is missing. ${name} parts must be placed within <${name}.Root>.`,
    );
  }
  return context;
}
function progressAttributes(state: Record<string, unknown>) {
  return {
    get 'data-indeterminate'() {
      return state.status === 'indeterminate' ? '' : undefined;
    },
    get 'data-progressing'() {
      return state.status === 'progressing' ? '' : undefined;
    },
    get 'data-complete'() {
      return state.status === 'complete' ? '' : undefined;
    },
  };
}
function MeterControl(props: MeterRootProps | ProgressRootProps, progress: boolean) {
  const [label, setLabel] = createSignal<string>();
  const value = () =>
    props.value === null || !Number.isFinite(props.value)
      ? progress
        ? null
        : (props.min ?? 0)
      : clamp(props.value, props.min ?? 0, props.max ?? 100);
  const percent = () =>
    value() === null
      ? null
      : (props.max ?? 100) === (props.min ?? 0)
        ? 0
        : clamp(
            ((value()! - (props.min ?? 0)) / ((props.max ?? 100) - (props.min ?? 0))) * 100,
            0,
            100,
          );
  const formatted = () =>
    value() === null
      ? ''
      : props.format
        ? new Intl.NumberFormat(props.locale, props.format).format(value()!)
        : new Intl.NumberFormat(props.locale, { style: 'percent' }).format(percent()! / 100);
  const state = progress
    ? {
        get status() {
          return value() === null
            ? 'indeterminate'
            : value() === (props.max ?? 100)
              ? 'complete'
              : 'progressing';
        },
      }
    : {};
  const Provider = progress ? ProgressContext : MeterContext;
  return (
    <Provider value={{ props, value, percent, formatted, label, setLabel, state }}>
      {renderElement('div', props, state, mergeProps(progressAttributes(state), {
        role: progress ? 'progressbar' : 'meter',
        get 'aria-valuemin'() {
          return props.min ?? 0;
        },
        get 'aria-valuemax'() {
          return props.max ?? 100;
        },
        get 'aria-valuenow'() {
          return value() ?? undefined;
        },
        get 'aria-labelledby'() {
          return label();
        },
        get 'aria-valuetext'() {
          return props.getAriaValueText
            ? (props.getAriaValueText as (formatted: string, value: number | null) => string)(
                formatted(),
                props.value,
              )
            : value() === null
              ? 'indeterminate progress'
              : formatted();
        },
      }))}
    </Provider>
  );
}
export function MeterRoot(props: MeterRootProps) {
  return MeterControl(props, false);
}
export namespace MeterRoot {
  export type Props = MeterRootProps;
  export type State = Record<string, never>;
}
export function ProgressRoot(props: ProgressRootProps) {
  return MeterControl(props, true);
}
export namespace ProgressRoot {
  export type Props = ProgressRootProps;
  export type State = { status: ProgressStatus };
}
function MeterTrackPart(props: BaseProps, progress: boolean) {
  const context = useMeterContext(progress);
  return renderElement('div', props, context.state, progressAttributes(context.state));
}
function MeterIndicatorPart(props: BaseProps, progress: boolean) {
  const context = useMeterContext(progress);
  return renderElement('div', props, context.state, mergeProps(progressAttributes(context.state), {
    get style() {
      return { width: context.percent() === null ? undefined : `${context.percent()}%` };
    },
  }));
}
function MeterLabelPart(props: BaseProps, progress: boolean) {
  const context = useMeterContext(progress);
  const generatedId = createUniqueId();
  const id = () => props.id ?? generatedId;
  createEffect(
    id,
    (value) => {
      context.setLabel(value);
      return () => context.setLabel(undefined);
    },
  );
  return renderElement('span', props, context.state, mergeProps(progressAttributes(context.state), {
    get id() { return id(); },
    role: 'presentation',
  }));
}
export interface MeterValueProps extends Omit<BaseProps, 'children'> {
  children?: null | ((formatted: string, value: number) => JSX.Element);
}
export interface ProgressValueProps extends Omit<BaseProps, 'children'> {
  children?: null | ((formatted: string, value: number | null) => JSX.Element);
}
function MeterValuePart(props: MeterValueProps | ProgressValueProps, progress: boolean) {
  const context = useMeterContext(progress);
  return renderElement('span', omitProps(props, ['children']) as BaseProps, context.state, mergeProps(progressAttributes(context.state), {
    'aria-hidden': true,
    get children() {
      return typeof props.children === 'function'
        ? (props.children as (formatted: string, value: number | null) => JSX.Element)(
            progress && context.value() === null ? 'indeterminate' : context.formatted(),
            context.props.value,
          )
        : context.formatted();
    },
  }));
}
export function MeterTrack(props: BaseProps) {
  return MeterTrackPart(props, false);
}
export namespace MeterTrack {
  export type Props = BaseProps;
}
export function MeterIndicator(props: BaseProps) {
  return MeterIndicatorPart(props, false);
}
export namespace MeterIndicator {
  export type Props = BaseProps;
}
export function MeterLabel(props: BaseProps) {
  return MeterLabelPart(props, false);
}
export namespace MeterLabel {
  export type Props = BaseProps;
}
export function MeterValue(props: MeterValueProps) {
  return MeterValuePart(props, false);
}
export namespace MeterValue {
  export type Props = MeterValueProps;
}
export function ProgressTrack(props: BaseProps) {
  return MeterTrackPart(props, true);
}
export namespace ProgressTrack {
  export type Props = BaseProps;
}
export function ProgressIndicator(props: BaseProps) {
  return MeterIndicatorPart(props, true);
}
export namespace ProgressIndicator {
  export type Props = BaseProps;
}
export function ProgressLabel(props: BaseProps) {
  return MeterLabelPart(props, true);
}
export namespace ProgressLabel {
  export type Props = BaseProps;
}
export function ProgressValue(props: ProgressValueProps) {
  return MeterValuePart(props, true);
}
export namespace ProgressValue {
  export type Props = ProgressValueProps;
}
export const Meter = {
  Root: MeterRoot,
  Track: MeterTrack,
  Indicator: MeterIndicator,
  Label: MeterLabel,
  Value: MeterValue,
};
export const Progress = {
  Root: ProgressRoot,
  Track: ProgressTrack,
  Indicator: ProgressIndicator,
  Label: ProgressLabel,
  Value: ProgressValue,
};

export interface OTPFieldRootState extends FieldRootState {
  complete: boolean;
  length: number;
  readOnly: boolean;
  required: boolean;
  value: string;
}
export interface OTPFieldRootProps extends BaseProps<OTPFieldRootState> {
  length: number;
  value?: string;
  defaultValue?: string;
  onValueChange?: Change<string>;
  onValueInvalid?: Change<string>;
  onValueComplete?: Change<string>;
  validationType?: 'numeric' | 'alpha' | 'alphanumeric' | 'none';
  normalizeValue?: (value: string) => string;
  autoSubmit?: boolean;
  mask?: boolean;
  inputMode?: JSX.InputHTMLAttributes<HTMLInputElement>['inputmode'];
  autoComplete?: string;
  form?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  name?: string;
}
interface OTPContextValue {
  props: OTPFieldRootProps;
  state: OTPFieldRootState;
  value: () => string;
  write: (value: string, event: Event, reason: string) => boolean;
  count: number;
  inputs: Map<number, HTMLInputElement>;
  active: () => number;
  setActive: (index: number) => void;
  focus: (index: number) => void;
  normalize: (raw: string, event: Event, reason: string) => string;
}
const OTPContext = createContext<OTPContextValue>();
export function OTPFieldRoot(props: OTPFieldRootProps) {
  const field = useContext(FieldContext);
  const [value, setValue] = createControllable(props, 'value', props.defaultValue ?? '');
  bindFieldValue(field, value);
  const inheritedDisabled = useFieldsetDisabled();
  const [input, setInput] = createSignal<HTMLInputElement>();
  const [active, setActive] = createSignal(-1);
  const inputs = new Map<number, HTMLInputElement>();
  const state = mergeProps(
    field?.state ?? { touched: false, dirty: false, valid: null, filled: false, focused: false },
    {
      get complete() {
        return value().length === props.length;
      },
      get disabled() {
        return Boolean(props.disabled || field?.state.disabled || inheritedDisabled());
      },
      get length() {
        return props.length;
      },
      get readOnly() {
        return Boolean(props.readOnly);
      },
      get required() {
        return Boolean(props.required);
      },
      get value() {
        return value();
      },
    },
  ) as OTPFieldRootState;
  const context: OTPContextValue = {
    props,
    state,
    value,
    count: 0,
    inputs,
    active,
    setActive,
    focus(index) {
      const element = inputs.get(clamp(index, 0, props.length - 1));
      element?.focus();
      element?.select();
    },
    normalize(raw, event, reason) {
      let result = props.normalizeValue ? props.normalizeValue(raw) : raw;
      const validation = props.validationType ?? 'numeric';
      if (validation === 'numeric') result = result.replace(/[^0-9]/g, '');
      else if (validation === 'alpha') result = result.replace(/[^a-z]/gi, '');
      else if (validation === 'alphanumeric') result = result.replace(/[^a-z0-9]/gi, '');
      if (result !== raw) props.onValueInvalid?.(raw, eventDetails(event, reason));
      return result.slice(0, props.length);
    },
    write(next, event, reason) {
      if (state.disabled || state.readOnly) return false;
      const changed = setValue(next.slice(0, props.length), event, reason);
      if (changed) field?.change(next);
      if (next.length === props.length && (changed || reason === 'input-paste')) {
        props.onValueComplete?.(next, eventDetails(event, reason));
        if (props.autoSubmit) queueMicrotask(() => inputs.get(0)?.form?.requestSubmit());
      }
      return changed;
    },
  };
  registerReset(input, () => {
    setValue(props.defaultValue ?? '');
    field?.reset();
  });
  return (
    <OTPContext value={context}>
      {renderElement(
        'div',
        omitProps(props, ['children', 'id']),
        state,
        mergeProps(fieldAttributes(field), {
          role: 'group',
          get children() {
            return (
              <>
                {props.children}
                <input
                  type="hidden"
                  ref={setInput}
                  name={props.name ?? field?.props.name}
                  form={props.form}
                  value={value()}
                  disabled={state.disabled}
                />
              </>
            );
          },
        }),
      )}
    </OTPContext>
  );
}
export namespace OTPFieldRoot {
  export type Props = OTPFieldRootProps;
  export type State = OTPFieldRootState;
  export type ValidationType = NonNullable<OTPFieldRootProps['validationType']>;
  export type ChangeEventDetails = ChangeDetails;
  export type InvalidEventDetails = ChangeDetails;
  export type CompleteEventDetails = ChangeDetails;
}
export interface OTPFieldInputProps extends BaseProps<OTPFieldRootState> {
  index?: number;
}
export function OTPFieldInput(props: OTPFieldInputProps) {
  const context = useContext(OTPContext)!;
  const field = useContext(FieldContext);
  const direction = useDirection();
  const initialIndex = context.count++;
  const index = () => props.index ?? initialIndex;
  let composing = false;
  const state = mergeProps(context.state, {
    get filled() {
      return Boolean(context.value()[index()]);
    },
    get focused() {
      return context.active() === index();
    },
    get index() {
      return index();
    },
    get value() {
      return context.value()[index()] ?? '';
    },
  });
  function enter(raw: string, event: Event, reason: string) {
    const normalized = context.normalize(raw, event, reason);
    if (!normalized) {
      if (!raw && reason !== 'input-paste')
        context.write(
          context.value().slice(0, index()) + context.value().slice(index() + 1),
          event,
          'input-clear',
        );
      return;
    }
    const offset =
      normalized.length >= context.props.length ? 0 : Math.min(index(), context.value().length);
    const next = (
      context.value().slice(0, offset) +
      normalized +
      context.value().slice(offset + normalized.length)
    ).slice(0, context.props.length);
    if (context.write(next, event, reason) || next === context.value())
      context.focus(Math.min(offset + normalized.length, context.props.length - 1));
  }
  onCleanup(() => context.inputs.delete(index()));
  return renderElement(
    'input',
    props,
    state,
    mergeProps(fieldAttributes(field), controlEvents(field), {
      get id() {
        return props.id ?? (index() === 0 ? (context.props.id ?? field?.id) : undefined);
      },
      get type() {
        return context.props.mask ? 'password' : 'text';
      },
      get inputMode() {
        return (
          context.props.inputMode ??
          (context.props.validationType === 'none' ||
          context.props.validationType === 'alpha' ||
          context.props.validationType === 'alphanumeric'
            ? 'text'
            : 'numeric')
        );
      },
      get autoComplete() {
        return context.props.autoComplete ?? 'one-time-code';
      },
      get value() {
        return context.value()[index()] ?? '';
      },
      get form() {
        return context.props.form;
      },
      get disabled() {
        return context.state.disabled;
      },
      get readOnly() {
        return context.state.readOnly;
      },
      get required() {
        return context.state.required;
      },
      get 'aria-label'() {
        return props['aria-label'] ?? `Character ${index() + 1} of ${context.props.length}`;
      },
      get 'data-index'() {
        return index();
      },
      ref(element: HTMLInputElement) {
        context.inputs.set(index(), element);
        field?.register(element, context.value());
      },
      onFocus(event: FocusEvent) {
        context.setActive(index());
        (event.currentTarget as HTMLInputElement).select();
      },
      onBlur() {
        if (context.active() === index()) context.setActive(-1);
      },
      onInput(event: InputEvent) {
        if (!composing) {
          enter((event.currentTarget as HTMLInputElement).value, event, 'input-change');
          (event.currentTarget as HTMLInputElement).value = context.value()[index()] ?? '';
        }
      },
      onPaste(event: ClipboardEvent) {
        event.preventDefault();
        enter(event.clipboardData?.getData('text') ?? '', event, 'input-paste');
      },
      onCompositionStart() {
        composing = true;
      },
      onCompositionEnd(event: CompositionEvent) {
        composing = false;
        enter(event.data, event, 'input-change');
      },
      onKeyDown(event: KeyboardEvent) {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          context.focus(
            index() + (event.key === 'ArrowRight' ? 1 : -1) * (direction() === 'rtl' ? -1 : 1),
          );
        } else if (event.key === 'Home') {
          event.preventDefault();
          context.focus(0);
        } else if (event.key === 'End') {
          event.preventDefault();
          context.focus(context.props.length - 1);
        } else if (
          !context.state.readOnly &&
          (event.key === 'Backspace' || event.key === 'Delete')
        ) {
          event.preventDefault();
          const offset =
            event.key === 'Backspace' && !context.value()[index()]
              ? Math.max(0, index() - 1)
              : index();
          context.write(
            context.value().slice(0, offset) + context.value().slice(offset + 1),
            event,
            'keyboard',
          );
          if (event.key === 'Backspace')
            context.focus(Math.max(0, offset - (context.value()[index()] ? 0 : 1)));
        }
      },
    }),
  );
}
export namespace OTPFieldInput {
  export type Props = OTPFieldInputProps;
  export type State = OTPFieldRootState;
}
export function OTPFieldSeparator(props: BaseProps) {
  return renderElement('div', props, {}, { role: 'separator', 'aria-hidden': true });
}
export namespace OTPFieldSeparator {
  export type Props = BaseProps;
}
export const OTPField = { Root: OTPFieldRoot, Input: OTPFieldInput, Separator: OTPFieldSeparator };

// Named type exports preserve the upstream public import paths.
export type ButtonState = Button.State;
export type InputState = FieldRootState;
export type CheckboxGroupState = FieldRootState;
export type CheckboxIndicatorProps = CheckboxIndicator.Props;
export type CheckboxIndicatorState = CheckboxRootState;
export type SwitchRootState = CheckboxRootState;
export type SwitchThumbProps = SwitchThumb.Props;
export type SwitchThumbState = SwitchRootState;
export type RadioRootState = FieldRootState & {
  checked: boolean;
  readOnly: boolean;
  required: boolean;
};
export type RadioIndicatorProps = RadioIndicator.Props;
export type RadioIndicatorState = RadioRootState;
export type RadioGroupState = FieldRootState & { readOnly: boolean; required: boolean };
export type ToggleState = Toggle.State;
export type ToggleGroupState = { disabled: boolean; multiple: boolean; orientation: Orientation };
export type FieldRootActions = FieldRoot.Actions;
export type FieldControlState = FieldRootState;
export type FieldLabelProps = FieldLabel.Props;
export type FieldLabelState = FieldRootState;
export type FieldDescriptionProps = FieldDescription.Props;
export type FieldDescriptionState = FieldRootState;
export type FieldErrorProps = FieldError.Props;
export type FieldErrorState = FieldRootState & { transitionStatus: 'starting' | 'ending' | 'idle' };
export type FieldItemProps = FieldItem.Props;
export type FieldItemState = FieldRootState;
export type FieldValidityProps = FieldValidity.Props;
export type FieldValidityState = Parameters<FieldValidity.Props['children']>[0];
export type FieldsetRootState = { disabled: boolean };
export type FieldsetLegendProps = FieldsetLegend.Props;
export type FieldsetLegendState = { disabled: boolean };
export type FormState = Record<string, never>;
export type FormActions = { validate: (fieldName?: string) => void };
export type FormValidationMode = Form.ValidationMode;
export type NumberFieldInputProps = NumberFieldInput.Props;
export type NumberFieldInputState = NumberFieldRootState;
export type NumberFieldGroupProps = NumberFieldGroup.Props;
export type NumberFieldGroupState = NumberFieldRootState;
export type NumberFieldIncrementProps = NumberFieldIncrement.Props;
export type NumberFieldIncrementState = NumberFieldRootState;
export type NumberFieldDecrementProps = NumberFieldDecrement.Props;
export type NumberFieldDecrementState = NumberFieldRootState;
export type NumberFieldScrubAreaProps = NumberFieldScrubArea.Props;
export type NumberFieldScrubAreaState = NumberFieldRootState;
export type NumberFieldScrubAreaCursorProps = NumberFieldScrubAreaCursor.Props;
export type NumberFieldScrubAreaCursorState = NumberFieldRootState;
export type SliderControlProps = SliderControl.Props;
export type SliderControlState = SliderRootState;
export type SliderTrackProps = SliderTrack.Props;
export type SliderTrackState = SliderRootState;
export type SliderIndicatorProps = SliderIndicator.Props;
export type SliderIndicatorState = SliderRootState;
export type SliderLabelProps = SliderLabel.Props;
export type SliderLabelState = SliderRootState;
export type SliderThumbState = SliderRootState;
export type SliderValueState = SliderRootState;
export type SliderRootChangeEventCustomProperties = { activeThumbIndex: number };
export type MeterRootState = Record<string, never>;
export type MeterTrackProps = MeterTrack.Props;
export type MeterTrackState = MeterRootState;
export type MeterIndicatorProps = MeterIndicator.Props;
export type MeterIndicatorState = MeterRootState;
export type MeterLabelProps = MeterLabel.Props;
export type MeterLabelState = MeterRootState;
export type MeterValueState = MeterRootState;
export type ProgressRootState = { status: ProgressStatus };
export type ProgressTrackProps = ProgressTrack.Props;
export type ProgressTrackState = ProgressRootState;
export type ProgressIndicatorProps = ProgressIndicator.Props;
export type ProgressIndicatorState = ProgressRootState;
export type ProgressLabelProps = ProgressLabel.Props;
export type ProgressLabelState = ProgressRootState;
export type ProgressValueState = ProgressRootState;
export type OTPFieldInputState = OTPFieldRootState & { index: number };
export type InputChangeEventReason = 'none';
export type InputChangeEventDetails = ChangeDetails & { reason: InputChangeEventReason };
export type CheckboxGroupChangeEventReason = 'none';
export type CheckboxGroupChangeEventDetails = ChangeDetails & {
  reason: CheckboxGroupChangeEventReason;
};
export type CheckboxRootChangeEventReason = 'none';
export type CheckboxRootChangeEventDetails = ChangeDetails & {
  reason: CheckboxRootChangeEventReason;
};
export type SwitchRootChangeEventReason = 'none';
export type SwitchRootChangeEventDetails = ChangeDetails & { reason: SwitchRootChangeEventReason };
export type RadioGroupChangeEventReason = 'none';
export type RadioGroupChangeEventDetails = ChangeDetails & { reason: RadioGroupChangeEventReason };
export type ToggleChangeEventReason = 'none';
export type ToggleChangeEventDetails = ChangeDetails & { reason: ToggleChangeEventReason };
export type ToggleGroupChangeEventReason = 'none';
export type ToggleGroupChangeEventDetails = ChangeDetails & {
  reason: ToggleGroupChangeEventReason;
};
export type FieldControlChangeEventReason = 'none';
export type FieldControlChangeEventDetails = ChangeDetails & {
  reason: FieldControlChangeEventReason;
};
export type NumberFieldRootChangeEventReason = string;
export type NumberFieldRootChangeEventDetails = NumberFieldRoot.ChangeEventDetails;
export type NumberFieldRootCommitEventReason = string;
export type NumberFieldRootCommitEventDetails = ChangeDetails;
export type SliderRootChangeEventReason = string;
export type SliderRootChangeEventDetails = SliderRoot.ChangeEventDetails;
export type SliderRootCommitEventReason = string;
export type SliderRootCommitEventDetails = ChangeDetails;
export type FormSubmitEventReason = 'none';
export type FormSubmitEventDetails = ChangeDetails;
export type OTPFieldRootChangeEventReason = string;
export type OTPFieldRootChangeEventDetails = ChangeDetails;
export type OTPFieldRootInvalidEventReason = string;
export type OTPFieldRootInvalidEventDetails = ChangeDetails;
export type OTPFieldRootCompleteEventReason = string;
export type OTPFieldRootCompleteEventDetails = ChangeDetails;

export namespace Field {
  export namespace Root {
    export type Props = FieldRootProps;
    export type State = FieldRootState;
    export type Actions = FieldRoot.Actions;
  }
  export namespace Label {
    export type Props = FieldLabel.Props;
    export type State = FieldRootState;
  }
  export namespace Description {
    export type Props = FieldDescription.Props;
    export type State = FieldRootState;
  }
  export namespace Control {
    export type Props = InputProps;
    export type State = FieldRootState;
  }
  export namespace Error {
    export type Props = FieldError.Props;
    export type State = FieldRootState;
  }
  export namespace Item {
    export type Props = FieldItem.Props;
    export type State = FieldRootState;
  }
  export namespace Validity {
    export type Props = FieldValidity.Props;
  }
}
export namespace Fieldset {
  export namespace Root {
    export type Props = FieldsetRootProps;
  }
  export namespace Legend {
    export type Props = FieldsetLegend.Props;
  }
}
export namespace Checkbox {
  export namespace Root {
    export type Props = CheckboxRootProps;
    export type State = CheckboxRootState;
    export type ChangeEventDetails = ChangeDetails;
  }
  export namespace Indicator {
    export type Props = CheckboxIndicator.Props;
    export type State = CheckboxRootState;
  }
}
export namespace Switch {
  export namespace Root {
    export type Props = SwitchRootProps;
    export type State = CheckboxRootState;
    export type ChangeEventDetails = ChangeDetails;
  }
  export namespace Thumb {
    export type Props = SwitchThumb.Props;
    export type State = CheckboxRootState;
  }
}
export namespace Radio {
  export namespace Root {
    export type Props = RadioRootProps;
  }
  export namespace Indicator {
    export type Props = RadioIndicator.Props;
  }
}
export namespace NumberField {
  export namespace Root {
    export type Props = NumberFieldRootProps;
    export type State = NumberFieldRootState;
    export type ChangeEventDetails = ChangeDetails;
    export type CommitEventDetails = ChangeDetails;
  }
  export namespace Input {
    export type Props = NumberFieldInput.Props;
    export type State = NumberFieldRootState;
  }
  export namespace Group {
    export type Props = NumberFieldGroup.Props;
    export type State = NumberFieldRootState;
  }
  export namespace Increment {
    export type Props = NumberFieldIncrement.Props;
    export type State = NumberFieldRootState;
  }
  export namespace Decrement {
    export type Props = NumberFieldDecrement.Props;
    export type State = NumberFieldRootState;
  }
  export namespace ScrubArea {
    export type Props = NumberFieldScrubArea.Props;
    export type State = NumberFieldRootState;
  }
  export namespace ScrubAreaCursor {
    export type Props = NumberFieldScrubAreaCursor.Props;
    export type State = NumberFieldRootState;
  }
}
export namespace Slider {
  export namespace Root {
    export type Props<Value extends number | readonly number[] = number | readonly number[]> =
      SliderRootProps<Value>;
    export type State = SliderRootState;
    export type ChangeEventDetails = SliderRoot.ChangeEventDetails;
    export type CommitEventDetails = ChangeDetails;
  }
  export namespace Control {
    export type Props = SliderControl.Props;
    export type State = SliderRootState;
  }
  export namespace Track {
    export type Props = SliderTrack.Props;
    export type State = SliderRootState;
  }
  export namespace Indicator {
    export type Props = SliderIndicator.Props;
    export type State = SliderRootState;
  }
  export namespace Thumb {
    export type Props = SliderThumbProps;
    export type State = SliderRootState;
  }
  export namespace Label {
    export type Props = SliderLabel.Props;
    export type State = SliderRootState;
  }
  export namespace Value {
    export type Props = SliderValueProps;
    export type State = SliderRootState;
  }
}
export namespace Meter {
  export namespace Root {
    export type Props = MeterRootProps;
    export type State = Record<string, never>;
  }
  export namespace Track {
    export type Props = MeterTrack.Props;
  }
  export namespace Indicator {
    export type Props = MeterIndicator.Props;
  }
  export namespace Label {
    export type Props = MeterLabel.Props;
  }
  export namespace Value {
    export type Props = MeterValueProps;
  }
}
export namespace Progress {
  export type Status = ProgressStatus;
  export namespace Root {
    export type Props = ProgressRootProps;
    export type State = { status: ProgressStatus };
  }
  export namespace Track {
    export type Props = ProgressTrack.Props;
  }
  export namespace Indicator {
    export type Props = ProgressIndicator.Props;
  }
  export namespace Label {
    export type Props = ProgressLabel.Props;
  }
  export namespace Value {
    export type Props = ProgressValueProps;
  }
}
export namespace OTPField {
  export namespace Root {
    export type Props = OTPFieldRootProps;
    export type State = OTPFieldRootState;
    export type ValidationType = OTPFieldRoot.ValidationType;
    export type ChangeEventDetails = ChangeDetails;
    export type InvalidEventDetails = ChangeDetails;
    export type CompleteEventDetails = ChangeDetails;
  }
  export namespace Input {
    export type Props = OTPFieldInputProps;
    export type State = OTPFieldRootState;
  }
  export namespace Separator {
    export type Props = OTPFieldSeparator.Props;
  }
}
