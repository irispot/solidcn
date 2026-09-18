import type { BaseProps } from '../core';
import type {
  ScrollAreaThumbState as NativeThumbState,
} from '../structure';

/** Geometry used by the native scroll metrics and corner measurement. */
export type Coords = { x: number; y: number };
export type Size = { width: number; height: number };
/** Public helper shapes; these are not native render callback states. */
export type OverflowEdges = {
  xStart: boolean;
  xEnd: boolean;
  yStart: boolean;
  yEnd: boolean;
};
export type HiddenState = { x: boolean; y: boolean; corner: boolean };

/** Values supplied to the native root render callback. */
export interface ScrollAreaRootState {
  scrolling: boolean;
  hasOverflowX: boolean;
  hasOverflowY: boolean;
  overflowXStart: boolean;
  overflowXEnd: boolean;
  overflowYStart: boolean;
  overflowYEnd: boolean;
}
export interface ScrollAreaRootProps extends BaseProps<ScrollAreaRootState> {
  overflowEdgeThreshold?: number | Partial<{
    xStart: number;
    xEnd: number;
    yStart: number;
    yEnd: number;
  }>;
}
export namespace ScrollAreaRoot {
  export type State = ScrollAreaRootState;
  export type Props = ScrollAreaRootProps;
}

export interface ScrollAreaViewportState extends ScrollAreaRootState {}
export type ScrollAreaViewportProps = BaseProps<ScrollAreaViewportState>;
export namespace ScrollAreaViewport {
  export type State = ScrollAreaViewportState;
  export type Props = ScrollAreaViewportProps;
}

export interface ScrollAreaScrollbarState extends ScrollAreaRootState {
  orientation: 'horizontal' | 'vertical';
  hidden: boolean;
}
export interface ScrollAreaScrollbarProps extends BaseProps<ScrollAreaScrollbarState> {
  orientation?: ScrollAreaScrollbarState['orientation'];
  keepMounted?: boolean;
}
export namespace ScrollAreaScrollbar {
  export type State = ScrollAreaScrollbarState;
  export type Props = ScrollAreaScrollbarProps;
}

export interface ScrollAreaContentState extends ScrollAreaRootState {}
export type ScrollAreaContentProps = BaseProps<ScrollAreaContentState>;
export namespace ScrollAreaContent {
  export type State = ScrollAreaContentState;
  export type Props = ScrollAreaContentProps;
}

export type ScrollAreaThumbState = NativeThumbState;
export type ScrollAreaThumbProps = BaseProps<ScrollAreaThumbState>;
export namespace ScrollAreaThumb {
  export type State = ScrollAreaThumbState;
  export type Props = ScrollAreaThumbProps;
}

export type ScrollAreaCornerState = Record<never, never>;
export type ScrollAreaCornerProps = BaseProps<ScrollAreaCornerState>;
export namespace ScrollAreaCorner {
  export type State = ScrollAreaCornerState;
  export type Props = ScrollAreaCornerProps;
}
