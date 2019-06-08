export function timeSince(date: Date|string): string {
  let dateTemp = new Date();
  if (typeof date === 'string') {
    dateTemp = new Date(date);
  }
  const newDate = new Date();
  const diff = +newDate - +dateTemp;
  const seconds = Math.floor((diff) / 1000);
  let interval = Math.floor(seconds / 31536000);

  if (Math.abs(interval) > 1) {
    return Math.abs(interval) + ' years ' + (interval < 0 ? 'from now' : 'ago');
  }
  interval = Math.floor(seconds / 2592000);
  if (Math.abs(interval) > 1) {
    return Math.abs(interval) + ' months ' + (interval < 0 ? 'from now' : 'ago');
  }
  interval = Math.floor(seconds / 86400);
  if (Math.abs(interval) > 1) {
    return Math.abs(interval) + ' days ' + (interval < 0 ? 'from now' : 'ago');
  }
  interval = Math.floor(seconds / 3600);
  if (Math.abs(interval) > 1) {
    return Math.abs(interval) + ' hours ' + (interval < 0 ? 'from now' : 'ago');
  }
  interval = Math.floor(seconds / 60);
  if (Math.abs(interval) > 1) {
    return Math.abs(interval) + ' minutes ' + (interval < 0 ? 'from now' : 'ago');
  }
  return Math.floor(seconds) + ' seconds ' + (interval < 0 ? 'from now' : 'ago');
}

export function formatDate(date: Date|string): string {
  let dateTemp = new Date();
  if (typeof date === 'string') {
    dateTemp = new Date(date);
  }
  const year = dateTemp.getUTCFullYear();
  const month = dateTemp.getUTCMonth() + 1;
  let monthString = month.toString();
  if (month < 10) {
    monthString = `0${month}`;
  }
  const day = dateTemp.getUTCDate();
  let dayString = day.toString();
  if (day < 10) {
    dayString = `0${day}`;
  }
  const formattedDate = `${year.toString()}-${monthString}-${dayString}`;
  return formattedDate;
}

export function getYear(date: Date|string): number {
  let dateTemp = new Date();
  if (typeof date === 'string') {
    dateTemp = new Date(date);
  }
  const year = dateTemp.getUTCFullYear();
  return year;
}
