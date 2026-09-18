import { Calendar } from '@solid-cn/ui/calendar';
import * as dateFnsJalali from 'date-fns-jalali';
import { faIR, enUS } from 'date-fns-jalali/locale';
export { faIR, enUS };
export function DayPicker(props) {
  return <Calendar {...props} unstyled dateLib={dateFnsJalali} numerals={props.numerals ?? 'arabext'} locale={props.locale ?? faIR} dir={props.dir ?? 'rtl'} />;
}
