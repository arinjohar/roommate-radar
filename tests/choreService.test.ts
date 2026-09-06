import assert from 'node:assert/strict';
import test from 'node:test';
import { nextDueDate } from '../src/services/choreSchedule';

import type { RoommateRadarServices } from '../src/services/contracts';
import { createDemoData, DEMO_HOUSEHOLD_ID } from '../src/services/demoData';
import { createLocalServices } from '../src/services/local';

const DEMO_HOUSEHOLD_MEMBER_IDS = createDemoData().members.map((member) => member.id);
const DEMO_MEMBER_ID = DEMO_HOUSEHOLD_MEMBER_IDS[2];

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); },
    async removeItem(key: string) { values.delete(key); },
  };
}

async function approveRequest(
  service: RoommateRadarServices['chores'],
  pendingId: string,
) {
  for (const memberId of DEMO_HOUSEHOLD_MEMBER_IDS.filter((id) => id !== DEMO_MEMBER_ID)) {
    await service.voteOnChore({
      householdId: DEMO_HOUSEHOLD_ID,
      pendingId,
      memberId,
      vote: 'approved',
    });
  }
}

test('board policy, pending requests, retention, and saved options persist across service instances', async () => {
  const storage = createMemoryStorage();
  const now = () => new Date('2026-09-05T12:00:00.000Z');
  const firstSession = createLocalServices(storage, { now }).chores;
  const request = await firstSession.requestChore({
    householdId: DEMO_HOUSEHOLD_ID,
    requestedById: DEMO_MEMBER_ID,
    title: 'Pair clean the pantry',
    points: 4,
    assigneeIds: [DEMO_HOUSEHOLD_MEMBER_IDS[0], DEMO_HOUSEHOLD_MEMBER_IDS[1]],
    dueAt: '2026-09-09T18:00:00.000Z',
    dueInDays: 4,
    recurrence: 'one time',
    starterTitle: null,
  });
  assert.equal(request.status, 'pending');
  await firstSession.setCompletedRetentionDays(DEMO_HOUSEHOLD_ID, 30);
  await firstSession.requestTrustLevelChange({ householdId: DEMO_HOUSEHOLD_ID, memberId: DEMO_MEMBER_ID, nextTrustLevel: 'open' });

  const secondSession = createLocalServices(storage, { now }).chores;
  const restored = await secondSession.getBoard(DEMO_HOUSEHOLD_ID);
  assert.equal(restored.completedRetentionDays, 30);
  assert.equal(restored.pendingChores.length, 1);
  assert.equal(restored.pendingTrustChanges.length, 1);
  assert.deepEqual(restored.choreStarters, []);
});

test('the service enforces approval and preserves real assignee IDs and due intervals', async () => {
  const storage = createMemoryStorage();
  let currentTime = new Date('2026-09-05T12:00:00.000Z');
  const service = createLocalServices(storage, { now: () => currentTime }).chores;

  const result = await service.requestChore({
    householdId: DEMO_HOUSEHOLD_ID,
    requestedById: DEMO_MEMBER_ID,
    title: 'Pair clean the pantry',
    points: 4,
    assigneeIds: [DEMO_HOUSEHOLD_MEMBER_IDS[0], DEMO_HOUSEHOLD_MEMBER_IDS[1]],
    dueAt: '2026-09-09T18:00:00.000Z',
    dueInDays: 4,
    recurrence: 'one time',
    starterTitle: null,
  });
  assert.equal(result.status, 'pending');
  if (result.status !== 'pending') return;
  assert.equal((await service.getBoard(DEMO_HOUSEHOLD_ID)).chores.some((chore) => chore.title === result.pending.title), false);

  await approveRequest(service, result.pending.id);
  currentTime = new Date('2026-09-20T12:00:00.000Z');
  const restored = await createLocalServices(storage, { now: () => currentTime }).chores.getBoard(DEMO_HOUSEHOLD_ID);
  const created = restored.chores.find((chore) => chore.title === result.pending.title);
  assert.deepEqual(created?.assigneeIds, [DEMO_HOUSEHOLD_MEMBER_IDS[0], DEMO_HOUSEHOLD_MEMBER_IDS[1]]);
  assert.equal(created?.dueIntervalDays, 4);
  assert.equal(restored.choreStarters.find((starter) => starter.title === result.pending.title)?.dueInDays, 4);
  assert.equal(
    (await createLocalServices(storage).chores.list(DEMO_HOUSEHOLD_ID))
      .some((chore) => chore.id === created?.id),
    true,
  );
});

test('recurring chores wait for completion and materialize only one missed occurrence', async () => {
  const storage = createMemoryStorage();
  let currentTime = new Date('2026-09-05T12:00:00.000Z');
  const service = createLocalServices(storage, { now: () => currentTime }).chores;
  const result = await service.requestChore({
    householdId: DEMO_HOUSEHOLD_ID,
    requestedById: DEMO_MEMBER_ID,
    title: 'Daily reset',
    points: 2,
    assigneeIds: [],
    dueAt: '2026-09-06T18:00:00.000Z',
    dueInDays: 1,
    recurrence: 'every 1 day',
    starterTitle: null,
  });
  assert.equal(result.status, 'pending');
  if (result.status !== 'pending') return;
  await approveRequest(service, result.pending.id);

  currentTime = new Date('2026-10-01T12:00:00.000Z');
  let board = await service.getBoard(DEMO_HOUSEHOLD_ID);
  let series = board.chores.filter((chore) => chore.title === 'Daily reset');
  assert.equal(series.length, 1);

  await service.completeChore({ householdId: DEMO_HOUSEHOLD_ID, choreId: series[0].id, memberId: DEMO_MEMBER_ID });
  assert.equal(
    (await service.listCompletions(
      DEMO_HOUSEHOLD_ID,
      '2026-01-01T00:00:00.000Z',
      '2030-01-01T00:00:00.000Z',
    )).some((completion) => completion.choreId === series[0].id),
    true,
  );
  board = await service.getBoard(DEMO_HOUSEHOLD_ID);
  series = board.chores.filter((chore) => chore.title === 'Daily reset');
  assert.equal(series.length, 2);
  board = await service.getBoard(DEMO_HOUSEHOLD_ID);
  assert.equal(board.chores.filter((chore) => chore.title === 'Daily reset').length, 2);
});

test('a newly created household uses its real roster and can approve its own first chore', async () => {
  const storage = createMemoryStorage();
  const services = createLocalServices(storage, { now: () => new Date('2026-09-05T12:00:00.000Z') });
  const membership = await services.households.create({
    householdName: 'Cedar House',
    displayName: 'Taylor',
    avatarColor: '#9ED9C5',
  });
  const service = services.chores;
  const householdId = membership.household.id;
  const memberId = membership.member.id;

  const initial = await service.getBoard(householdId);
  assert.equal(initial.chores.every((chore) => chore.assigneeIds.length === 0 || chore.assigneeIds[0] === memberId), true);
  const result = await service.requestChore({
    householdId,
    requestedById: memberId,
    title: 'Clean pantry shelves',
    points: 2,
    assigneeIds: [memberId],
    dueAt: '',
    dueInDays: null,
    recurrence: 'one time',
    starterTitle: null,
  });
  assert.equal(result.status, 'created');
  assert.equal((await service.getBoard(householdId)).chores.some((chore) => chore.title === 'Clean pantry shelves'), true);
});

test('edits require approval, reject stale versions, and archive preserves awarded points', async () => {
  const service = createLocalServices(createMemoryStorage(), { now: () => new Date('2026-09-05T12:00:00Z') }).chores;
  const input = { householdId: DEMO_HOUSEHOLD_ID, requestedById: DEMO_MEMBER_ID, title: 'New chore', points: 3, assigneeIds: [DEMO_MEMBER_ID], dueAt: '', dueInDays: null, recurrence: 'one time', starterTitle: null };
  const created = await service.requestChore(input);
  assert.equal(created.status, 'pending');
  if (created.status !== 'pending') return;
  await approveRequest(service, created.pending.id);
  const chore = (await service.getBoard(DEMO_HOUSEHOLD_ID)).chores.find((item) => item.title === input.title)!;
  await service.requestEdit({ ...input, title: 'Edited chore', points: 5, choreId: chore.id, scope: 'future', expectedVersion: 1 });
  let board = await service.getBoard(DEMO_HOUSEHOLD_ID);
  assert.equal(board.chores.find((item) => item.id === chore.id)?.title, 'New chore');
  await approveRequest(service, board.pendingChores[0].id);
  board = await service.getBoard(DEMO_HOUSEHOLD_ID);
  assert.equal(board.chores.find((item) => item.id === chore.id)?.points, 5);
  await assert.rejects(service.requestEdit({ ...input, choreId: chore.id, scope: 'occurrence', expectedVersion: 1 }), /changed/);
  const first = await service.completeChore({ householdId: DEMO_HOUSEHOLD_ID, choreId: chore.id, memberId: DEMO_MEMBER_ID });
  const second = await service.completeChore({ householdId: DEMO_HOUSEHOLD_ID, choreId: chore.id, memberId: DEMO_HOUSEHOLD_MEMBER_IDS[0] });
  assert.deepEqual(first, second);
  assert.equal(first.pointsAwarded, 5);
  await assert.rejects(service.requestArchive({ householdId: DEMO_HOUSEHOLD_ID, choreId: chore.id, requestedById: DEMO_MEMBER_ID, scope: 'future', expectedVersion: 2 }), /history/);
  assert.equal((await service.getBoard(DEMO_HOUSEHOLD_ID)).completions.filter((item) => item.choreId === chore.id).length, 1);
});

test('an occurrence edit leaves future settings intact and stopping a series prevents recurrence', async () => {
  let time = new Date('2026-09-05T12:00:00Z');
  const services = createLocalServices(createMemoryStorage(), { now: () => time });
  const { household, member } = await services.households.create({ householdName: 'Solo', displayName: 'Solo member', avatarColor: '#F36F56' });
  const service = services.chores;
  const householdId = household.id; const memberId = member.id;
  const input = { householdId, requestedById: memberId, title: 'Daily tidy', points: 2, assigneeIds: [memberId], dueAt: '2026-09-05T18:00:00Z', dueInDays: 0, recurrence: 'every 1 day', starterTitle: null };
  const result = await service.requestChore(input);
  assert.equal(result.status, 'created');
  if (result.status !== 'created') return;
  await service.requestEdit({ ...input, title: 'Today only', points: 4, dueAt: '2026-09-07T18:00:00Z', choreId: result.chore.id, scope: 'occurrence', expectedVersion: 1 });
  await service.completeChore({ householdId, memberId, choreId: result.chore.id });
  time = new Date('2026-09-06T19:00:00Z');
  let board = await service.getBoard(householdId);
  const next = board.chores.find((item) => item.seriesId === result.chore.id && item.id !== result.chore.id)!;
  assert.equal(next.title, 'Daily tidy'); assert.equal(next.points, 2);
  assert.equal(next.dueAt, '2026-09-06T18:00:00.000Z');
  await service.requestArchive({ householdId, requestedById: memberId, choreId: next.id, scope: 'future', expectedVersion: 1 });
  time = new Date('2026-10-01T19:00:00Z');
  board = await service.getBoard(householdId);
  assert.equal(board.chores.filter((item) => item.seriesId === result.chore.id).length, 2);
  assert.equal(board.completions.find((item) => item.choreId === result.chore.id)?.pointsAwarded, 4);
});

test('monthly recurrence clamps at month end', () => {
  assert.equal(nextDueDate('2028-01-31T18:00:00Z', 1, 'months'), '2028-02-29T18:00:00.000Z');
});
