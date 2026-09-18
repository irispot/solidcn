// Solid-owned types for the unchanged upstream geometry source. Keep this
// small file separate so geometry.ts can be copied byte-for-byte on rebase.
export type MessageScrollerScrollAlign = 'start' | 'center' | 'end' | 'nearest';

export type MessageScrollerScrollable = {
  start: boolean;
  end: boolean;
};

export type MessageScrollerVisibilityState = {
  currentAnchorId: string | null;
  visibleMessageIds: string[];
};

export const SCROLL_POSITION_EPSILON = 0.5;

export const EMPTY_MESSAGE_SCROLLER_SCROLLABLE: MessageScrollerScrollable = {
  start: false,
  end: false,
};

const EMPTY_VISIBLE_MESSAGE_IDS: string[] = [];

export const EMPTY_MESSAGE_SCROLLER_VISIBILITY_STATE: MessageScrollerVisibilityState = {
  currentAnchorId: null,
  visibleMessageIds: EMPTY_VISIBLE_MESSAGE_IDS,
};
