import type {
  Chore,
  Completion,
  Household,
  Member,
  PulseResponse,
} from '../types/domain';
import type { HouseholdMembership, RoommateRadarServices } from './contracts';
import type { ChoreBoardSnapshot, ChoreService } from './contracts';
import { initialRecurringDueDate, parseSchedule } from './choreSchedule';
import { validateDisplayName, validateHouseholdName } from './householdValidation';

interface SupabaseOptions {
  url: string;
  anonKey: string;
  getAccessToken: () => Promise<string | null>;
  session: RoommateRadarServices['session'];
}

interface DbHousehold {
  id: string;
  name: string;
  invite_code: string;
  creator_member_id: string;
  created_at: string;
}

interface DbMember {
  id: string;
  household_id: string;
  display_name: string;
  avatar_color: string;
}

interface DbCompletion {
  id: string;
  chore_id: string;
  member_id: string;
  points_awarded: number;
  completed_at: string;
}

interface DbPulse {
  id: string;
  household_id: string;
  member_id: string;
  week_start: string;
  cleanliness: number;
  noise: number;
  communication: number;
}

export function createSupabaseServices(options: SupabaseOptions): RoommateRadarServices {
  const baseUrl = options.url.replace(/\/$/, '');

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const accessToken = await options.getAccessToken();
    if (!accessToken) throw new Error('A Supabase user session is required.');
    const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: options.anonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Supabase request failed (${response.status}): ${detail}`);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  const rpc = <T>(name: string, body: object) => request<T>(`rpc/${name}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const change = <T>(householdId: string, action: string, payload: object) => rpc<T>('request_chore_change', { p_household_id: householdId, p_action: action, p_payload: payload });
  const vote = (householdId: string, pendingId: string, choice: string) => rpc<Chore | null>('vote_chore_change', { p_household_id: householdId, p_request_id: pendingId, p_vote: choice });
  const normalizeSchedule = <T extends { recurrence: string; dueAt: string; dueInDays: number | null }>(input: T): T => {
    const schedule = parseSchedule(input.recurrence);
    if (!schedule.repeatEvery || input.dueAt) return input;
    const dueAt = initialRecurringDueDate(input.recurrence, new Date());
    const today = new Date();
    const due = new Date(dueAt);
    const dueInDays = Math.round((Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate()) - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) / 86_400_000);
    return { ...input, dueAt, dueInDays };
  };
  const choreBoard: Omit<ChoreService, 'list' | 'listCompletions' | 'complete' | 'listMemberPoints'> = {
    getBoard: (householdId) => rpc<ChoreBoardSnapshot>('get_chore_board', { p_household_id: householdId }),
    requestChore: (input) => {
      const normalized = normalizeSchedule(input);
      return change(normalized.householdId, 'create', { ...normalized, ...parseSchedule(normalized.recurrence) });
    },
    async requestEdit(input) {
      const normalized = normalizeSchedule(input);
      await change(normalized.householdId, 'edit', { ...normalized, ...parseSchedule(normalized.recurrence) });
    },
    async requestArchive(input) { await change(input.householdId, 'archive', input); },
    voteOnChore: (input) => vote(input.householdId, input.pendingId, input.vote),
    async requestTrustLevelChange(input) { await change(input.householdId, 'trust', input); },
    async voteOnTrustLevelChange(input) { await vote(input.householdId, input.pendingId, input.vote); },
    async setCompletedRetentionDays(householdId, days) { await rpc('update_chore_board_settings', { p_household_id: householdId, p_retention: days }); },
    async removeChoreStarter(householdId, title) { await rpc('update_chore_board_settings', { p_household_id: householdId, p_remove_starter: title }); },
    async updateChorePoints() { throw new Error('Use Edit to request an effort point change.'); },
    async completeChore(input) {
      return mapCompletion(await rpc<DbCompletion>('complete_chore', { p_chore_id: input.choreId, p_idempotency_key: `complete-${input.choreId}` }));
    },
    async undoCompletion(input) {
      await rpc('undo_chore_completion', { p_chore_id: input.choreId });
    },
  };

  return {
    households: {
      async create(input) {
        const householdName = validateHouseholdName(input.householdName);
        const displayName = validateDisplayName(input.displayName);
        const value = await rpc<{ household: DbHousehold; member: DbMember }>('create_household', {
          p_name: householdName,
          p_display_name: displayName,
          p_avatar_color: input.avatarColor,
        });
        return mapMembership(value);
      },
      async join(input) {
        const displayName = validateDisplayName(input.displayName);
        const value = await rpc<{ household: DbHousehold; member: DbMember }>('join_household', {
          p_invite_code: input.inviteCode,
          p_display_name: displayName,
          p_avatar_color: input.avatarColor,
        });
        return mapMembership(value);
      },
      async listMemberships() {
        const rows = await rpc<Array<{
          household_id: string;
          household_name: string;
          invite_code: string;
          creator_member_id: string;
          household_created_at: string;
          member_id: string;
          display_name: string;
          avatar_color: string;
        }>>('list_my_household_memberships', {});
        return rows.map((row) => ({
          household: {
            id: row.household_id,
            name: row.household_name,
            inviteCode: row.invite_code,
            creatorMemberId: row.creator_member_id,
            createdAt: row.household_created_at,
          },
          member: {
            id: row.member_id,
            householdId: row.household_id,
            displayName: row.display_name,
            avatarColor: row.avatar_color,
          },
        }));
      },
      async get(householdId) {
        const rows = await request<DbHousehold[]>(
          `households?select=id,name,invite_code,creator_member_id,created_at&id=eq.${encodeURIComponent(householdId)}`,
        );
        return rows[0] ? mapHousehold(rows[0]) : null;
      },
      async listMembers(householdId) {
        const rows = await request<DbMember[]>(
          `members?select=id,household_id,display_name,avatar_color&household_id=eq.${encodeURIComponent(householdId)}&order=created_at.asc`,
        );
        return rows.map(mapMember);
      },
      async leave(householdId) {
        await rpc('leave_household', { p_household_id: householdId });
      },
      async delete(householdId) {
        await rpc('delete_household', { p_household_id: householdId });
      },
      async transferOwnershipAndLeave(householdId, _memberId, newOwnerMemberId) {
        await rpc('transfer_household_ownership_and_leave', {
          p_household_id: householdId,
          p_new_owner_member_id: newOwnerMemberId,
        });
      },
    },
    chores: {
      ...choreBoard,
      async listMemberPoints(householdId) {
        const rows = await request<{ member_id: string; total_points: number }[]>(`member_point_totals?household_id=eq.${encodeURIComponent(householdId)}&select=member_id,total_points`);
        return rows.map((row) => ({ memberId: row.member_id, totalPoints: Number(row.total_points) }));
      },
      async list(householdId) {
        return (await choreBoard.getBoard(householdId)).chores.filter((chore) => !chore.archivedAt);
      },
      async listCompletions(householdId, from, to) {
        const rows = await request<DbCompletion[]>(
          `completions?select=id,chore_id,member_id,points_awarded,completed_at,chores!inner(household_id)&chores.household_id=eq.${encodeURIComponent(householdId)}&completed_at=gte.${encodeURIComponent(from)}&completed_at=lt.${encodeURIComponent(to)}&order=completed_at.asc`,
        );
        return rows.map(mapCompletion);
      },
      async complete(choreId, idempotencyKey) {
        const row = await rpc<DbCompletion>('complete_chore', {
          p_chore_id: choreId,
          p_idempotency_key: idempotencyKey,
        });
        return mapCompletion(row);
      },
    },
    pulse: {
      async list(householdId, weekStart) {
        const rows = await request<DbPulse[]>(
          `pulse_responses?select=id,household_id,member_id,week_start,cleanliness,noise,communication&household_id=eq.${encodeURIComponent(householdId)}&week_start=eq.${encodeURIComponent(weekStart)}`,
        );
        return rows.map(mapPulse);
      },
      async submit(householdId, weekStart, scores) {
        const row = await rpc<DbPulse>('submit_pulse', {
          p_household_id: householdId,
          p_week_start: weekStart,
          p_cleanliness: scores.cleanliness,
          p_noise: scores.noise,
          p_communication: scores.communication,
        });
        return mapPulse(row);
      },
    },
    session: options.session,
    demo: {
      async reset() {
        await rpc<void>('reset_my_demo_data', {});
        await options.session.clear();
      },
    },
  };
}

export interface SupabaseAuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
}

export async function createAnonymousSupabaseSession(
  url: string,
  anonKey: string,
): Promise<SupabaseAuthSession> {
  const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    // Match Supabase's signInAnonymously request shape. An empty request body can
    // be interpreted differently by older GoTrue deployments.
    body: JSON.stringify({ data: {}, gotrue_meta_security: {} }),
  });
  if (!response.ok) throw new Error(`Anonymous sign-in failed (${response.status}).`);
  const value = await response.json() as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    user: { id: string };
  };
  return {
    accessToken: value.access_token,
    refreshToken: value.refresh_token,
    expiresAt: value.expires_at,
    userId: value.user.id,
  };
}

export async function refreshSupabaseSession(
  url: string,
  anonKey: string,
  refreshToken: string,
): Promise<SupabaseAuthSession> {
  const response = await fetch(
    `${url.replace(/\/$/, '')}/auth/v1/token?grant_type=refresh_token`,
    {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    },
  );
  if (!response.ok) throw new Error(`Supabase session refresh failed (${response.status}).`);
  const value = await response.json() as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    user: { id: string };
  };
  return {
    accessToken: value.access_token,
    refreshToken: value.refresh_token,
    expiresAt: value.expires_at,
    userId: value.user.id,
  };
}

function mapMembership(value: { household: DbHousehold; member: DbMember }): HouseholdMembership {
  return { household: mapHousehold(value.household), member: mapMember(value.member) };
}

function mapHousehold(row: DbHousehold): Household {
  return { id: row.id, name: row.name, inviteCode: row.invite_code, creatorMemberId: row.creator_member_id, createdAt: row.created_at };
}

function mapMember(row: DbMember): Member {
  return {
    id: row.id,
    householdId: row.household_id,
    displayName: row.display_name,
    avatarColor: row.avatar_color,
  };
}

function mapCompletion(row: DbCompletion): Completion {
  return {
    id: row.id,
    choreId: row.chore_id,
    memberId: row.member_id,
    pointsAwarded: row.points_awarded,
    completedAt: row.completed_at,
  };
}

function mapPulse(row: DbPulse): PulseResponse {
  return {
    id: row.id,
    householdId: row.household_id,
    memberId: row.member_id,
    weekStart: row.week_start,
    cleanliness: row.cleanliness,
    noise: row.noise,
    communication: row.communication,
  };
}
