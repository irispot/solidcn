import * as React from 'react';
import { Toast } from '@base-ui/react/toast';

const toastManager = Toast.createToastManager();

// One React-style source renders in both apps. This checks the Base UI
// Positioner and Arrow, which the Shadcn toast examples do not use.
export default function AnchoredToast() {
  const [item, setItem] = React.useState(null);
  const anchor = React.useRef<HTMLButtonElement>(null);

  function showToast() {
    const options = {
      title: 'Saved',
      timeout: 0,
      positionerProps: { anchor: anchor.current, side: 'bottom', sideOffset: 8 },
    };
    const id = toastManager.add(options);
    setItem({ ...options, id });
  }

  return (
    <Toast.Provider toastManager={toastManager}>
      <button type="button" ref={anchor} onClick={showToast} style={{ padding: '8px' }}>
        Show anchored toast
      </button>
      {item && (
        <Toast.Portal>
          <Toast.Positioner toast={item} data-visual-toast-positioner="">
            <Toast.Root
              toast={item}
              style={{ position: 'relative', padding: '10px', background: 'white', border: '1px solid black' }}
            >
              <Toast.Arrow
                data-visual-toast-arrow=""
                style={{ width: '8px', height: '8px', background: 'white', border: '1px solid black', transform: 'rotate(45deg)' }}
              />
              <Toast.Title />
            </Toast.Root>
          </Toast.Positioner>
        </Toast.Portal>
      )}
    </Toast.Provider>
  );
}
