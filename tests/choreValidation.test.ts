import assert from 'node:assert/strict';
import test from 'node:test';

import {
  choreErrorMessage,
  DUE_DATE_ERROR_MESSAGE,
  dueDateToIso,
} from '../src/features/chores/choreValidation';

const now = new Date(2026, 8, 6, 12);

test('due dates may be empty, today, or in the future', () => {
  assert.equal(dueDateToIso('', now), '');
  assert.equal(dueDateToIso('2026-09-06', now), '2026-09-06T18:00:00.000Z');
  assert.equal(dueDateToIso('2026-09-07', now), '2026-09-07T18:00:00.000Z');
});

test('past and malformed due dates use the concise validation message', () => {
  for (const value of ['2026-09-05', '2026-02-30', 'not-a-date']) {
    assert.throws(() => dueDateToIso(value, now), { message: DUE_DATE_ERROR_MESSAGE });
  }
});

test('Supabase due-date errors are unwrapped for display', () => {
  const error = new Error('Supabase request failed (400): {"code":"P0001","message":"Choose today or a future due date"}');
  assert.equal(choreErrorMessage(error, 'Could not add that chore.'), DUE_DATE_ERROR_MESSAGE);
});
