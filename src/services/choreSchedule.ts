import type { RepeatUnit } from '../types/domain';
export type { RepeatUnit } from '../types/domain';
export type ChoreScope = 'occurrence' | 'future';

/** Translate older saved schedules at the service boundary. */
export function parseSchedule(recurrence: string): { repeatEvery: number | null; repeatUnit: RepeatUnit | null } {
  const legacy: Record<string, string> = { once: 'one time', daily: 'every 1 day', weekly: 'every 1 week', biweekly: 'every 2 weeks', monthly: 'every 1 month' };
  const normalized = recurrence.trim().toLowerCase();
  const weekdayOnly = /^(?:every\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/.exec(normalized);
  const withoutWeekday = normalized.replace(/\s+on\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/, '');
  const value = weekdayOnly ? 'every 1 week' : legacy[withoutWeekday] ?? withoutWeekday;
  if (value === 'one time') return { repeatEvery: null, repeatUnit: null };
  const match = /^every (\d+) (day|week|month)s?$/.exec(value);
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 365) throw new Error('Choose a repeat interval between 1 and 365.');
  return { repeatEvery: Number(match[1]), repeatUnit: `${match[2]}s` as RepeatUnit };
}

const weekdayNumbers: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

function scheduledWeekday(recurrence: string): number | null {
  const match = /(?:every\s+|\s+on\s+)(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/i.exec(recurrence.trim());
  return match ? weekdayNumbers[match[1].toLowerCase()] : null;
}

/**
 * Give a new repeating chore a stable first occurrence when no date was chosen.
 * Dates are anchored at 18:00 UTC, matching the date picker, and weekday-based
 * legacy schedules use their next named weekday.
 */
export function initialRecurringDueDate(recurrence: string, now: Date): string {
  const schedule = parseSchedule(recurrence);
  if (!schedule.repeatEvery || !schedule.repeatUnit) return '';

  const due = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 18));
  const weekday = scheduledWeekday(recurrence);
  if (weekday !== null) {
    const daysUntil = (weekday - due.getUTCDay() + 7) % 7;
    due.setUTCDate(due.getUTCDate() + (daysUntil || (due <= now ? 7 : 0)));
  } else if (due <= now) {
    if (schedule.repeatUnit === 'months') {
      const day = due.getUTCDate();
      due.setUTCDate(1);
      due.setUTCMonth(due.getUTCMonth() + 1);
      const lastDay = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0)).getUTCDate();
      due.setUTCDate(Math.min(day, lastDay));
    } else {
      due.setUTCDate(due.getUTCDate() + (schedule.repeatUnit === 'weeks' ? 7 : 1));
    }
  }
  return due.toISOString();
}

export function scheduleLabel(every: number | null, unit: RepeatUnit | null) {
  return every && unit ? `every ${every} ${every === 1 ? unit.slice(0, -1) : unit}` : 'one time';
}

export function nextDueDate(dueAt: string, every: number, unit: RepeatUnit) {
  const date = new Date(dueAt);
  if (unit === 'months') {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + every);
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
  } else date.setUTCDate(date.getUTCDate() + every * (unit === 'weeks' ? 7 : 1));
  return date.toISOString();
}
