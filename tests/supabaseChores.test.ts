import assert from 'node:assert/strict';
import test from 'node:test';
import { createSupabaseServices } from '../src/services/supabase';

test('hosted board uses authenticated RPCs, structured schedules, and database point totals', async () => {
  const originalFetch = globalThis.fetch;
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const value = String(url).includes('member_point_totals') ? [{ member_id: 'member', total_points: '12' }]
      : String(url).endsWith('get_chore_board') ? { chores: [{ id: 'active' }, { id: 'archived', archivedAt: '2026-09-05' }] }
      : { status: 'created', chore: { id: 'new' } };
    return new Response(JSON.stringify(value), { status: 200 });
  };
  try {
    const services = createSupabaseServices({ url: 'https://example.supabase.co', anonKey: 'public-key', getAccessToken: async () => 'user-token', session: { load: async () => null, save: async () => {}, clear: async () => {} } });
    await services.chores.requestChore({ householdId: 'home', requestedById: 'member', title: 'Tidy', points: 2, assigneeIds: ['member'], recurrence: 'every 2 weeks', dueAt: '2026-09-09T18:00:00Z', dueInDays: 4, starterTitle: null });
    const body = JSON.parse(String(calls[0].init.body));
    assert.equal(body.p_action, 'create');
    assert.equal(body.p_payload.repeatEvery, 2);
    assert.equal(body.p_payload.repeatUnit, 'weeks');
    assert.deepEqual(body.p_payload.assigneeIds, ['member']);
    assert.equal(new Headers(calls[0].init.headers).get('Authorization'), 'Bearer user-token');
    assert.deepEqual(await services.chores.listMemberPoints('home'), [{ memberId: 'member', totalPoints: 12 }]);
    assert.deepEqual(await services.chores.list('home'), [{ id: 'active' }]);
  } finally { globalThis.fetch = originalFetch; }
});

test('hosted writes fill a missing recurring due date before calling the RPC', async () => {
  const originalFetch = globalThis.fetch;
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ status: 'created', chore: { id: 'new' } }), { status: 200 });
  };
  try {
    const services = createSupabaseServices({ url: 'https://example.supabase.co', anonKey: 'public-key', getAccessToken: async () => 'user-token', session: { load: async () => null, save: async () => {}, clear: async () => {} } });
    await services.chores.requestChore({ householdId: 'home', requestedById: 'member', title: 'Bins', points: 2, assigneeIds: ['member'], recurrence: 'every Wednesday', dueAt: '', dueInDays: null, starterTitle: null });
    const body = JSON.parse(String(calls[0].init.body));
    assert.match(body.p_payload.dueAt, /^\d{4}-\d{2}-\d{2}T18:00:00\.000Z$/);
    assert.equal(body.p_payload.repeatEvery, 1);
    assert.equal(body.p_payload.repeatUnit, 'weeks');
  } finally { globalThis.fetch = originalFetch; }
});
