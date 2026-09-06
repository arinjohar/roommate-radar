import assert from 'node:assert/strict';
import test from 'node:test';

import { createLocalServices } from '../src/services/local';
import { DEMO_HOUSEHOLD_ID, DEMO_INVITE_CODE } from '../src/services/demoData';

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); },
    async removeItem(key: string) { values.delete(key); },
  };
}

test('local adapter exposes the deterministic four-member, eight-chore story', async () => {
  const services = createLocalServices(createMemoryStorage());
  const household = await services.households.get(DEMO_HOUSEHOLD_ID);
  const members = await services.households.listMembers(DEMO_HOUSEHOLD_ID);
  const chores = await services.chores.list(DEMO_HOUSEHOLD_ID);

  assert.equal(household?.inviteCode, DEMO_INVITE_CODE);
  assert.equal(members.length, 4);
  assert.equal(chores.length, 8);
  assert.equal(chores[0].title, 'Clean bathroom');
});

test('completion retries are idempotent and survive adapter recreation', async () => {
  const storage = createMemoryStorage();
  const services = createLocalServices(storage);
  const chore = (await services.chores.list(DEMO_HOUSEHOLD_ID))[0];
  await services.session.save({
    guestId: 'guest-1',
    householdId: DEMO_HOUSEHOLD_ID,
    memberId: '20000000-0000-4000-8000-000000000002',
  });

  const first = await services.chores.complete(chore.id, 'completion-request-1');
  const retry = await services.chores.complete(chore.id, 'completion-request-1');
  const reloaded = createLocalServices(storage);
  const saved = await reloaded.chores.listCompletions(
    DEMO_HOUSEHOLD_ID,
    '2026-01-01T00:00:00.000Z',
    '2030-01-01T00:00:00.000Z',
  );

  assert.deepEqual(retry, first);
  assert.equal(saved.filter((item) => item.id === first.id).length, 1);
});

test('pulse submissions update the current member response', async () => {
  const storage = createMemoryStorage();
  const services = createLocalServices(storage);
  await services.session.save({
    guestId: 'guest-1',
    householdId: DEMO_HOUSEHOLD_ID,
    memberId: '20000000-0000-4000-8000-000000000002',
  });

  await services.pulse.submit(DEMO_HOUSEHOLD_ID, '2026-08-31', {
    cleanliness: 3,
    noise: 4,
    communication: 2,
  });
  await services.pulse.submit(DEMO_HOUSEHOLD_ID, '2026-08-31', {
    cleanliness: 4,
    noise: 4,
    communication: 3,
  });

  const responses = await services.pulse.list(DEMO_HOUSEHOLD_ID, '2026-08-31');
  assert.equal(responses.length, 1);
  assert.equal(responses[0].cleanliness, 4);
});

test('board completions and Balance totals share durable local storage', async () => {
  const storage = createMemoryStorage();
  const services = createLocalServices(storage);
  const { household, member } = await services.households.create({ householdName: 'New home', displayName: 'Pat', avatarColor: '#F36F56' });
  await services.choreBoard.setHouseholdMembers(household.id, [member.id]);
  const created = await services.choreBoard.requestChore({ householdId: household.id, requestedById: member.id, title: 'Tidy', points: 4, assigneeIds: [member.id], recurrence: 'one time', dueAt: '', dueInDays: null, starterTitle: null });
  assert.equal(created.status, 'created');
  if (created.status !== 'created') return;
  await services.choreBoard.completeChore({ householdId: household.id, choreId: created.chore.id, memberId: member.id });
  const restored = createLocalServices(storage);
  assert.deepEqual(await restored.chores.listMemberPoints(household.id), [{ memberId: member.id, totalPoints: 4 }]);
  assert.equal((await restored.chores.listCompletions(household.id, '2020-01-01', '2100-01-01')).length, 1);
});
