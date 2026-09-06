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
import { initialRecurringDueDate, nextDueDate, parseSchedule, type ChoreScope } from './choreSchedule';
import { createDemoData, type DemoData } from './demoData';
import { validateDisplayName, validateHouseholdName } from './householdValidation';

const DATA_KEY = '@roommate-radar/demo-data/v1';
const SESSION_KEY = '@roommate-radar/session/v1';
const CHORE_BOARD_KEY = '@roommate-radar/chore-board/v3';

type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;
type ServiceOptions = { now?: () => Date };
type ChoreBoardSettings = Omit<ChoreBoardSnapshot, 'chores' | 'completions'> & { seriesTemplates?: Record<string, Chore> };
type ChoreBoardState = { households: Record<string, ChoreBoardSettings> };

const trustLevelStrictness: Record<TrustLevel, number> = {
  open: 0,
  'points-and-new': 1,
  'everything-except-date': 2,
};

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

async function rememberMembership(
  storage: Storage,
  membership: { household: { id: string }; member: { id: string } },
) {
  const saved = await loadSession(storage);
  const memberships = [
    ...(saved?.memberships ?? (saved ? [{ householdId: saved.householdId, memberId: saved.memberId }] : [])),
    { householdId: membership.household.id, memberId: membership.member.id },
  ].filter((value, index, values) => values.findIndex((candidate) => candidate.householdId === value.householdId) === index);
  await storage.setItem(SESSION_KEY, JSON.stringify({
    guestId: saved?.guestId ?? membership.member.id,
    householdId: membership.household.id,
    memberId: membership.member.id,
    memberships,
  }));
}

function recurrenceInterval(recurrence: string) {
  const schedule = parseSchedule(recurrence);
  return schedule.repeatEvery && schedule.repeatUnit ? { count: schedule.repeatEvery, unit: schedule.repeatUnit } : null;
}

function materializeRecurringChores(data: DemoData, householdId: string, settings: ChoreBoardSettings, now: Date) {
  const completedIds = new Set(data.completions.map((completion) => completion.choreId));
  const seriesIds = [...new Set(data.chores.filter((chore) => chore.householdId === householdId).map((chore) => chore.seriesId ?? chore.id))];
  for (const seriesId of seriesIds) {
    const series = data.chores.filter((chore) => (chore.seriesId ?? chore.id) === seriesId);
    const latest = series[series.length - 1];
    const template = settings.seriesTemplates?.[seriesId] ?? latest;
    const interval = template ? recurrenceInterval(template.recurrence) : null;
    if (!latest || !interval || template.archivedAt || (!latest.archivedAt && !completedIds.has(latest.id)) || !latest.dueAt) continue;
    const nextDue = new Date(nextDueDate(latest.scheduledAt ?? latest.dueAt, interval.count, interval.unit));
    if (nextDue > now) continue;
    data.chores.push({ ...template, archivedAt: null, version: 1, id: `recurrence-${seriesId}-${nextDue.getTime()}`, dueAt: nextDue.toISOString(), scheduledAt: nextDue.toISOString(), seriesId, isPreApproved: true });
  }
}

function validateChore(input: ChoreRequest, today: Date, originalDueAt?: string) {
  const normalizedTitle = input.title.trim();
  const dueDay = input.dueAt.slice(0, 10);
  if (input.dueAt && Number.isNaN(Date.parse(input.dueAt))) throw new Error('Invalid date.');
  const parsedDueDay = new Date(`${dueDay}T00:00:00.000Z`);
  const todayUtc = new Date(today);
  todayUtc.setUTCHours(0, 0, 0, 0);
  if (dueDay && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDay) || Number.isNaN(parsedDueDay.getTime()) || parsedDueDay.toISOString().slice(0, 10) !== dueDay || (parsedDueDay < todayUtc && dueDay !== originalDueAt?.slice(0, 10)))) throw new Error('Invalid date.');
  if (!normalizedTitle || normalizedTitle.length > 120) throw new Error('Give this chore a name between 1 and 120 characters.');
  parseSchedule(input.recurrence);
  if (!Number.isInteger(input.points) || input.points < 1 || input.points > 10) throw new Error('Choose between 1 and 10 effort points.');
  if (!Number.isInteger(input.dueInDays) && input.dueInDays !== null) throw new Error('Invalid due interval.');
  return normalizedTitle;
}

function normalizeChoreInput<T extends ChoreRequest>(input: T, currentTime: Date): T {
  const schedule = parseSchedule(input.recurrence);
  if (!schedule.repeatEvery || input.dueAt) return input;
  const dueAt = initialRecurringDueDate(input.recurrence, currentTime);
  const due = new Date(dueAt);
  const start = new Date(Date.UTC(currentTime.getUTCFullYear(), currentTime.getUTCMonth(), currentTime.getUTCDate()));
  const dueInDays = Math.round((Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate()) - start.getTime()) / 86_400_000);
  return { ...input, dueAt, dueInDays };
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
      saved.households = saved.households.map((household) => ({
        ...household,
        creatorMemberId: household.creatorMemberId
          || saved.members.find((member) => member.householdId === household.id)?.id
          || '',
      }));
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
      version: 1,
      scheduledAt: input.dueAt,
      ...parseSchedule(input.recurrence),
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
    const existing = data.completions.find((item) => item.choreId === chore.id || item.id === existingId);
    if (existing) return existing;
    if (chore.archivedAt) throw new Error('That chore was deleted.');
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

  function requestChange(data: DemoData, settings: ChoreBoardSettings, memberIds: string[], input: ChoreRequest & { choreId: string; scope: ChoreScope; expectedVersion: number }, action: 'edit' | 'archive') {
    const normalizedInput = action === 'edit' ? normalizeChoreInput(input, now()) : input;
    const chore = data.chores.find((item) => item.id === normalizedInput.choreId && item.householdId === normalizedInput.householdId);
    if (!chore || chore.archivedAt) throw new Error('That chore is no longer active.');
    if (data.completions.some((item) => item.choreId === chore.id)) throw new Error('Completed chores keep their history.');
    if ((chore.version ?? 1) !== normalizedInput.expectedVersion) throw new Error('This chore changed. Refresh before editing.');
    if (settings.pendingChores.some((item) => item.choreId === chore.id)) throw new Error('A change for this chore is already pending.');
    const approvals = approvalsFor(memberIds, normalizedInput.requestedById);
    if (normalizedInput.assigneeIds.some((id) => !memberIds.includes(id))) throw new Error('Choose roommates from this household.');
    const title = action === 'edit' ? validateChore(normalizedInput, now(), chore.dueAt) : chore.title;
    if (action === 'edit' && normalizedInput.scope === 'occurrence' && JSON.stringify(parseSchedule(normalizedInput.recurrence)) !== JSON.stringify(parseSchedule(chore.recurrence))) throw new Error('Choose This and future to change the repeat schedule.');
    const pending: PendingChore = { ...normalizedInput, title, action, id: `change-${now().getTime()}-${Math.random()}`, approvals };
    const needsApproval = settings.trustLevel === 'everything-except-date' || (settings.trustLevel === 'points-and-new' && normalizedInput.points !== chore.points);
    if (needsApproval && !memberIds.every((id) => approvals[id] === 'approved')) settings.pendingChores.push(pending);
    else applyChange(data, settings, pending);
  }

  function applyChange(data: DemoData, settings: ChoreBoardSettings, input: PendingChore) {
    const chore = data.chores.find((item) => item.id === input.choreId && item.householdId === input.householdId);
    if (!chore || chore.archivedAt || (chore.version ?? 1) !== input.expectedVersion || data.completions.some((item) => item.choreId === chore.id)) throw new Error('This chore changed. Reject this request and refresh.');
    const seriesId = chore.seriesId ?? chore.id;
    settings.seriesTemplates ??= {};
    settings.seriesTemplates[seriesId] ??= clone(chore);
    chore.scheduledAt ??= chore.dueAt;
    if (input.action === 'archive') chore.archivedAt = now().toISOString();
    else {
      Object.assign(chore, { title: input.title, points: input.points, assigneeIds: [...input.assigneeIds], dueAt: input.dueAt, recurrence: input.recurrence, dueIntervalDays: input.dueInDays, ...parseSchedule(input.recurrence) });
      const starter = { title: input.title, points: input.points, assigneeIds: [...input.assigneeIds], recurrence: input.recurrence, dueInDays: input.dueInDays };
      settings.choreStarters = [...settings.choreStarters.filter((item) => item.title.toLowerCase() !== input.title.toLowerCase()), starter];
    }
    chore.version = (chore.version ?? 1) + 1;
    if (input.scope === 'future') { chore.scheduledAt = chore.dueAt; settings.seriesTemplates[seriesId] = clone(chore); }
  }

  return {
    households: {
      async create(input) {
        const data = await readData();
        const householdName = validateHouseholdName(input.householdName);
        const displayName = validateDisplayName(input.displayName);
        const householdId = makeId();
        const memberId = makeId();
        const household = {
          id: householdId,
          name: householdName,
          inviteCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
          creatorMemberId: memberId,
          createdAt: new Date().toISOString(),
        };
        const member = {
          id: memberId,
          householdId: household.id,
          displayName,
          avatarColor: input.avatarColor,
        };
        data.households.push(household);
        data.members.push(member);
        await Promise.all([writeData(data), rememberMembership(storage, { household, member })]);
        return { household, member };
      },
      async join(input) {
        const data = await readData();
        const displayName = validateDisplayName(input.displayName);
        const household = data.households.find(
          (item) => item.inviteCode === normalizeCode(input.inviteCode),
        );
        if (!household) throw new Error('That invite code was not found.');
        const member = {
          id: makeId(),
          householdId: household.id,
          displayName,
          avatarColor: input.avatarColor,
        };
        data.members.push(member);
        await Promise.all([writeData(data), rememberMembership(storage, { household, member })]);
        return { household, member };
      },
      async listMemberships() {
        const [data, session] = await Promise.all([readData(), loadSession(storage)]);
        if (!session) return [];
        const savedMemberships = session.memberships ?? [{
          householdId: session.householdId,
          memberId: session.memberId,
        }];
        return savedMemberships.flatMap(({ householdId, memberId }) => {
          const household = data.households.find((item) => item.id === householdId);
          const member = data.members.find((item) => item.id === memberId && item.householdId === householdId);
          return household && member ? [{ household, member }] : [];
        });
      },
      async get(householdId) {
        return (await readData()).households.find((item) => item.id === householdId) ?? null;
      },
      async listMembers(householdId) {
        return (await readData()).members.filter((item) => item.householdId === householdId);
      },
      async leave(householdId, memberId) {
        const data = await readData();
        const household = data.households.find((item) => item.id === householdId);
        if (!household || !data.members.some((item) => item.id === memberId && item.householdId === householdId)) {
          throw new Error('Household membership not found.');
        }
        if (household.creatorMemberId === memberId) {
          throw new Error('Transfer ownership or delete the household before leaving.');
        }
        data.members = data.members.filter((item) => item.id !== memberId);
        data.pulseResponses = data.pulseResponses.filter((item) => item.memberId !== memberId);
        data.completions = data.completions.filter((item) => item.memberId !== memberId);
        data.chores = data.chores.map((chore) => chore.householdId === householdId
          ? { ...chore, assigneeIds: chore.assigneeIds.filter((id) => id !== memberId) }
          : chore);
        await writeData(data);
      },
      async delete(householdId, memberId) {
        const data = await readData();
        const household = data.households.find((item) => item.id === householdId);
        if (!household || household.creatorMemberId !== memberId) {
          throw new Error('Only the household creator can delete this household.');
        }
        const choreIds = new Set(data.chores.filter((item) => item.householdId === householdId).map((item) => item.id));
        data.households = data.households.filter((item) => item.id !== householdId);
        data.members = data.members.filter((item) => item.householdId !== householdId);
        data.chores = data.chores.filter((item) => item.householdId !== householdId);
        data.completions = data.completions.filter((item) => !choreIds.has(item.choreId));
        data.pulseResponses = data.pulseResponses.filter((item) => item.householdId !== householdId);
        const boardState = await readBoardState();
        delete boardState.households[householdId];
        await Promise.all([
          writeData(data),
          storage.setItem(CHORE_BOARD_KEY, JSON.stringify(boardState)),
        ]);
      },
      async transferOwnershipAndLeave(householdId, memberId, newOwnerMemberId) {
        const data = await readData();
        const household = data.households.find((item) => item.id === householdId);
        if (!household || household.creatorMemberId !== memberId) {
          throw new Error('Only the household creator can transfer ownership.');
        }
        if (newOwnerMemberId === memberId || !data.members.some((item) => item.id === newOwnerMemberId && item.householdId === householdId)) {
          throw new Error('Choose one other current household member.');
        }
        household.creatorMemberId = newOwnerMemberId;
        data.members = data.members.filter((item) => item.id !== memberId);
        data.pulseResponses = data.pulseResponses.filter((item) => item.memberId !== memberId);
        data.completions = data.completions.filter((item) => item.memberId !== memberId);
        data.chores = data.chores.map((chore) => chore.householdId === householdId
          ? { ...chore, assigneeIds: chore.assigneeIds.filter((id) => id !== memberId) }
          : chore);
        await writeData(data);
      },
    },
    chores: {
      async requestEdit(input) {
        await mutateBoard(input.householdId, (data, settings, memberIds) => requestChange(data, settings, memberIds, input, 'edit'));
      },
      async requestArchive(input) {
        await mutateBoard(input.householdId, (data, settings, memberIds) => {
          const chore = data.chores.find((item) => item.id === input.choreId && item.householdId === input.householdId);
          if (!chore) throw new Error('Chore not found.');
          requestChange(data, settings, memberIds, { ...chore, dueInDays: chore.dueIntervalDays ?? null, starterTitle: null, ...input }, 'archive');
        });
      },
      async listMemberPoints(householdId) {
        const data = await readData();
        return data.members.filter((member) => member.householdId === householdId).map((member) => ({ memberId: member.id, totalPoints: data.completions.filter((item) => item.memberId === member.id).reduce((sum, item) => sum + item.pointsAwarded, 0) }));
      },
      async list(householdId) {
        return (await readData()).chores
          .filter((item) => item.householdId === householdId && !item.archivedAt)
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
        const session = await loadSession(storage);
        if (!session) throw new Error('Join this household before completing a chore.');
        if (!idempotencyKey.trim()) throw new Error('Idempotency key required.');
        return mutateBoard(session.householdId, (data, _settings, memberIds) => {
          const chore = data.chores.find((item) => item.id === choreId && item.householdId === session.householdId);
          if (!chore || !memberIds.includes(session.memberId)) throw new Error('Chore not found.');
          return addCompletion(data, chore, session.memberId, `${session.memberId}:${idempotencyKey}`);
        });
      },
      getBoard(householdId) {
        return mutateBoard(householdId, (data, settings) => {
          materializeRecurringChores(data, householdId, settings, now());
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
          const normalizedInput = normalizeChoreInput(input, now());
          approvalsFor(memberIds, normalizedInput.requestedById);
          if (normalizedInput.assigneeIds.some((id) => !memberIds.includes(id))) throw new Error('Choose roommates from this household.');
          const title = validateChore(normalizedInput, now());
          const saved = normalizedInput.starterTitle
            ? settings.choreStarters.find(
              (item) => item.title.toLowerCase() === normalizedInput.starterTitle?.toLowerCase(),
            )
            : undefined;
          const usesSavedSettings = Boolean(saved)
            && saved?.title.toLowerCase() === title.toLowerCase()
            && saved.points === normalizedInput.points
            && sameIds(saved.assigneeIds, normalizedInput.assigneeIds)
            && saved.recurrence === normalizedInput.recurrence
            && saved.dueInDays === normalizedInput.dueInDays;
          const requiresApproval = settings.trustLevel === 'open'
            ? false
            : settings.trustLevel === 'points-and-new'
              ? !saved || saved.title.toLowerCase() !== title.toLowerCase() || saved.points !== input.points
              : !usesSavedSettings;
          if (!requiresApproval) {
            return {
              status: 'created' as const,
              chore: createApprovedChore(data, settings, normalizedInput, title),
            };
          }
          const pending: PendingChore = {
            id: `pending-${makeId()}`,
            householdId: normalizedInput.householdId,
            title,
            points: normalizedInput.points,
            assigneeIds: [...normalizedInput.assigneeIds],
            dueAt: normalizedInput.dueAt,
            dueInDays: normalizedInput.dueInDays,
            recurrence: normalizedInput.recurrence,
            requestedById: normalizedInput.requestedById,
            approvals: approvalsFor(memberIds, input.requestedById),
          };
          if (memberIds.every((id) => pending.approvals[id] === 'approved')) {
            return {
              status: 'created' as const,
              chore: createApprovedChore(data, settings, normalizedInput, title),
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
          if (pending.action && pending.action !== 'create') {
            applyChange(data, settings, pending);
            return null;
          }
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
          approvalsFor(memberIds, memberId);
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
