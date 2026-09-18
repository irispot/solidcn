import { Calendar } from '@solid-cn/ui/calendar';
// This original helper imports only the DayPicker enum map, not React.
export { getDefaultClassNames } from '../../apps/reference/node_modules/react-day-picker/dist/esm/helpers/getDefaultClassNames.js';
export function DayPicker(props) {
  return <Calendar {...props} unstyled />;
}
