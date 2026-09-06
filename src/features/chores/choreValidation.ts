export const DUE_DATE_ERROR_MESSAGE = 'Choose today or a future due date';

export function dueDateToIso(value: string, now = new Date()) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) throw new Error(DUE_DATE_ERROR_MESSAGE);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const selected = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isCalendarDate = selected.getFullYear() === year
    && selected.getMonth() === month - 1
    && selected.getDate() === day;

  if (!isCalendarDate || selected < today) throw new Error(DUE_DATE_ERROR_MESSAGE);
  return `${trimmed}T18:00:00.000Z`;
}

export function choreErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : '';
  return message.includes(DUE_DATE_ERROR_MESSAGE) ? DUE_DATE_ERROR_MESSAGE : message || fallback;
}
