# Base UI for Solid 2 RC

This is a native Solid migration in progress. It requires exactly `solid-js@2.0.0-rc.8` and `@solidjs/web@2.0.0-rc.8`. It does not use the React runtime.

The package contains all 43 public runtime module paths from the pinned Base UI source. Export coverage does not prove behavior parity. Do not use this package as a verified replacement for the complete upstream library.

```tsx
import { Button } from '@solid-cn/base-ui/button';
import { Dialog } from '@solid-cn/base-ui/dialog';

export function Example() {
  return (
    <Dialog.Root>
      <Dialog.Trigger render={(props) => <Button {...props} />}>Open</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Title>Example</Dialog.Title>
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

Components are unstyled. Use CSS, or use the `@solid-cn/ui` package for Shadcn styles. Native Solid render props are functions; they do not accept a pre-created JSX element. Native event callbacks receive DOM events. Read reactive values in expressions; do not copy reactive getters into static variables.

The package includes Solid source, compiled browser modules, server modules, and TypeScript declarations. Its `solid` export condition selects source for the Solid Vite plugin. Its `browser` and `node` conditions select the applicable compiled modules. Build and package commands run from the workspace root. Neither package is published to npm.

## Verification and limits

The workspace checksum guard protects all original tests, fixtures, assertion helpers, and test configuration files. The unchanged upstream `mergeProps` suite passes against the native utility. A separate fixture adapter runs a limited set of unchanged component tests. See `tooling/parity/README.md` at the workspace root for exact coverage and adapter limits.

Additional Chromium checks cover controls, selection, overlays, custom state mappings, and the styled components. A temporary consumer checks archive installation, types, production builds, server rendering, and hydration. These checks do not prove the full upstream behavior contract.

Known gaps include:

- Advanced navigation-menu positioning, content transitions, and focus rules.
- Drawer snap points, nested gestures, and background indentation.
- Virtualized and grid selection, and positioning through transformed ancestors.
- Exact nested overlay pointer, focus, and animation behavior.
- Precise public prop types and all event reason and callback ordering rules.
- The control-specific differences in [CONTROLS.md](CONTROLS.md).
- Full original browser, accessibility, server, hydration, and type-test coverage.

The root `README.md` gives installation steps and the complete migration status. The release check must fail until full parity is established.
