import type { BaseProps } from '../core';
import type {
  ToolbarRootOrientation as NativeRootOrientation,
  ToolbarRootProps as NativeRootProps,
  ToolbarRootState as NativeRootState,
  ToolbarSeparatorProps as NativeSeparatorProps,
  ToolbarSeparatorState as NativeSeparatorState,
} from '../structure';

export type Orientation = NativeRootOrientation;
export type ToolbarRootOrientation = Orientation;
export type ToolbarRootState = NativeRootState;
export type ToolbarRootProps = NativeRootProps;

/** Facts used by native toolbar roving focus to select an available item. */
export interface ToolbarRootItemMetadata {
  disabled: boolean;
  focusableWhenDisabled: boolean;
}
export namespace ToolbarRoot {
  export type ItemMetadata = ToolbarRootItemMetadata;
  export type Orientation = ToolbarRootOrientation;
  export type State = ToolbarRootState;
  export type Props = ToolbarRootProps;
}

export interface ToolbarGroupState extends ToolbarRootState {}
export interface ToolbarGroupProps extends BaseProps<ToolbarGroupState> {
  disabled?: boolean;
}
export namespace ToolbarGroup {
  export type State = ToolbarGroupState;
  export type Props = ToolbarGroupProps;
}

export interface ToolbarButtonState extends ToolbarRootState {
  focusable: boolean;
}
export interface ToolbarButtonProps extends BaseProps<ToolbarButtonState> {
  disabled?: boolean;
  focusableWhenDisabled?: boolean;
}
export namespace ToolbarButton {
  export type State = ToolbarButtonState;
  export type Props = ToolbarButtonProps;
}

export interface ToolbarInputState extends ToolbarRootState {
  focusable: boolean;
}
export interface ToolbarInputProps extends BaseProps<ToolbarInputState> {
  disabled?: boolean;
  focusableWhenDisabled?: boolean;
  defaultValue?: string | number | readonly string[];
}
export namespace ToolbarInput {
  export type State = ToolbarInputState;
  export type Props = ToolbarInputProps;
}

export interface ToolbarLinkState {
  orientation: Orientation;
}
export type ToolbarLinkProps = BaseProps<ToolbarLinkState>;
export namespace ToolbarLink {
  export type State = ToolbarLinkState;
  export type Props = ToolbarLinkProps;
}

export type ToolbarSeparatorState = NativeSeparatorState;
export type ToolbarSeparatorProps = NativeSeparatorProps;
export namespace ToolbarSeparator {
  export type State = ToolbarSeparatorState;
  export type Props = ToolbarSeparatorProps;
}
