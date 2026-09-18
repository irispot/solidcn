import type { JSX } from '@solidjs/web';
import type { VirtualElement } from '@floating-ui/dom';
import type { BaseProps, ChangeEventDetails, Ref } from '../core';
import type { PopupHandle } from '../overlays';

type Side = NonNullable<BaseProps['side']>;
type Align = NonNullable<BaseProps['align']>;
type EmptyState = Record<never, never>;
type PortalContainer = HTMLElement | ShadowRoot | { current: HTMLElement | ShadowRoot | null } | null;

export type TooltipProviderState = EmptyState;
export interface TooltipProviderProps {
  children?: JSX.Element;
  delay?: number;
  closeDelay?: number;
  timeout?: number;
}
export namespace TooltipProvider {
  export type State = TooltipProviderState;
  export type Props = TooltipProviderProps;
}

export type TooltipRootState = EmptyState;
export type TooltipRootChangeEventReason =
  | 'trigger-hover' | 'trigger-focus' | 'trigger-press' | 'outside-press'
  | 'escape-key' | 'focus-out' | 'disabled' | 'imperative-action' | 'none';
export type TooltipRootChangeEventDetails = Omit<ChangeEventDetails, 'reason'> & {
  reason: TooltipRootChangeEventReason;
  preventUnmountOnClose(): void;
};
export interface TooltipRootActions {
  close(): void;
  unmount(): void;
}
export interface TooltipRootProps<Payload = unknown> {
  children?: JSX.Element | ((state: { payload: Payload | undefined }) => JSX.Element);
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: TooltipRootChangeEventDetails) => void;
  onOpenChangeComplete?: (open: boolean) => void;
  actionsRef?: Ref<TooltipRootActions>;
  disableHoverablePopup?: boolean;
  trackCursorAxis?: 'none' | 'x' | 'y' | 'both';
  disabled?: boolean;
  handle?: PopupHandle<Payload>;
  triggerId?: string | null;
  defaultTriggerId?: string | null;
}
export namespace TooltipRoot {
  export type State = TooltipRootState;
  export type Props<Payload = unknown> = TooltipRootProps<Payload>;
  export type Actions = TooltipRootActions;
  export type ChangeEventReason = TooltipRootChangeEventReason;
  export type ChangeEventDetails = TooltipRootChangeEventDetails;
}

export interface TooltipTriggerState {
  open: boolean;
  disabled: boolean;
}
export interface TooltipTriggerProps<Payload = unknown> extends BaseProps<TooltipTriggerState> {
  handle?: PopupHandle<Payload>;
  payload?: Payload;
  delay?: number;
  closeDelay?: number;
  closeOnClick?: boolean;
  disabled?: boolean;
}
export namespace TooltipTrigger {
  export type State = TooltipTriggerState;
  export type Props<Payload = unknown> = TooltipTriggerProps<Payload>;
}

export type TooltipPortalState = EmptyState;
export interface TooltipPortalProps extends BaseProps<TooltipPortalState> {
  keepMounted?: boolean;
  container?: PortalContainer;
  mount?: HTMLElement;
}
export namespace TooltipPortal {
  export type State = TooltipPortalState;
  export type Props = TooltipPortalProps;
}

export interface TooltipPositionerState {
  open: boolean;
  closed: boolean;
  side: Side;
  align: Align;
}
export interface TooltipPositionerProps extends BaseProps<TooltipPositionerState> {
  anchor?: Element | VirtualElement | { current: Element | VirtualElement | null } |
    (() => Element | VirtualElement | undefined);
  positionMethod?: 'absolute' | 'fixed';
  collisionPadding?: number;
  arrowPadding?: number;
  keepMounted?: boolean;
  onPositioned?: () => void;
}
export namespace TooltipPositioner {
  export type State = TooltipPositionerState;
  export type Props = TooltipPositionerProps;
}

export interface TooltipPopupState extends TooltipPositionerState {
  startingStyle: boolean;
  endingStyle: boolean;
}
export interface TooltipPopupProps extends BaseProps<TooltipPopupState> {
  keepMounted?: boolean;
}
export namespace TooltipPopup {
  export type State = TooltipPopupState;
  export type Props = TooltipPopupProps;
}

export interface TooltipArrowState {
  side: Side;
}
export type TooltipArrowProps = BaseProps<TooltipArrowState>;
export namespace TooltipArrow {
  export type State = TooltipArrowState;
  export type Props = TooltipArrowProps;
}

// Native Viewport is a plain container; React's transition state is not implemented yet.
export type TooltipViewportProps = BaseProps;
export namespace TooltipViewport {
  export type Props = TooltipViewportProps;
}
