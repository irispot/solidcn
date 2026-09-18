// Shared data only: both apps render the same component tree and perform the
// same interactions. Component implementations are loaded by each app.
const n = (type, props = {}, ...children) => ({ type, props, children: children.flat() });
const states = {
  switch: ['off', 'on', 'disabled'],
  button: ['default', 'disabled', 'focus'],
  checkbox: ['off', 'on'],
  input: ['default'],
  tabs: ['default'],
  progress: ['default'],
  separator: ['default'],
  menu: ['open', 'keyboard'],
  select: ['open'],
  combobox: ['filtered'],
  dialog: ['open'],
  tooltip: ['hover'],
};
export const cases = ['base', 'shadcn'].flatMap((layer) =>
  Object.entries(states).flatMap(([component, variants]) =>
    variants.map((state) => ({
      id: `${layer}-${component}-${state}`,
      layer,
      component,
      state,
      width: 600,
      height: 240,
      popups:
        component === 'tooltip'
          ? [layer === 'base' ? '.base-tooltip' : '[data-slot="tooltip-content"]']
          : ['menu', 'select', 'combobox', 'dialog'].includes(component)
            ? [
                `[role="${component === 'menu' ? 'menu' : component === 'select' || component === 'combobox' ? 'listbox' : 'dialog'}"]`,
              ]
            : [],
      actions:
        state === 'focus'
          ? [{ type: 'press', selector: 'body', value: 'Tab' }]
          : component === 'menu'
            ? [
                { type: 'click', selector: '[data-visual-trigger]' },
                { type: 'wait', selector: '[role="menu"]' },
                ...(state === 'keyboard'
                  ? [{ type: 'press', selector: '[data-visual-trigger]', value: 'ArrowDown' }]
                  : []),
              ]
            : component === 'select'
              ? [
                  { type: 'click', selector: '[data-visual-trigger]' },
                  { type: 'wait', selector: '[role="listbox"]' },
                ]
              : component === 'combobox'
                ? [
                    { type: 'fill', selector: '[role="combobox"]', value: 'Ap' },
                    { type: 'wait', selector: '[role="listbox"]' },
                  ]
                : component === 'dialog'
                  ? [
                      { type: 'click', selector: '[data-visual-trigger]' },
                      { type: 'wait', selector: '[role="dialog"]' },
                    ]
                  : component === 'tooltip'
                    ? [
                        { type: 'hover', selector: '[data-visual-trigger]' },
                        {
                          type: 'wait',
                          selector:
                            layer === 'base' ? '.base-tooltip' : '[data-slot="tooltip-content"]',
                        },
                      ]
                    : [],
    })),
  ),
);

// These are direct Base UI checks. Documentation examples exercise the Shadcn
// wrappers; they do not count as direct checks of the underlying Base modules.
const extraBaseStates = {
  accordion: ['closed', 'open'],
  'alert-dialog': ['closed', 'open'],
  autocomplete: ['closed', 'filtered'],
  avatar: ['fallback'],
  'checkbox-group': ['default'],
  collapsible: ['closed', 'open'],
  'context-menu': ['closed', 'open'],
  'direction-provider': ['rtl'],
  drawer: ['closed', 'open'],
  field: ['default'],
  fieldset: ['default'],
  form: ['default'],
  menubar: ['closed', 'open'],
  meter: ['default'],
  'navigation-menu': ['closed', 'open'],
  'number-field': ['default'],
  'otp-field': ['default'],
  popover: ['closed', 'open'],
  'preview-card': ['closed', 'open'],
  radio: ['default'],
  'radio-group': ['default'],
  'scroll-area': ['default'],
  slider: ['default'],
  toast: ['open'],
  toggle: ['off', 'on'],
  'toggle-group': ['default'],
  toolbar: ['default'],
};
const popupRoles = {
  'alert-dialog': 'alertdialog',
  autocomplete: 'listbox',
  'context-menu': 'menu',
  drawer: 'dialog',
  menubar: 'menu',
  'navigation-menu': '.base-popup[data-open]',
  popover: 'dialog',
  'preview-card': '.base-popup[data-open]',
};
const clickOpen = new Set(['alert-dialog', 'drawer', 'menubar', 'navigation-menu', 'popover']);
for (const [component, variants] of Object.entries(extraBaseStates)) {
  for (const state of variants) {
    const role = popupRoles[component];
    const open = state === 'open' || state === 'filtered';
    const selector = role ? (role.startsWith('.') ? role : `[role="${role}"]`) : undefined;
    const action = component === 'context-menu'
      ? { type: 'right-click', selector: '[data-visual-trigger]' }
      : component === 'preview-card'
        ? { type: 'hover', selector: '[data-visual-trigger]' }
        : component === 'autocomplete'
          ? { type: 'fill', selector: '[role="combobox"]', value: 'Ap' }
          : { type: 'click', selector: '[data-visual-trigger]' };
    cases.push({
      id: `base-${component}-${state}`,
      layer: 'base',
      component,
      state,
      width: 600,
      height: 260,
      popups: open && selector ? [selector] : [],
      actions: open && (clickOpen.has(component) || component === 'context-menu' || component === 'preview-card' || component === 'autocomplete')
        ? [action, ...(selector ? [{ type: 'wait', selector }] : [])]
        : [],
    });
  }
}
cases.push({
  id: 'shadcn-direction-rtl',
  layer: 'shadcn',
  component: 'direction',
  state: 'rtl',
  width: 600,
  height: 260,
  popups: [],
  actions: [],
});
cases.push(
  {
    id: 'shadcn-form-default',
    layer: 'shadcn',
    component: 'form',
    state: 'default',
    width: 600,
    height: 260,
    popups: [],
    actions: [],
  },
  {
    id: 'shadcn-form-invalid',
    layer: 'shadcn',
    component: 'form',
    state: 'invalid',
    width: 600,
    height: 260,
    popups: [],
    actions: [
      { type: 'fill', selector: '[data-visual-form-input]', value: '' },
      { type: 'click', selector: '[data-visual-form-submit]' },
      { type: 'wait', selector: '[data-slot="form-message"]' },
    ],
  },
  {
    id: 'shadcn-sonner-open',
    layer: 'shadcn',
    component: 'sonner',
    state: 'open',
    width: 600,
    height: 260,
    popups: ['[data-sonner-toast],[data-slot="toast"]'],
    actions: [
      { type: 'click', selector: '[data-visual-trigger]' },
      { type: 'wait', selector: '[data-sonner-toast],[data-slot="toast"]' },
    ],
  },
);

const baseExtraTree = {
  accordion: (state) => n('Accordion.Root', { defaultValue: state === 'open' ? ['item'] : [] },
    n('Accordion.Item', { value: 'item', ...{ className: 'fixture-width' } },
      n('Accordion.Header', {}, n('Accordion.Trigger', { className: 'base-button' }, 'Account settings')),
      n('Accordion.Panel', {}, 'Change your account settings.'))),
  'alert-dialog': () => n('AlertDialog.Root', {},
    n('AlertDialog.Trigger', { className: 'base-button', 'data-visual-trigger': '' }, 'Delete item'),
    n('AlertDialog.Portal', {}, n('AlertDialog.Backdrop', { className: 'base-backdrop' }),
      n('AlertDialog.Popup', { className: 'base-dialog' },
        n('AlertDialog.Title', {}, 'Delete item?'),
        n('AlertDialog.Description', {}, 'This action cannot be undone.'),
        n('AlertDialog.Close', { className: 'base-button' }, 'Cancel')))),
  autocomplete: () => n('Autocomplete.Root', { items: ['Apple', 'Apricot', 'Banana'] },
    n('Autocomplete.Input', { className: 'base-input', 'aria-label': 'Fruit', placeholder: 'Search fruit' }),
    n('Autocomplete.Portal', {}, n('Autocomplete.Positioner', { sideOffset: 4 },
      n('Autocomplete.Popup', { className: 'base-popup' },
        n('Autocomplete.List', {}, (value) => n('Autocomplete.Item', { value, className: 'base-item' }, value)))))),
  avatar: () => n('Avatar.Root', { className: 'base-avatar' }, n('Avatar.Fallback', {}, 'AB')),
  'checkbox-group': () => n('CheckboxGroup', { defaultValue: ['apple'], className: 'fixture-row', 'aria-label': 'Fruit' },
    n('Checkbox.Root', { value: 'apple', className: 'base-checkbox', 'aria-label': 'Apple' }, n('Checkbox.Indicator', {}, '✓')),
    n('span', {}, 'Apple')),
  collapsible: (state) => n('Collapsible.Root', { defaultOpen: state === 'open', className: 'fixture-width' },
    n('Collapsible.Trigger', { className: 'base-button' }, 'Details'),
    n('Collapsible.Panel', {}, 'Additional details are here.')),
  'context-menu': () => n('ContextMenu.Root', {},
    n('ContextMenu.Trigger', { className: 'base-button', 'data-visual-trigger': '' }, 'Right click here'),
    n('ContextMenu.Portal', {}, n('ContextMenu.Positioner', {},
      n('ContextMenu.Popup', { className: 'base-popup' },
        n('ContextMenu.Item', { className: 'base-item' }, 'Copy'),
        n('ContextMenu.Item', { className: 'base-item' }, 'Paste'))))),
  'direction-provider': () => n('DirectionProvider', { direction: 'rtl' },
    n('Tabs.Root', { defaultValue: 'one', className: 'base-tabs' },
      n('Tabs.List', { className: 'base-tabs-list' },
        n('Tabs.Tab', { value: 'one', className: 'base-tab' }, 'First'),
        n('Tabs.Tab', { value: 'two', className: 'base-tab' }, 'Second')))),
  drawer: () => n('Drawer.Root', {},
    n('Drawer.Trigger', { className: 'base-button', 'data-visual-trigger': '' }, 'Open drawer'),
    n('Drawer.Portal', {}, n('Drawer.Backdrop', { className: 'base-backdrop' }),
      n('Drawer.Viewport', {}, n('Drawer.Popup', { className: 'base-drawer' },
        n('Drawer.Title', {}, 'Drawer details'), n('Drawer.Description', {}, 'Example drawer content.'),
        n('Drawer.Close', { className: 'base-button' }, 'Close'))))),
  field: () => n('Field.Root', { className: 'fixture-width' },
    n('Field.Label', {}, 'Email address'),
    n('Field.Control', { className: 'base-input', placeholder: 'name@example.com' }),
    n('Field.Description', {}, 'We will not share your email.')),
  fieldset: () => n('Fieldset.Root', { className: 'fixture-width' },
    n('Fieldset.Legend', {}, 'Contact details'),
    n('Input', { className: 'base-input', 'aria-label': 'Name', defaultValue: 'Ada' })),
  form: () => n('Form', { className: 'fixture-width' },
    n('Field.Root', {}, n('Field.Label', {}, 'Name'),
      n('Field.Control', { className: 'base-input', defaultValue: 'Ada' })),
    n('Button', { className: 'base-button', type: 'submit' }, 'Save')),
  menubar: () => n('Menubar', {}, n('Menu.Root', {},
    n('Menu.Trigger', { className: 'base-button', 'data-visual-trigger': '' }, 'File'),
    n('Menu.Portal', {}, n('Menu.Positioner', {},
      n('Menu.Popup', { className: 'base-popup' }, n('Menu.Item', { className: 'base-item' }, 'New')))))),
  meter: () => n('Meter.Root', { value: 65, className: 'fixture-width' },
    n('Meter.Label', {}, 'Storage'), n('Meter.Value', {}),
    n('Meter.Track', { className: 'base-progress-track' }, n('Meter.Indicator', { className: 'base-progress-indicator' }))),
  'navigation-menu': () => n('NavigationMenu.Root', {},
    n('NavigationMenu.List', {}, n('NavigationMenu.Item', {},
      n('NavigationMenu.Trigger', { className: 'base-button', 'data-visual-trigger': '' }, 'Products'),
      n('NavigationMenu.Content', {}, n('NavigationMenu.Link', { href: '#' }, 'Overview')))),
    n('NavigationMenu.Portal', {}, n('NavigationMenu.Positioner', {},
      n('NavigationMenu.Popup', { className: 'base-popup' }, n('NavigationMenu.Viewport', {}))))),
  'number-field': () => n('NumberField.Root', { defaultValue: 5, className: 'fixture-width' },
    n('NumberField.Group', { className: 'fixture-row' },
      n('NumberField.Decrement', { className: 'base-button' }, '−'),
      n('NumberField.Input', { className: 'base-input', 'aria-label': 'Quantity' }),
      n('NumberField.Increment', { className: 'base-button' }, '+'))),
  'otp-field': () => n('OTPField.Root', { defaultValue: '1234', length: 4 },
    n('OTPField.Input', { className: 'base-input', 'aria-label': 'One-time code' })),
  popover: () => n('Popover.Root', {},
    n('Popover.Trigger', { className: 'base-button', 'data-visual-trigger': '' }, 'Options'),
    n('Popover.Portal', {}, n('Popover.Positioner', { sideOffset: 4 },
      n('Popover.Popup', { className: 'base-popup' },
        n('Popover.Title', {}, 'Options'), n('Popover.Description', {}, 'Choose a setting.'),
        n('Popover.Close', { className: 'base-button' }, 'Close'))))),
  'preview-card': () => n('PreviewCard.Root', { openDelay: 0 },
    n('PreviewCard.Trigger', { className: 'base-button', 'data-visual-trigger': '', delay: 0 }, 'Preview'),
    n('PreviewCard.Portal', {}, n('PreviewCard.Positioner', { sideOffset: 4 },
      n('PreviewCard.Popup', { className: 'base-popup' }, 'Preview content')))),
  radio: () => n('RadioGroup', { defaultValue: 'apple', 'aria-label': 'Fruit', className: 'fixture-row' },
    n('Radio.Root', { value: 'apple', className: 'base-radio' }, n('Radio.Indicator', {}, '●')),
    n('span', {}, 'Apple')),
  'radio-group': () => n('RadioGroup', { defaultValue: 'apple', 'aria-label': 'Fruit', className: 'fixture-row' },
    n('Radio.Root', { value: 'apple', className: 'base-radio' }, n('Radio.Indicator', {}, '●')),
    n('Radio.Root', { value: 'banana', className: 'base-radio' }, n('Radio.Indicator', {}, '●'))),
  'scroll-area': () => n('ScrollArea.Root', { className: 'base-scroll-area' },
    n('ScrollArea.Viewport', {}, n('ScrollArea.Content', {},
      n('div', { className: 'base-scroll-content' }, 'A long scrolling area with more content.'))),
    n('ScrollArea.Scrollbar', {}, n('ScrollArea.Thumb', {}))),
  slider: () => n('Slider.Root', { defaultValue: [35], className: 'fixture-width' },
    n('Slider.Label', {}, 'Volume'),
    n('Slider.Control', { className: 'base-slider-control' },
      n('Slider.Track', { className: 'base-progress-track' },
        n('Slider.Indicator', { className: 'base-progress-indicator' }),
        n('Slider.Thumb', { className: 'base-slider-thumb' })))),
  toast: () => n('Toast.Provider', {}, n('Toast.Viewport', { className: 'base-toast-viewport' },
    n('Toast.Root', { toast: { id: 'visual-toast', title: 'Saved', description: 'Your changes were saved.' }, className: 'base-popup' },
      n('Toast.Title', {}, 'Saved'), n('Toast.Description', {}, 'Your changes were saved.')))),
  toggle: (state) => n('Toggle', { defaultPressed: state === 'on', className: 'base-button' }, 'Bold'),
  'toggle-group': () => n('ToggleGroup', { defaultValue: ['bold'], className: 'fixture-row' },
    n('Toggle', { value: 'bold', className: 'base-button' }, 'Bold'),
    n('Toggle', { value: 'italic', className: 'base-button' }, 'Italic')),
  toolbar: () => n('Toolbar.Root', { className: 'fixture-row' },
    n('Toolbar.Button', { className: 'base-button' }, 'Save'),
    n('Toolbar.Separator', {}),
    n('Toolbar.Input', { className: 'base-input', 'aria-label': 'Search', placeholder: 'Search' })),
};

export function fixtureTree(fixture) {
  const { component, layer, state } = fixture;
  if (layer === 'base' && component in baseExtraTree) return baseExtraTree[component](state);
  if (layer === 'shadcn' && component === 'direction')
    return n('DirectionProvider', { direction: 'rtl' },
      n('Tabs', { defaultValue: 'one', className: 'fixture-width' },
        n('TabsList', {}, n('TabsTrigger', { value: 'one' }, 'First'), n('TabsTrigger', { value: 'two' }, 'Second')),
        n('TabsContent', { value: 'one' }, 'Right-to-left layout.')));
  if (layer === 'shadcn' && component === 'form') return n('FormScenario');
  if (layer === 'shadcn' && component === 'sonner') return n('SonnerScenario');
  const base = layer === 'base';
  const cls = (name) => (base ? { className: `base-${name}` } : {});
  const trigger = { ...cls('button'), 'data-visual-trigger': '', 'aria-label': 'Open options' };
  const names = ['Apple', 'Apricot', 'Banana'];
  switch (component) {
    case 'switch':
      return n(
        'div',
        { className: 'fixture-row' },
        base
          ? n(
              'Switch.Root',
              {
                ...cls('switch'),
                defaultChecked: state === 'on',
                disabled: state === 'disabled',
                'aria-label': 'Notifications',
              },
              n('Switch.Thumb', cls('switch-thumb')),
            )
          : n('Switch', {
              defaultChecked: state === 'on',
              disabled: state === 'disabled',
              'aria-label': 'Notifications',
            }),
        n('span', {}, 'Notifications'),
      );
    case 'button':
      return n('Button', { ...cls('button'), disabled: state === 'disabled' }, 'Save changes');
    case 'checkbox':
      return n(
        'div',
        { className: 'fixture-row' },
        base
          ? n(
              'Checkbox.Root',
              { ...cls('checkbox'), defaultChecked: state === 'on', 'aria-label': 'Accept terms' },
              n(
                'Checkbox.Indicator',
                cls('checkbox-indicator'),
                n(
                  'svg',
                  {
                    width: 14,
                    height: 14,
                    viewBox: '0 0 24 24',
                    fill: 'none',
                    stroke: 'currentColor',
                    strokeWidth: 2,
                    strokeLinecap: 'round',
                    strokeLinejoin: 'round',
                  },
                  n('path', { d: 'm20 6-11 11-5-5' }),
                ),
              ),
            )
          : n('Checkbox', { defaultChecked: state === 'on', 'aria-label': 'Accept terms' }),
        n('span', {}, 'Accept terms'),
      );
    case 'input':
      return n(
        'div',
        { className: 'fixture-width' },
        n('Input', { ...cls('input'), defaultValue: 'hello@example.com', 'aria-label': 'Email' }),
      );
    case 'tabs':
      return base
        ? n(
            'Tabs.Root',
            { defaultValue: 'account', ...cls('tabs') },
            n(
              'Tabs.List',
              cls('tabs-list'),
              n('Tabs.Tab', { value: 'account', ...cls('tab') }, 'Account'),
              n('Tabs.Tab', { value: 'password', ...cls('tab') }, 'Password'),
            ),
            n('Tabs.Panel', { value: 'account', ...cls('panel') }, 'Manage your account.'),
            n('Tabs.Panel', { value: 'password', ...cls('panel') }, 'Change your password.'),
          )
        : n(
            'Tabs',
            { defaultValue: 'account', className: 'fixture-width' },
            n(
              'TabsList',
              {},
              n('TabsTrigger', { value: 'account' }, 'Account'),
              n('TabsTrigger', { value: 'password' }, 'Password'),
            ),
            n('TabsContent', { value: 'account' }, 'Manage your account.'),
            n('TabsContent', { value: 'password' }, 'Change your password.'),
          );
    case 'progress':
      return base
        ? n(
            'Progress.Root',
            { value: 42, ...cls('progress'), 'aria-label': 'Upload' },
            n(
              'Progress.Track',
              cls('progress-track'),
              n('Progress.Indicator', cls('progress-indicator')),
            ),
          )
        : n('Progress', { value: 42, className: 'fixture-width', 'aria-label': 'Upload' });
    case 'separator':
      return n(
        'div',
        { className: 'fixture-width' },
        n('p', {}, 'Account'),
        n('Separator', cls('separator')),
        n('p', {}, 'Preferences'),
      );
    case 'menu':
      return base
        ? n(
            'Menu.Root',
            {},
            n('Menu.Trigger', trigger, 'Options'),
            n(
              'Menu.Portal',
              {},
              n(
                'Menu.Positioner',
                { sideOffset: 4, align: 'start' },
                n(
                  'Menu.Popup',
                  cls('popup'),
                  ...['Profile', 'Settings', 'Sign out'].map((label) =>
                    n('Menu.Item', cls('item'), label),
                  ),
                ),
              ),
            ),
          )
        : n(
            'DropdownMenu',
            {},
            n('DropdownMenuTrigger', { ...trigger, className: 'visual-trigger' }, 'Options'),
            n(
              'DropdownMenuContent',
              {},
              ...['Profile', 'Settings', 'Sign out'].map((label) =>
                n('DropdownMenuItem', {}, label),
              ),
            ),
          );
    case 'select':
      return base
        ? n(
            'Select.Root',
            { defaultValue: 'Apple', items: names.map((value) => ({ value, label: value })) },
            n('Select.Trigger', trigger, n('Select.Value', {})),
            n(
              'Select.Portal',
              {},
              n(
                'Select.Positioner',
                { sideOffset: 4, align: 'start', alignItemWithTrigger: false },
                n(
                  'Select.Popup',
                  cls('popup'),
                  n(
                    'Select.List',
                    {},
                    ...names.map((value) =>
                      n('Select.Item', { value, ...cls('item') }, n('Select.ItemText', {}, value)),
                    ),
                  ),
                ),
              ),
            ),
          )
        : n(
            'Select',
            { defaultValue: 'Apple', items: names.map((value) => ({ value, label: value })) },
            n('SelectTrigger', { ...trigger }, n('SelectValue', {})),
            n(
              'SelectContent',
              { alignItemWithTrigger: false },
              ...names.map((value) => n('SelectItem', { value }, value)),
            ),
          );
    case 'combobox':
      return base
        ? n(
            'Combobox.Root',
            { items: names },
            n('Combobox.Input', {
              ...cls('input'),
              'aria-label': 'Fruit',
              placeholder: 'Choose fruit',
            }),
            n(
              'Combobox.Portal',
              {},
              n(
                'Combobox.Positioner',
                { sideOffset: 4, align: 'start' },
                n(
                  'Combobox.Popup',
                  cls('popup'),
                  n('Combobox.List', {}, (value) =>
                    n('Combobox.Item', { value, ...cls('item') }, value),
                  ),
                ),
              ),
            ),
          )
        : n(
            'Combobox',
            { items: names },
            n('ComboboxInput', { 'aria-label': 'Fruit', placeholder: 'Choose fruit' }),
            n(
              'ComboboxContent',
              {},
              n('ComboboxList', {}, (value) => n('ComboboxItem', { value }, value)),
            ),
          );
    case 'dialog':
      return base
        ? n(
            'Dialog.Root',
            {},
            n('Dialog.Trigger', trigger, 'Edit profile'),
            n(
              'Dialog.Portal',
              {},
              n('Dialog.Backdrop', cls('backdrop')),
              n(
                'Dialog.Popup',
                cls('dialog'),
                n('Dialog.Title', {}, 'Edit profile'),
                n('Dialog.Description', {}, 'Update your profile details.'),
                n('Dialog.Close', cls('button'), 'Close'),
              ),
            ),
          )
        : n(
            'Dialog',
            {},
            n('DialogTrigger', { ...trigger, className: 'visual-trigger' }, 'Edit profile'),
            n(
              'DialogContent',
              {},
              n(
                'DialogHeader',
                {},
                n('DialogTitle', {}, 'Edit profile'),
                n('DialogDescription', {}, 'Update your profile details.'),
              ),
              n('DialogClose', { className: 'visual-trigger' }, 'Close'),
            ),
          );
    case 'tooltip':
      return base
        ? n(
            'Tooltip.Provider',
            { delay: 0 },
            n(
              'Tooltip.Root',
              {},
              n('Tooltip.Trigger', trigger, 'Details'),
              n(
                'Tooltip.Portal',
                {},
                n(
                  'Tooltip.Positioner',
                  { side: 'top', sideOffset: 4 },
                  n('Tooltip.Popup', cls('tooltip'), 'More information'),
                ),
              ),
            ),
          )
        : n(
            'TooltipProvider',
            { delay: 0 },
            n(
              'Tooltip',
              {},
              n('TooltipTrigger', { ...trigger, className: 'visual-trigger' }, 'Details'),
              n('TooltipContent', {}, 'More information'),
            ),
          );
    default:
      throw new Error(`Unknown visual fixture: ${fixture.id}`);
  }
}
