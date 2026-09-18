import { ChartTooltipContent as NativeChartTooltipContent } from '@solid-cn/ui/chart';
export { ChartContainer, ChartTooltip } from '@solid-cn/ui/chart';
export function ChartTooltipContent(props) {
  return <NativeChartTooltipContent {...props} variant="new-york" />;
}
