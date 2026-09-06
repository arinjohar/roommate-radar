import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createChoreService,
  DEMO_HOUSEHOLD_ID,
  DEMO_HOUSEHOLD_MEMBER_IDS,
  DEMO_MEMBER_ID,
} from '../src/services/choreService';

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); },
  };
}

async function approveRequest(
  service: ReturnType<typeof createChoreService>,
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
  const firstSession = createChoreService(storage, { now });
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
  await firstSession.removeChoreStarter(DEMO_HOUSEHOLD_ID, 'Clean the fridge');
  await firstSession.requestTrustLevelChange({ householdId: DEMO_HOUSEHOLD_ID, memberId: DEMO_MEMBER_ID, nextTrustLevel: 'open' });

  const secondSession = createChoreService(storage, { now });
  const restored = await secondSession.getBoard(DEMO_HOUSEHOLD_ID);
  assert.equal(restored.completedRetentionDays, 30);
  assert.equal(restored.pendingChores.length, 1);
  assert.equal(restored.pendingTrustChanges.length, 1);
  assert.equal(restored.choreStarters.some((starter) => starter.title === 'Clean the fridge'), false);
});

test('the service enforces approval and preserves real assignee IDs and due intervals', async () => {
  const storage = createMemoryStorage();
  let currentTime = new Date('2026-09-05T12:00:00.000Z');
  const service = createChoreService(storage, { now: () => currentTime });
  assert.equal('createChore' in service, false);

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
  const restored = await createChoreService(storage, { now: () => currentTime }).getBoard(DEMO_HOUSEHOLD_ID);
  const created = restored.chores.find((chore) => chore.title === result.pending.title);
  assert.deepEqual(created?.assigneeIds, [DEMO_HOUSEHOLD_MEMBER_IDS[0], DEMO_HOUSEHOLD_MEMBER_IDS[1]]);
  assert.equal(created?.dueIntervalDays, 4);
  assert.equal(restored.choreStarters.find((starter) => starter.title === result.pending.title)?.dueInDays, 4);
});

test('recurring chores wait for completion and materialize only one missed occurrence', async () => {
  const storage = createMemoryStorage();
  let currentTime = new Date('2026-09-05T12:00:00.000Z');
  const service = createChoreService(storage, { now: () => currentTime });
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
  board = await service.getBoard(DEMO_HOUSEHOLD_ID);
  series = board.chores.filter((chore) => chore.title === 'Daily reset');
  assert.equal(series.length, 2);
  board = await service.getBoard(DEMO_HOUSEHOLD_ID);
  assert.equal(board.chores.filter((chore) => chore.title === 'Daily reset').length, 2);
});

test('a newly created household uses its real roster and can approve its own first chore', async () => {
  const storage = createMemoryStorage();
  const service = createChoreService(storage, { now: () => new Date('2026-09-05T12:00:00.000Z') });
  const householdId = 'new-household';
  const memberId = 'new-member';
  await service.setHouseholdMembers(householdId, [memberId]);

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
