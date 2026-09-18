import type { JSX } from '@solidjs/web';
import type { VirtualElement } from '@floating-ui/dom';
import type { BaseProps, ChangeEventDetails, Ref } from '../core';
import type { PopupHandle } from '../overlays';

type Side = NonNullable<BaseProps['side']>;
type Align = NonNullable<BaseProps['align']>;
type EmptyState = Record<never, never>;
type PortalContainer = HTMLElement | ShadowRoot | { current: HTMLElement | ShadowRoot | null } | null;
type FocusTarget = boolean | HTMLElement | { current: HTMLElement | null } | (() => HTMLElement | false | undefined | null);

export type PopoverRootState = EmptyState;
export type PopoverRootChangeEventReason =
  | 'trigger-hover' | 'trigger-focus' | 'trigger-press' | 'outside-press'
  | 'escape-key' | 'close-press' | 'focus-out' | 'imperative-action' | 'none';
export type PopoverRootChangeEventDetails = Omit<ChangeEventDetails, 'reason'> & {
  reason: PopoverRootChangeEventReason;
  trigger?: HTMLElement;
  preventUnmountOnClose(): void;
};
export interface PopoverRootActions {
  close(): void;
  unmount(): void;
}
export interface PopoverRootProps<Payload = unknown> {
  children?: JSX.Element | ((state: { payload: Payload | undefined }) => JSX.Element);
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: PopoverRootChangeEventDetails) => void;
  onOpenChangeComplete?: (open: boolean) => void;
  actionsRef?: Ref<PopoverRootActions>;
  modal?: boolean | 'trap-focus';
  triggerId?: string | null;
  defaultTriggerId?: string | null;
  handle?: PopupHandle<Payload>;
}
export namespace PopoverRoot {
  export type State = PopoverRootState;
  export type Props<Payload = unknown> = PopoverRootProps<Payload>;
  export type Actions = PopoverRootActions;
  export type ChangeEventReason = PopoverRootChangeEventReason;
  export type ChangeEventDetails = PopoverRootChangeEventDetails;
}

export interface PopoverTriggerState {
  open: boolean;
  disabled: boolean;
}
export interface PopoverTriggerProps<Payload = unknown> extends BaseProps<PopoverTriggerState> {
  nativeButton?: boolean;
  handle?: PopupHandle<Payload>;
  payload?: Payload;
  id?: string;
  openOnHover?: boolean;
  delay?: number;
  closeDelay?: number;
  disabled?: boolean;
}
export namespace PopoverTrigger {
  export type State = PopoverTriggerState;
  export type Props<Payload = unknown> = PopoverTriggerProps<Payload>;
}

export type PopoverPortalState = EmptyState;
export interface PopoverPortalProps extends BaseProps<PopoverPortalState> {
  keepMounted?: boolean;
  container?: PortalContainer;
  mount?: HTMLElement;
}
export namespace PopoverPortal {
  export type State = PopoverPortalState;
  export type Props = PopoverPortalProps;
}

export interface PopoverPositionerState {
  open: boolean;
  closed: boolean;
  side: Side;
  align: Align;
}
export interface PopoverPositionerProps extends BaseProps<PopoverPositionerState> {
  anchor?: Element | VirtualElement | { current: Element | VirtualElement | null } |
    (() => Element | VirtualElement | undefined);
  positionMethod?: 'absolute' | 'fixed';
  collisionPadding?: number;
  arrowPadding?: number;
  keepMounted?: boolean;
  onPositioned?: () => void;
}
export namespace PopoverPositioner {
  export type State = PopoverPositionerState;
  export type Props = PopoverPositionerProps;
}

export interface PopoverPopupState extends PopoverPositionerState {
  startingStyle: boolean;
  endingStyle: boolean;
}
export interface PopoverPopupProps extends BaseProps<PopoverPopupState> {
  initialFocus?: FocusTarget;
  finalFocus?: FocusTarget;
  keepMounted?: boolean;
}
export namespace PopoverPopup {
  export type State = PopoverPopupState;
  export type Props = PopoverPopupProps;
}

export interface PopoverArrowState {
  side: Side;
}
export type PopoverArrowProps = BaseProps<PopoverArrowState>;
export namespace PopoverArrow {
  export type State = PopoverArrowState;
  export type Props = PopoverArrowProps;
}

export interface PopoverBackdropState {
  open: boolean;
  closed: boolean;
  startingStyle: boolean;
  endingStyle: boolean;
}
export type PopoverBackdropProps = BaseProps<PopoverBackdropState>;
export namespace PopoverBackdrop {
  export type State = PopoverBackdropState;
  export type Props = PopoverBackdropProps;
}

export type PopoverTitleState = EmptyState;
export type PopoverTitleProps = BaseProps<PopoverTitleState>;
export namespace PopoverTitle {
  export type State = PopoverTitleState;
  export type Props = PopoverTitleProps;
}

export type PopoverDescriptionState = EmptyState;
export type PopoverDescriptionProps = BaseProps<PopoverDescriptionState>;
export namespace PopoverDescription {
  export type State = PopoverDescriptionState;
  export type Props = PopoverDescriptionProps;
}

export type PopoverCloseState = EmptyState;
export type PopoverCloseProps = BaseProps<PopoverCloseState>;
export namespace PopoverClose {
  export type State = PopoverCloseState;
  export type Props = PopoverCloseProps;
}

// Native Viewport is a plain container; React's transition state is not implemented yet.
export type PopoverViewportProps = BaseProps;
export namespace PopoverViewport {
  export type Props = PopoverViewportProps;
}
