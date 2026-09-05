import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Completion, HouseholdSession, PulseResponse } from '../types/domain';
import type { RoommateRadarServices } from './contracts';
import { createDemoData, type DemoData } from './demoData';

const DATA_KEY = '@roommate-radar/demo-data/v1';
const SESSION_KEY = '@roommate-radar/session/v1';

type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export function createLocalServices(storage: Storage = AsyncStorage): RoommateRadarServices {
  async function readData(): Promise<DemoData> {
    const serialized = await storage.getItem(DATA_KEY);
    if (serialized) {
      const saved = JSON.parse(serialized) as DemoData;
      saved.completionRequestIds ??= {};
      return saved;
    }
    const seeded = createDemoData();
    await storage.setItem(DATA_KEY, JSON.stringify(seeded));
    return seeded;
  }

  async function writeData(data: DemoData): Promise<void> {
    await storage.setItem(DATA_KEY, JSON.stringify(data));
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
        const requestKey = `${session.memberId}:${idempotencyKey}`;
        const existingId = data.completionRequestIds[requestKey];
        const existing = data.completions.find((item) => item.id === existingId);
        if (existing) return existing;
        const completion: Completion = {
          id: makeId(),
          choreId,
          memberId: session.memberId,
          pointsAwarded: chore.points,
          completedAt: new Date().toISOString(),
        };
        data.completions.push(completion);
        data.completionRequestIds[requestKey] = completion.id;
        await writeData(data);
        return completion;
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
        await storage.removeItem(SESSION_KEY);
      },
    },
  };
}

async function loadSession(storage: Storage): Promise<HouseholdSession | null> {
  const serialized = await storage.getItem(SESSION_KEY);
  return serialized ? (JSON.parse(serialized) as HouseholdSession) : null;
}
