import assert from 'node:assert/strict';
import test from 'node:test';

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
