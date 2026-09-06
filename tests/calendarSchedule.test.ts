import assert from 'node:assert/strict';
import test from 'node:test';

import { calendarOccurrences, dateKey } from '../src/features/chores/calendarSchedule';
import type { Chore } from '../src/types/domain';

const base: Chore = {
  id: 'weekly-clean', householdId: 'home', title: 'Clean the kitchen', points: 4,
  assigneeIds: ['sam'], dueAt: '2026-09-07T18:00:00.000Z', scheduledAt: '2026-09-07T18:00:00.000Z',
  recurrence: 'weekly', seriesId: 'weekly-clean',
};

test('calendar keeps one-time chores and previews scheduled recurring dates without persisting them', () => {
  const once: Chore = { ...base, id: 'one-time', seriesId: 'one-time', title: 'Collect a package', recurrence: 'once', dueAt: '2026-09-10T18:00:00.000Z', scheduledAt: undefined };
  const occurrences = calendarOccurrences([base, once], new Date('2026-09-01T00:00:00Z'), new Date('2026-10-01T00:00:00Z'));

  assert.deepEqual(occurrences.map((item) => [item.chore.title, dateKey(item.dueAt), item.isProjected]), [
    ['Clean the kitchen', '2026-09-07', false],
    ['Collect a package', '2026-09-10', false],
    ['Clean the kitchen', '2026-09-14', true],
    ['Clean the kitchen', '2026-09-21', true],
    ['Clean the kitchen', '2026-09-28', true],
  ]);
});

test('calendar stops projecting an archived recurring series', () => {
  assert.equal(calendarOccurrences([{ ...base, archivedAt: '2026-09-08T00:00:00.000Z' }], new Date('2026-09-01T00:00:00Z'), new Date('2026-10-01T00:00:00Z')).length, 0);
});
