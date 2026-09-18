# Shadcn UI for Solid 2 RC

This package contains native Solid source for all 62 component modules in the cloned Base UI registry, plus the legacy `form` module. It uses `solid-js` and `@solidjs/web` version `2.0.0-rc.8`. No component imports the React runtime.

```tsx
import { Button } from '@solid-cn/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from '@solid-cn/ui/dialog';

export function Example() {
  return (
    <Dialog>
      <DialogTrigger render={(props) => <Button {...props} />}>Open</DialogTrigger>
      <DialogContent>
        <DialogTitle>Solid dialog</DialogTitle>
      </DialogContent>
    </Dialog>
  );
}
```

Use the Solid 2 compiler with `jsxImportSource: "@solidjs/web"`. Render props must be functions. A pre-created JSX node cannot receive the behavior props that Base UI supplies.

The package includes the original eight Shadcn style sheets, theme variables, and Tailwind utilities. The combined `styles.css` includes the Nova style. Import it after Tailwind CSS 4, and set `class="style-nova"` on `html` or `body`. Dialogs, menus, and notifications use portals outside the application root:

```css
@import 'tailwindcss';
@import '@solid-cn/ui/styles.css';
```

To select a different style, keep the combined import and add the selected preset after it. For example, import `@solid-cn/ui/styles/style-maia.css` and set `class="style-maia"` on `html` or `body`. The unused Nova rules only apply inside `.style-nova`. The combined sheet also tells Tailwind to scan the package for utility classes.

The native calendar, command palette, OTP input, resizable panels, chart, questionnaire, and message scroller replace React-only dependencies. The carousel uses the framework-independent Embla engine. The Sonner surface uses the native Base UI toast manager. The legacy Form parts use `createForm`, a native Solid controller, in place of React Hook Form. Create a controller with `createForm({ defaultValues, validate })`, pass it to `<Form control={form}>`, and use `form.handleSubmit` on your form element.

The SVG chart module exports native `LineChart`, `AreaChart`, `BarChart`, `PieChart`, `RadarChart`, and `RadialBarChart` components and their series. Import these from this package instead of Recharts.

## Current limits

This is an experimental native port, not a verified drop-in replacement. An export with the same name does not prove the same behavior. The original React tests are unchanged. They do not yet prove this Solid port correct. The workspace parity report records that gap.

The following API differences are known:

- Calendar supports date, multiple-date, and range selection, month changes, basic locale formatting, date matchers, and keyboard input. It does not implement the full React Day Picker API. Custom components are limited to `DayButton`. Week numbers are not rendered. Range `min` and `max` are not enforced. Both partial dropdown caption modes show month and year selectors. Keyboard movement does not skip disabled dates. The initial keyboard date can be outside a supplied default month.
- Chart renders native SVG lines, areas, bars, pies, radar polygons, and radial bars with basic axes, grids, tooltips, and legends. It is not a Recharts replacement. Stacking, curves, axis domains, vertical layout, animation, and custom series components are not implemented. Several accepted options, including `stackId`, curve `type`, and axis `domain`, have no effect. Pie `endAngle`, `paddingAngle`, and `label` are not implemented.
- Form uses the `createForm` API above. React Hook Form controllers, field arrays, schema resolvers, nested field paths, and subscription APIs are not supported. Form state has values, errors, touched fields, submitting state, and basic validation only.
- Command has text filtering, keyboard movement, and item selection. It does not reproduce all cmdk scoring, group ordering, and filtering rules.
- OTP supports value changes, slots, paste conversion, and completion. It does not include the password-manager badge strategy from input-otp.
- Resizable panels support pointer and arrow-key changes between adjacent panels, with basic size limits. Sizes use numeric percentages. CSS size units, saved layouts, `defaultLayout`, and the upstream imperative panel API are not implemented.
- Questionnaire supports step movement, required inputs, choices, progress, and form submission. Displayed choice shortcuts do not yet have keyboard actions. Its focus and status behavior does not reproduce every upstream case.
- Message scroller supports edge and message movement, basic visibility, following new content, and prepend position retention. It does not reproduce the complete upstream anchor and streaming-layout state machine.
- Sonner supports string titles, description, duration, ID, one action, status methods, and dismiss. It uses the Base UI toast manager. Sonner promise, custom rendering, and its full option API are not supported.
- Carousel uses the native Embla engine and supports its options and plugins. `useCarousel()` returns reactive property getters. Read these properties inside Solid reactive expressions; do not destructure them into static local values.

The shared Base UI layer has its own API and accessibility gaps. See its README and the workspace parity report before production use. Native browser diagnostics cover selected paths, not every component or every browser.

## Validation and distribution

With the workspace development server running, execute `node tooling/verify-shadcn.mjs` from the workspace root. It checks date selection, command filtering, OTP, panel resizing, questionnaire submission, form validation, carousel navigation, message scrolling, chart tooltip display, and toast closing. It does not modify or replace upstream test files.

Build the packages from the workspace root with `npm run build`. Create local package archives with `npm pack` from each package directory, then install both archives in a Solid 2 project. This package has not been published to npm.
