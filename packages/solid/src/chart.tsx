import { dataValue } from './utils';
import {
  createContext,
  createSignal,
  createEffect,
  createUniqueId,
  useContext,
  Show,
  untrack,
  type Component,
} from 'solid-js';
import { Dynamic, Portal, type JSX } from '@solidjs/web';
import { cn, omitProps, mergeRenderProps, type ComponentProps } from './utils';
export type ChartConfig = Record<
  string,
  {
    label?: JSX.Element;
    icon?: Component<any>;
  } & (
    | {
        color?: string;
        theme?: never;
      }
    | {
        color?: never;
        theme: {
          light: string;
          dark: string;
        };
      }
  )
>;
export type ChartDatum = Record<string, string | number | null | undefined>;
export type ChartPayload = {
  dataKey: string;
  name: string;
  value: number;
  fill?: string;
  color?: string;
  payload: ChartDatum;
  type?: string;
};
const ConfigContext = createContext<{
  config: ChartConfig;
}>({ config: {} });
const PlotContext = createContext<ReturnType<typeof createPlot> | null>(null);
const SizeContext = createContext<(() => { width: number; height: number }) | null>(null);
const TooltipContext = createContext<{
  active: boolean;
  payload: ChartPayload[];
  label: unknown;
  labelClassName?: string;
  labelFormatter?: ChartTooltipContentProps['labelFormatter'];
  formatter?: ChartTooltipContentProps['formatter'];
} | null>(null);
type PlotProps = {
  data: ChartDatum[];
  width?: number;
  height?: number;
  children?: JSX.Element;
  margin?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  accessibilityLayer?: boolean;
  class?: string;
  className?: string;
  layout?: 'horizontal' | 'vertical';
  barGap?: number | string;
  barCategoryGap?: number | string;
  maxBarSize?: number;
  kind?: 'bar';
};
function createPlot(props: PlotProps) {
  const [active, setActive] = createSignal<number | null>(null);
  const [pointerY, setPointerY] = createSignal(0);
  const config = useContext(ConfigContext);
  const responsiveSize = useContext(SizeContext);
  const [series, setSeries] = createSignal<SeriesProps[]>([]);
  const [xAxis, setXAxis] = createSignal<AxisProps>();
  const [legendHeight, setLegendHeight] = createSignal(0);
  const [overlay, setOverlay] = createSignal<HTMLDivElement>();
  const width = () => props.width ?? responsiveSize?.().width ?? 640,
    height = () => props.height ?? responsiveSize?.().height ?? 360;
  const margin = (edge: 'left' | 'right' | 'top' | 'bottom') =>
    props.kind === 'bar'
      ? props.margin
        ? (props.margin[edge] ?? 0)
        : 5
      : (props.margin?.[edge] ?? { left: 40, right: 20, top: 20, bottom: 40 }[edge]);
  const left = () => margin('left'),
    right = () => width() - margin('right'),
    top = () => margin('top'),
    bottom = () =>
      height() -
      margin('bottom') -
      (props.kind === 'bar' && xAxis() && !xAxis()!.hide ? (xAxis()!.height ?? 30) : 0) -
      legendHeight();
  const numericValues = () =>
    props.data.flatMap((row) =>
      series().length
        ? series()
            .filter((series) => !series.hide)
            .map((series) => Number(row[series.dataKey] ?? 0))
        : (Object.values(row).filter((value) => typeof value === 'number') as number[]),
    );
  const rawMaximum = () => Math.max(props.kind === 'bar' ? 0 : 1, ...numericValues());
  const rawMinimum = () => Math.min(0, ...numericValues());
  const ticks = () => numericTicks(rawMinimum(), rawMaximum());
  const maximum = () => (props.kind === 'bar' ? ticks().at(-1)! : rawMaximum());
  const minimum = () => (props.kind === 'bar' ? ticks()[0] : rawMinimum());
  const band = () => (right() - left()) / Math.max(1, props.data.length);
  const categoryStart = (index: number) =>
    left() + band() * (xAxis()?.reversed ? props.data.length - 1 - index : index);
  const x = (index: number) =>
    props.kind === 'bar'
      ? categoryStart(index) + band() / 2
      : left() +
        (right() - left()) * (props.data.length > 1 ? index / (props.data.length - 1) : 0.5);
  const y = (value: number) =>
    bottom() * (1 - (value - minimum()) / (maximum() - minimum())) +
    top() * ((value - minimum()) / (maximum() - minimum()));
  return {
    props,
    config,
    width,
    height,
    left,
    right,
    top,
    bottom,
    maximum,
    minimum,
    x,
    y,
    ticks,
    band,
    categoryStart,
    margin,
    series,
    setSeries,
    xAxis,
    setXAxis,
    legendHeight,
    setLegendHeight,
    overlay,
    setOverlay,
    active,
    setActive,
    pointerY,
    setPointerY,
  };
}
function usePlot() {
  const value = useContext(PlotContext);
  if (!value) throw new Error('Chart series must be inside a chart.');
  return value;
}
const color = (key: string, explicit: string | undefined, config: ChartConfig, index = 0) =>
  explicit ?? (config[key] ? `var(--color-${key})` : `var(--chart-${(index % 5) + 1})`);

/* The numeric tick, grouped bar, and rectangle rules below are adapted from
 * Recharts 3.8.0 (util/scale/getNiceTickValues, combineAllBarPositions, and Rectangle).
 * Copyright (c) 2015-present recharts. MIT License.
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
function numericTicks(minimum: number, maximum: number, count = 5): number[] {
  if (minimum === maximum) return Array.from({ length: count }, (_, index) => minimum + index);
  const rough = (maximum - minimum) / (count - 1);
  const digits = Math.floor(Math.log10(rough)) + 1;
  const quantum = 10 ** digits * (digits === 1 ? 0.1 : 0.05);
  for (let correction = 0; correction < 100; correction++) {
    const step = (Math.ceil(rough / quantum) + correction) * quantum;
    const middle =
      minimum <= 0 && maximum >= 0 ? 0 : Math.floor((minimum + maximum) / 2 / step) * step;
    let below = Math.ceil((middle - minimum) / step);
    let above = Math.ceil((maximum - middle) / step);
    const total = below + above + 1;
    if (total > count) continue;
    if (maximum > 0) above += count - total;
    else below += count - total;
    return Array.from({ length: below + above + 1 }, (_, index) =>
      Number((middle + (index - below) * step).toPrecision(14)),
    );
  }
  return [minimum, maximum];
}
const roundChart = (number: number) => Math.round(number * 10000) / 10000;
function rectanglePath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number | number[],
) {
  const max = Math.min(Math.abs(roundChart(width)) / 2, Math.abs(roundChart(height)) / 2);
  const corners = (
    Array.isArray(radius)
      ? [0, 1, 2, 3].map((i) => radius[i] ?? 0)
      : [radius, radius, radius, radius]
  ).map((r) => Math.max(0, Math.min(max, r)));
  const xs = width < 0 ? -1 : 1,
    ys = height < 0 ? -1 : 1,
    clockwise = xs === ys ? 1 : 0;
  const point = (x: number, y: number) => `${roundChart(x)},${roundChart(y)}`;
  const arc = (r: number, x: number, y: number) =>
    r > 0 ? `A ${roundChart(r)},${roundChart(r)},0,0,${clockwise},${point(x, y)}` : '';
  return `M${point(x, y + ys * corners[0])}${arc(corners[0], x + xs * corners[0], y)}L${point(x + width - xs * corners[1], y)}${arc(corners[1], x + width, y + ys * corners[1])}L${point(x + width, y + height - ys * corners[2])}${arc(corners[2], x + width - xs * corners[2], y + height)}L${point(x + xs * corners[3], y + height)}${arc(corners[3], x, y + height - ys * corners[3])}Z`;
}
export function ChartContainer(
  props: ComponentProps<'div'> & {
    config: ChartConfig;
    initialDimension?: {
      width: number;
      height: number;
    };
  },
) {
  const id = props.id ?? `chart-${createUniqueId()}`;
  const [size, setSize] = createSignal(
    untrack(() => props.initialDimension ?? { width: 320, height: 200 }),
  );
  const [container, setContainer] = createSignal<HTMLDivElement>();
  createEffect(
    () => container(),
    (element) => {
      if (!element) return;
      const update = () => {
        const rect = element.getBoundingClientRect();
        setSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
      };
      update();
      const observer = new element.ownerDocument.defaultView!.ResizeObserver(update);
      observer.observe(element);
      return () => observer.disconnect();
    },
  );
  return (
    <ConfigContext
      value={{
        get config() {
          return props.config;
        },
      }}
    >
      <div
        {...omitProps(props, ['config', 'initialDimension', 'className'])}
        data-slot="chart"
        data-chart={dataValue(id)}
        class={cn(
          "cn-chart flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
          props.class ?? props.className,
        )}
      >
        <ChartStyle id={id} config={props.config} />
        <SizeContext value={size}>
          <div
            ref={setContainer}
            class="recharts-responsive-container"
            style={{ width: '100%', height: '100%', 'min-width': '0px' }}
          >
            <div style={{ width: '0px', height: '0px', overflow: 'visible' }}>{props.children}</div>
          </div>
        </SizeContext>
      </div>
    </ConfigContext>
  );
}
export function ChartStyle(props: { id: string; config: ChartConfig }) {
  const css = () =>
    Object.entries({ light: '', dark: '.dark ' })
      .map(
        ([theme, prefix]) =>
          `${prefix}[data-chart="${props.id.replace(/["\\]/g, '')}"] {${Object.entries(props.config)
            .map(
              ([key, value]) =>
                `--color-${key.replace(/[^a-zA-Z0-9_-]/g, '')}: ${value.theme?.[theme as 'light' | 'dark'] ?? value.color ?? 'currentColor'};`,
            )
            .join('')}}`,
      )
      .join('\n');
  return <style>{css()}</style>;
}
function Plot(props: PlotProps) {
  const context = createPlot(props);
  return (
    <Show when={context.width() > 0 && context.height() > 0}>
      <PlotContext value={context}>
        <div
          ref={context.setOverlay}
          class="recharts-wrapper"
          style={{
            position: 'relative',
            cursor: 'default',
            width: `${context.width()}px`,
            height: `${context.height()}px`,
          }}
        >
          <svg
            role={props.accessibilityLayer ? 'application' : 'img'}
            tabindex={props.accessibilityLayer ? 0 : undefined}
            aria-label={props.accessibilityLayer ? undefined : 'Chart'}
            class={cn('recharts-surface', props.class ?? props.className)}
            width={context.width()}
            height={context.height()}
            style={{ width: '100%', height: '100%', display: 'block' }}
            viewBox={`0 0 ${context.width()} ${context.height()}`}
            onMouseMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const x = Math.round(((event.clientX - rect.left) / rect.width) * context.width());
              const y = Math.round(((event.clientY - rect.top) / rect.height) * context.height());
              if (
                x < context.left() ||
                x > context.right() ||
                y < context.top() ||
                y > context.bottom()
              ) {
                context.setActive(null);
                return;
              }
              context.setPointerY(y);
              context.setActive(
                Math.max(
                  0,
                  Math.min(
                    props.data.length - 1,
                    props.kind === 'bar'
                      ? context.xAxis()?.reversed
                        ? props.data.length - 1 - Math.floor((x - context.left()) / context.band())
                        : Math.floor((x - context.left()) / context.band())
                      : Math.round(
                          ((x - context.left()) / (context.right() - context.left())) *
                            (props.data.length - 1),
                        ),
                  ),
                ),
              );
            }}
            onMouseLeave={() => context.setActive(null)}
            onFocus={() => {
              if (props.accessibilityLayer) {
                context.setActive(0);
                context.setPointerY(context.top());
              }
            }}
            onKeyDown={(event) => {
              if (!props.accessibilityLayer || !['ArrowLeft', 'ArrowRight'].includes(event.key))
                return;
              event.preventDefault();
              const direction = context.xAxis()?.reversed ? -1 : 1;
              context.setActive(
                Math.max(
                  0,
                  Math.min(
                    props.data.length - 1,
                    (context.active() ?? 0) + (event.key === 'ArrowRight' ? direction : -direction),
                  ),
                ),
              );
            }}
          >
            {props.children}
          </svg>
        </div>
      </PlotContext>
    </Show>
  );
}
export const LineChart = Plot,
  AreaChart = Plot,
  ComposedChart = Plot,
  PieChart = Plot,
  RadarChart = Plot,
  RadialBarChart = Plot;
export function BarChart(props: PlotProps) {
  return <Plot {...props} kind="bar" />;
}
type SeriesProps = {
  dataKey: string;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  fillOpacity?: number;
  dot?: boolean | Record<string, unknown>;
  type?: string;
  name?: string;
  stackId?: string;
  radius?: number | number[];
  barSize?: number;
  maxBarSize?: number;
  hide?: boolean;
  children?: JSX.Element;
};
const pathFor = (plot: ReturnType<typeof createPlot>, key: string) =>
  plot.props.data
    .map((row, index) => `${index ? 'L' : 'M'}${plot.x(index)},${plot.y(Number(row[key] ?? 0))}`)
    .join(' ');
export function Line(props: SeriesProps) {
  const plot = usePlot();
  createEffect(
    () => props,
    (entry) => {
      plot.setSeries((series) => [...series, entry]);
      return () =>
        queueMicrotask(() => plot.setSeries((series) => series.filter((value) => value !== entry)));
    },
  );
  return (
    <g data-series={dataValue(props.dataKey)}>
      <path
        d={pathFor(plot, props.dataKey)}
        fill="none"
        stroke={color(props.dataKey, props.stroke, plot.config.config)}
        stroke-width={props.strokeWidth ?? 2}
      />
      {props.dot !== false &&
        plot.props.data.map((row, index) => (
          <circle
            cx={plot.x(index)}
            cy={plot.y(Number(row[props.dataKey] ?? 0))}
            r={3}
            fill={color(props.dataKey, props.stroke, plot.config.config)}
          />
        ))}
    </g>
  );
}
export function Area(props: SeriesProps) {
  const plot = usePlot();
  return (
    <g data-series={dataValue(props.dataKey)}>
      <path
        d={`${pathFor(plot, props.dataKey)} L${plot.x(plot.props.data.length - 1)},${plot.y(0)} L${plot.x(0)},${plot.y(0)} Z`}
        fill={color(props.dataKey, props.fill ?? props.stroke, plot.config.config)}
        fill-opacity={props.fillOpacity ?? 0.25}
      />
      <Line {...props} />
    </g>
  );
}
export function Bar(props: SeriesProps) {
  const plot = usePlot();
  createEffect(
    () => props,
    (entry) => {
      plot.setSeries((series) => [...series, entry]);
      return () =>
        queueMicrotask(() => plot.setSeries((series) => series.filter((value) => value !== entry)));
    },
  );
  const position = () => {
    const series = plot.series().filter((series) => !series.hide);
    const count = Math.max(1, series.length),
      index = Math.max(0, series.indexOf(props));
    const band = plot.band();
    const percent = (value: number | string, size: number) =>
      typeof value === 'string' && value.endsWith('%')
        ? (parseFloat(value) / 100) * size
        : Number(value);
    let gap = percent(plot.props.barGap ?? 4, band);
    const categoryGap = percent(plot.props.barCategoryGap ?? '10%', band);
    if (series[0]?.barSize !== undefined) {
      let sum = series.reduce((sum, entry) => sum + (entry.barSize ?? 0), 0) + (count - 1) * gap;
      if (sum >= band) {
        sum -= (count - 1) * gap;
        gap = 0;
      }
      const fullSize = sum >= band ? (band / count) * 0.9 : undefined;
      if (fullSize !== undefined) sum = count * fullSize;
      return {
        offset:
          Math.floor((band - sum) / 2) +
          series
            .slice(0, index)
            .reduce((sum, entry) => sum + (fullSize ?? entry.barSize ?? 0) + gap, 0),
        size: fullSize ?? props.barSize ?? 0,
      };
    }
    if (band - 2 * categoryGap - (count - 1) * gap <= 0) gap = 0;
    let original = (band - 2 * categoryGap - (count - 1) * gap) / count;
    if (original > 1) original = Math.floor(original);
    const size = Math.min(original, props.maxBarSize ?? plot.props.maxBarSize ?? Infinity);
    return { offset: categoryGap + (original + gap) * index + (original - size) / 2, size };
  };
  return (
    <g
      class="recharts-layer recharts-bar"
      data-series={dataValue(props.dataKey)}
      visibility={props.hide ? 'hidden' : undefined}
    >
      {plot.props.data.map((row, index) => {
        const value = () => Number(row[props.dataKey] ?? 0);
        const x = () => plot.categoryStart(index) + position().offset;
        const y = () => plot.y(value());
        const height = () => plot.y(0) - plot.y(value());
        return (
          <path
            class="recharts-rectangle"
            d={rectanglePath(x(), y(), position().size, height(), props.radius ?? 0)}
            fill={color(props.dataKey, props.fill, plot.config.config)}
          >
            <title>
              {props.name ?? props.dataKey}: {value()}
            </title>
          </path>
        );
      })}
    </g>
  );
}
export function CartesianGrid(props: {
  vertical?: boolean;
  horizontal?: boolean;
  stroke?: string;
  strokeDasharray?: string;
}) {
  const plot = usePlot();
  return (
    <g class="recharts-cartesian-grid">
      {props.horizontal !== false &&
        plot
          .ticks()
          .map((value) => (
            <line
              stroke={props.stroke ?? '#ccc'}
              stroke-dasharray={props.strokeDasharray}
              fill="none"
              x1={plot.left()}
              x2={plot.right()}
              y1={plot.y(value)}
              y2={plot.y(value)}
            />
          ))}
      {props.vertical !== false &&
        plot.props.data.map((_, index) => (
          <line
            stroke={props.stroke ?? '#ccc'}
            stroke-dasharray={props.strokeDasharray}
            fill="none"
            x1={plot.x(index)}
            x2={plot.x(index)}
            y1={plot.top()}
            y2={plot.bottom()}
          />
        ))}
    </g>
  );
}
type AxisProps = {
  dataKey?: string;
  tickFormatter?: (value: any, index: number) => string;
  hide?: boolean;
  tickLine?: boolean;
  axisLine?: boolean;
  tickMargin?: number;
  height?: number;
  reversed?: boolean;
  minTickGap?: number;
  interval?: number | 'preserveEnd';
};
export function XAxis(props: AxisProps) {
  const plot = usePlot();
  const [element, setElement] = createSignal<SVGGElement>();
  const [widths, setWidths] = createSignal<number[]>([]);
  const labels = () =>
    plot.props.data.map((row, index) =>
      String(
        props.tickFormatter?.(row[props.dataKey ?? 'name'] ?? index, index) ??
          row[props.dataKey ?? 'name'] ??
          index,
      ),
    );
  createEffect(
    () => ({ element: element(), labels: labels() }),
    ({ element, labels }) => {
      if (!element) return;
      const doc = element.ownerDocument;
      const style = doc.defaultView!.getComputedStyle(element);
      const span = doc.createElement('span');
      Object.assign(span.style, {
        position: 'absolute',
        top: '-20000px',
        left: '0px',
        padding: '0px',
        margin: '0px',
        border: 'none',
        whiteSpace: 'pre',
        fontSize: style.fontSize,
        letterSpacing: style.letterSpacing,
      });
      span.setAttribute('aria-hidden', 'true');
      doc.body.appendChild(span);
      const measured = labels.map((label) => {
        span.textContent = label;
        return span.getBoundingClientRect().width;
      });
      span.remove();
      setWidths(measured);
    },
  );
  const visibleTicks = () => {
    const values = labels();
    if (typeof props.interval === 'number')
      return values.flatMap((label, index) =>
        index % ((props.interval! as number) + 1) === 0
          ? [{ index, label, coordinate: plot.x(index) }]
          : [],
      );
    const sign = props.reversed ? -1 : 1;
    const start = sign > 0 ? 0 : plot.width();
    let end = sign > 0 ? plot.width() : 0;
    const result: { index: number; label: string; coordinate: number }[] = [];
    for (let index = values.length - 1; index >= 0; index--) {
      const size = widths()[index] ?? 0;
      let coordinate = plot.x(index);
      if (index === values.length - 1) {
        const gap = sign * (coordinate + (sign * size) / 2 - end);
        if (gap > 0) coordinate -= gap * sign;
      }
      if (
        sign * (coordinate - (sign * size) / 2 - start) < 0 ||
        sign * (coordinate + (sign * size) / 2 - end) > 0
      )
        continue;
      result.unshift({ index, label: values[index], coordinate });
      end = coordinate - sign * (size / 2 + (props.minTickGap ?? 5));
    }
    return result;
  };
  createEffect(
    () => props,
    (axis) => {
      plot.setXAxis(axis);
      return () => queueMicrotask(() => plot.setXAxis(undefined));
    },
  );
  return (
    <g
      ref={setElement}
      class="recharts-layer recharts-cartesian-axis recharts-xAxis"
      visibility={props.hide ? 'hidden' : undefined}
    >
      {props.axisLine !== false && (
        <line
          x1={plot.left()}
          x2={plot.right()}
          y1={plot.bottom()}
          y2={plot.bottom()}
          stroke="#666"
        />
      )}
      {visibleTicks().map(({ index, label, coordinate }) => (
        <g class="recharts-layer recharts-cartesian-axis-tick-label">
          {props.tickLine !== false && (
            <line
              x1={plot.x(index)}
              x2={plot.x(index)}
              y1={plot.bottom()}
              y2={plot.bottom() + 6}
              stroke="#666"
            />
          )}
          <text
            class="recharts-text recharts-cartesian-axis-tick-value"
            stroke="none"
            fill="#666"
            x={coordinate}
            y={plot.bottom() + 6 + (props.tickMargin ?? 2)}
            text-anchor="middle"
          >
            <tspan x={coordinate} dy="0.71em">
              {label}
            </tspan>
          </text>
        </g>
      ))}
    </g>
  );
}
export function YAxis(props: {
  tickFormatter?: (value: number, index: number) => string;
  hide?: boolean;
  tickLine?: boolean;
  axisLine?: boolean;
  tickMargin?: number;
  domain?: [number | 'auto', number | 'auto'];
}) {
  const plot = usePlot();
  return (
    <g fill="var(--muted-foreground)" font-size="12" visibility={props.hide ? 'hidden' : undefined}>
      {Array.from({ length: 5 }, (_, index) => {
        const value = plot.minimum() + ((plot.maximum() - plot.minimum()) * index) / 4;
        return (
          <text
            x={plot.left() - 8 - (props.tickMargin ?? 0)}
            y={plot.y(value) + 4}
            text-anchor="end"
          >
            {props.tickFormatter?.(value, index) ?? Number(value.toFixed(2))}
          </text>
        );
      })}
    </g>
  );
}
type PieProps = Partial<SeriesProps> & {
  data?: ChartDatum[];
  nameKey?: string;
  cx?: number;
  cy?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  paddingAngle?: number;
  label?: boolean;
};
export function Pie(props: PieProps) {
  const plot = usePlot();
  const data = () => props.data ?? plot.props.data;
  const values = () => data().map((row) => Number(row[props.dataKey ?? 'value'] ?? 0));
  const total = () => values().reduce((sum, value) => sum + value, 0) || 1;
  const center = () => [props.cx ?? plot.width() / 2, props.cy ?? plot.height() / 2];
  const point = (angle: number, radius: number) => [
    center()[0] + Math.cos(angle) * radius,
    center()[1] + Math.sin(angle) * radius,
  ];
  const arcs = () =>
    values().map((value, index) => {
      const start =
        ((props.startAngle ?? -90) * Math.PI) / 180 +
        (values()
          .slice(0, index)
          .reduce((sum, n) => sum + n, 0) /
          total()) *
          Math.PI *
          2;
      const end = start + (value / total()) * Math.PI * 2 - 0.00001;
      const radius = props.outerRadius ?? Math.min(plot.width(), plot.height()) * 0.35,
        inner = props.innerRadius ?? 0;
      const a = point(start, radius),
        b = point(end, radius),
        c = point(end, inner),
        d = point(start, inner);
      return {
        d: `M${a} A${radius} ${radius} 0 ${end - start > Math.PI ? 1 : 0} 1 ${b} L${c} A${inner} ${inner} 0 ${end - start > Math.PI ? 1 : 0} 0 ${d} Z`,
        index,
        value,
      };
    });
  return (
    <g>
      {arcs().map((arc) => (
        <path
          d={arc.d}
          fill={color(
            String(data()[arc.index][props.nameKey ?? 'name'] ?? arc.index),
            data()[arc.index].fill as string | undefined,
            plot.config.config,
            arc.index,
          )}
        >
          <title>
            {String(data()[arc.index][props.nameKey ?? 'name'] ?? arc.index)}: {arc.value}
          </title>
        </path>
      ))}
    </g>
  );
}
export function Radar(props: SeriesProps) {
  const plot = usePlot();
  const points = () =>
    plot.props.data
      .map((row, index) => {
        const angle = (index / plot.props.data.length) * Math.PI * 2 - Math.PI / 2;
        const radius =
          (Number(row[props.dataKey] ?? 0) / plot.maximum()) *
          Math.min(plot.width(), plot.height()) *
          0.35;
        return `${plot.width() / 2 + Math.cos(angle) * radius},${plot.height() / 2 + Math.sin(angle) * radius}`;
      })
      .join(' ');
  return (
    <polygon
      points={points()}
      stroke={color(props.dataKey, props.stroke, plot.config.config)}
      stroke-width={props.strokeWidth ?? 2}
      fill={color(props.dataKey, props.fill, plot.config.config)}
      fill-opacity={props.fillOpacity ?? 0.3}
    />
  );
}
export function RadialBar(
  props: SeriesProps & {
    background?: boolean;
    cornerRadius?: number;
  },
) {
  const plot = usePlot();
  return (
    <g>
      {plot.props.data.map((row, index) => {
        const radius = 40 + index * 24;
        const length = 2 * Math.PI * radius;
        return (
          <g transform={`rotate(-90 ${plot.width() / 2} ${plot.height() / 2})`}>
            {props.background && (
              <circle
                cx={plot.width() / 2}
                cy={plot.height() / 2}
                r={radius}
                fill="none"
                stroke="var(--muted)"
                stroke-width="18"
              />
            )}
            <circle
              cx={plot.width() / 2}
              cy={plot.height() / 2}
              r={radius}
              fill="none"
              stroke={color(props.dataKey, props.fill, plot.config.config, index)}
              stroke-width="18"
              stroke-linecap={props.cornerRadius ? 'round' : 'butt'}
              stroke-dasharray={`${(Number(row[props.dataKey] ?? 0) / plot.maximum()) * length} ${length}`}
            />
          </g>
        );
      })}
    </g>
  );
}
export function ChartTooltip(props: {
  content?:
    | JSX.Element
    | ((props: { active: boolean; payload: ChartPayload[]; label: unknown }) => JSX.Element);
  cursor?: boolean | Record<string, unknown>;
  formatter?: ChartTooltipContentProps['formatter'];
  offset?: number;
  active?: boolean;
  position?: { x?: number; y?: number };
  isAnimationActive?: boolean | 'auto';
  animationDuration?: number;
  animationEasing?: string;
  labelClassName?: string;
  labelFormatter?: ChartTooltipContentProps['labelFormatter'];
}) {
  const plot = usePlot();
  const payload = () => {
    const index = plot.active();
    if (index === null) return [];
    const row = plot.props.data[index];
    return row
      ? plot
          .series()
          .filter((series) => !series.hide)
          .map((series) => ({
            dataKey: series.dataKey,
            name: series.name ?? series.dataKey,
            value: Number(row[series.dataKey]),
            color: color(series.dataKey, series.fill, plot.config.config),
            payload: row,
          }))
      : [];
  };
  const state = {
    get active() {
      return props.active ?? plot.active() !== null;
    },
    get payload() {
      return payload();
    },
    get label() {
      return plot.active() === null
        ? undefined
        : plot.props.data[plot.active()!]?.[plot.xAxis()?.dataKey ?? 'name'];
    },
    get labelClassName() {
      return props.labelClassName;
    },
    get labelFormatter() {
      return props.labelFormatter;
    },
    get formatter() {
      return props.formatter;
    },
  };
  const [element, setElement] = createSignal<HTMLDivElement>();
  const [size, setSize] = createSignal({ width: 0, height: 0 });
  const [reducedMotion, setReducedMotion] = createSignal(false);
  createEffect(
    () => element(),
    (element) => {
      if (!element) return;
      const media = element.ownerDocument.defaultView!.matchMedia(
        '(prefers-reduced-motion: reduce)',
      );
      const update = () => setReducedMotion(media.matches);
      update();
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    },
  );
  createEffect(
    () => ({ element: element(), active: state.active, payload: payload() }),
    ({ element }) => {
      if (!element) return;
      const measure = () => {
        const rect = element.getBoundingClientRect();
        setSize({ width: rect.width, height: rect.height });
      };
      measure();
      const observer = new element.ownerDocument.defaultView!.ResizeObserver(measure);
      observer.observe(element);
      return () => observer.disconnect();
    },
  );
  const translate = (axis: 'x' | 'y') => {
    if (props.position?.[axis] !== undefined) return props.position[axis];
    const coordinate = axis === 'x' ? plot.x(plot.active() ?? 0) : plot.pointerY();
    const dimension = axis === 'x' ? size().width : size().height;
    const start = axis === 'x' ? plot.left() : plot.top();
    const end = axis === 'x' ? plot.right() : plot.bottom();
    const offset = props.offset ?? 10;
    return Math.max(
      start,
      coordinate + offset + dimension > end
        ? coordinate - dimension - Math.max(offset, 0)
        : coordinate + offset,
    );
  };
  return (
    <TooltipContext value={state}>
      <Show when={state.active && props.cursor !== false && plot.active() !== null}>
        <path
          class="recharts-rectangle recharts-tooltip-cursor"
          fill="#ccc"
          stroke="none"
          pointer-events="none"
          d={rectanglePath(
            plot.categoryStart(plot.active()!),
            plot.top() + 0.5,
            plot.band(),
            plot.bottom() - plot.top() - 1,
            0,
          )}
          {...(typeof props.cursor === 'object' ? props.cursor : {})}
        />
      </Show>
      <Show when={plot.overlay() && state.active}>
        <Portal mount={plot.overlay()}>
          <div
            ref={setElement}
            class="recharts-tooltip-wrapper"
            tabindex={-1}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              'pointer-events': 'none',
              visibility: size().width > 0 ? 'visible' : 'hidden',
              transform: `translate(${translate('x')}px, ${translate('y')}px)`,
              transition:
                (props.isAnimationActive ?? 'auto') !== false &&
                (props.isAnimationActive === true || !reducedMotion())
                  ? `transform ${props.animationDuration ?? 400}ms ${props.animationEasing ?? 'ease'}`
                  : undefined,
            }}
          >
            {typeof props.content === 'function'
              ? props.content(state)
              : (props.content ?? <ChartTooltipContent formatter={props.formatter} />)}
          </div>
        </Portal>
      </Show>
    </TooltipContext>
  );
}
export type ChartTooltipContentProps = ComponentProps<'div'> & {
  active?: boolean;
  payload?: ChartPayload[];
  indicator?: 'dot' | 'line' | 'dashed';
  hideLabel?: boolean;
  hideIndicator?: boolean;
  label?: unknown;
  labelFormatter?: (label: unknown, payload: ChartPayload[]) => JSX.Element;
  formatter?: (
    value: number,
    name: string,
    item: ChartPayload,
    index: number,
    payload: ChartDatum,
  ) => JSX.Element;
  color?: string;
  nameKey?: string;
  labelKey?: string;
  labelClassName?: string;
  variant?: 'base' | 'new-york';
};
function payloadConfig(config: ChartConfig, item: ChartPayload | undefined, key: string) {
  if (!item) return undefined;
  const direct = Reflect.get(item, key);
  const nested = item.payload?.[key];
  const configKey = typeof direct === 'string' ? direct : typeof nested === 'string' ? nested : key;
  return config[configKey] ?? config[key];
}
export function ChartTooltipContent(input: ChartTooltipContentProps) {
  const context = useContext(ConfigContext);
  const state = useContext(TooltipContext);
  const props: ChartTooltipContentProps = mergeRenderProps(state ?? {}, input);
  const indicator = () => props.indicator ?? 'dot';
  const nestLabel = () => props.payload?.length === 1 && indicator() !== 'dot';
  const label = () => {
    if (props.hideLabel || !props.payload?.length) return null;
    const item = props.payload[0];
    const config = payloadConfig(
      context.config,
      item,
      String(props.labelKey ?? item?.dataKey ?? item?.name ?? 'value'),
    );
    const value =
      !props.labelKey && typeof props.label === 'string'
        ? (context.config[props.label]?.label ?? props.label)
        : config?.label;
    return props.labelFormatter || value ? (
      <div class={cn('font-medium', props.labelClassName)}>
        {props.labelFormatter ? props.labelFormatter(value, props.payload) : value}
      </div>
    ) : null;
  };
  return (
    <Show when={props.active && props.payload?.length}>
      <div
        class={cn(
          props.variant === 'new-york'
            ? 'grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl'
            : 'cn-chart-tooltip grid min-w-32 items-start',
          props.class ?? props.className,
        )}
      >
        {!nestLabel() ? label() : null}
        <div class="grid gap-1.5">
          {props.payload
            ?.filter((item) => item.type !== 'none')
            .map((item, index) => {
              const config = () =>
                payloadConfig(
                  context.config,
                  item,
                  String(props.nameKey ?? item.name ?? item.dataKey ?? 'value'),
                );
              const itemColor = () => props.color ?? item.payload?.fill ?? item.color;
              return (
                <div
                  class={cn(
                    'flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground',
                    indicator() === 'dot' && 'items-center',
                  )}
                >
                  {props.formatter && item.value !== undefined && item.name ? (
                    props.formatter(item.value, item.name, item, index, item.payload)
                  ) : (
                    <>
                      {config()?.icon ? (
                        <Dynamic component={config()!.icon!} />
                      ) : (
                        !props.hideIndicator && (
                          <div
                            class={cn(
                              'shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)',
                              {
                                'h-2.5 w-2.5': indicator() === 'dot',
                                'w-1': indicator() === 'line',
                                'w-0 border-[1.5px] border-dashed bg-transparent':
                                  indicator() === 'dashed',
                                'my-0.5': nestLabel() && indicator() === 'dashed',
                              },
                            )}
                            style={{ '--color-bg': itemColor(), '--color-border': itemColor() }}
                          />
                        )
                      )}
                      <div
                        class={cn(
                          'flex flex-1 justify-between leading-none',
                          nestLabel() ? 'items-end' : 'items-center',
                        )}
                      >
                        <div class="grid gap-1.5">
                          {nestLabel() ? label() : null}
                          <span class="text-muted-foreground">{config()?.label ?? item.name}</span>
                        </div>
                        {item.value != null && (
                          <span class="font-mono font-medium text-foreground tabular-nums">
                            {typeof item.value === 'number'
                              ? item.value.toLocaleString()
                              : String(item.value)}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </Show>
  );
}
export function ChartLegendContent(
  props: ComponentProps<'div'> & {
    payload?: {
      value: string;
      color?: string;
      dataKey?: string;
    }[];
    hideIcon?: boolean;
    verticalAlign?: 'top' | 'bottom';
    nameKey?: string;
  },
) {
  const context = useContext(ConfigContext);
  const entries = () =>
    props.payload ??
    Object.entries(context.config).map(([key]) => ({
      value: key,
      color: `var(--color-${key})`,
      dataKey: key,
    }));
  return (
    <div
      class={cn(
        'cn-chart-legend flex items-center justify-center gap-4',
        props.verticalAlign === 'top' ? 'pb-3' : 'pt-3',
        props.class ?? props.className,
      )}
    >
      {entries().map((entry) => (
        <div class="flex items-center gap-1.5">
          {!props.hideIcon && (
            <span class="h-2 w-2 rounded-[2px]" style={{ background: entry.color }} />
          )}
          {context.config[entry.dataKey ?? entry.value]?.label ?? entry.value}
        </div>
      ))}
    </div>
  );
}
export function ChartLegend(props: { content?: JSX.Element; verticalAlign?: 'top' | 'bottom' }) {
  const plot = usePlot();
  const [element, setElement] = createSignal<HTMLDivElement>();
  createEffect(
    () => element(),
    (element) => {
      if (!element) return;
      const measure = () => plot.setLegendHeight(element.getBoundingClientRect().height);
      measure();
      const observer = new element.ownerDocument.defaultView!.ResizeObserver(measure);
      observer.observe(element);
      return () => observer.disconnect();
    },
  );
  return (
    <Show when={plot.overlay()}>
      <Portal mount={plot.overlay()}>
        <div
          ref={setElement}
          class="recharts-legend-wrapper"
          style={{
            position: 'absolute',
            width: `${plot.right() - plot.left()}px`,
            height: 'auto',
            left: `${plot.left()}px`,
            [props.verticalAlign === 'top' ? 'top' : 'bottom']:
              `${plot.margin(props.verticalAlign === 'top' ? 'top' : 'bottom')}px`,
          }}
        >
          {props.content ?? <ChartLegendContent verticalAlign={props.verticalAlign} />}
        </div>
      </Portal>
    </Show>
  );
}
