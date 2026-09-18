export const navigationSsrTestFile = 'base-ui/packages/react/src/navigation-menu/content/NavigationMenuContent.test.tsx';
export const navigationSsrTestName = 'server-side rendering';
export const navigationSsrAssertions = [
  'keeps the content mounted (hidden) in the DOM when keepMounted is true',
  'does not keep the content mounted in the DOM when keepMounted is false',
];
