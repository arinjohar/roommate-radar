import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Chore, Completion } from '../types/domain';

export type TrustLevel = 'open' | 'points-and-new' | 'everything-except-date';
export type Approval = 'pending' | 'approved';

export type ChoreStarter = {
  title: string;
  points: number;
  assigneeIds: string[];
  recurrence: string;
  dueInDays: number | null;
};

export type PendingChore = ChoreStarter & {
  id: string;
  householdId: string;
  dueAt: string;
  requestedById: string;
  approvals: Record<string, Approval>;
};

export type PendingTrustChange = {
  id: string;
  householdId: string;
  nextTrustLevel: TrustLevel;
  requestedById: string;
  approvals: Record<string, Approval>;
};

export type ChoreBoardSnapshot = {
  chores: Chore[];
  completions: Completion[];
  choreStarters: ChoreStarter[];
  trustLevel: TrustLevel;
  completedRetentionDays: number;
  pendingChores: PendingChore[];
  pendingTrustChanges: PendingTrustChange[];
};

export type ChoreRequest = ChoreStarter & {
  householdId: string;
  requestedById: string;
  dueAt: string;
  starterTitle: string | null;
};

export type ChoreService = {
  getBoard: (householdId: string) => Promise<ChoreBoardSnapshot>;
  setHouseholdMembers: (householdId: string, memberIds: string[]) => Promise<void>;
  requestChore: (input: ChoreRequest) => Promise<{ status: 'created'; chore: Chore } | { status: 'pending'; pending: PendingChore }>;
  voteOnChore: (input: { householdId: string; pendingId: string; memberId: string; vote: 'approved' | 'rejected' }) => Promise<Chore | null>;
  requestTrustLevelChange: (input: { householdId: string; memberId: string; nextTrustLevel: TrustLevel }) => Promise<void>;
  voteOnTrustLevelChange: (input: { householdId: string; pendingId: string; memberId: string; vote: 'approved' | 'rejected' }) => Promise<void>;
  setCompletedRetentionDays: (householdId: string, days: number) => Promise<void>;
  removeChoreStarter: (householdId: string, title: string) => Promise<void>;
  updateChorePoints: (input: { choreId: string; householdId: string; points: number }) => Promise<Chore>;
  completeChore: (input: { choreId: string; householdId: string; memberId: string }) => Promise<Completion>;
};

type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;
type ServiceOptions = { now?: () => Date };
type HouseholdBoardData = ChoreBoardSnapshot & { memberIds: string[] };
type PersistedState = { households: Record<string, HouseholdBoardData> };

const STORAGE_KEY = '@roommate-radar/chore-board/v2';
export const DEMO_HOUSEHOLD_ID = '10000000-0000-4000-8000-000000000001';
export const DEMO_MEMBER_ID = '20000000-0000-4000-8000-000000000003';
export const DEMO_HOUSEHOLD_MEMBER_IDS = [
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000004',
];

const defaultChoreStarters: ChoreStarter[] = [
  { title: 'Empty the dishwasher', points: 2, assigneeIds: [], recurrence: 'one time', dueInDays: null },
  { title: 'Clean the fridge', points: 5, assigneeIds: [], recurrence: 'one time', dueInDays: null },
  { title: 'Mop the kitchen floor', points: 4, assigneeIds: [], recurrence: 'one time', dueInDays: null },
  { title: 'Take out the trash', points: 2, assigneeIds: [], recurrence: 'one time', dueInDays: null },
  { title: 'Change shared linens', points: 3, assigneeIds: [], recurrence: 'one time', dueInDays: null },
];

const seededChores: Omit<Chore, 'householdId'>[] = [
  { id: 'bathroom', title: 'Clean bathroom', points: 6, assigneeIds: [DEMO_HOUSEHOLD_MEMBER_IDS[0]], dueAt: '2026-09-07T18:00:00.000Z', recurrence: 'weekly', dueIntervalDays: 2, isPreApproved: true },
  { id: 'kitchen', title: 'Wipe down the kitchen', points: 3, assigneeIds: [DEMO_HOUSEHOLD_MEMBER_IDS[1]], dueAt: '2026-09-06T18:00:00.000Z', recurrence: 'weekly', dueIntervalDays: 1, isPreApproved: true },
  { id: 'recycling', title: 'Take out recycling', points: 2, assigneeIds: [DEMO_HOUSEHOLD_MEMBER_IDS[2]], dueAt: '2026-09-05T18:00:00.000Z', recurrence: 'weekly', dueIntervalDays: 0, isPreApproved: true },
  { id: 'floors', title: 'Vacuum shared spaces', points: 5, assigneeIds: [DEMO_HOUSEHOLD_MEMBER_IDS[3]], dueAt: '2026-09-08T18:00:00.000Z', recurrence: 'weekly', dueIntervalDays: 3, isPreApproved: true },
  { id: 'groceries', title: 'Restock house basics', points: 4, assigneeIds: [DEMO_HOUSEHOLD_MEMBER_IDS[0]], dueAt: '2026-09-09T18:00:00.000Z', recurrence: 'weekly', dueIntervalDays: 4, isPreApproved: true },
  { id: 'plants', title: 'Water the plants', points: 1, assigneeIds: [DEMO_HOUSEHOLD_MEMBER_IDS[1]], dueAt: '2026-09-04T18:00:00.000Z', recurrence: 'weekly', dueIntervalDays: 0, isPreApproved: true },
  { id: 'overdue-demo', title: 'Return library books', points: 2, assigneeIds: [DEMO_HOUSEHOLD_MEMBER_IDS[2]], dueAt: '2026-09-03T18:00:00.000Z', recurrence: 'one time', dueIntervalDays: 0, isPreApproved: true },
  { id: 'entryway', title: 'Tidy the entryway', points: 2, assigneeIds: [DEMO_HOUSEHOLD_MEMBER_IDS[2]], dueAt: '2026-09-10T18:00:00.000Z', recurrence: 'weekly', dueIntervalDays: 5, isPreApproved: true },
  { id: 'laundry', title: 'Wash shared towels', points: 4, assigneeIds: [DEMO_HOUSEHOLD_MEMBER_IDS[3]], dueAt: '2026-09-11T18:00:00.000Z', recurrence: 'weekly', dueIntervalDays: 6, isPreApproved: true },
];

const trustLevelStrictness: Record<TrustLevel, number> = {
  open: 0,
  'points-and-new': 1,
  'everything-except-date': 2,
};

function clone<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function createHouseholdData(householdId: string): HouseholdBoardData {
  return {
    chores: seededChores.map((chore) => ({ ...clone(chore), householdId })),
    completions: [],
    choreStarters: clone(defaultChoreStarters),
    trustLevel: 'everything-except-date',
    completedRetentionDays: 7,
    pendingChores: [],
    pendingTrustChanges: [],
    memberIds: [...DEMO_HOUSEHOLD_MEMBER_IDS],
  };
}

function recurrenceInterval(recurrence: string) {
  if (recurrence === 'weekly') return { count: 1, unit: 'weeks' as const };
  const match = recurrence.match(/^every (\d+) (day|week|month)s?$/i);
  return match ? { count: Number(match[1]), unit: `${match[2]}s` as 'days' | 'weeks' | 'months' } : null;
}

function addInterval(date: Date, count: number, unit: 'days' | 'weeks' | 'months') {
  const next = new Date(date);
  if (unit === 'days') next.setUTCDate(next.getUTCDate() + count);
  if (unit === 'weeks') next.setUTCDate(next.getUTCDate() + count * 7);
  if (unit === 'months') next.setUTCMonth(next.getUTCMonth() + count);
  return next;
}

function materializeRecurringChores(board: HouseholdBoardData, now: Date) {
  const completedIds = new Set(board.completions.map((completion) => completion.choreId));
  const seriesIds = [...new Set(board.chores.map((chore) => chore.seriesId ?? chore.id))];
  for (const seriesId of seriesIds) {
    const series = board.chores.filter((chore) => (chore.seriesId ?? chore.id) === seriesId);
    const latest = [...series].sort((a, b) => Date.parse(b.dueAt) - Date.parse(a.dueAt))[0];
    const interval = latest ? recurrenceInterval(latest.recurrence) : null;
    if (!latest || !interval || !completedIds.has(latest.id)) continue;
    const nextDue = addInterval(new Date(latest.dueAt), interval.count, interval.unit);
    if (nextDue > now) continue;
    board.chores.push({ ...latest, id: `recurrence-${seriesId}-${nextDue.getTime()}`, dueAt: nextDue.toISOString(), seriesId, isPreApproved: true });
  }
}

function validateChore(input: ChoreRequest, today: Date) {
  const normalizedTitle = input.title.trim();
  const dueDay = input.dueAt.slice(0, 10);
  const parsedDueDay = new Date(`${dueDay}T00:00:00.000Z`);
  const todayUtc = new Date(today);
  todayUtc.setUTCHours(0, 0, 0, 0);
  if (dueDay && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDay) || Number.isNaN(parsedDueDay.getTime()) || parsedDueDay.toISOString().slice(0, 10) !== dueDay || parsedDueDay < todayUtc)) throw new Error('Invalid date.');
  if (!normalizedTitle) throw new Error('Give this chore a short, clear name.');
  if (!Number.isInteger(input.points) || input.points < 1 || input.points > 10) throw new Error('Choose between 1 and 10 effort points.');
  if (!Number.isInteger(input.dueInDays) && input.dueInDays !== null) throw new Error('Invalid due interval.');
  return normalizedTitle;
}

function sameIds(left: string[], right: string[]) {
  const sortedRight = [...right].sort();
  return left.length === right.length && [...left].sort().every((id, index) => id === sortedRight[index]);
}

function approvalsFor(memberIds: string[], requesterId: string): Record<string, Approval> {
  if (!memberIds.includes(requesterId)) throw new Error('Only household members can request chore changes.');
  return Object.fromEntries(memberIds.map((id) => [id, id === requesterId ? 'approved' : 'pending']));
}

function createApprovedChore(board: HouseholdBoardData, input: ChoreRequest, title: string, now: Date): Chore {
  const choreId = `custom-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
  const chore: Chore = {
    id: choreId,
    householdId: input.householdId,
    title,
    points: input.points,
    assigneeIds: [...input.assigneeIds],
    dueAt: input.dueAt,
    dueIntervalDays: input.dueInDays,
    recurrence: input.recurrence,
    isPreApproved: true,
    seriesId: choreId,
  };
  board.chores.push(chore);
  const starter: ChoreStarter = { title, points: input.points, assigneeIds: [...input.assigneeIds], recurrence: input.recurrence, dueInDays: input.dueInDays };
  const index = board.choreStarters.findIndex((item) => item.title.toLowerCase() === title.toLowerCase());
  if (index >= 0) board.choreStarters[index] = starter;
  else board.choreStarters.push(starter);
  return chore;
}

export function createChoreService(storage: Storage = AsyncStorage, options: ServiceOptions = {}): ChoreService {
  const now = options.now ?? (() => new Date());
  let mutationQueue: Promise<unknown> = Promise.resolve();

  async function readState(): Promise<PersistedState> {
    const serialized = await storage.getItem(STORAGE_KEY);
    return serialized ? JSON.parse(serialized) as PersistedState : { households: {} };
  }

  async function mutate<T>(householdId: string, change: (board: HouseholdBoardData) => T | Promise<T>): Promise<T> {
    const operation = mutationQueue.then(async () => {
      const state = await readState();
      const board = state.households[householdId] ?? createHouseholdData(householdId);
      state.households[householdId] = board;
      const result = await change(board);
      await storage.setItem(STORAGE_KEY, JSON.stringify(state));
      return clone(result);
    });
    mutationQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  return {
    getBoard(householdId) {
      return mutate(householdId, (board) => {
        materializeRecurringChores(board, now());
        return board;
      });
    },

    setHouseholdMembers(householdId, memberIds) {
      return mutate(householdId, (board) => {
        if (memberIds.length > 0) {
          board.chores = board.chores.map((chore) => ({
            ...chore,
            assigneeIds: chore.assigneeIds.map((id) => {
              if (memberIds.includes(id)) return id;
              const priorIndex = DEMO_HOUSEHOLD_MEMBER_IDS.indexOf(id);
              return priorIndex < 0 ? id : memberIds[priorIndex % memberIds.length];
            }),
          }));
          board.choreStarters = board.choreStarters.map((starter) => ({
            ...starter,
            assigneeIds: starter.assigneeIds.map((id) => {
              if (memberIds.includes(id)) return id;
              const priorIndex = DEMO_HOUSEHOLD_MEMBER_IDS.indexOf(id);
              return priorIndex < 0 ? id : memberIds[priorIndex % memberIds.length];
            }),
          }));
        }
        board.memberIds = [...new Set(memberIds)];
        for (const pending of [...board.pendingChores, ...board.pendingTrustChanges]) {
          for (const memberId of board.memberIds) {
            pending.approvals[memberId] ??= memberId === pending.requestedById ? 'approved' : 'pending';
          }
        }
      });
    },

    requestChore(input) {
      return mutate(input.householdId, (board) => {
        const title = validateChore(input, now());
        const saved = input.starterTitle
          ? board.choreStarters.find((item) => item.title.toLowerCase() === input.starterTitle?.toLowerCase())
          : undefined;
        const usesSavedSettings = Boolean(saved)
          && saved?.title.toLowerCase() === title.toLowerCase()
          && saved.points === input.points
          && sameIds(saved.assigneeIds, input.assigneeIds)
          && saved.recurrence === input.recurrence
          && saved.dueInDays === input.dueInDays;
        const requiresApproval = board.trustLevel === 'open'
          ? false
          : board.trustLevel === 'points-and-new'
            ? !saved || saved.points !== input.points
            : !usesSavedSettings;
        if (!requiresApproval) return { status: 'created' as const, chore: createApprovedChore(board, input, title, now()) };
        const pending: PendingChore = {
          id: `pending-${now().getTime()}-${Math.random().toString(36).slice(2, 8)}`,
          householdId: input.householdId,
          title,
          points: input.points,
          assigneeIds: [...input.assigneeIds],
          dueAt: input.dueAt,
          dueInDays: input.dueInDays,
          recurrence: input.recurrence,
          requestedById: input.requestedById,
          approvals: approvalsFor(board.memberIds, input.requestedById),
        };
        if (board.memberIds.every((id) => pending.approvals[id] === 'approved')) {
          return { status: 'created' as const, chore: createApprovedChore(board, input, title, now()) };
        }
        board.pendingChores.push(pending);
        return { status: 'pending' as const, pending };
      });
    },

    voteOnChore({ householdId, pendingId, memberId, vote }) {
      return mutate(householdId, (board) => {
        const index = board.pendingChores.findIndex((item) => item.id === pendingId);
        if (index < 0) throw new Error('That request is no longer pending.');
        if (!board.memberIds.includes(memberId)) throw new Error('Only household members can vote on chore changes.');
        const pending = board.pendingChores[index];
        if (vote === 'rejected') {
          board.pendingChores.splice(index, 1);
          return null;
        }
        pending.approvals[memberId] = 'approved';
        if (!board.memberIds.every((id) => pending.approvals[id] === 'approved')) return null;
        board.pendingChores.splice(index, 1);
        return createApprovedChore(board, { ...pending, starterTitle: null }, pending.title, now());
      });
    },

    requestTrustLevelChange({ householdId, memberId, nextTrustLevel }) {
      return mutate(householdId, (board) => {
        if (nextTrustLevel === board.trustLevel) return;
        if (board.pendingTrustChanges.length > 0) throw new Error('A trust level change is already pending.');
        if (trustLevelStrictness[nextTrustLevel] > trustLevelStrictness[board.trustLevel]) {
          board.trustLevel = nextTrustLevel;
          return;
        }
        const pending: PendingTrustChange = {
          id: `pending-trust-${now().getTime()}`,
          householdId,
          nextTrustLevel,
          requestedById: memberId,
          approvals: approvalsFor(board.memberIds, memberId),
        };
        if (board.memberIds.every((id) => pending.approvals[id] === 'approved')) {
          board.trustLevel = nextTrustLevel;
          return;
        }
        board.pendingTrustChanges.push(pending);
      });
    },

    voteOnTrustLevelChange({ householdId, pendingId, memberId, vote }) {
      return mutate(householdId, (board) => {
        const index = board.pendingTrustChanges.findIndex((item) => item.id === pendingId);
        if (index < 0) throw new Error('That trust level request is no longer pending.');
        if (!board.memberIds.includes(memberId)) throw new Error('Only household members can vote on trust changes.');
        const pending = board.pendingTrustChanges[index];
        if (vote === 'rejected') {
          board.pendingTrustChanges.splice(index, 1);
          return;
        }
        pending.approvals[memberId] = 'approved';
        if (board.memberIds.every((id) => pending.approvals[id] === 'approved')) {
          board.trustLevel = pending.nextTrustLevel;
          board.pendingTrustChanges.splice(index, 1);
        }
      });
    },

    setCompletedRetentionDays(householdId, days) {
      return mutate(householdId, (board) => {
        if (![7, 14, 30].includes(days)) throw new Error('Choose a supported history window.');
        board.completedRetentionDays = days;
      });
    },

    removeChoreStarter(householdId, title) {
      return mutate(householdId, (board) => {
        board.choreStarters = board.choreStarters.filter((item) => item.title !== title);
      });
    },

    updateChorePoints({ householdId, choreId, points }) {
      return mutate(householdId, (board) => {
        if (!Number.isInteger(points) || points < 1 || points > 10) throw new Error('Choose between 1 and 10 effort points.');
        const existing = board.chores.find((chore) => chore.id === choreId);
        if (!existing) throw new Error('That chore is no longer available. Refresh and try again.');
        throw new Error('Published chores keep their effort points.');
      });
    },

    completeChore({ householdId, choreId, memberId }) {
      return mutate(householdId, (board) => {
        const chore = board.chores.find((candidate) => candidate.id === choreId);
        if (!chore) throw new Error('That chore is no longer available. Refresh and try again.');
        const existing = board.completions.find((completion) => completion.choreId === choreId);
        if (existing) return existing;
        const completion: Completion = { id: `completion-${choreId}`, choreId, memberId, pointsAwarded: chore.points, completedAt: now().toISOString() };
        board.completions.push(completion);
        return completion;
      });
    },
  };
}

export const choreService = createChoreService();
