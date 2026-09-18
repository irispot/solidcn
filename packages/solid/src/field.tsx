import { dataValue } from './utils';
// Native Solid 2 port of the upstream Base UI registry.
import {
  createSignal,
  createMemo,
  createEffect,
  createContext,
  useContext,
  createUniqueId,
  type Component,
} from 'solid-js';
import type { JSX } from '@solidjs/web';
import { omitProps, type ComponentProps } from './utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';
import { Label } from './label';
import { Separator } from './separator';
function FieldSet(__props0: ComponentProps<'fieldset'>) {
  return (
    <fieldset
      data-slot="field-set"
      class={cn('cn-field-set flex flex-col', __props0.className ?? __props0.class)}
      {...omitProps(__props0, ['className'])}
    />
  );
}
function FieldLegend(
  __props1: ComponentProps<'legend'> & {
    variant?: 'legend' | 'label';
  },
) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={dataValue(__props1.variant === undefined ? 'legend' : __props1.variant)}
      class={cn('cn-field-legend', __props1.className ?? __props1.class)}
      {...omitProps(__props1, ['className', 'variant'])}
    />
  );
}
function FieldGroup(__props2: ComponentProps<'div'>) {
  return (
    <div
      data-slot="field-group"
      class={cn(
        'cn-field-group group/field-group @container/field-group flex w-full flex-col',
        __props2.className ?? __props2.class,
      )}
      {...omitProps(__props2, ['className'])}
    />
  );
}
const fieldVariants = cva('cn-field group/field flex w-full', {
  variants: {
    orientation: {
      vertical: 'cn-field-orientation-vertical flex-col *:w-full [&>.sr-only]:w-auto',
      horizontal:
        'cn-field-orientation-horizontal flex-row items-center has-[>[data-slot=field-content]]:items-start *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px',
      responsive:
        'cn-field-orientation-responsive flex-col *:w-full @md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:*:data-[slot=field-label]:flex-auto [&>.sr-only]:w-auto @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px',
    },
  },
  defaultVariants: {
    orientation: 'vertical',
  },
});
function Field(__props3: ComponentProps<'div'> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={dataValue(
        __props3.orientation === undefined ? 'vertical' : __props3.orientation,
      )}
      class={cn(
        fieldVariants({
          get orientation() {
            return __props3.orientation === undefined ? 'vertical' : __props3.orientation;
          },
        }),
        __props3.className ?? __props3.class,
      )}
      {...omitProps(__props3, ['className', 'orientation'])}
    />
  );
}
function FieldContent(__props4: ComponentProps<'div'>) {
  return (
    <div
      data-slot="field-content"
      class={cn(
        'cn-field-content group/field-content flex flex-1 flex-col leading-snug',
        __props4.className ?? __props4.class,
      )}
      {...omitProps(__props4, ['className'])}
    />
  );
}
function FieldLabel(__props5: ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      class={cn(
        'cn-field-label group/field-label peer/field-label flex w-fit',
        'has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col',
        __props5.className ?? __props5.class,
      )}
      {...omitProps(__props5, ['className'])}
    />
  );
}
function FieldTitle(__props6: ComponentProps<'div'>) {
  return (
    <div
      data-slot="field-label"
      class={cn('cn-field-title flex w-fit items-center', __props6.className ?? __props6.class)}
      {...omitProps(__props6, ['className'])}
    />
  );
}
function FieldDescription(__props7: ComponentProps<'p'>) {
  return (
    <p
      data-slot="field-description"
      class={cn(
        'cn-field-description leading-normal font-normal group-has-data-horizontal/field:text-balance',
        'last:mt-0 nth-last-2:-mt-1',
        '[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary',
        __props7.className ?? __props7.class,
      )}
      {...omitProps(__props7, ['className'])}
    />
  );
}
function FieldSeparator(
  __props8: ComponentProps<'div'> & {
    children?: JSX.Element;
  },
) {
  return (
    <div
      data-slot="field-separator"
      data-content={dataValue(!!__props8.children)}
      class={cn('cn-field-separator relative', __props8.className ?? __props8.class)}
      {...omitProps(__props8, ['children', 'className'])}
    >
      <Separator class="absolute inset-0 top-1/2" />
      {__props8.children && (
        <span
          class="cn-field-separator-content relative mx-auto block w-fit bg-background"
          data-slot="field-separator-content"
        >
          {__props8.children}
        </span>
      )}
    </div>
  );
}
function FieldError(
  __props9: ComponentProps<'div'> & {
    errors?: Array<
      | {
          message?: string;
        }
      | undefined
    >;
  },
) {
  const content = createMemo(() => {
    if (__props9.children) {
      return __props9.children;
    }
    if (!__props9.errors?.length) {
      return null;
    }
    const uniqueErrors = [
      ...new Map(__props9.errors.map((error) => [error?.message, error])).values(),
    ];
    if (uniqueErrors?.length == 1) {
      return uniqueErrors[0]?.message;
    }
    return (
      <ul class="ml-4 flex list-disc flex-col gap-1">
        {uniqueErrors.map((error, index) => error?.message && <li>{error.message}</li>)}
      </ul>
    );
  });
  const __view = createMemo(() => {
    if (!content()) {
      return null;
    }
    return (
      <div
        role="alert"
        data-slot="field-error"
        class={cn('cn-field-error font-normal', __props9.className ?? __props9.class)}
        {...omitProps(__props9, ['className', 'children', 'errors'])}
      >
        {content()}
      </div>
    );
  });
  return <>{__view()}</>;
}
export {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
};
