import type { ChangeEventDetails } from '../core';

export { Accordion } from '../structure';
export type AccordionRoot = typeof import('../structure').Accordion.Root;
export type AccordionItem = typeof import('../structure').Accordion.Item;
export type AccordionHeader = typeof import('../structure').Accordion.Header;
export type AccordionTrigger = typeof import('../structure').Accordion.Trigger;
export type AccordionPanel = typeof import('../structure').Accordion.Panel;
export type AccordionItemChangeEventReason = 'trigger-press' | 'none';
export type AccordionItemChangeEventDetails = ChangeEventDetails & {
  reason: AccordionItemChangeEventReason;
};
export type AccordionHeaderState = import('../structure').AccordionItemState;
export type {
  AccordionHeaderProps,
  AccordionItemProps,
  AccordionItemState,
  AccordionPanelProps,
  AccordionPanelState,
  AccordionRootChangeEventDetails,
  AccordionRootChangeEventReason,
  AccordionRootProps,
  AccordionRootState,
  AccordionTriggerProps,
  AccordionTriggerState,
  AccordionValue,
} from '../structure';
