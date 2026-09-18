import * as React from 'react';
import { expect, it } from 'vitest';
import { screen } from '@testing-library/dom';
import { NavigationMenu } from '@base-ui/react/navigation-menu';
import { createRenderer } from '#test-utils';

// Supplemental check for a gap in the unchanged upstream SSR assertion: its
// title says "hidden", but it checks only that one Content node exists.
const { renderToString } = createRenderer();
it('server-side rendering keeps closed NavigationMenu.Content hidden', () => {
  const element = React.createElement;
  renderToString(
    element(
      NavigationMenu.Root,
      null,
      element(
        NavigationMenu.List,
        null,
        element(
          NavigationMenu.Item,
          null,
          element(NavigationMenu.Trigger, null, 'Item 1'),
          element(
            NavigationMenu.Content,
            { keepMounted: true, 'data-testid': 'closed-content' },
            element(NavigationMenu.Link, { href: '#link-1' }, 'Link 1'),
          ),
        ),
      ),
      element(
        NavigationMenu.Portal,
        null,
        element(
          NavigationMenu.Positioner,
          null,
          element(NavigationMenu.Popup, null, element(NavigationMenu.Viewport)),
        ),
      ),
    ),
  );
  const contents = screen.queryAllByTestId('closed-content');
  expect(contents).toHaveLength(1);
  expect(contents[0]).toHaveAttribute('hidden');
});
