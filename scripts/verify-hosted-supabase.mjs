/*
 * Exercises the hosted Supabase path using only the public project URL/key.
 * It creates temporary anonymous users and a uniquely named verification
 * household. It never needs, logs, or accepts a service-role key.
 */

const url = required('EXPO_PUBLIC_SUPABASE_URL').replace(/\/$/, '');
const key = required('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const demoHouseholdId = '10000000-0000-4000-8000-000000000001';

async function request(path, { token, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: {
      apikey: key,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  const value = text ? JSON.parse(text) : undefined;
  if (!response.ok) throw new Error(`${method} ${path} failed (${response.status}): ${text}`);
  return value;
}

async function anonymousUser(label) {
  const session = await request('/auth/v1/signup', {
    method: 'POST',
    body: { data: { verification_run: label }, gotrue_meta_security: {} },
  });
  assert(session.access_token && session.user?.id, 'Anonymous sign-in did not return a session. Enable Anonymous Sign-Ins in Supabase Auth settings.');
  assert(session.user.is_anonymous === true, 'The returned user is not anonymous. Check Supabase Auth settings.');
  return session;
}

const rpc = (token, name, body) => request(`/rest/v1/rpc/${name}`, { token, method: 'POST', body });
const rest = (token, path) => request(`/rest/v1/${path}`, { token });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required. Copy .env.example and use the hosted project's public values.`);
  return value;
}

async function main() {
  console.log(`Verifying hosted Supabase project at ${new URL(url).hostname}.`);
  const owner = await anonymousUser(`owner-${runId}`);
  const guest = await anonymousUser(`guest-${runId}`);

  const created = await rpc(owner.access_token, 'create_household', {
    p_name: `Verification House ${runId}`,
    p_display_name: 'Owner check',
    p_avatar_color: '#F36F56',
  });
  assert(created?.household?.id && created?.household?.invite_code, 'create_household returned an incomplete membership.');
  const ownerMemberships = await rpc(owner.access_token, 'list_my_household_memberships', {});
  assert(
    ownerMemberships.some((membership) => (
      membership.household_id === created.household.id
      && membership.member_id === created.member.id
      && membership.creator_member_id === created.member.id
    )),
    'The creator membership is unavailable after creating a household.',
  );

  const hiddenBeforeJoin = await rest(
    guest.access_token,
    `households?select=id&id=eq.${encodeURIComponent(created.household.id)}`,
  );
  assert(Array.isArray(hiddenBeforeJoin) && hiddenBeforeJoin.length === 0, 'RLS exposed an unjoined household.');

  const joined = await rpc(guest.access_token, 'join_household', {
    p_invite_code: created.household.invite_code,
    p_display_name: 'Guest check',
    p_avatar_color: '#9ED9C5',
  });
  assert(joined?.member?.id, 'join_household did not return a member.');
  const guestMemberships = await rpc(guest.access_token, 'list_my_household_memberships', {});
  assert(
    guestMemberships.some((membership) => (
      membership.household_id === created.household.id
      && membership.member_id === joined.member.id
      && membership.creator_member_id === created.member.id
    )),
    'The joined membership is unavailable after joining a household.',
  );

  const members = await rest(
    guest.access_token,
    `members?select=id,display_name&household_id=eq.${encodeURIComponent(created.household.id)}`,
  );
  assert(Array.isArray(members) && members.length === 2, 'Joined guest cannot see the expected household roster.');

  const householdId = created.household.id;
  const input = {
    title: `Verification chore ${runId}`, points: 3,
    assigneeIds: [created.member.id, joined.member.id],
    dueAt: '', dueInDays: null, recurrence: 'one time', repeatEvery: null, repeatUnit: null,
    starterTitle: null,
  };
  const change = (token, action, payload) => rpc(token, 'request_chore_change', { p_household_id: householdId, p_action: action, p_payload: payload });
  const vote = (token, id) => rpc(token, 'vote_chore_change', { p_household_id: householdId, p_request_id: id, p_vote: 'approved' });
  const board = (token) => rpc(token, 'get_chore_board', { p_household_id: householdId });
  const request = await change(owner.access_token, 'create', input);
  assert(request.status === 'pending', 'A two-member household must review new chores by default.');
  await vote(guest.access_token, request.pending.id);
  const newChore = (await board(guest.access_token)).chores.find((item) => item.title === input.title);
  assert(newChore?.assigneeIds.length === 2, 'Multi-member assignments were not saved.');
  const edit = await change(owner.access_token, 'edit', { ...input, points: 4, choreId: newChore.id, expectedVersion: newChore.version, scope: 'future' });
  await vote(guest.access_token, edit.pending.id);
  const award = await rpc(guest.access_token, 'complete_chore', { p_chore_id: newChore.id, p_idempotency_key: `new-${runId}` });
  const duplicate = await rpc(owner.access_token, 'complete_chore', { p_chore_id: newChore.id, p_idempotency_key: `duplicate-${runId}` });
  assert(award.id === duplicate.id && award.points_awarded === 4, 'Cross-member completion duplicated or awarded the wrong points.');
  const totals = await rest(owner.access_token, `member_point_totals?household_id=eq.${householdId}`);
  assert(Number(totals.find((item) => item.member_id === joined.member.id)?.total_points) === 4, 'Balance point total does not match the saved award.');
  const removable = await change(owner.access_token, 'create', { ...input, title: `Remove ${runId}` });
  await vote(guest.access_token, removable.pending.id);
  const toDelete = (await board(owner.access_token)).chores.find((item) => item.title === `Remove ${runId}`);
  const deletion = await change(owner.access_token, 'archive', { choreId: toDelete.id, expectedVersion: toDelete.version, scope: 'future' });
  await vote(guest.access_token, deletion.pending.id);
  assert((await board(owner.access_token)).chores.find((item) => item.id === toDelete.id)?.archivedAt, 'Deletion did not archive the chore.');

  const demoHiddenBeforeJoin = await rest(
    guest.access_token,
    `households?select=id&id=eq.${demoHouseholdId}`,
  );
  assert(Array.isArray(demoHiddenBeforeJoin) && demoHiddenBeforeJoin.length === 0, 'RLS exposed the demo household before joining.');

  const demoMembership = await rpc(guest.access_token, 'join_household', {
    p_invite_code: 'RADAR4',
    p_display_name: `Verifier ${runId.slice(-4)}`,
    p_avatar_color: '#F4C95D',
  });
  assert(demoMembership?.member?.id, 'RADAR4 seed data is missing or join_household failed. Push seed data with --include-seed.');

  const chores = await rest(
    guest.access_token,
    `chores?select=id,title,points&household_id=eq.${demoHouseholdId}&order=due_at.asc`,
  );
  assert(Array.isArray(chores) && chores.length >= 8, 'The demo household does not contain the expected chores.');

  const chore = chores.find((item) => item.title === 'Mop kitchen floor') ?? chores[0];
  const idempotencyKey = `hosted-verification-${runId}`;
  const completion = await rpc(guest.access_token, 'complete_chore', {
    p_chore_id: chore.id,
    p_idempotency_key: idempotencyKey,
  });
  const completionRetry = await rpc(guest.access_token, 'complete_chore', {
    p_chore_id: chore.id,
    p_idempotency_key: idempotencyKey,
  });
  assert(completion?.id === completionRetry?.id, 'complete_chore is not idempotent.');

  const weekStart = mondayUtc();
  const firstPulse = await rpc(guest.access_token, 'submit_pulse', {
    p_household_id: demoHouseholdId,
    p_week_start: weekStart,
    p_cleanliness: 3,
    p_noise: 4,
    p_communication: 2,
  });
  const secondPulse = await rpc(guest.access_token, 'submit_pulse', {
    p_household_id: demoHouseholdId,
    p_week_start: weekStart,
    p_cleanliness: 4,
    p_noise: 4,
    p_communication: 3,
  });
  assert(firstPulse?.id === secondPulse?.id && secondPulse.cleanliness === 4, 'submit_pulse did not upsert the active member response.');

  const pulses = await rest(
    guest.access_token,
    `pulse_responses?select=id,member_id,cleanliness&household_id=eq.${demoHouseholdId}&week_start=eq.${weekStart}`,
  );
  assert(pulses.filter((pulse) => pulse.member_id === demoMembership.member.id).length === 1, 'Pulse RLS/upsert did not preserve one response for the active member.');

  await rpc(guest.access_token, 'reset_my_demo_data', {});
  const ownCompletionsAfterReset = await rest(
    guest.access_token,
    `completions?select=id,member_id&member_id=eq.${demoMembership.member.id}`,
  );
  const ownPulsesAfterReset = await rest(
    guest.access_token,
    `pulse_responses?select=id&household_id=eq.${demoHouseholdId}&member_id=eq.${demoMembership.member.id}`,
  );
  assert(ownCompletionsAfterReset.length === 0, 'reset_my_demo_data did not remove the active user completion.');
  assert(ownPulsesAfterReset.length === 0, 'reset_my_demo_data did not remove the active user pulse.');

  await rpc(owner.access_token, 'transfer_household_ownership_and_leave', {
    p_household_id: householdId,
    p_new_owner_member_id: joined.member.id,
  });
  const formerOwnerMemberships = await rpc(owner.access_token, 'list_my_household_memberships', {});
  assert(
    !formerOwnerMemberships.some((membership) => membership.household_id === householdId),
    'The former owner still has a membership after transferring ownership and leaving.',
  );
  const transferredMemberships = await rpc(guest.access_token, 'list_my_household_memberships', {});
  assert(
    transferredMemberships.some((membership) => (
      membership.household_id === householdId
      && membership.creator_member_id === joined.member.id
    )),
    'The selected roommate did not become the household owner.',
  );
  const transferredBoard = await board(guest.access_token);
  assert(
    transferredBoard.chores.every((item) => !item.assigneeIds.includes(created.member.id)),
    'A departing owner remained assigned to an active chore.',
  );

  console.log('Hosted verification passed: anonymous auth, RLS, create/join, chore workflows, saved totals, seeded demo, pulse, reset, and ownership transfer.');
}

function mondayUtc() {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return start.toISOString().slice(0, 10);
}

main().catch((error) => {
  console.error(`Hosted Supabase verification failed: ${error.message}`);
  process.exitCode = 1;
});
