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
import { cn } from './utils';
import { OTPInput, OTPInputContext } from './internal/input-otp';
import { IconPlaceholder } from './icons';
function InputOTP(
  __props0: ComponentProps<typeof OTPInput> & {
    containerClassName?: string;
  },
) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn(
        'cn-input-otp flex items-center has-disabled:opacity-50',
        __props0.containerClassName,
      )}
      spellcheck="false"
      class={cn(
        'cn-input-otp-input disabled:cursor-not-allowed',
        __props0.className ?? __props0.class,
      )}
      {...omitProps(__props0, ['className', 'containerClassName'])}
    />
  );
}
function InputOTPGroup(__props1: ComponentProps<'div'>) {
  return (
    <div
      data-slot="input-otp-group"
      class={cn('cn-input-otp-group flex items-center', __props1.className ?? __props1.class)}
      {...omitProps(__props1, ['className'])}
    />
  );
}
function InputOTPSlot(
  __props2: ComponentProps<'div'> & {
    index: number;
  },
) {
  const inputOTPContext = useContext(OTPInputContext);
  const __local3 = () =>
    inputOTPContext?.slots[__props2.index] ?? { char: null, isActive: false, hasFakeCaret: false };
  return (
    <div
      data-slot="input-otp-slot"
      data-active={dataValue(__local3().isActive)}
      class={cn(
        'cn-input-otp-slot relative flex items-center justify-center data-[active=true]:z-10',
        __props2.className ?? __props2.class,
      )}
      {...omitProps(__props2, ['index', 'className'])}
    >
      {__local3().char}
      {__local3().hasFakeCaret && (
        <div class="cn-input-otp-caret pointer-events-none absolute inset-0 flex items-center justify-center">
          <div class="cn-input-otp-caret-line" />
        </div>
      )}
    </div>
  );
}
function InputOTPSeparator(__props4: ComponentProps<'div'>) {
  return (
    <div
      data-slot="input-otp-separator"
      class="cn-input-otp-separator flex items-center"
      role="separator"
      {...omitProps(__props4, [])}
    >
      <IconPlaceholder
        lucide="MinusIcon"
        tabler="IconMinus"
        hugeicons="MinusSignIcon"
        phosphor="MinusIcon"
        remixicon="RiSubtractLine"
      />
    </div>
  );
}
export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
