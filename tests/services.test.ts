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

test('a saved membership restores the same household and member after an app restart', async () => {
  const storage = createMemoryStorage();
  const services = createLocalServices(storage);
  const membership = await services.households.create({
    householdName: 'Maple House',
    displayName: 'Aanya',
    avatarColor: '#F36F56',
  });
  await services.session.save({
    guestId: membership.member.id,
    householdId: membership.household.id,
    memberId: membership.member.id,
  });

  const reloaded = createLocalServices(storage);
  const saved = await reloaded.session.load();
  const household = saved && await reloaded.households.get(saved.householdId);
  const members = saved ? await reloaded.households.listMembers(saved.householdId) : [];

  assert.equal(household?.name, 'Maple House');
  assert.equal(members.find((member) => member.id === saved?.memberId)?.displayName, 'Aanya');
  assert.equal(members.length, 1);
});

test('household and member names enforce the hosted database limits locally', async () => {
  const services = createLocalServices(createMemoryStorage());

  await assert.rejects(
    services.households.create({
      householdName: 'H'.repeat(81),
      displayName: 'Ari',
      avatarColor: '#F36F56',
    }),
    /80 characters or fewer/,
  );
  await assert.rejects(
    services.households.create({
      householdName: 'Maple House',
      displayName: 'M'.repeat(61),
      avatarColor: '#F36F56',
    }),
    /60 characters or fewer/,
  );

  const creator = await services.households.create({
    householdName: 'Maple House',
    displayName: 'Ari',
    avatarColor: '#F36F56',
  });
  await assert.rejects(
    services.households.join({
      inviteCode: creator.household.inviteCode,
      displayName: 'M'.repeat(61),
      avatarColor: '#9ED9C5',
    }),
    /60 characters or fewer/,
  );
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
  const created = await services.chores.requestChore({ householdId: household.id, requestedById: member.id, title: 'Tidy', points: 4, assigneeIds: [member.id], recurrence: 'one time', dueAt: '', dueInDays: null, starterTitle: null });
  assert.equal(created.status, 'created');
  if (created.status !== 'created') return;
  await services.chores.completeChore({ householdId: household.id, choreId: created.chore.id, memberId: member.id });
  const restored = createLocalServices(storage);
  assert.deepEqual(await restored.chores.listMemberPoints(household.id), [{ memberId: member.id, totalPoints: 4 }]);
  assert.equal((await restored.chores.listCompletions(household.id, '2020-01-01', '2100-01-01')).length, 1);
});

test('household creation records one creator and owners must transfer before leaving', async () => {
  const storage = createMemoryStorage();
  const services = createLocalServices(storage);
  const creator = await services.households.create({ householdName: 'Cedar House', displayName: 'Pat', avatarColor: '#F36F56' });
  const roommate = await services.households.join({ inviteCode: creator.household.inviteCode, displayName: 'Lee', avatarColor: '#9ED9C5' });
  const assigned = await services.chores.requestChore({
    householdId: creator.household.id,
    requestedById: creator.member.id,
    title: 'Owner chore',
    points: 3,
    assigneeIds: [creator.member.id, roommate.member.id],
    recurrence: 'weekly',
    dueAt: '2026-09-07T18:00:00.000Z',
    dueInDays: null,
    starterTitle: null,
  });
  assert.equal(assigned.status, 'pending');
  if (assigned.status !== 'pending') return;
  await services.chores.voteOnChore({
    householdId: creator.household.id,
    pendingId: assigned.pending.id,
    memberId: roommate.member.id,
    vote: 'approved',
  });

  assert.equal(creator.household.creatorMemberId, creator.member.id);
  await assert.rejects(
    services.households.leave(creator.household.id, creator.member.id),
    /Transfer ownership or delete/,
  );
  await assert.rejects(
    services.households.transferOwnershipAndLeave(creator.household.id, creator.member.id, 'not-a-member'),
    /Choose one other current household member/,
  );

  await services.households.transferOwnershipAndLeave(creator.household.id, creator.member.id, roommate.member.id);
  assert.equal((await services.households.get(creator.household.id))?.creatorMemberId, roommate.member.id);
  assert.deepEqual((await services.households.listMembers(creator.household.id)).map((member) => member.id), [roommate.member.id]);
  assert.deepEqual((await services.chores.list(creator.household.id))[0].assigneeIds, [roommate.member.id]);
});

test('only the creator can delete a household', async () => {
  const services = createLocalServices(createMemoryStorage());
  const creator = await services.households.create({ householdName: 'Birch House', displayName: 'Ari', avatarColor: '#F36F56' });
  const roommate = await services.households.join({ inviteCode: creator.household.inviteCode, displayName: 'Jo', avatarColor: '#9ED9C5' });

  await assert.rejects(
    services.households.delete(creator.household.id, roommate.member.id),
    /Only the household creator/,
  );
  await services.households.delete(creator.household.id, creator.member.id);
  assert.equal(await services.households.get(creator.household.id), null);
  assert.deepEqual(await services.households.listMembers(creator.household.id), []);
});

test('local memberships keep earlier household data reachable after creating another household', async () => {
  const storage = createMemoryStorage();
  const services = createLocalServices(storage);
  const first = await services.households.create({ householdName: 'Maple house', displayName: 'Ari', avatarColor: '#F36F56' });
  const firstChore = await services.chores.requestChore({ householdId: first.household.id, requestedById: first.member.id, title: 'Water plants', points: 2, assigneeIds: [first.member.id], recurrence: 'once', dueAt: '', dueInDays: null, starterTitle: null });
  assert.equal(firstChore.status, 'created');
  if (firstChore.status !== 'created') return;
  await services.chores.completeChore({ householdId: first.household.id, choreId: firstChore.chore.id, memberId: first.member.id });

  const second = await services.households.create({ householdName: 'Cedar house', displayName: 'Ari', avatarColor: '#F36F56' });

  const restored = createLocalServices(storage);
  const memberships = await restored.households.listMemberships();
  assert.deepEqual(memberships.map((membership) => membership.household.name), ['Maple house', 'Cedar house']);
  assert.equal((await restored.chores.listCompletions(first.household.id, '2020-01-01', '2100-01-01')).length, 1);
  assert.equal((await restored.households.get(second.household.id))?.name, 'Cedar house');
});
