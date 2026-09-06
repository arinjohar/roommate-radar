import type {
  Chore,
  ChoreRecurrence,
  Completion,
  Household,
  Member,
  PulseResponse,
} from '../types/domain';
import type { HouseholdMembership, RoommateRadarServices } from './contracts';

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
  created_at: string;
}

interface DbMember {
  id: string;
  household_id: string;
  display_name: string;
  avatar_color: string;
}

interface DbChore {
  id: string;
  household_id: string;
  title: string;
  points: number;
  assignee_id: string | null;
  due_at: string;
  recurrence: ChoreRecurrence;
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

  return {
    households: {
      async create(input) {
        const value = await rpc<{ household: DbHousehold; member: DbMember }>('create_household', {
          p_name: input.householdName,
          p_display_name: input.displayName,
          p_avatar_color: input.avatarColor,
        });
        return mapMembership(value);
      },
      async join(input) {
        const value = await rpc<{ household: DbHousehold; member: DbMember }>('join_household', {
          p_invite_code: input.inviteCode,
          p_display_name: input.displayName,
          p_avatar_color: input.avatarColor,
        });
        return mapMembership(value);
      },
      async get(householdId) {
        const rows = await request<DbHousehold[]>(
          `households?select=id,name,invite_code,created_at&id=eq.${encodeURIComponent(householdId)}`,
        );
        return rows[0] ? mapHousehold(rows[0]) : null;
      },
      async listMembers(householdId) {
        const rows = await request<DbMember[]>(
          `members?select=id,household_id,display_name,avatar_color&household_id=eq.${encodeURIComponent(householdId)}&order=created_at.asc`,
        );
        return rows.map(mapMember);
      },
    },
    chores: {
      async list(householdId) {
        const rows = await request<DbChore[]>(
          `chores?select=id,household_id,title,points,assignee_id,due_at,recurrence&household_id=eq.${encodeURIComponent(householdId)}&order=due_at.asc`,
        );
        return rows.map(mapChore);
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
      async getBoard(householdId) {
        const [choreRows, completionRows] = await Promise.all([
          request<DbChore[]>(
            `chores?select=id,household_id,title,points,assignee_id,due_at,recurrence&household_id=eq.${encodeURIComponent(householdId)}&order=due_at.asc`,
          ),
          request<DbCompletion[]>(
            `completions?select=id,chore_id,member_id,points_awarded,completed_at,chores!inner(household_id)&chores.household_id=eq.${encodeURIComponent(householdId)}&order=completed_at.asc`,
          ),
        ]);
        return {
          chores: choreRows.map(mapChore),
          completions: completionRows.map(mapCompletion),
          choreStarters: [],
          trustLevel: 'everything-except-date' as const,
          completedRetentionDays: 7,
          pendingChores: [],
          pendingTrustChanges: [],
        };
      },
      async requestChore() {
        throw new Error('Chore requests are not available with the hosted adapter yet.');
      },
      async voteOnChore() {
        throw new Error('Chore approvals are not available with the hosted adapter yet.');
      },
      async requestTrustLevelChange() {
        throw new Error('Trust settings are not available with the hosted adapter yet.');
      },
      async voteOnTrustLevelChange() {
        throw new Error('Trust approvals are not available with the hosted adapter yet.');
      },
      async setCompletedRetentionDays() {
        throw new Error('Chore history settings are not available with the hosted adapter yet.');
      },
      async removeChoreStarter() {
        throw new Error('Saved chore options are not available with the hosted adapter yet.');
      },
      async updateChorePoints() {
        throw new Error('Published chores keep their effort points.');
      },
      async completeChore({ choreId, memberId }) {
        const row = await rpc<DbCompletion>('complete_chore', {
          p_chore_id: choreId,
          p_idempotency_key: `${memberId}:${choreId}`,
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
  return { id: row.id, name: row.name, inviteCode: row.invite_code, createdAt: row.created_at };
}

function mapMember(row: DbMember): Member {
  return {
    id: row.id,
    householdId: row.household_id,
    displayName: row.display_name,
    avatarColor: row.avatar_color,
  };
}

function mapChore(row: DbChore): Chore {
  return {
    id: row.id,
    householdId: row.household_id,
    title: row.title,
    points: row.points,
    assigneeIds: row.assignee_id ? [row.assignee_id] : [],
    dueAt: row.due_at,
    recurrence: row.recurrence,
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
