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
import { Questionnaire as QuestionnairePrimitive } from './internal/questionnaire';
import { cn } from './utils';
import { buttonVariants, type Button } from './button';
import { IconPlaceholder } from './icons';
function Questionnaire(__props0: ComponentProps<typeof QuestionnairePrimitive.Root>) {
  return (
    <QuestionnairePrimitive.Root
      data-slot="questionnaire"
      class={cn(
        'cn-questionnaire flex w-full min-w-0 flex-col',
        __props0.className ?? __props0.class,
      )}
      {...omitProps(__props0, ['className'])}
    />
  );
}
function QuestionnaireProgress(__props1: ComponentProps<typeof QuestionnairePrimitive.Progress>) {
  return (
    <QuestionnairePrimitive.Progress
      data-slot="questionnaire-progress"
      class={cn(
        'cn-questionnaire-progress min-h-[1lh] w-fit min-w-[14ch] font-medium text-muted-foreground tabular-nums',
        __props1.className ?? __props1.class,
      )}
      {...omitProps(__props1, ['className'])}
    />
  );
}
function QuestionnaireItem(__props2: ComponentProps<typeof QuestionnairePrimitive.Item>) {
  return (
    <QuestionnairePrimitive.Item
      data-slot="questionnaire-item"
      class={cn(
        'cn-questionnaire-item min-w-0 border-0 p-0 outline-none',
        __props2.className ?? __props2.class,
      )}
      {...omitProps(__props2, ['className'])}
    />
  );
}
function QuestionnaireTitle(__props3: ComponentProps<typeof QuestionnairePrimitive.Title>) {
  return (
    <QuestionnairePrimitive.Title
      data-slot="questionnaire-title"
      class={cn(
        'cn-questionnaire-title cn-font-heading text-pretty',
        __props3.className ?? __props3.class,
      )}
      {...omitProps(__props3, ['className'])}
    />
  );
}
function QuestionnaireDescription(
  __props4: ComponentProps<typeof QuestionnairePrimitive.Description>,
) {
  return (
    <QuestionnairePrimitive.Description
      data-slot="questionnaire-description"
      class={cn(
        'cn-questionnaire-description text-pretty text-muted-foreground',
        __props4.className ?? __props4.class,
      )}
      {...omitProps(__props4, ['className'])}
    />
  );
}
function QuestionnaireChoices(__props5: ComponentProps<typeof QuestionnairePrimitive.Choices>) {
  return (
    <QuestionnairePrimitive.Choices
      data-slot="questionnaire-choices"
      class={cn(
        'cn-questionnaire-choices group/questionnaire-choices grid min-w-0',
        __props5.className ?? __props5.class,
      )}
      {...omitProps(__props5, ['className'])}
    />
  );
}
function QuestionnaireChoice(__props6: ComponentProps<typeof QuestionnairePrimitive.Choice>) {
  return (
    <QuestionnairePrimitive.Choice
      data-slot="questionnaire-choice"
      class={cn(
        'cn-questionnaire-choice group/questionnaire-choice relative flex min-h-11 cursor-pointer items-start text-start transition-colors outline-none select-none',
        'data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-50',
        __props6.className ?? __props6.class,
      )}
      {...omitProps(__props6, ['children', 'className'])}
    >
      <QuestionnairePrimitive.ChoiceInput
        data-slot="questionnaire-choice-input"
        class="cn-questionnaire-choice-input absolute inset-0 z-10 size-full cursor-pointer opacity-0"
      />
      <span
        aria-hidden="true"
        data-slot="questionnaire-choice-indicator"
        class="cn-questionnaire-choice-indicator pointer-events-none relative flex shrink-0 items-center justify-center border group-data-[type=radio]/questionnaire-choice:rounded-full"
      >
        <span
          data-slot="questionnaire-choice-indicator-dot"
          class="cn-questionnaire-choice-indicator-dot hidden rounded-full group-data-[type=checkbox]/questionnaire-choice:hidden group-data-checked/questionnaire-choice:block"
        />
        <IconPlaceholder
          data-slot="questionnaire-choice-indicator-check"
          class="cn-questionnaire-choice-indicator-check hidden group-data-[type=radio]/questionnaire-choice:hidden group-data-checked/questionnaire-choice:block"
          lucide="CheckIcon"
          tabler="IconCheck"
          hugeicons="Tick02Icon"
          phosphor="CheckIcon"
          remixicon="RiCheckLine"
        />
      </span>
      <QuestionnairePrimitive.ChoiceLabel
        data-slot="questionnaire-choice-label"
        class="cn-questionnaire-choice-label cn-questionnaire-choice-content flex min-w-0 flex-1 flex-col leading-snug"
      >
        {__props6.children}
      </QuestionnairePrimitive.ChoiceLabel>
      <QuestionnairePrimitive.ChoiceShortcut
        data-slot="questionnaire-choice-shortcut"
        class="cn-questionnaire-choice-shortcut cn-questionnaire-shortcut pointer-events-none ms-auto hidden shrink-0 group-data-[shortcut]/questionnaire-choice:inline-flex"
      />
    </QuestionnairePrimitive.Choice>
  );
}
function QuestionnaireChoiceDescription(__props7: ComponentProps<'span'>) {
  return (
    <span
      data-slot="questionnaire-choice-description"
      class={cn('cn-questionnaire-choice-description', __props7.className ?? __props7.class)}
      {...omitProps(__props7, ['className'])}
    />
  );
}
function QuestionnaireInput(__props8: ComponentProps<typeof QuestionnairePrimitive.Input>) {
  return (
    <div
      data-slot="questionnaire-input-wrapper"
      class="cn-questionnaire-input-wrapper group/questionnaire-input relative min-w-0"
    >
      <QuestionnairePrimitive.Input
        data-slot="questionnaire-input"
        class={cn(
          'cn-questionnaire-input min-h-11 w-full min-w-0 transition-[color,box-shadow,background-color] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0',
          'selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground',
          __props8.className ?? __props8.class,
        )}
        {...omitProps(__props8, ['className'])}
      />
    </div>
  );
}
function QuestionnaireError(__props9: ComponentProps<typeof QuestionnairePrimitive.Error>) {
  return (
    <QuestionnairePrimitive.Error
      data-slot="questionnaire-error"
      class={cn('cn-questionnaire-error text-destructive', __props9.className ?? __props9.class)}
      {...omitProps(__props9, ['className'])}
    />
  );
}
function QuestionnaireActions(__props10: ComponentProps<'div'>) {
  return (
    <div
      data-slot="questionnaire-actions"
      class={cn(
        'cn-questionnaire-actions grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center',
        __props10.className ?? __props10.class,
      )}
      {...omitProps(__props10, ['className'])}
    />
  );
}
function QuestionnairePrevious(
  __props11: ComponentProps<typeof QuestionnairePrimitive.Previous> &
    Partial<Pick<ComponentProps<typeof Button>, 'size' | 'variant'>>,
) {
  return (
    <QuestionnairePrimitive.Previous
      data-slot="questionnaire-previous"
      data-size={dataValue(__props11.size === undefined ? 'default' : __props11.size)}
      data-variant={dataValue(__props11.variant === undefined ? 'outline' : __props11.variant)}
      class={cn(
        buttonVariants({
          get size() {
            return __props11.size === undefined ? 'default' : __props11.size;
          },
          get variant() {
            return __props11.variant === undefined ? 'outline' : __props11.variant;
          },
        }),
        'cn-questionnaire-previous col-start-1 row-start-1 min-h-11 justify-self-start sm:min-h-0',
        __props11.className ?? __props11.class,
      )}
      {...omitProps(__props11, ['children', 'className', 'size', 'variant'])}
    >
      {__props11.children ?? 'Previous'}
    </QuestionnairePrimitive.Previous>
  );
}
function QuestionnaireSkip(
  __props12: ComponentProps<typeof QuestionnairePrimitive.Skip> &
    Partial<Pick<ComponentProps<typeof Button>, 'size' | 'variant'>>,
) {
  return (
    <QuestionnairePrimitive.Skip
      data-slot="questionnaire-skip"
      data-size={dataValue(__props12.size === undefined ? 'default' : __props12.size)}
      data-variant={dataValue(__props12.variant === undefined ? 'outline' : __props12.variant)}
      class={cn(
        buttonVariants({
          get size() {
            return __props12.size === undefined ? 'default' : __props12.size;
          },
          get variant() {
            return __props12.variant === undefined ? 'outline' : __props12.variant;
          },
        }),
        'cn-questionnaire-skip col-start-2 row-start-1 min-h-11 justify-self-end sm:min-h-0',
        __props12.className ?? __props12.class,
      )}
      {...omitProps(__props12, ['children', 'className', 'size', 'variant'])}
    >
      {__props12.children ?? 'Skip'}
    </QuestionnairePrimitive.Skip>
  );
}
function QuestionnaireNext(
  __props13: ComponentProps<typeof QuestionnairePrimitive.Next> &
    Partial<Pick<ComponentProps<typeof Button>, 'size' | 'variant'>>,
) {
  return (
    <QuestionnairePrimitive.Next
      data-slot="questionnaire-next"
      data-size={dataValue(__props13.size === undefined ? 'default' : __props13.size)}
      data-variant={dataValue(__props13.variant === undefined ? 'default' : __props13.variant)}
      class={cn(
        buttonVariants({
          get size() {
            return __props13.size === undefined ? 'default' : __props13.size;
          },
          get variant() {
            return __props13.variant === undefined ? 'default' : __props13.variant;
          },
        }),
        'cn-questionnaire-next col-start-3 row-start-1 min-h-11 justify-self-end sm:min-h-0',
        __props13.className ?? __props13.class,
      )}
      {...omitProps(__props13, ['children', 'className', 'size', 'variant'])}
    >
      {__props13.children ?? 'Next'}
    </QuestionnairePrimitive.Next>
  );
}
function QuestionnaireSubmit(
  __props14: ComponentProps<typeof QuestionnairePrimitive.Submit> &
    Partial<Pick<ComponentProps<typeof Button>, 'size' | 'variant'>>,
) {
  return (
    <QuestionnairePrimitive.Submit
      data-slot="questionnaire-submit"
      data-size={dataValue(__props14.size === undefined ? 'default' : __props14.size)}
      data-variant={dataValue(__props14.variant === undefined ? 'default' : __props14.variant)}
      class={cn(
        buttonVariants({
          get size() {
            return __props14.size === undefined ? 'default' : __props14.size;
          },
          get variant() {
            return __props14.variant === undefined ? 'default' : __props14.variant;
          },
        }),
        'cn-questionnaire-submit col-start-3 row-start-1 min-h-11 justify-self-end sm:min-h-0',
        __props14.className ?? __props14.class,
      )}
      {...omitProps(__props14, ['children', 'className', 'size', 'variant'])}
    >
      {__props14.children ?? 'Submit'}
    </QuestionnairePrimitive.Submit>
  );
}
export {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,
};
