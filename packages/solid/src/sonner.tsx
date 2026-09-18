// Sonner's public surface is rendered with native Base UI state and a
// Sonner-compatible layout. Keep it separate from the Shadcn Toast component.
import { Toast as Primitive } from '@solid-cn/base-ui/toast';
import { IconPlaceholder } from './icons';
import type { ComponentProps } from './utils';

const manager = Primitive.createToastManager();
type ToasterProps = ComponentProps<typeof Primitive.Provider> & {
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  offset?: number;
  closeButton?: boolean;
};
const font = 'ui-sans-serif, system-ui, -apple-system, "system-ui", "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif';

function ToastIcon(props: { type?: string }) {
  const icon = () => {
    switch (props.type) {
      case 'success': return 'CircleCheckIcon';
      case 'error': return 'OctagonXIcon';
      case 'warning': return 'TriangleAlertIcon';
      case 'info': return 'InfoIcon';
      case 'loading': return 'Loader2Icon';
      default: return undefined;
    }
  };
  return (
    <>{icon() && <span style={{ display: 'flex', width: '16px', height: '16px', 'margin-left': '-4px', 'margin-right': '5px', 'flex-shrink': 0 }}>
      <IconPlaceholder lucide={icon()!} class="size-4" aria-hidden="true" />
    </span>}</>
  );
}

export function Toaster(props: ToasterProps) {
  const position = () => props.position ?? 'bottom-right';
  const offset = () => `${props.offset ?? 24}px`;
  const isTop = () => position().startsWith('top');
  const isCenter = () => position().endsWith('center');
  const isLeft = () => position().endsWith('left');
  return (
    <Primitive.Provider toastManager={manager} timeout={props.timeout}>
      <Primitive.Portal>
        <Primitive.Viewport
          data-slot="sonner-viewport"
          style={{
            position: 'fixed',
            width: '356px',
            'max-width': 'calc(100vw - 32px)',
            'z-index': 999999999,
            'pointer-events': 'none',
            ...(isTop() ? { top: offset() } : { bottom: offset() }),
            ...(isCenter() ? { left: '50%', transform: 'translateX(-50%)' } : isLeft() ? { left: offset() } : { right: offset() }),
          }}
        >
          {manager.toasts.map((item, index) => (
            <Primitive.Root
              toast={item}
              data-slot="toast"
              style={{
                position: 'absolute',
                width: '100%',
                ...(isTop() ? { top: `${index * 88}px` } : { bottom: `${index * 88}px` }),
                display: 'flex',
                'align-items': 'center',
                gap: '6px',
                padding: '16px',
                border: '1px solid #e5e5e5',
                'border-radius': '18px',
                background: '#fff',
                color: '#171717',
                'box-shadow': '0 4px 12px rgba(0, 0, 0, 0.1)',
                'box-sizing': 'border-box',
                'font-family': font,
                'font-size': '13px',
                'line-height': '1.5',
                'pointer-events': 'auto',
              }}
            >
              <ToastIcon type={item.type} />
              <Primitive.Content style={{ display: 'flex', 'flex-direction': 'column', gap: '2px', flex: 1, 'min-width': 0 }}>
                <Primitive.Title style={{ margin: 0, 'font-size': '13px', 'font-weight': 500, 'line-height': '1.5' }} />
                <Primitive.Description style={{ margin: 0, color: '#3f3f3f', 'font-size': '13px', 'line-height': '1.4' }} />
              </Primitive.Content>
              {props.closeButton && <Primitive.Close aria-label="Close toast">×</Primitive.Close>}
            </Primitive.Root>
          ))}
        </Primitive.Viewport>
      </Primitive.Portal>
    </Primitive.Provider>
  );
}
type ToastOptions = {
  description?: string;
  duration?: number;
  id?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
};
function notify(title: string, options: ToastOptions = {}, type?: string) {
  return manager.add({
    title,
    description: options.description,
    timeout: options.duration,
    id: options.id,
    type,
    actionProps: options.action
      ? { children: options.action.label, onClick: options.action.onClick }
      : undefined,
  });
}
export const toast = Object.assign(notify, {
  success: (title: string, options?: ToastOptions) => notify(title, options, 'success'),
  error: (title: string, options?: ToastOptions) => notify(title, options, 'error'),
  warning: (title: string, options?: ToastOptions) => notify(title, options, 'warning'),
  info: (title: string, options?: ToastOptions) => notify(title, options, 'info'),
  loading: (title: string, options?: ToastOptions) => notify(title, options, 'loading'),
  dismiss: (id?: string) => manager.close(id),
});
