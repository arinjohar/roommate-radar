import type { RepeatUnit } from '../types/domain';
export type { RepeatUnit } from '../types/domain';
export type ChoreScope = 'occurrence' | 'future';

/** Translate older saved schedules at the service boundary. */
export function parseSchedule(recurrence: string): { repeatEvery: number | null; repeatUnit: RepeatUnit | null } {
  const legacy: Record<string, string> = { once: 'one time', daily: 'every 1 day', weekly: 'every 1 week', biweekly: 'every 2 weeks', monthly: 'every 1 month' };
  const value = legacy[recurrence] ?? recurrence;
  if (value === 'one time') return { repeatEvery: null, repeatUnit: null };
  const match = /^every (\d+) (day|week|month)s?$/.exec(value);
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 365) throw new Error('Choose a repeat interval between 1 and 365.');
  return { repeatEvery: Number(match[1]), repeatUnit: `${match[2]}s` as RepeatUnit };
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
