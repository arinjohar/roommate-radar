import { nextDueDate, parseSchedule } from '../../services/choreSchedule';
import type { Chore } from '../../types/domain';

export type CalendarOccurrence = {
  id: string;
  chore: Chore;
  dueAt: string;
  isProjected: boolean;
};

/**
 * Creates a read-only look ahead for the calendar. The chore service remains
 * the source of truth: this does not create occurrences or change a series.
 */
export function calendarOccurrences(
  chores: Chore[],
  from: Date,
  to: Date,
): CalendarOccurrence[] {
  const active = chores.filter((chore) => !chore.archivedAt && chore.dueAt);
  const occurrences = active
    .filter((chore) => isInRange(chore.dueAt, from, to))
    .map((chore) => ({ id: chore.id, chore, dueAt: chore.dueAt, isProjected: false }));
  const existingDates = new Set(active.map((chore) => `${chore.seriesId ?? chore.id}:${chore.dueAt}`));
  const bySeries = new Map<string, Chore[]>();

  for (const chore of chores.filter((item) => item.dueAt)) {
    const seriesId = chore.seriesId ?? chore.id;
    bySeries.set(seriesId, [...(bySeries.get(seriesId) ?? []), chore]);
  }

  for (const [seriesId, series] of bySeries) {
    const latest = [...series].sort((left, right) => left.dueAt.localeCompare(right.dueAt)).at(-1);
    if (!latest || latest.archivedAt) continue;
    const schedule = parseSchedule(latest.recurrence);
    if (!schedule.repeatEvery || !schedule.repeatUnit) continue;

    let dueAt = latest.scheduledAt ?? latest.dueAt;
    do {
      dueAt = nextDueDate(dueAt, schedule.repeatEvery, schedule.repeatUnit);
      if (new Date(dueAt) >= to) break;
      if (new Date(dueAt) >= from && !existingDates.has(`${seriesId}:${dueAt}`)) {
        occurrences.push({
          id: `preview-${seriesId}-${dueAt}`,
          chore: latest,
          dueAt,
          isProjected: true,
        });
      }
    } while (new Date(dueAt) < to);
  }

  return occurrences.sort((left, right) => left.dueAt.localeCompare(right.dueAt));
}

export function dateKey(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

function isInRange(value: string, from: Date, to: Date) {
  const date = new Date(value);
  return date >= from && date < to;
}
