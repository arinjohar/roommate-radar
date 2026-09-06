import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Chore, Completion, HouseholdSession, PulseResponse } from '../types/domain';
import type {
  Approval,
  ChoreBoardSnapshot,
  ChoreRequest,
  ChoreStarter,
  PendingChore,
  PendingTrustChange,
  RoommateRadarServices,
  TrustLevel,
} from './contracts';
import { createDemoData, type DemoData } from './demoData';

const DATA_KEY = '@roommate-radar/demo-data/v1';
const SESSION_KEY = '@roommate-radar/session/v1';
const CHORE_BOARD_KEY = '@roommate-radar/chore-board/v3';

type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;
type ServiceOptions = { now?: () => Date };
type ChoreBoardSettings = Omit<ChoreBoardSnapshot, 'chores' | 'completions'>;
type ChoreBoardState = { households: Record<string, ChoreBoardSettings> };

const trustLevelStrictness: Record<TrustLevel, number> = {
  open: 0,
  'points-and-new': 1,
  'everything-except-date': 2,
};

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function defaultBoardSettings(): ChoreBoardSettings {
  return {
    choreStarters: [],
    trustLevel: 'everything-except-date',
    completedRetentionDays: 7,
    pendingChores: [],
    pendingTrustChanges: [],
  };
}

function recurrenceInterval(recurrence: string) {
  if (recurrence === 'weekly') return { count: 1, unit: 'weeks' as const };
  const match = recurrence.match(/^every (\d+) (day|week|month)s?$/i);
  return match
    ? { count: Number(match[1]), unit: `${match[2]}s` as 'days' | 'weeks' | 'months' }
    : null;
}

function addInterval(date: Date, count: number, unit: 'days' | 'weeks' | 'months') {
  const next = new Date(date);
  if (unit === 'days') next.setUTCDate(next.getUTCDate() + count);
  if (unit === 'weeks') next.setUTCDate(next.getUTCDate() + count * 7);
  if (unit === 'months') next.setUTCMonth(next.getUTCMonth() + count);
  return next;
}

function materializeRecurringChores(data: DemoData, householdId: string, now: Date) {
  const chores = data.chores.filter((chore) => chore.householdId === householdId);
  const completedIds = new Set(data.completions.map((completion) => completion.choreId));
  const seriesIds = [...new Set(chores.map((chore) => chore.seriesId ?? chore.id))];
  for (const seriesId of seriesIds) {
    const series = chores.filter((chore) => (chore.seriesId ?? chore.id) === seriesId);
    const latest = [...series].sort((a, b) => Date.parse(b.dueAt) - Date.parse(a.dueAt))[0];
    const interval = latest ? recurrenceInterval(latest.recurrence) : null;
    if (!latest || !interval || !completedIds.has(latest.id)) continue;
    const nextDue = addInterval(new Date(latest.dueAt), interval.count, interval.unit);
    if (nextDue > now) continue;
    data.chores.push({
      ...latest,
      id: `recurrence-${seriesId}-${nextDue.getTime()}`,
      dueAt: nextDue.toISOString(),
      seriesId,
      isPreApproved: true,
    });
  }
}

function validateChore(input: ChoreRequest, today: Date) {
  const normalizedTitle = input.title.trim();
  const dueDay = input.dueAt.slice(0, 10);
  const parsedDueDay = new Date(`${dueDay}T00:00:00.000Z`);
  const todayUtc = new Date(today);
  todayUtc.setUTCHours(0, 0, 0, 0);
  if (dueDay && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDay)
    || Number.isNaN(parsedDueDay.getTime())
    || parsedDueDay.toISOString().slice(0, 10) !== dueDay
    || parsedDueDay < todayUtc)) throw new Error('Invalid date.');
  if (!normalizedTitle) throw new Error('Give this chore a short, clear name.');
  if (!Number.isInteger(input.points) || input.points < 1 || input.points > 10) {
    throw new Error('Choose between 1 and 10 effort points.');
  }
  if (!Number.isInteger(input.dueInDays) && input.dueInDays !== null) {
    throw new Error('Invalid due interval.');
  }
  return normalizedTitle;
}

function sameIds(left: string[], right: string[]) {
  const sortedRight = [...right].sort();
  return left.length === right.length
    && [...left].sort().every((id, index) => id === sortedRight[index]);
}

function approvalsFor(memberIds: string[], requesterId: string): Record<string, Approval> {
  if (!memberIds.includes(requesterId)) {
    throw new Error('Only household members can request chore changes.');
  }
  return Object.fromEntries(
    memberIds.map((id) => [id, id === requesterId ? 'approved' : 'pending']),
  );
}

export function createLocalServices(
  storage: Storage = AsyncStorage,
  options: ServiceOptions = {},
): RoommateRadarServices {
  const now = options.now ?? (() => new Date());
  let mutationQueue: Promise<unknown> = Promise.resolve();
  async function readData(): Promise<DemoData> {
    const serialized = await storage.getItem(DATA_KEY);
    if (serialized) {
      const saved = JSON.parse(serialized) as DemoData;
      saved.completionRequestIds ??= {};
      saved.chores = saved.chores.map((chore) => {
        const legacy = chore as typeof chore & { assigneeId?: string | null };
        if (Array.isArray(chore.assigneeIds)) return chore;
        const { assigneeId, ...current } = legacy;
        return { ...current, assigneeIds: assigneeId ? [assigneeId] : [] };
      });
      return saved;
    }
    const seeded = createDemoData();
    await storage.setItem(DATA_KEY, JSON.stringify(seeded));
    return seeded;
  }

  async function writeData(data: DemoData): Promise<void> {
    await storage.setItem(DATA_KEY, JSON.stringify(data));
  }

  async function readBoardState(): Promise<ChoreBoardState> {
    const serialized = await storage.getItem(CHORE_BOARD_KEY);
    return serialized ? JSON.parse(serialized) as ChoreBoardState : { households: {} };
  }

  async function mutateBoard<T>(
    householdId: string,
    change: (
      data: DemoData,
      settings: ChoreBoardSettings,
      memberIds: string[],
    ) => T | Promise<T>,
  ): Promise<T> {
    const operation = mutationQueue.then(async () => {
      const [data, boardState] = await Promise.all([readData(), readBoardState()]);
      const settings = boardState.households[householdId] ?? defaultBoardSettings();
      boardState.households[householdId] = settings;
      const memberIds = data.members
        .filter((member) => member.householdId === householdId)
        .map((member) => member.id);
      const result = await change(data, settings, memberIds);
      await Promise.all([
        writeData(data),
        storage.setItem(CHORE_BOARD_KEY, JSON.stringify(boardState)),
      ]);
      return result;
    });
    mutationQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  function createApprovedChore(
    data: DemoData,
    settings: ChoreBoardSettings,
    input: ChoreRequest,
    title: string,
  ): Chore {
    const choreId = makeId();
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
    data.chores.push(chore);
    const starter: ChoreStarter = {
      title,
      points: input.points,
      assigneeIds: [...input.assigneeIds],
      recurrence: input.recurrence,
      dueInDays: input.dueInDays,
    };
    const index = settings.choreStarters.findIndex(
      (item) => item.title.toLowerCase() === title.toLowerCase(),
    );
    if (index >= 0) settings.choreStarters[index] = starter;
    else settings.choreStarters.push(starter);
    return chore;
  }

  function addCompletion(
    data: DemoData,
    chore: Chore,
    memberId: string,
    requestKey: string,
  ): Completion {
    const existingId = data.completionRequestIds[requestKey];
    const existing = data.completions.find((item) => item.id === existingId);
    if (existing) return existing;
    const completion: Completion = {
      id: makeId(),
      choreId: chore.id,
      memberId,
      pointsAwarded: chore.points,
      completedAt: now().toISOString(),
    };
    data.completions.push(completion);
    data.completionRequestIds[requestKey] = completion.id;
    return completion;
  }

  return {
    households: {
      async create(input) {
        const data = await readData();
        const household = {
          id: makeId(),
          name: input.householdName.trim(),
          inviteCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
          createdAt: new Date().toISOString(),
        };
        const member = {
          id: makeId(),
          householdId: household.id,
          displayName: input.displayName.trim(),
          avatarColor: input.avatarColor,
        };
        data.households.push(household);
        data.members.push(member);
        await writeData(data);
        return { household, member };
      },
      async join(input) {
        const data = await readData();
        const household = data.households.find(
          (item) => item.inviteCode === normalizeCode(input.inviteCode),
        );
        if (!household) throw new Error('That invite code was not found.');
        const member = {
          id: makeId(),
          householdId: household.id,
          displayName: input.displayName.trim(),
          avatarColor: input.avatarColor,
        };
        data.members.push(member);
        await writeData(data);
        return { household, member };
      },
      async get(householdId) {
        return (await readData()).households.find((item) => item.id === householdId) ?? null;
      },
      async listMembers(householdId) {
        return (await readData()).members.filter((item) => item.householdId === householdId);
      },
    },
    chores: {
      async list(householdId) {
        return (await readData()).chores
          .filter((item) => item.householdId === householdId)
          .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
      },
      async listCompletions(householdId, from, to) {
        const data = await readData();
        const choreIds = new Set(
          data.chores.filter((item) => item.householdId === householdId).map((item) => item.id),
        );
        return data.completions.filter(
          (item) => choreIds.has(item.choreId) && item.completedAt >= from && item.completedAt < to,
        );
      },
      async complete(choreId, idempotencyKey) {
        const data = await readData();
        const session = await loadSession(storage);
        const chore = data.chores.find((item) => item.id === choreId);
        if (!chore) throw new Error('That chore no longer exists.');
        if (!session || session.householdId !== chore.householdId) {
          throw new Error('Join this household before completing a chore.');
        }
        const completion = addCompletion(
          data,
          chore,
          session.memberId,
          `${session.memberId}:${idempotencyKey}`,
        );
        await writeData(data);
        return completion;
      },
      getBoard(householdId) {
        return mutateBoard(householdId, (data, settings) => {
          materializeRecurringChores(data, householdId, now());
          const choreIds = new Set(
            data.chores
              .filter((chore) => chore.householdId === householdId)
              .map((chore) => chore.id),
          );
          return {
            ...settings,
            chores: data.chores
              .filter((chore) => chore.householdId === householdId)
              .sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
            completions: data.completions.filter((completion) => choreIds.has(completion.choreId)),
          };
        });
      },
      requestChore(input) {
        return mutateBoard(input.householdId, (data, settings, memberIds) => {
          const title = validateChore(input, now());
          const saved = input.starterTitle
            ? settings.choreStarters.find(
              (item) => item.title.toLowerCase() === input.starterTitle?.toLowerCase(),
            )
            : undefined;
          const usesSavedSettings = Boolean(saved)
            && saved?.title.toLowerCase() === title.toLowerCase()
            && saved.points === input.points
            && sameIds(saved.assigneeIds, input.assigneeIds)
            && saved.recurrence === input.recurrence
            && saved.dueInDays === input.dueInDays;
          const requiresApproval = settings.trustLevel === 'open'
            ? false
            : settings.trustLevel === 'points-and-new'
              ? !saved || saved.points !== input.points
              : !usesSavedSettings;
          if (!requiresApproval) {
            return {
              status: 'created' as const,
              chore: createApprovedChore(data, settings, input, title),
            };
          }
          const pending: PendingChore = {
            id: `pending-${makeId()}`,
            householdId: input.householdId,
            title,
            points: input.points,
            assigneeIds: [...input.assigneeIds],
            dueAt: input.dueAt,
            dueInDays: input.dueInDays,
            recurrence: input.recurrence,
            requestedById: input.requestedById,
            approvals: approvalsFor(memberIds, input.requestedById),
          };
          if (memberIds.every((id) => pending.approvals[id] === 'approved')) {
            return {
              status: 'created' as const,
              chore: createApprovedChore(data, settings, input, title),
            };
          }
          settings.pendingChores.push(pending);
          return { status: 'pending' as const, pending };
        });
      },
      voteOnChore({ householdId, pendingId, memberId, vote }) {
        return mutateBoard(householdId, (data, settings, memberIds) => {
          const index = settings.pendingChores.findIndex((item) => item.id === pendingId);
          if (index < 0) throw new Error('That request is no longer pending.');
          if (!memberIds.includes(memberId)) {
            throw new Error('Only household members can vote on chore changes.');
          }
          const pending = settings.pendingChores[index];
          if (vote === 'rejected') {
            settings.pendingChores.splice(index, 1);
            return null;
          }
          pending.approvals[memberId] = 'approved';
          if (!memberIds.every((id) => pending.approvals[id] === 'approved')) return null;
          settings.pendingChores.splice(index, 1);
          return createApprovedChore(
            data,
            settings,
            { ...pending, starterTitle: null },
            pending.title,
          );
        });
      },
      requestTrustLevelChange({ householdId, memberId, nextTrustLevel }) {
        return mutateBoard(householdId, (_data, settings, memberIds) => {
          if (nextTrustLevel === settings.trustLevel) return;
          if (settings.pendingTrustChanges.length > 0) {
            throw new Error('A trust level change is already pending.');
          }
          if (trustLevelStrictness[nextTrustLevel] > trustLevelStrictness[settings.trustLevel]) {
            settings.trustLevel = nextTrustLevel;
            return;
          }
          const pending: PendingTrustChange = {
            id: `pending-trust-${makeId()}`,
            householdId,
            nextTrustLevel,
            requestedById: memberId,
            approvals: approvalsFor(memberIds, memberId),
          };
          if (memberIds.every((id) => pending.approvals[id] === 'approved')) {
            settings.trustLevel = nextTrustLevel;
            return;
          }
          settings.pendingTrustChanges.push(pending);
        });
      },
      voteOnTrustLevelChange({ householdId, pendingId, memberId, vote }) {
        return mutateBoard(householdId, (_data, settings, memberIds) => {
          const index = settings.pendingTrustChanges.findIndex((item) => item.id === pendingId);
          if (index < 0) throw new Error('That trust level request is no longer pending.');
          if (!memberIds.includes(memberId)) {
            throw new Error('Only household members can vote on trust changes.');
          }
          const pending = settings.pendingTrustChanges[index];
          if (vote === 'rejected') {
            settings.pendingTrustChanges.splice(index, 1);
            return;
          }
          pending.approvals[memberId] = 'approved';
          if (memberIds.every((id) => pending.approvals[id] === 'approved')) {
            settings.trustLevel = pending.nextTrustLevel;
            settings.pendingTrustChanges.splice(index, 1);
          }
        });
      },
      setCompletedRetentionDays(householdId, days) {
        return mutateBoard(householdId, (_data, settings) => {
          if (![7, 14, 30].includes(days)) {
            throw new Error('Choose a supported history window.');
          }
          settings.completedRetentionDays = days;
        });
      },
      removeChoreStarter(householdId, title) {
        return mutateBoard(householdId, (_data, settings) => {
          settings.choreStarters = settings.choreStarters.filter(
            (item) => item.title !== title,
          );
        });
      },
      updateChorePoints({ householdId, choreId, points }) {
        return mutateBoard(householdId, (data) => {
          if (!Number.isInteger(points) || points < 1 || points > 10) {
            throw new Error('Choose between 1 and 10 effort points.');
          }
          const existing = data.chores.find(
            (chore) => chore.householdId === householdId && chore.id === choreId,
          );
          if (!existing) {
            throw new Error('That chore is no longer available. Refresh and try again.');
          }
          throw new Error('Published chores keep their effort points.');
        });
      },
      completeChore({ householdId, choreId, memberId }) {
        return mutateBoard(householdId, (data, _settings, memberIds) => {
          const chore = data.chores.find(
            (candidate) => candidate.householdId === householdId && candidate.id === choreId,
          );
          if (!chore) {
            throw new Error('That chore is no longer available. Refresh and try again.');
          }
          if (!memberIds.includes(memberId)) {
            throw new Error('Join this household before completing a chore.');
          }
          return addCompletion(data, chore, memberId, `${memberId}:${choreId}`);
        });
      },
    },
    pulse: {
      async list(householdId, weekStart) {
        return (await readData()).pulseResponses.filter(
          (item) => item.householdId === householdId && item.weekStart === weekStart,
        );
      },
      async submit(householdId, weekStart, scores) {
        const data = await readData();
        const session = await loadSession(storage);
        if (!session || session.householdId !== householdId) {
          throw new Error('Join this household before sharing a pulse.');
        }
        if (Object.values(scores).some((score) => !Number.isInteger(score) || score < 1 || score > 5)) {
          throw new Error('Pulse scores must be whole numbers between 1 and 5.');
        }
        const priorIndex = data.pulseResponses.findIndex(
          (item) => item.memberId === session.memberId && item.weekStart === weekStart,
        );
        const response: PulseResponse = {
          id: priorIndex >= 0 ? data.pulseResponses[priorIndex].id : makeId(),
          householdId,
          memberId: session.memberId,
          weekStart,
          ...scores,
        };
        if (priorIndex >= 0) data.pulseResponses[priorIndex] = response;
        else data.pulseResponses.push(response);
        await writeData(data);
        return response;
      },
    },
    session: {
      load: () => loadSession(storage),
      async save(session) {
        await storage.setItem(SESSION_KEY, JSON.stringify(session));
      },
      async clear() {
        await storage.removeItem(SESSION_KEY);
      },
    },
    demo: {
      async reset() {
        await writeData(createDemoData());
        await Promise.all([
          storage.removeItem(SESSION_KEY),
          storage.removeItem(CHORE_BOARD_KEY),
        ]);
      },
    },
  };
}

async function loadSession(storage: Storage): Promise<HouseholdSession | null> {
  const serialized = await storage.getItem(SESSION_KEY);
  return serialized ? (JSON.parse(serialized) as HouseholdSession) : null;
}
