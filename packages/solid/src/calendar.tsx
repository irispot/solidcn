import { dataValue } from './utils';
import { createSignal, createEffect } from 'solid-js';
import { Dynamic, type JSX } from '@solidjs/web';
import { Button, buttonVariants } from './button';
import { IconPlaceholder } from './icons';
import { cn, omitProps, type ComponentProps } from './utils';
export type DateRange = {
  from?: Date;
  to?: Date;
};
export type DateMatcher =
  | boolean
  | Date
  | Date[]
  | ((date: Date) => boolean)
  | {
      before?: Date;
      after?: Date;
      from?: Date;
      to?: Date;
      dayOfWeek?: number[];
    };
/** Pure date operations. Dates remain ordinary JavaScript dates in every calendar. */
export interface CalendarDateLib {
  startOfMonth?: (date: Date) => Date;
  addMonths?: (date: Date, amount: number) => Date;
  getYear?: (date: Date) => number;
  getMonth?: (date: Date) => number;
  getDate?: (date: Date) => number;
  newDate?: (year: number, month: number, day: number) => Date;
  format?: (date: Date, pattern: string, options?: any) => string;
}
export type CalendarProps = Omit<ComponentProps<'div'>, 'onSelect'> & {
  /** Use DayPicker part classes without the shadcn Calendar styles. */
  unstyled?: boolean;
  dateLib?: CalendarDateLib;
  numerals?: string;
  mode?: 'single' | 'multiple' | 'range';
  selected?: Date | Date[] | DateRange;
  defaultSelected?: Date | Date[] | DateRange;
  onSelect?: (
    selection: any,
    day: Date,
    modifiers: Record<string, boolean>,
    event: MouseEvent,
  ) => void;
  month?: Date;
  defaultMonth?: Date;
  onMonthChange?: (month: Date) => void;
  numberOfMonths?: number;
  showOutsideDays?: boolean;
  fixedWeeks?: boolean;
  showWeekNumber?: boolean;
  weekStartsOn?: number;
  locale?: {
    code?: string;
    options?: {
      weekStartsOn?: number;
      firstWeekContainsDate?: number;
    };
    localize?: { day?: (day: number, options: { width: string }) => string };
  };
  disabled?: DateMatcher | DateMatcher[];
  hidden?: DateMatcher | DateMatcher[];
  startMonth?: Date;
  endMonth?: Date;
  fromYear?: number;
  toYear?: number;
  required?: boolean;
  min?: number;
  max?: number;
  captionLayout?: 'label' | 'dropdown' | 'dropdown-months' | 'dropdown-years';
  buttonVariant?: ComponentProps<typeof Button>['variant'];
  classNames?: Record<string, string>;
  formatters?: Record<string, (date: Date) => string>;
  components?: {
    DayButton?: (props: any) => JSX.Element;
    Root?: (props: any) => JSX.Element;
    Chevron?: (props: any) => JSX.Element;
    WeekNumber?: (props: any) => JSX.Element;
  };
  footer?: JSX.Element;
  today?: Date;
  modifiers?: Record<string, DateMatcher | DateMatcher[]>;
  modifiersClassNames?: Record<string, string>;
  modifiersStyles?: Record<string, JSX.CSSProperties>;
  styles?: Record<string, JSX.CSSProperties>;
  autoFocus?: boolean;
  hideNavigation?: boolean;
  disableNavigation?: boolean;
  hideWeekdays?: boolean;
  ISOWeek?: boolean;
  firstWeekContainsDate?: number;
  excludeDisabled?: boolean;
};
const start = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const add = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const equal = (a: Date | undefined, b: Date | undefined) =>
  !!a &&
  !!b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
function matches(date: Date, matcher: DateMatcher | DateMatcher[] | undefined): boolean {
  if (!matcher) return false;
  if (typeof matcher === 'boolean') return matcher;
  if (typeof matcher === 'function') return matcher(date);
  if (matcher instanceof Date) return equal(date, matcher);
  if (Array.isArray(matcher)) return matcher.some((value) => matches(date, value));
  return !!(
    (matcher.before && date < matcher.before) ||
    (matcher.after && date > matcher.after) ||
    (matcher.from && matcher.to && date >= matcher.from && date <= matcher.to) ||
    matcher.dayOfWeek?.includes(date.getDay())
  );
}
function CalendarRoot(props: any) {
  return (
    <div
      {...omitProps(props, ['rootRef', 'className'])}
      ref={props.rootRef}
      class={props.className}
    />
  );
}
function CalendarWeekNumber(props: any) {
  return (
    <td {...omitProps(props, ['week', 'children', 'className'])} class={props.className}>
      <div class="flex size-(--cell-size) items-center justify-center text-center">
        {props.children}
      </div>
    </td>
  );
}
function CalendarPlainDayButton(props: any) {
  return (
    <button
      type="button"
      {...omitProps(props, ['day', 'modifiers', 'locale', 'className'])}
      class={props.className}
    />
  );
}
export function Calendar(props: CalendarProps) {
  const monthStart = (date: Date) => props.dateLib?.startOfMonth?.(date) ?? start(date);
  const yearOf = (date: Date) => props.dateLib?.getYear?.(date) ?? date.getFullYear();
  const monthOf = (date: Date) => props.dateLib?.getMonth?.(date) ?? date.getMonth();
  const dayOf = (date: Date) => props.dateLib?.getDate?.(date) ?? date.getDate();
  const makeDate = (year: number, month: number, day: number) =>
    props.dateLib?.newDate?.(year, month, day) ?? new Date(year, month, day);
  const shiftMonth = (date: Date, amount: number) =>
    props.dateLib?.addMonths?.(date, amount) ??
    new Date(date.getFullYear(), date.getMonth() + amount, date.getDate());
  const digits = (value: string | number) => {
    if (!props.numerals || props.numerals === 'latn') return String(value);
    const formatter = new Intl.NumberFormat('en', {
      numberingSystem: props.numerals,
      useGrouping: false,
    });
    return String(value).replace(/\d/g, (digit) => formatter.format(Number(digit)));
  };
  const formatDate = (date: Date, pattern: string) => {
    const formatted = props.dateLib?.format?.(
      date,
      pattern,
      props.locale ? { locale: props.locale } : undefined,
    );
    // DayPicker applies its numeral system to every formatted date, including
    // short weekday names that contain digits (for example Persian "ش1").
    return formatted === undefined ? undefined : digits(formatted);
  };
  const caption = (date: Date) =>
    props.formatters?.formatCaption?.(date) ??
    digits(
      formatDate(date, 'LLLL y') ??
        date.toLocaleDateString(props.locale?.code, {
          month: 'long',
          year: 'numeric',
          calendar: 'gregory',
          numberingSystem: 'latn',
        }),
    );
  const [month, setMonth] = createSignal(monthStart(props.defaultMonth ?? new Date())),
    [selected, setSelected] = createSignal(props.defaultSelected),
    [focused, setFocused] = createSignal<Date | undefined>(undefined);
  let root!: HTMLDivElement;
  const current = () => monthStart(props.month ?? month()),
    selection = () => ('selected' in props ? props.selected : selected()),
    weekStart = () =>
      props.ISOWeek ? 1 : (props.weekStartsOn ?? props.locale?.options?.weekStartsOn ?? 0);
  const isSelected = (date: Date) => {
    const value = selection();
    return value instanceof Date
      ? equal(date, value)
      : Array.isArray(value)
        ? value.some((day) => equal(day, date))
        : !!(value?.from && date >= value.from && date <= (value.to ?? value.from));
  };
  const changeMonth = (next: Date) => {
    const date = monthStart(next);
    if (equal(date, current()) || props.disableNavigation) return;
    if (
      (navStart() && date < monthStart(navStart()!)) ||
      (navEnd() && date > monthStart(navEnd()!))
    )
      return;
    setMonth(date);
    props.onMonthChange?.(date);
  };
  const select = (date: Date, event: MouseEvent, modifiers: Record<string, boolean>) => {
    if (matches(date, props.disabled)) return;
    const old = selection();
    let next: Date | Date[] | DateRange | undefined;
    if (props.mode === 'multiple') {
      const values = Array.isArray(old) ? old : [];
      next = isSelected(date) ? values.filter((value) => !equal(value, date)) : [...values, date];
      if ((props.min && next.length < props.min) || (props.max && next.length > props.max)) return;
    } else if (props.mode === 'range') {
      const range = old && !Array.isArray(old) && !(old instanceof Date) ? old : {};
      const { from, to } = range;
      if (!from && !to) next = { from: date, to: props.min ? undefined : date };
      else if (from && !to)
        next = equal(from, date)
          ? props.required
            ? { from, to: undefined }
            : undefined
          : date < from
            ? { from: date, to: from }
            : { from, to: date };
      else if (from && to)
        next =
          equal(from, date) && equal(to, date)
            ? props.required
              ? range
              : undefined
            : equal(from, date)
              ? { from, to: props.min ? undefined : date }
              : equal(to, date)
                ? { from: date, to: props.min ? undefined : date }
                : date < from
                  ? { from: date, to }
                  : { from, to: date };
      const candidate = next as DateRange | undefined;
      if (candidate?.from && candidate.to) {
        const distance =
          (Date.UTC(candidate.to.getFullYear(), candidate.to.getMonth(), candidate.to.getDate()) -
            Date.UTC(
              candidate.from.getFullYear(),
              candidate.from.getMonth(),
              candidate.from.getDate(),
            )) /
          86400000;
        if (
          (props.max && distance > props.max) ||
          (props.min && props.min > 1 && distance < props.min)
        )
          next = { from: date, to: undefined };
        else if (props.excludeDisabled)
          for (let day = candidate.from; day <= candidate.to; day = add(day, 1))
            if (matches(day, props.disabled)) {
              next = { from: date, to: undefined };
              break;
            }
      }
    } else next = isSelected(date) && !props.required ? undefined : date;
    setSelected(next);
    props.onSelect?.(next, date, modifiers, event);
  };
  const move = (event: KeyboardEvent, date: Date) => {
    let target: Date | undefined;
    const reverse = props.dir === 'rtl' ? -1 : 1;
    if (event.key === 'ArrowRight') target = add(date, reverse);
    if (event.key === 'ArrowLeft') target = add(date, -reverse);
    if (event.key === 'ArrowDown') target = add(date, 7);
    if (event.key === 'ArrowUp') target = add(date, -7);
    if (event.key === 'Home') target = add(date, -((date.getDay() - weekStart() + 7) % 7));
    if (event.key === 'End') target = add(date, 6 - ((date.getDay() - weekStart() + 7) % 7));
    if (event.key === 'PageUp' || event.key === 'PageDown')
      target = shiftMonth(date, event.key === 'PageUp' ? -1 : 1);
    if (!target) return;
    const step =
      event.key === 'ArrowUp' ? -7 : event.key === 'ArrowDown' ? 7 : target < date ? -1 : 1;
    for (
      let attempts = 0;
      matches(target, props.disabled) || matches(target, props.hidden);
      attempts++
    ) {
      if (attempts > 366) return;
      target = add(target, step);
    }
    event.preventDefault();
    setFocused(target);
    const lastMonth = add(shiftMonth(current(), props.numberOfMonths ?? 1), -1);
    if (target < current()) changeMonth(target);
    else if (target > lastMonth)
      changeMonth(shiftMonth(monthStart(target), -(props.numberOfMonths ?? 1) + 1));
    const day = iso(target);
    queueMicrotask(() =>
      (
        root.querySelector<HTMLButtonElement>(`td:not([data-outside]) [data-date="${day}"]`) ??
        root.querySelector<HTMLButtonElement>(`[data-date="${day}"]`)
      )?.focus(),
    );
  };
  const name = (key: string, fallback = '') =>
    props.classNames?.[key] ?? cn(!props.unstyled && fallback, `rdp-${key}`);
  const dayClasses = () =>
    name(
      'day',
      cn(
        'group/day relative aspect-square h-full w-full rounded-(--cell-radius) p-0 text-center select-none [&:last-child[data-selected=true]_button]:rounded-r-(--cell-radius)',
        props.showWeekNumber
          ? '[&:nth-child(2)[data-selected=true]_button]:rounded-l-(--cell-radius)'
          : '[&:first-child[data-selected=true]_button]:rounded-l-(--cell-radius)',
      ),
    );
  const modifierClasses: Record<string, string> = {
    range_start:
      'relative isolate z-0 rounded-l-(--cell-radius) bg-muted after:absolute after:inset-y-0 after:right-0 after:w-4 after:bg-muted',
    range_middle: 'rounded-none',
    range_end:
      'relative isolate z-0 rounded-r-(--cell-radius) bg-muted after:absolute after:inset-y-0 after:left-0 after:w-4 after:bg-muted',
    today: 'rounded-(--cell-radius) bg-muted text-foreground data-[selected=true]:rounded-none',
    outside: 'text-muted-foreground aria-selected:text-muted-foreground',
    disabled: 'text-muted-foreground opacity-50',
    hidden: 'invisible',
  };
  const grids = () =>
    Array.from({ length: props.numberOfMonths ?? 1 }, (_, index) => shiftMonth(current(), index));
  const monthLabel = (date: Date) =>
    props.formatters?.formatMonthDropdown?.(date) ??
    digits(formatDate(date, 'LLLL') ?? date.toLocaleString(props.locale?.code, { month: 'short' }));
  const captionClass = () =>
    name(
      'caption_label',
      'font-medium select-none cn-calendar-caption-label flex items-center gap-1 rounded-(--cell-radius) text-sm [&>svg]:size-3.5 [&>svg]:text-muted-foreground',
    );
  const hasYearDropdown = () =>
    props.captionLayout === 'dropdown' || props.captionLayout === 'dropdown-years';
  const firstYear = () =>
    (props.startMonth && yearOf(props.startMonth)) ??
    props.fromYear ??
    yearOf(props.today ?? new Date()) - 100;
  const lastYear = () =>
    (props.endMonth && yearOf(props.endMonth)) ?? props.toYear ?? yearOf(props.today ?? new Date());
  const navStart = () =>
    props.startMonth ??
    (props.fromYear || hasYearDropdown() ? makeDate(firstYear(), 0, 1) : undefined);
  const navEnd = () =>
    props.endMonth ??
    (props.toYear || hasYearDropdown() ? add(makeDate(lastYear() + 1, 0, 1), -1) : undefined);
  const previousDisabled = () =>
    !!(props.disableNavigation || (navStart() && current() <= monthStart(navStart()!)));
  const nextDisabled = () =>
    !!(
      props.disableNavigation ||
      (navEnd() && shiftMonth(current(), (props.numberOfMonths ?? 1) - 1) >= monthStart(navEnd()!))
    );
  const focusTarget = () => {
    const first = current(),
      last = add(shiftMonth(first, props.numberOfMonths ?? 1), -1);
    const available = (date: Date) =>
      date >= first &&
      date <= last &&
      !matches(date, props.disabled) &&
      !matches(date, props.hidden);
    const value = selection();
    const candidates = [
      focused(),
      ...(value instanceof Date
        ? [value]
        : Array.isArray(value)
          ? value
          : value?.from
            ? [value.from]
            : []),
      props.today ?? new Date(),
    ];
    for (const date of candidates) if (date && available(date)) return date;
    for (let date = first; date <= last; date = add(date, 1)) if (available(date)) return date;
    return undefined;
  };
  const weekNumber = (date: Date) => {
    const weekOne = (year: number) => {
      const day = (
        props.ISOWeek
          ? (year: number, month: number, day: number) => new Date(year, month, day)
          : makeDate
      )(
        year,
        0,
        props.ISOWeek
          ? 4
          : (props.firstWeekContainsDate ?? props.locale?.options?.firstWeekContainsDate ?? 1),
      );
      return add(day, -((day.getDay() - weekStart() + 7) % 7));
    };
    const year =
      date >= weekOne((props.ISOWeek ? date.getFullYear() : yearOf(date)) + 1)
        ? (props.ISOWeek ? date.getFullYear() : yearOf(date)) + 1
        : date < weekOne(props.ISOWeek ? date.getFullYear() : yearOf(date))
          ? (props.ISOWeek ? date.getFullYear() : yearOf(date)) - 1
          : props.ISOWeek
            ? date.getFullYear()
            : yearOf(date);
    const first = weekOne(year);
    return (
      Math.floor(
        (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
          Date.UTC(first.getFullYear(), first.getMonth(), first.getDate())) /
          604800000,
      ) + 1
    );
  };
  return (
    <Dynamic
      component={props.components?.Root ?? CalendarRoot}
      rootRef={(element: HTMLDivElement) => {
        root = element;
      }}
      data-slot="calendar"
      className={cn(
        name('root', 'w-fit'),
        !props.unstyled &&
          'cn-calendar group/calendar bg-background in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent',
        !props.unstyled && String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        !props.unstyled && String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        props.class ?? props.className,
      )}
      style={props.style}
      dir={props.dir}
    >
      <div class={name('months', 'relative flex flex-col gap-4 md:flex-row')}>
        {!props.hideNavigation && (
          <nav
            aria-label=""
            class={name(
              'nav',
              'absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1',
            )}
          >
            <button
              type="button"
              class={name(
                'button_previous',
                cn(
                  buttonVariants({ variant: props.buttonVariant ?? 'ghost' }),
                  'size-(--cell-size) p-0 select-none aria-disabled:opacity-50',
                ),
              )}
              aria-label="Go to the Previous Month"
              aria-disabled={previousDisabled() ? 'true' : undefined}
              tabindex={previousDisabled() ? -1 : undefined}
              onClick={() => changeMonth(shiftMonth(current(), -1))}
            >
              {props.components?.Chevron ? (
                <Dynamic
                  component={props.components.Chevron}
                  orientation="left"
                  className={name('chevron')}
                  size={24}
                  disabled={previousDisabled()}
                />
              ) : (
                <IconPlaceholder
                  lucide="ChevronLeftIcon"
                  class={cn('cn-rtl-flip size-4', name('chevron'))}
                />
              )}
            </button>
            <button
              type="button"
              class={name(
                'button_next',
                cn(
                  buttonVariants({ variant: props.buttonVariant ?? 'ghost' }),
                  'size-(--cell-size) p-0 select-none aria-disabled:opacity-50',
                ),
              )}
              aria-label="Go to the Next Month"
              aria-disabled={nextDisabled() ? 'true' : undefined}
              tabindex={nextDisabled() ? -1 : undefined}
              onClick={() => changeMonth(shiftMonth(current(), 1))}
            >
              {props.components?.Chevron ? (
                <Dynamic
                  component={props.components.Chevron}
                  orientation="right"
                  className={name('chevron')}
                  size={24}
                  disabled={nextDisabled()}
                />
              ) : (
                <IconPlaceholder
                  lucide="ChevronRightIcon"
                  class={cn('cn-rtl-flip size-4', name('chevron'))}
                />
              )}
            </button>
          </nav>
        )}
        {grids().map((displayMonth) => {
          const leading = (displayMonth.getDay() - weekStart() + 7) % 7;
          const length = dayOf(add(shiftMonth(displayMonth, 1), -1));
          const weeks = props.fixedWeeks ? 6 : Math.ceil((leading + length) / 7);
          return (
            <div class={name('month', 'flex w-full flex-col gap-4')}>
              <div
                class={name(
                  'month_caption',
                  'flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)',
                )}
                aria-live="polite"
              >
                {props.captionLayout && props.captionLayout !== 'label' ? (
                  <div
                    class={name(
                      'dropdowns',
                      'flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium',
                    )}
                  >
                    {props.captionLayout !== 'dropdown-years' ? (
                      <span
                        data-disabled={dataValue(!!props.disableNavigation)}
                        class={name(
                          'dropdown_root',
                          'cn-calendar-dropdown-root relative rounded-(--cell-radius)',
                        )}
                      >
                        <select
                          aria-label="Choose the Month"
                          class={cn(
                            name('dropdown', 'absolute inset-0 bg-popover opacity-0'),
                            name('months_dropdown'),
                          )}
                          disabled={props.disableNavigation}
                          value={monthOf(displayMonth)}
                          onChange={(event) =>
                            changeMonth(
                              makeDate(yearOf(displayMonth), Number(event.currentTarget.value), 1),
                            )
                          }
                        >
                          {Array.from({ length: 12 }, (_, index) => (
                            <option
                              value={index}
                              disabled={
                                !!(
                                  (props.startMonth &&
                                    yearOf(displayMonth) === yearOf(props.startMonth) &&
                                    index < monthOf(props.startMonth)) ||
                                  (props.endMonth &&
                                    yearOf(displayMonth) === yearOf(props.endMonth) &&
                                    index > monthOf(props.endMonth))
                                )
                              }
                            >
                              {monthLabel(makeDate(yearOf(displayMonth), index, 1))}
                            </option>
                          ))}
                        </select>
                        <span class={captionClass()} aria-hidden="true">
                          {monthLabel(displayMonth)}
                          {props.components?.Chevron ? (
                            <Dynamic
                              component={props.components.Chevron}
                              orientation="down"
                              className={name('chevron')}
                              size={18}
                            />
                          ) : (
                            <IconPlaceholder
                              lucide="ChevronDownIcon"
                              width={18}
                              height={18}
                              class={cn('size-4', name('chevron'))}
                            />
                          )}
                        </span>
                      </span>
                    ) : (
                      <span>{monthLabel(displayMonth)}</span>
                    )}
                    {hasYearDropdown() ? (
                      <span
                        data-disabled={dataValue(!!props.disableNavigation)}
                        class={name(
                          'dropdown_root',
                          'cn-calendar-dropdown-root relative rounded-(--cell-radius)',
                        )}
                      >
                        <select
                          aria-label="Choose the Year"
                          class={cn(
                            name('dropdown', 'absolute inset-0 bg-popover opacity-0'),
                            name('years_dropdown'),
                          )}
                          disabled={props.disableNavigation}
                          value={yearOf(displayMonth)}
                          onChange={(event) =>
                            changeMonth(
                              makeDate(Number(event.currentTarget.value), monthOf(displayMonth), 1),
                            )
                          }
                        >
                          {Array.from(
                            {
                              length: Math.max(0, lastYear() - firstYear() + 1),
                            },
                            (_, index) => {
                              const year = firstYear() + index;
                              return <option value={year}>{digits(year)}</option>;
                            },
                          )}
                        </select>
                        <span class={captionClass()} aria-hidden="true">
                          {props.formatters?.formatYearDropdown?.(displayMonth) ??
                            digits(yearOf(displayMonth))}
                          {props.components?.Chevron ? (
                            <Dynamic
                              component={props.components.Chevron}
                              orientation="down"
                              className={name('chevron')}
                              size={18}
                            />
                          ) : (
                            <IconPlaceholder
                              lucide="ChevronDownIcon"
                              width={18}
                              height={18}
                              class={cn('size-4', name('chevron'))}
                            />
                          )}
                        </span>
                      </span>
                    ) : (
                      <span>{digits(yearOf(displayMonth))}</span>
                    )}
                    <span
                      role="status"
                      aria-live="polite"
                      style={{
                        border: '0',
                        clip: 'rect(0 0 0 0)',
                        height: '1px',
                        margin: '-1px',
                        overflow: 'hidden',
                        padding: '0',
                        position: 'absolute',
                        width: '1px',
                        'white-space': 'nowrap',
                        'word-wrap': 'normal',
                      }}
                    >
                      {caption(displayMonth)}
                    </span>
                  </div>
                ) : (
                  <span
                    role="status"
                    aria-live="polite"
                    class={name(
                      'caption_label',
                      'font-medium select-none cn-calendar-caption text-sm',
                    )}
                  >
                    {caption(displayMonth)}
                  </span>
                )}
              </div>
              <table
                role="grid"
                aria-multiselectable={
                  props.mode === 'range' || props.mode === 'multiple' ? 'true' : 'false'
                }
                aria-label={caption(displayMonth)}
                class={name('month_grid', 'w-full border-collapse')}
              >
                <thead aria-hidden="true">
                  {!props.hideWeekdays && (
                    <tr class={name('weekdays', 'flex')}>
                      {props.showWeekNumber && (
                        <th
                          scope="col"
                          aria-label="Week Number"
                          class={name('week_number_header', 'w-(--cell-size) select-none')}
                        />
                      )}
                      {Array.from({ length: 7 }, (_, index) => (
                        <th
                          scope="col"
                          aria-label={new Date(2024, 0, 7 + weekStart() + index).toLocaleDateString(
                            props.locale?.code,
                            { weekday: 'long' },
                          )}
                          class={name(
                            'weekday',
                            'flex-1 rounded-(--cell-radius) text-[0.8rem] font-normal text-muted-foreground select-none',
                          )}
                        >
                          {props.formatters?.formatWeekdayName?.(
                            new Date(2024, 0, 7 + weekStart() + index),
                          ) ??
                            formatDate(new Date(2024, 0, 7 + weekStart() + index), 'cccccc') ??
                            props.locale?.localize?.day?.((weekStart() + index) % 7, {
                              width: 'short',
                            }) ??
                            new Date(2024, 0, 7 + weekStart() + index)
                              .toLocaleDateString(props.locale?.code, { weekday: 'short' })
                              .slice(0, 2)}
                        </th>
                      ))}
                    </tr>
                  )}
                </thead>
                <tbody class={name('weeks')}>
                  {Array.from({ length: weeks }, (_, week) => (
                    <tr class={name('week', 'mt-2 flex w-full')}>
                      {props.showWeekNumber && (
                        <Dynamic
                          component={props.components?.WeekNumber ?? CalendarWeekNumber}
                          week={{
                            weekNumber: weekNumber(add(displayMonth, week * 7 - leading)),
                            days: Array.from({ length: 7 }, (_, day) => ({
                              date: add(displayMonth, week * 7 + day - leading),
                              displayMonth,
                            })),
                          }}
                          scope="row"
                          role="rowheader"
                          aria-label={`Week ${weekNumber(add(displayMonth, week * 7 - leading))}`}
                          className={name(
                            'week_number',
                            'text-[0.8rem] text-muted-foreground select-none',
                          )}
                        >
                          {digits(
                            String(weekNumber(add(displayMonth, week * 7 - leading))).padStart(
                              2,
                              '0',
                            ),
                          )}
                        </Dynamic>
                      )}
                      {Array.from({ length: 7 }, (_, weekday) => {
                        const date = add(displayMonth, week * 7 + weekday - leading);
                        const outside = monthOf(date) !== monthOf(displayMonth);
                        const range = () => {
                          const value = selection();
                          return value && !Array.isArray(value) && !(value instanceof Date)
                            ? value
                            : {};
                        };
                        const modifiers = (): Record<string, boolean> => ({
                          selected: isSelected(date),
                          disabled: matches(date, props.disabled),
                          today: equal(date, props.today ?? new Date()),
                          outside,
                          focused: equal(date, focused()),
                          hidden:
                            matches(date, props.hidden) ||
                            (outside && props.showOutsideDays === false),
                          range_start: !!range().to && equal(date, range().from),
                          range_end: !!range().from && equal(date, range().to),
                          range_middle: !!(
                            range().from &&
                            range().to &&
                            date > range().from! &&
                            date < range().to!
                          ),
                          ...Object.fromEntries(
                            Object.entries(props.modifiers ?? {}).map(([key, value]) => [
                              key,
                              matches(date, value),
                            ]),
                          ),
                        });
                        return (
                          <td
                            role="gridcell"
                            aria-selected={isSelected(date) ? 'true' : undefined}
                            data-day={iso(date)}
                            data-month={outside ? iso(date).slice(0, 7) : undefined}
                            data-selected={modifiers().selected ? 'true' : undefined}
                            data-disabled={modifiers().disabled ? 'true' : undefined}
                            data-hidden={modifiers().hidden ? 'true' : undefined}
                            data-outside={outside ? 'true' : undefined}
                            data-focused={modifiers().focused ? 'true' : undefined}
                            data-today={modifiers().today ? 'true' : undefined}
                            class={[
                              dayClasses(),
                              ...Object.entries(modifiers())
                                .filter(([, active]) => active)
                                .map(
                                  ([key]) =>
                                    props.modifiersClassNames?.[key] ??
                                    (key in modifierClasses || ['selected', 'focused'].includes(key)
                                      ? name(key, modifierClasses[key])
                                      : ''),
                                ),
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            style={Object.assign(
                              {},
                              props.styles?.day,
                              ...Object.entries(modifiers())
                                .filter(([, active]) => active)
                                .map(
                                  ([key]) => props.modifiersStyles?.[key] ?? props.styles?.[key],
                                ),
                            )}
                          >
                            {!modifiers().hidden && (
                              <Dynamic
                                component={
                                  props.components?.DayButton ??
                                  (props.unstyled ? CalendarPlainDayButton : CalendarDayButton)
                                }
                                day={{ date, displayMonth, outside }}
                                modifiers={modifiers()}
                                locale={props.locale}
                                disabled={modifiers().disabled}
                                className={name('day_button')}
                                tabindex={!outside && equal(date, focusTarget()) ? 0 : -1}
                                data-date={dataValue(iso(date))}
                                aria-label={digits(
                                  formatDate(date, 'PPPP') ??
                                    date.toLocaleDateString(props.locale?.code, {
                                      dateStyle: 'full',
                                    }),
                                )}
                                onClick={(event: MouseEvent) => select(date, event, modifiers())}
                                onKeyDown={(event: KeyboardEvent) => move(event, date)}
                                onFocus={() => setFocused(date)}
                                onBlur={() => setFocused(undefined)}
                              >
                                {props.formatters?.formatDay?.(date) ?? digits(dayOf(date))}
                              </Dynamic>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
      {props.footer && <div role="status">{props.footer}</div>}
    </Dynamic>
  );
}
export function CalendarDayButton(
  props: ComponentProps<typeof Button> & {
    day: {
      date: Date;
      displayMonth?: Date;
      outside?: boolean;
    };
    modifiers: Record<string, boolean>;
    locale?: {
      code?: string;
    };
  },
) {
  return (
    <Button
      variant="ghost"
      size="icon"
      {...omitProps(props, ['day', 'modifiers', 'locale', 'className'])}
      data-day={dataValue(props.day.date.toLocaleDateString(props.locale?.code))}
      data-selected-single={dataValue(
        props.modifiers.selected &&
          !props.modifiers.range_start &&
          !props.modifiers.range_end &&
          !props.modifiers.range_middle,
      )}
      data-range-start={dataValue(props.modifiers.range_start)}
      data-range-end={dataValue(props.modifiers.range_end)}
      data-range-middle={dataValue(props.modifiers.range_middle)}
      class={cn(
        'cn-calendar-day-button relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 border-0 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50 data-[range-end=true]:rounded-(--cell-radius) data-[range-end=true]:rounded-r-(--cell-radius) data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-muted data-[range-middle=true]:text-foreground data-[range-start=true]:rounded-(--cell-radius) data-[range-start=true]:rounded-l-(--cell-radius) data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground dark:hover:text-foreground [&>span]:text-xs [&>span]:opacity-70 rdp-day',
        props.class ?? props.className,
      )}
    />
  );
}
