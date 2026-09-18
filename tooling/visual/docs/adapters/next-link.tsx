import type { JSX } from '@solidjs/web';
import { omitProps } from '../../../../shadcn-ui/packages/solid/src/utils';

/** Next Link uses a normal anchor when no Next router is mounted, as in these previews. */
export default function Link(
  props: JSX.AnchorHTMLAttributes<HTMLAnchorElement> & {
    as?: string;
    prefetch?: boolean;
    replace?: boolean;
    scroll?: boolean;
  },
) {
  return (
    <a
      {...omitProps(props, ['as', 'prefetch', 'replace', 'scroll'])}
      href={props.as ?? props.href}
    />
  );
}
