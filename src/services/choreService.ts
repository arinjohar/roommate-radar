import type { Chore, Completion } from '../types/domain';

export type ChoreService = {
  getWeeklyChores: (householdId: string) => Promise<Chore[]>;
  getCompletions: (householdId: string) => Promise<Completion[]>;
  completeChore: (input: {
    choreId: string;
    householdId: string;
    memberId: string;
  }) => Promise<Completion>;
};

export const DEMO_HOUSEHOLD_ID = 'maple-house';
export const DEMO_MEMBER_ID = 'jamie';

// Dates are deliberately deterministic so this fixture is safe for demos and tests.
const seededChores: Chore[] = [
  { id: 'bathroom', householdId: DEMO_HOUSEHOLD_ID, title: 'Clean bathroom', points: 6, assigneeId: 'jamie', dueAt: '2026-09-07T18:00:00.000Z', recurrence: 'weekly' },
  { id: 'kitchen', householdId: DEMO_HOUSEHOLD_ID, title: 'Wipe down the kitchen', points: 3, assigneeId: 'sam', dueAt: '2026-09-06T18:00:00.000Z', recurrence: 'weekly' },
  { id: 'recycling', householdId: DEMO_HOUSEHOLD_ID, title: 'Take out recycling', points: 2, assigneeId: 'alex', dueAt: '2026-09-05T18:00:00.000Z', recurrence: 'weekly' },
  { id: 'floors', householdId: DEMO_HOUSEHOLD_ID, title: 'Vacuum shared spaces', points: 5, assigneeId: 'morgan', dueAt: '2026-09-08T18:00:00.000Z', recurrence: 'weekly' },
  { id: 'groceries', householdId: DEMO_HOUSEHOLD_ID, title: 'Restock house basics', points: 4, assigneeId: 'jamie', dueAt: '2026-09-09T18:00:00.000Z', recurrence: 'weekly' },
  { id: 'plants', householdId: DEMO_HOUSEHOLD_ID, title: 'Water the plants', points: 1, assigneeId: 'sam', dueAt: '2026-09-04T18:00:00.000Z', recurrence: 'weekly' },
  { id: 'entryway', householdId: DEMO_HOUSEHOLD_ID, title: 'Tidy the entryway', points: 2, assigneeId: 'alex', dueAt: '2026-09-10T18:00:00.000Z', recurrence: 'weekly' },
  { id: 'laundry', householdId: DEMO_HOUSEHOLD_ID, title: 'Wash shared towels', points: 4, assigneeId: 'morgan', dueAt: '2026-09-11T18:00:00.000Z', recurrence: 'weekly' },
];

let completions: Completion[] = [];

export const choreService: ChoreService = {
  async getWeeklyChores(householdId) {
    return seededChores.filter((chore) => chore.householdId === householdId);
  },

  async getCompletions(householdId) {
    const householdChoreIds = new Set(
      seededChores.filter((chore) => chore.householdId === householdId).map((chore) => chore.id),
    );
    return completions.filter((completion) => householdChoreIds.has(completion.choreId));
  },

  async completeChore({ choreId, householdId, memberId }) {
    const chore = seededChores.find(
      (candidate) => candidate.id === choreId && candidate.householdId === householdId,
    );
    if (!chore) throw new Error('That chore is no longer available. Refresh and try again.');

    const existing = completions.find((completion) => completion.choreId === choreId);
    if (existing) return existing;

    const completion: Completion = {
      id: `completion-${choreId}`,
      choreId,
      memberId,
      pointsAwarded: chore.points,
      completedAt: new Date().toISOString(),
    };
    completions = [...completions, completion];
    return completion;
  },
};
