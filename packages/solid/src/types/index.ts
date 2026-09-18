import type { JSX } from '@solidjs/web';
import type { Ref } from '../core';

export type {
  BaseProps as BaseUIComponentProps,
  ChangeEventDetails as BaseUIChangeEventDetails,
  Ref,
} from '../core';
export type Orientation = 'horizontal' | 'vertical';
export type * from '../tabs/types';

/** Native HTML props for a Solid element, including the Base UI ref contract. */
export type HTMLProps<T = any> = JSX.HTMLAttributes<T> & { ref?: Ref<T> };

/** A Solid render callback receives element props and the component state. */
export type ComponentRenderFn<Props, State> = (props: Props, state: State) => JSX.Element;

/** Base UI extends a native event before it calls merged event handlers. */
export type BaseUIEvent<E extends Event = Event> = E & {
  preventBaseUIHandler: () => void;
  readonly baseUIHandlerPrevented?: boolean;
};

interface ReasonToEventMap {
  none: Event;
  'trigger-press': MouseEvent | PointerEvent | TouchEvent | KeyboardEvent;
  'trigger-hover': MouseEvent;
  'trigger-focus': FocusEvent;
  'outside-press': MouseEvent | PointerEvent | TouchEvent;
  'item-press': MouseEvent | KeyboardEvent | PointerEvent;
  'close-press': MouseEvent | KeyboardEvent | PointerEvent;
  'link-press': MouseEvent | PointerEvent;
  'clear-press': PointerEvent | MouseEvent | KeyboardEvent;
  'chip-remove-press': PointerEvent | MouseEvent | KeyboardEvent;
  'track-press': PointerEvent | MouseEvent | TouchEvent;
  'increment-press': PointerEvent | MouseEvent | TouchEvent;
  'decrement-press': PointerEvent | MouseEvent | TouchEvent;
  'input-change': InputEvent | Event;
  'input-clear': InputEvent | FocusEvent | Event;
  'input-blur': FocusEvent;
  'input-paste': ClipboardEvent;
  'input-press': MouseEvent | PointerEvent | TouchEvent | KeyboardEvent;
  'focus-out': FocusEvent | KeyboardEvent;
  'escape-key': KeyboardEvent;
  'close-watcher': Event;
  'list-navigation': KeyboardEvent;
  keyboard: KeyboardEvent;
  pointer: PointerEvent;
  drag: PointerEvent | TouchEvent;
  swipe: PointerEvent | TouchEvent;
  wheel: WheelEvent;
  scrub: PointerEvent;
  'cancel-open': MouseEvent;
  'sibling-open': Event;
  disabled: Event;
  missing: Event;
  initial: Event;
  'imperative-action': Event;
  'window-resize': UIEvent;
}

type ReasonToEvent<Reason extends string> = Reason extends keyof ReasonToEventMap
  ? ReasonToEventMap[Reason]
  : Event;

/** Details of a Base UI event that does not support cancellation. */
export type BaseUIGenericEventDetails<
  Reason extends string,
  CustomProperties extends object = {},
> = Reason extends string
  ? { reason: Reason; event: ReasonToEvent<Reason> } & CustomProperties
  : never;
