import type { BaseProps, ChangeEventDetails } from '../core';

export type TabsTabValue = any | null;
export type TabsTabActivationDirection = 'left' | 'right' | 'up' | 'down' | 'none';

export interface TabsTabPosition {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface TabsTabSize {
  width: number;
  height: number;
}

export interface TabsTabMetadata {
  disabled: boolean;
  id: string | undefined;
  value: TabsTabValue | undefined;
}

export type TabsRootOrientation = 'horizontal' | 'vertical';
export interface TabsRootState {
  orientation: TabsRootOrientation;
  tabActivationDirection: TabsTabActivationDirection;
}

export type TabsRootChangeEventReason = 'none' | 'disabled' | 'missing' | 'initial';
export type TabsRootChangeEventDetails = Omit<ChangeEventDetails, 'reason'> & {
  reason: TabsRootChangeEventReason;
  activationDirection: TabsTabActivationDirection;
};

export interface TabsRootProps extends BaseProps<TabsRootState> {
  value?: TabsTabValue | undefined;
  defaultValue?: TabsTabValue | undefined;
  orientation?: TabsRootOrientation | undefined;
  onValueChange?: ((value: TabsTabValue, details: TabsRootChangeEventDetails) => void) | undefined;
}

export namespace TabsRoot {
  export type State = TabsRootState;
  export type Props = TabsRootProps;
  export type Orientation = TabsRootOrientation;
  export type ChangeEventReason = TabsRootChangeEventReason;
  export type ChangeEventDetails = TabsRootChangeEventDetails;
}

export interface TabsTabState {
  disabled: boolean;
  active: boolean;
  orientation: TabsRootOrientation;
  tabActivationDirection: TabsTabActivationDirection;
}

export interface TabsTabProps extends BaseProps<TabsTabState> {
  value: TabsTabValue;
  disabled?: boolean | undefined;
  nativeButton?: boolean | undefined;
}

export namespace TabsTab {
  export type Value = TabsTabValue;
  export type ActivationDirection = TabsTabActivationDirection;
  export type Position = TabsTabPosition;
  export type Size = TabsTabSize;
  export type Metadata = TabsTabMetadata;
  export type State = TabsTabState;
  export type Props = TabsTabProps;
}

export interface TabsListState extends TabsRootState {}
export interface TabsListProps extends BaseProps<TabsListState> {
  activateOnFocus?: boolean | undefined;
  loopFocus?: boolean | undefined;
}

export namespace TabsList {
  export type State = TabsListState;
  export type Props = TabsListProps;
}

export interface TabsPanelMetadata {
  id?: string | undefined;
  value: TabsTabValue;
}

export interface TabsPanelState extends TabsRootState {
  hidden: boolean;
  transitionStatus: 'idle' | 'starting' | 'ending';
}

export interface TabsPanelProps extends BaseProps<TabsPanelState> {
  value: TabsTabValue;
  keepMounted?: boolean | undefined;
}

export namespace TabsPanel {
  export type Metadata = TabsPanelMetadata;
  export type State = TabsPanelState;
  export type Props = TabsPanelProps;
}

export interface TabsIndicatorState extends TabsRootState {
  activeTabPosition: TabsTabPosition | null;
  activeTabSize: TabsTabSize | null;
}

export interface TabsIndicatorProps extends BaseProps<TabsIndicatorState> {
  renderBeforeHydration?: boolean | undefined;
}

export namespace TabsIndicator {
  export type State = TabsIndicatorState;
  export type Props = TabsIndicatorProps;
}
