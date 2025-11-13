const isValidDate = (date) => date instanceof Date && !Number.isNaN(date.getTime());

export const parseISODateString = (value) => {
  if (!value) return null;

  const [yearStr, monthStr, dayStr] = value.split('-') || [];
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  return isValidDate(date) ? date : null;
};

export const formatDateToISO = (date) => {
  if (!isValidDate(date)) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const parseTimeStringToDate = (value) => {
  if (!value) return null;

  const [hourStr, minuteStr] = value.split(':') || [];
  const hours = Number(hourStr);
  const minutes = Number(minuteStr);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  const time = new Date();
  time.setHours(hours, minutes, 0, 0);
  return time;
};

export const formatDateToTimeString = (date) => {
  if (!isValidDate(date)) return '';

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
};

export const today = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};


