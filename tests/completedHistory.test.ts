import assert from 'node:assert/strict';
import test from 'node:test';

import { filterRecentCompletions } from '../src/features/chores/completedHistory';
import type { Completion } from '../src/types/domain';

const completions: Completion[] = [
  { id: 'recent', choreId: 'one', memberId: 'member', pointsAwarded: 2, completedAt: '2026-09-14T12:00:00.000Z' },
  { id: 'old', choreId: 'two', memberId: 'member', pointsAwarded: 3, completedAt: '2026-09-12T11:59:59.000Z' },
];

test('changing completed history retention excludes chores outside the selected window', () => {
  const now = Date.parse('2026-09-20T12:00:00.000Z');
  assert.deepEqual(filterRecentCompletions(completions, 7, now).map((item) => item.id), ['recent']);
  assert.deepEqual(filterRecentCompletions(completions, 14, now).map((item) => item.id), ['recent', 'old']);
});
