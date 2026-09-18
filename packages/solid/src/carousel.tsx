import { createContext, createEffect, createSignal, useContext } from 'solid-js';
import EmblaCarousel, {
  type EmblaCarouselType,
  type EmblaOptionsType,
  type EmblaPluginType,
} from 'embla-carousel';
import { cn, omitProps, type ComponentProps } from './utils';
import { Button } from './button';
import { IconPlaceholder } from './icons';
export type CarouselApi = EmblaCarouselType;
export type CarouselProps = {
  opts?: EmblaOptionsType;
  plugins?: EmblaPluginType[];
  orientation?: 'horizontal' | 'vertical';
  setApi?: (api: CarouselApi) => void;
};
const Context = createContext<{
  orientation: () => string;
  mount: (node: HTMLElement) => void;
  previous: () => void;
  next: () => void;
  canPrevious: () => boolean;
  canNext: () => boolean;
  api: () => CarouselApi | undefined;
  props: CarouselProps;
} | null>(null);
function useCarouselState() {
  const context = useContext(Context);
  if (!context) throw new Error('Carousel parts must be inside Carousel.');
  return context;
}
export function useCarousel() {
  const context = useCarouselState();
  return {
    carouselRef: context.mount,
    get api() {
      return context.api();
    },
    get opts() {
      return context.props.opts;
    },
    get orientation() {
      return context.orientation();
    },
    scrollPrev: context.previous,
    scrollNext: context.next,
    get canScrollPrev() {
      return context.canPrevious();
    },
    get canScrollNext() {
      return context.canNext();
    },
  };
}
export function Carousel(props: ComponentProps<'div'> & CarouselProps) {
  const [root, setRoot] = createSignal<HTMLDivElement>();
  const [element, setElement] = createSignal<HTMLElement | null>(null),
    [previous, setPrevious] = createSignal(false),
    [next, setNext] = createSignal(false);
  const [api, setApi] = createSignal<CarouselApi>();
  const orientation = () =>
    props.orientation ?? (props.opts?.axis === 'y' ? 'vertical' : 'horizontal');
  createEffect(
    () => ({
      element: element(),
      opts: props.opts,
      plugins: props.plugins,
      orientation: orientation(),
    }),
    (values) => {
      if (!values.element) return;
      const instance = EmblaCarousel(
        values.element,
        { ...values.opts, axis: values.orientation === 'vertical' ? 'y' : 'x' },
        values.plugins,
      );
      setApi(instance);
      const update = () => {
        setPrevious(instance.canScrollPrev());
        setNext(instance.canScrollNext());
      };
      update();
      instance.on('select', update).on('reInit', update);
      props.setApi?.(instance);
      return () => {
        instance.destroy();
        setApi(undefined);
      };
    },
  );
  const context = {
    orientation,
    mount: setElement,
    previous: () => api()?.scrollPrev(),
    next: () => api()?.scrollNext(),
    canPrevious: previous,
    canNext: next,
    api,
    props,
  };
  createEffect(root, (node) => {
    if (!node) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        context.previous();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        context.next();
      }
    };
    node.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => node.removeEventListener('keydown', handleKeyDown, { capture: true });
  });
  return (
    <Context value={context}>
      <div
        {...omitProps(props, ['opts', 'plugins', 'orientation', 'setApi', 'className'])}
        ref={setRoot}
        class={cn('relative', props.class ?? props.className)}
        role="region"
        aria-roledescription="carousel"
        data-slot="carousel"
      />
    </Context>
  );
}
export function CarouselContent(props: ComponentProps<'div'>) {
  const context = useCarouselState();
  return (
    <div ref={context.mount} class="overflow-hidden" data-slot="carousel-content">
      <div
        {...omitProps(props, ['className'])}
        class={cn(
          'flex',
          context.orientation() === 'horizontal' ? '-ml-4' : '-mt-4 flex-col',
          props.class ?? props.className,
        )}
      />
    </div>
  );
}
export function CarouselItem(props: ComponentProps<'div'>) {
  const context = useCarouselState();
  return (
    <div
      {...omitProps(props, ['className'])}
      role="group"
      aria-roledescription="slide"
      data-slot="carousel-item"
      class={cn(
        'min-w-0 shrink-0 grow-0 basis-full',
        context.orientation() === 'horizontal' ? 'pl-4' : 'pt-4',
        props.class ?? props.className,
      )}
    />
  );
}
export function CarouselPrevious(props: ComponentProps<typeof Button>) {
  const context = useCarouselState();
  return (
    <Button
      variant="outline"
      size="icon-sm"
      {...omitProps(props, ['className'])}
      data-slot="carousel-previous"
      class={cn(
        'cn-carousel-previous absolute touch-manipulation',
        context.orientation() === 'horizontal'
          ? 'inset-y-0 -left-12 my-auto'
          : '-top-12 left-1/2 -translate-x-1/2 rotate-90',
        props.class ?? props.className,
      )}
      disabled={!context.canPrevious()}
      onClick={context.previous}
    >
      <IconPlaceholder lucide="ChevronLeftIcon" class="cn-rtl-flip" />
      <span class="sr-only">Previous slide</span>
    </Button>
  );
}
export function CarouselNext(props: ComponentProps<typeof Button>) {
  const context = useCarouselState();
  return (
    <Button
      variant="outline"
      size="icon-sm"
      {...omitProps(props, ['className'])}
      data-slot="carousel-next"
      class={cn(
        'cn-carousel-next absolute touch-manipulation',
        context.orientation() === 'horizontal'
          ? 'inset-y-0 -right-12 my-auto'
          : '-bottom-12 left-1/2 -translate-x-1/2 rotate-90',
        props.class ?? props.className,
      )}
      disabled={!context.canNext()}
      onClick={context.next}
    >
      <IconPlaceholder lucide="ChevronRightIcon" class="cn-rtl-flip" />
      <span class="sr-only">Next slide</span>
    </Button>
  );
}
