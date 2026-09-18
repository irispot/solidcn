import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const dir = resolve(root, 'base-ui/packages/solid/src');
const groups = {
  structure: {
    accordion: 'Accordion',
    avatar: 'Avatar',
    collapsible: 'Collapsible',
    menubar: 'Menubar',
    'scroll-area': 'ScrollArea',
    separator: 'Separator',
    tabs: 'Tabs',
    toolbar: 'Toolbar',
  },
  overlays: {
    'alert-dialog': 'AlertDialog',
    'context-menu': 'ContextMenu',
    dialog: 'Dialog',
    drawer: 'Drawer',
    menu: 'Menu',
    'navigation-menu': 'NavigationMenu',
    popover: 'Popover',
    'preview-card': 'PreviewCard',
    tooltip: 'Tooltip',
  },
  notifications: { toast: 'Toast, createToastManager, useToastManager' },
  core: {
    'csp-provider': 'CSPProvider',
    'direction-provider': 'DirectionProvider, useDirection',
    'use-render': 'useRender',
    'unstable-use-media-query': 'useMediaQuery',
  },
};
for (const [file, entries] of Object.entries(groups)) {
  for (const [name, exports] of Object.entries(entries)) {
    await mkdir(resolve(dir, name), { recursive: true });
    const types =
      name === 'use-render'
        ? `export type { StateAttributesMapping, UseRenderRenderProp, UseRenderElementProps, UseRenderComponentProps, UseRenderParameters, UseRenderReturnValue, UseRenderState } from '../core';\n`
        : '';
    await writeFile(
      resolve(dir, name, 'index.ts'),
      `export { ${exports} } from '../${file}';\n${types}`,
    );
  }
}
await mkdir(resolve(dir, 'types'), { recursive: true });
await writeFile(
  resolve(dir, 'types/index.ts'),
  `export type { BaseProps as BaseUIComponentProps, ChangeEventDetails as BaseUIChangeEventDetails, Ref } from '../core';\nexport type Orientation = 'horizontal' | 'vertical';\n`,
);
await writeFile(
  resolve(dir, 'index.ts'),
  `export * from './controls';\nexport * from './structure';\nexport * from './overlays';\nexport * from './selection';\nexport * from './notifications';\nexport { CSPProvider, DirectionProvider, useDirection, useRender, useMediaQuery } from './core';\nexport { mergeProps, mergePropsN } from './merge-props/mergeProps';\nexport type { BaseProps, ChangeEventDetails, Ref } from './core';\n`,
);
await copyFile(resolve(root, 'base-ui/LICENSE'), resolve(dir, '../LICENSE'));
console.log('Generated Solid Base UI entry points. No test files were read or written.');
