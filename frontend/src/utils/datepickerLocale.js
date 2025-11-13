import { registerLocale, setDefaultLocale } from 'react-datepicker';
import vi from 'date-fns/locale/vi';

registerLocale('vi', vi);
setDefaultLocale('vi');

export const DATE_PICKER_LOCALE = 'vi';

