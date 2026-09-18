import { dataValue } from './utils';
import { createContext, createSignal, createUniqueId, useContext } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useRender } from '@solid-cn/base-ui/use-render';
import { mergeProps } from '@solid-cn/base-ui/merge-props';
import { Label } from './label';
import { cn, omitProps, type ComponentProps } from './utils';
type FieldError = {
  message: string;
  type?: string;
};
export type FormValues = Record<string, unknown>;
export function createForm<T extends FormValues>(options: {
  defaultValues: T;
  validate?: (
    values: T,
  ) => Partial<Record<keyof T, string>> | Promise<Partial<Record<keyof T, string>>>;
}) {
  const [values, setValues] = createSignal<T>(() => ({ ...options.defaultValues }));
  const [errors, setErrors] = createSignal<Record<string, FieldError>>({});
  const [touched, setTouched] = createSignal<Record<string, boolean>>({});
  const [submitting, setSubmitting] = createSignal(false);
  const form = {
    get values() {
      return values();
    },
    get formState() {
      return {
        errors: errors(),
        touchedFields: touched(),
        isSubmitting: submitting(),
        isValid: Object.keys(errors()).length === 0,
      };
    },
    getFieldState(name: string) {
      return {
        get error() {
          return errors()[name];
        },
        get invalid() {
          return !!errors()[name];
        },
        get isTouched() {
          return !!touched()[name];
        },
        get isDirty() {
          return values()[name] !== options.defaultValues[name];
        },
      };
    },
    setValue(name: string, value: unknown) {
      setValues((previous) => ({ ...previous, [name]: value }));
    },
    setError(name: string, error: FieldError) {
      setErrors((previous) => ({ ...previous, [name]: error }));
    },
    clearErrors(name?: string) {
      setErrors((previous) => {
        if (!name) return {};
        const next = { ...previous };
        delete next[name];
        return next;
      });
    },
    touch(name: string) {
      setTouched((previous) => ({ ...previous, [name]: true }));
    },
    reset(next: T = options.defaultValues) {
      setValues(() => ({ ...next }));
      setErrors({});
      setTouched({});
    },
    async trigger() {
      await Promise.resolve();
      const validation = (await options.validate?.(values())) ?? {};
      setErrors(
        Object.fromEntries(
          Object.entries(validation)
            .filter(([, message]) => !!message)
            .map(([name, message]) => [name, { message: String(message) }]),
        ),
      );
      return !Object.values(validation).some(Boolean);
    },
    handleSubmit(submit: (values: T, event?: SubmitEvent) => void | Promise<void>) {
      return async (event?: SubmitEvent) => {
        const formElement = event?.currentTarget as HTMLFormElement | null | undefined;
        event?.preventDefault();
        setSubmitting(true);
        try {
          if (await form.trigger()) {
            await submit(values(), event);
          } else {
            formElement
              ?.querySelector<HTMLElement>('[data-slot="form-control"][aria-invalid="true"]')
              ?.focus();
          }
        } finally {
          setSubmitting(false);
        }
      };
    },
  };
  return Object.assign(form, { control: form });
}
type FormController = ReturnType<typeof createForm<any>>;
const FormContext = createContext<FormController | null>(null);
const FieldContext = createContext<{
  name: string;
  control: FormController;
} | null>(null);
const ItemContext = createContext<{
  id: string;
} | null>(null);
export function Form(props: { control: FormController; children?: JSX.Element }) {
  return <FormContext value={props.control}>{props.children}</FormContext>;
}
export function FormField(props: {
  name: string;
  control?: FormController;
  defaultValue?: unknown;
  render: (props: {
    field: {
      name: string;
      value: unknown;
      onChange: (value: unknown) => void;
      onBlur: () => void;
    };
    fieldState: ReturnType<FormController['getFieldState']>;
    formState: FormController['formState'];
  }) => JSX.Element;
}) {
  const inherited = useContext(FormContext),
    control = props.control ?? inherited;
  if (!control) throw new Error('FormField requires a Form control.');
  const field = {
    get name() {
      return props.name;
    },
    get value() {
      return control.values[props.name] ?? props.defaultValue;
    },
    onChange(value: unknown) {
      const target = (value as Event)?.target as HTMLInputElement | undefined;
      control.setValue(
        props.name,
        target ? (target.type === 'checkbox' ? target.checked : target.value) : value,
      );
    },
    onBlur() {
      control.touch(props.name);
    },
  };
  return (
    <FieldContext
      value={{
        get name() {
          return props.name;
        },
        control,
      }}
    >
      {props.render({
        field,
        get fieldState() {
          return control.getFieldState(props.name);
        },
        get formState() {
          return control.formState;
        },
      })}
    </FieldContext>
  );
}
export function useFormField() {
  const field = useContext(FieldContext),
    item = useContext(ItemContext);
  if (!field) throw new Error('useFormField requires FormField.');
  if (!item) throw new Error('useFormField requires FormItem.');
  return {
    get id() {
      return item.id;
    },
    get name() {
      return field.name;
    },
    get formItemId() {
      return `${item.id}-form-item`;
    },
    get formDescriptionId() {
      return `${item.id}-form-item-description`;
    },
    get formMessageId() {
      return `${item.id}-form-item-message`;
    },
    get error() {
      return field.control.getFieldState(field.name).error;
    },
    get invalid() {
      return field.control.getFieldState(field.name).invalid;
    },
    get isTouched() {
      return field.control.getFieldState(field.name).isTouched;
    },
    get isDirty() {
      return field.control.getFieldState(field.name).isDirty;
    },
  };
}
export function FormItem(props: ComponentProps<'div'>) {
  const id = createUniqueId();
  return (
    <ItemContext value={{ id }}>
      <div
        {...omitProps(props, ['className'])}
        data-slot="form-item"
        class={cn('grid gap-2', props.class ?? props.className)}
      />
    </ItemContext>
  );
}
export function FormLabel(props: ComponentProps<typeof Label>) {
  const field = useFormField();
  return (
    <Label
      {...omitProps(props, ['className'])}
      data-slot="form-label"
      data-error={dataValue(!!field.error)}
      class={cn('data-[error=true]:text-destructive', props.class ?? props.className)}
      for={field.formItemId}
    />
  );
}
export function FormControl(props: ComponentProps<'span'>) {
  const field = useFormField();
  return useRender({
    defaultTagName: 'span',
    get render() {
      return props.render;
    },
    get props() {
      return mergeProps(
        {
          id: field.formItemId,
          'data-slot': 'form-control',
          'aria-describedby': field.error
            ? `${field.formDescriptionId} ${field.formMessageId}`
            : field.formDescriptionId,
          'aria-invalid': field.error ? 'true' : 'false',
        },
        omitProps(props, ['render']),
      );
    },
  });
}
export function FormDescription(props: ComponentProps<'p'>) {
  const field = useFormField();
  return (
    <p
      {...omitProps(props, ['className'])}
      data-slot="form-description"
      id={field.formDescriptionId}
      class={cn('text-sm text-muted-foreground', props.class ?? props.className)}
    />
  );
}
export function FormMessage(props: ComponentProps<'p'>) {
  const field = useFormField();
  const body = () => (field.error ? String(field.error.message) : props.children);
  return (
    <>
      {body() && (
        <p
          {...omitProps(props, ['className', 'children'])}
          data-slot="form-message"
          id={field.formMessageId}
          class={cn('text-sm text-destructive', props.class ?? props.className)}
        >
          {body()}
        </p>
      )}
    </>
  );
}
