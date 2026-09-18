import { Dynamic, type JSX } from '@solidjs/web';
import { omitProps } from './utils';
import { registryIcons } from './icon-data';

/** Native renderer for the exact SVG nodes selected by the upstream registry. */
export function IconPlaceholder(
  props: JSX.SvgSVGAttributes<SVGSVGElement> & {
    lucide?: string;
    tabler?: string;
    hugeicons?: string;
    phosphor?: string;
    remixicon?: string;
    className?: string;
    size?: number | string;
    strokeWidth?: number | string;
    absoluteStrokeWidth?: boolean;
  },
) {
  const definition = () => {
    const value = registryIcons[props.lucide ?? ''];
    if (!value) throw new Error(`Missing native registry icon: ${props.lucide}`);
    return value;
  };
  const size = () => props.size ?? 24;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size()}
      height={size()}
      viewBox="0 0 24 24"
      fill="none"
      stroke={props.color ?? 'currentColor'}
      stroke-width={
        props.absoluteStrokeWidth
          ? (Number(props.strokeWidth ?? 2) * 24) / Number(size())
          : (props.strokeWidth ?? 2)
      }
      stroke-linecap="round"
      stroke-linejoin="round"
      class={['lucide', `lucide-${definition().iconName}`, props.class ?? props.className]
        .filter(Boolean)
        .join(' ')}
      {...omitProps(props, [
        'lucide',
        'tabler',
        'hugeicons',
        'phosphor',
        'remixicon',
        'class',
        'className',
        'size',
        'color',
        'strokeWidth',
        'absoluteStrokeWidth',
        'children',
      ])}
    >
      {definition().nodes.map(([tag, attributes]) => (
        <Dynamic component={tag as any} {...attributes} />
      ))}
      {props.children}
    </svg>
  );
}
