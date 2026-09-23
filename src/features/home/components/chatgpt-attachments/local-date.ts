const MONTH_ABBREVIATIONS_PT_BR = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const;

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatLocalDateAttachment(dateKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return dateKey;

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const daysInMonth = new Date(year, month, 0).getDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth) return dateKey;

  return `${day} ${MONTH_ABBREVIATIONS_PT_BR[month - 1]} ${year}`;
}

export function formatLocalDateAttachmentCompact(dateKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return dateKey;

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const daysInMonth = new Date(year, month, 0).getDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth) return dateKey;

  return `${dayValue}/${monthValue}`;
}
