import type { Chore, Completion } from '../types/domain';
import { DEMO_HOUSEHOLD_ID } from './demoData';
import { services } from './index';

export type ChoreService = {
  getWeeklyChores: (householdId: string) => Promise<Chore[]>;
  getCompletions: (householdId: string) => Promise<Completion[]>;
  completeChore: (input: {
    choreId: string;
    householdId: string;
    memberId: string;
  }) => Promise<Completion>;
};

export { DEMO_HOUSEHOLD_ID };
export const DEMO_MEMBER_ID = '20000000-0000-4000-8000-000000000001';

function weekBounds() {
  const start = new Date();
  const day = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() - ((day + 6) % 7));
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { from: start.toISOString(), to: end.toISOString() };
}

export const choreService: ChoreService = {
  getWeeklyChores: (householdId) => services.chores.list(householdId),
  async getCompletions(householdId) {
    const { from, to } = weekBounds();
    return services.chores.listCompletions(householdId, from, to);
  },
  completeChore({ choreId, memberId }) {
    return services.chores.complete(choreId, `${memberId}:${choreId}`);
  },
};
