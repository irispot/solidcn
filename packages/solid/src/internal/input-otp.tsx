import { createContext, createEffect, createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { omitProps, type ComponentProps } from '../utils';
function forwardEvent<E extends Event>(handler: unknown, event: E) {
  if (typeof handler === 'function') handler(event);
  else if (Array.isArray(handler) && typeof handler[0] === 'function') handler[0](handler[1], event);
}
type Slot = {
  char: string | null;
  placeholderChar: string | null;
  hasFakeCaret: boolean;
  isActive: boolean;
};
export const OTPInputContext = createContext<{
  slots: Slot[];
  isFocused: boolean;
  isHovering: boolean;
} | null>(null);
export type OTPInputProps = Omit<
  ComponentProps<'input'>,
  'children' | 'onChange' | 'value' | 'defaultValue' | 'pattern'
> & {
  maxLength: number;
  value?: string;
  defaultValue?: string;
  pattern?: string | RegExp;
  onChange?: (value: string) => void;
  onComplete?: (value: string) => void;
  containerClassName?: string;
  children?: JSX.Element;
  render?: (state: { slots: Slot[]; isFocused: boolean; isHovering: boolean }) => JSX.Element;
  pasteTransformer?: (text: string) => string;
  inputMode?: ComponentProps<'input'>['inputmode'];
  textAlign?: 'left' | 'center' | 'right';
  pushPasswordManagerStrategy?: 'increase-width' | 'none';
  noScriptCSSFallback?: string | null;
};
export function OTPInput(props: OTPInputProps) {
  const [value, setValue] = createSignal(props.defaultValue ?? '');
  const [focused, setFocused] = createSignal(false);
  const initialSelection = Math.min((props.value ?? props.defaultValue ?? '').length, props.maxLength);
  const [caret, setCaret] = createSignal(initialSelection);
  const [selectionEnd, setSelectionEnd] = createSignal(initialSelection);
  const [hover, setHover] = createSignal(false);
  const [containerHeight, setContainerHeight] = createSignal<number>();
  const [container, setContainer] = createSignal<HTMLDivElement>();
  createEffect(container, (element) => {
    if (!element) return;
    if (!element.ownerDocument.getElementById('input-otp-style')) {
      const style = element.ownerDocument.createElement('style');
      style.id = 'input-otp-style';
      style.textContent =
        '[data-input-otp]::selection { background: transparent !important; color: transparent !important; }';
      element.ownerDocument.head.append(style);
    }
    const measure = () => setContainerHeight(element.getBoundingClientRect().height);
    measure();
    const Observer = element.ownerDocument.defaultView?.ResizeObserver;
    if (!Observer) return;
    const observer = new Observer(measure);
    observer.observe(element);
    return () => observer.disconnect();
  });
  const current = () => props.value ?? value();
  let previousValue: string | undefined;
  createEffect(current, (next) => {
    if (previousValue !== undefined && previousValue.length < props.maxLength && next.length === props.maxLength)
      props.onComplete?.(next);
    previousValue = next;
  });
  const context = {
    get slots() {
      return Array.from({ length: props.maxLength }, (_, index) => ({
        char: current()[index] ?? null,
        placeholderChar:
          current().length === 0 && typeof props.placeholder === 'string'
            ? props.placeholder[index] ?? null
            : null,
        isActive:
          focused() &&
          (caret() === selectionEnd()
            ? index === Math.min(caret(), props.maxLength - 1)
            : index >= caret() && index < selectionEnd()),
        hasFakeCaret: focused() && index === caret() && !current()[index],
      }));
    },
    get isFocused() {
      return focused();
    },
    get isHovering() {
      return !props.disabled && hover();
    },
  };
  const commit = (next: string) => {
    const limited = next.slice(0, props.maxLength);
    const pattern =
      typeof props.pattern === 'string' ? new RegExp(props.pattern) : props.pattern;
    if (pattern && limited && !pattern.test(limited)) return false;
    setValue(limited);
    props.onChange?.(limited);
    return true;
  };
  let input!: HTMLInputElement;
  createEffect(current, (next) => input?.setAttribute('value', next), { ssrSource: 'client' });
  return (
    <OTPInputContext value={context}>
      <div
        ref={setContainer}
        data-input-otp-container="true"
        class={props.containerClassName}
        style={{
          position: 'relative',
          cursor: props.disabled ? 'default' : 'text',
          'user-select': 'none',
          'pointer-events': 'none',
          '--root-height': containerHeight() === undefined ? undefined : `${containerHeight()}px`,
        }}
        onClick={() => input?.focus()}
      >
        {props.render?.(context) ?? props.children}
        <div style={{ position: 'absolute', inset: '0', 'pointer-events': 'none' }}>
          <input
            data-input-otp="true"
            data-input-otp-placeholder-shown={current().length === 0 ? 'true' : undefined}
            data-input-otp-mss={caret()}
            data-input-otp-mse={selectionEnd()}
            {...omitProps(props, [
              'children',
              'render',
              'onChange',
              'onComplete',
              'containerClassName',
              'pasteTransformer',
              'defaultValue',
              'textAlign',
              'pushPasswordManagerStrategy',
              'noScriptCSSFallback',
              'inputMode',
              'inputmode',
              'pattern',
              'onInput',
              'onFocus',
              'onBlur',
              'onSelect',
              'onPaste',
              'onMouseOver',
              'onMouseLeave',
              'ref',
            ])}
            ref={(element) => {
              input = element;
              element.setAttribute('value', current());
              element.setSelectionRange(initialSelection, initialSelection);
              props.ref?.(element);
            }}
            value={current()}
            maxlength={props.maxLength}
            inputmode={props.inputMode ?? props.inputmode ?? 'numeric'}
            pattern={props.pattern instanceof RegExp ? props.pattern.source : props.pattern}
            autocomplete="one-time-code"
            aria-placeholder={props.placeholder}
            style={{
              position: 'absolute',
              inset: '0',
              width: '100%',
              height: '100%',
              display: 'flex',
              'text-align': props.textAlign ?? 'left',
              opacity: '1',
              color: 'transparent',
              'pointer-events': 'all',
              background: 'transparent',
              'caret-color': 'transparent',
              border: '0 solid transparent',
              outline: '0 solid transparent',
              'box-shadow': 'none',
              'line-height': '1',
              'letter-spacing': '-.5em',
              'font-size': 'var(--root-height)',
              'font-family': 'monospace',
              'font-variant-numeric': 'tabular-nums',
            }}
            onInput={(event) => {
              if (!commit(event.currentTarget.value)) {
                const position = Math.min(event.currentTarget.selectionStart ?? 0, current().length);
                event.currentTarget.value = current();
                event.currentTarget.setSelectionRange(position, position);
                setCaret(position);
                setSelectionEnd(position);
                forwardEvent(props.onInput, event);
                return;
              }
              const position = event.currentTarget.selectionStart ?? 0;
              if (
                event.currentTarget.value.length === props.maxLength &&
                position === props.maxLength &&
                event.currentTarget.selectionEnd === position
              ) {
                event.currentTarget.setSelectionRange(position - 1, position, 'backward');
                setCaret(position - 1);
                setSelectionEnd(position);
              } else {
                setCaret(position);
                setSelectionEnd(event.currentTarget.selectionEnd ?? position);
              }
              forwardEvent(props.onInput, event);
            }}
            onFocus={(event) => {
              const end = event.currentTarget.value.length;
              const start = Math.min(end, props.maxLength - 1);
              event.currentTarget.setSelectionRange(start, end);
              setCaret(start);
              setSelectionEnd(end);
              setFocused(true);
              forwardEvent(props.onFocus, event);
            }}
            onBlur={(event) => {
              setFocused(false);
              forwardEvent(props.onBlur, event);
            }}
            onSelect={(event) => {
              setCaret(input.selectionStart ?? 0);
              setSelectionEnd(input.selectionEnd ?? 0);
              forwardEvent(props.onSelect, event);
            }}
            onMouseOver={(event) => {
              setHover(true);
              forwardEvent(props.onMouseOver, event);
            }}
            onMouseLeave={(event) => {
              setHover(false);
              forwardEvent(props.onMouseLeave, event);
            }}
            onPaste={(event) => {
              if (props.pasteTransformer) {
                event.preventDefault();
                const text = props.pasteTransformer(event.clipboardData?.getData('text') ?? '');
                const start = input.selectionStart ?? 0;
                commit(current().slice(0, start) + text + current().slice(input.selectionEnd ?? start));
                setCaret(Math.min(start + text.length, props.maxLength));
              }
              forwardEvent(props.onPaste, event);
            }}
          />
        </div>
      </div>
    </OTPInputContext>
  );
}
