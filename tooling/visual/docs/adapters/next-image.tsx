import { createMemo, createSignal } from 'solid-js';
import { getImgProps } from 'next/dist/shared/lib/get-img-props';
import loaderModule from 'next/dist/shared/lib/image-loader';
import { visualImageConfig } from '../../apps/image-config.mjs';
const defaultLoader = loaderModule.default ?? loaderModule;

/** Original pure image attribute calculation, rendered by Solid rather than React. */
export default function Image(props) {
  const [showAltText, setShowAltText] = createSignal(false);
  const [blurComplete, setBlurComplete] = createSignal(false);
  const calculated = createMemo(() =>
    getImgProps(
      { ...props, className: props.class ?? props.className },
      {
        imgConf: visualImageConfig,
        defaultLoader,
        showAltText: showAltText(),
        blurComplete: blurComplete(),
      },
    ),
  );
  const attrs = createMemo(() => {
    const { className, style, ...rest } = calculated().props;
    return {
      ...rest,
      class: className,
      style: Object.fromEntries(
        Object.entries(style ?? {}).map(([key, value]) => [
          key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
          value,
        ]),
      ),
    };
  });
  return (
    <img
      {...attrs()}
      data-nimg={props.fill ? 'fill' : '1'}
      onLoad={(event) => {
        setBlurComplete(true);
        props.onLoad?.(event);
        props.onLoadingComplete?.(event.currentTarget);
      }}
      onError={(event) => {
        setShowAltText(true);
        setBlurComplete(true);
        props.onError?.(event);
      }}
    />
  );
}
