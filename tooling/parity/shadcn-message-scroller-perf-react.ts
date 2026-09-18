export * from './fixture-runtime';

// Keep the unchanged performance fixture's React.memo contract. Its prior
// transcript is stable while only the final streaming reply grows.
export function memo<Props extends Record<string, unknown>, Result>(
  component: (props: Props) => Result,
): (props: Props) => Result {
  let previous: Props | undefined;
  let output: Result;
  return (props) => {
    const keys = Object.keys(props);
    if (
      previous &&
      keys.length === Object.keys(previous).length &&
      keys.every((key) => Object.is(props[key], previous![key]))
    ) return output;
    previous = { ...props };
    output = component(props);
    return output;
  };
}
