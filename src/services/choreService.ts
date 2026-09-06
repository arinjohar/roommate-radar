import type { Chore, Completion } from '../types/domain';

export type ChoreService = {
  getWeeklyChores: (householdId: string) => Promise<Chore[]>;
  getCompletions: (householdId: string) => Promise<Completion[]>;
  createChore: (input: {
    householdId: string;
    title: string;
    points: number;
    assigneeId: string;
    dueAt: string;
    recurrence: string;
  }) => Promise<Chore>;
  updateChorePoints: (input: {
    choreId: string;
    householdId: string;
    points: number;
  }) => Promise<Chore>;
  completeChore: (input: {
    choreId: string;
    householdId: string;
    memberId: string;
  }) => Promise<Completion>;
};

export const DEMO_HOUSEHOLD_ID = 'maple-house';
export const DEMO_MEMBER_ID = 'alex';

// Dates are deliberately deterministic so this fixture is safe for demos and tests.
const seededChores: Chore[] = [
  { id: 'bathroom', householdId: DEMO_HOUSEHOLD_ID, title: 'Clean bathroom', points: 6, assigneeId: 'jamie', dueAt: '2026-09-07T18:00:00.000Z', recurrence: 'weekly', isPreApproved: true },
  { id: 'kitchen', householdId: DEMO_HOUSEHOLD_ID, title: 'Wipe down the kitchen', points: 3, assigneeId: 'sam', dueAt: '2026-09-06T18:00:00.000Z', recurrence: 'weekly', isPreApproved: true },
  { id: 'recycling', householdId: DEMO_HOUSEHOLD_ID, title: 'Take out recycling', points: 2, assigneeId: 'alex', dueAt: '2026-09-05T18:00:00.000Z', recurrence: 'weekly', isPreApproved: true },
  { id: 'floors', householdId: DEMO_HOUSEHOLD_ID, title: 'Vacuum shared spaces', points: 5, assigneeId: 'morgan', dueAt: '2026-09-08T18:00:00.000Z', recurrence: 'weekly', isPreApproved: true },
  { id: 'groceries', householdId: DEMO_HOUSEHOLD_ID, title: 'Restock house basics', points: 4, assigneeId: 'jamie', dueAt: '2026-09-09T18:00:00.000Z', recurrence: 'weekly', isPreApproved: true },
  { id: 'plants', householdId: DEMO_HOUSEHOLD_ID, title: 'Water the plants', points: 1, assigneeId: 'sam', dueAt: '2026-09-04T18:00:00.000Z', recurrence: 'weekly', isPreApproved: true },
  { id: 'overdue-demo', householdId: DEMO_HOUSEHOLD_ID, title: 'Return library books', points: 2, assigneeId: 'alex', dueAt: '2026-09-03T18:00:00.000Z', recurrence: 'one time', isPreApproved: true },
  { id: 'entryway', householdId: DEMO_HOUSEHOLD_ID, title: 'Tidy the entryway', points: 2, assigneeId: 'alex', dueAt: '2026-09-10T18:00:00.000Z', recurrence: 'weekly', isPreApproved: true },
  { id: 'laundry', householdId: DEMO_HOUSEHOLD_ID, title: 'Wash shared towels', points: 4, assigneeId: 'morgan', dueAt: '2026-09-11T18:00:00.000Z', recurrence: 'weekly', isPreApproved: true },
];

let completions: Completion[] = [];
let chores: Chore[] = seededChores.map((chore) => ({ ...chore }));

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

function materializeRecurringChores() {
  const now = new Date();
  const seriesIds = [...new Set(chores.map((chore) => chore.seriesId ?? chore.id))];
  seriesIds.forEach((seriesId) => {
    const series = chores.filter((chore) => (chore.seriesId ?? chore.id) === seriesId);
    const latest = [...series].sort((a, b) => Date.parse(b.dueAt) - Date.parse(a.dueAt))[0];
    const interval = latest ? recurrenceInterval(latest.recurrence) : null;
    if (!latest || !interval) return;
    let nextDue = addInterval(new Date(latest.dueAt), interval.count, interval.unit);
    while (nextDue <= now) {
      const occurrence: Chore = { ...latest, id: `recurrence-${seriesId}-${nextDue.getTime()}`, dueAt: nextDue.toISOString(), seriesId };
      chores = [...chores, occurrence];
      nextDue = addInterval(nextDue, interval.count, interval.unit);
    }
  });
}

export const choreService: ChoreService = {
  async getWeeklyChores(householdId) {
    materializeRecurringChores();
    return chores.filter((chore) => chore.householdId === householdId).map((chore) => ({ ...chore }));
  },

  async getCompletions(householdId) {
    const householdChoreIds = new Set(
      chores.filter((chore) => chore.householdId === householdId).map((chore) => chore.id),
    );
    return completions.filter((completion) => householdChoreIds.has(completion.choreId));
  },

  async createChore({ householdId, title, points, assigneeId, dueAt, recurrence }) {
    const normalizedTitle = title.trim();
    const dueDay = dueAt.slice(0, 10);
    const parsedDueDay = new Date(`${dueDay}T00:00:00.000Z`);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (dueDay && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDay) || Number.isNaN(parsedDueDay.getTime()) || parsedDueDay.toISOString().slice(0, 10) !== dueDay)) {
      throw new Error('Invalid date.');
    }
    if (dueDay && parsedDueDay < today) throw new Error('Invalid date.');
    if (!normalizedTitle) throw new Error('Give this chore a short, clear name.');
    if (!Number.isInteger(points) || points < 1 || points > 10) {
      throw new Error('Choose between 1 and 10 effort points.');
    }

    const choreId = `custom-${Date.now()}`;
    const chore: Chore = {
      id: choreId,
      householdId,
      title: normalizedTitle,
      points,
      assigneeId,
      dueAt,
      recurrence,
      isPreApproved: false,
      seriesId: choreId,
    };
    chores = [...chores, chore];
    return chore;
  },

  async updateChorePoints({ choreId, householdId, points }) {
    if (!Number.isInteger(points) || points < 1 || points > 10) {
      throw new Error('Choose between 1 and 10 effort points.');
    }
    const existing = chores.find((chore) => chore.id === choreId && chore.householdId === householdId);
    if (!existing) throw new Error('That chore is no longer available. Refresh and try again.');

    throw new Error('Published chores keep their effort points.');
  },


  async completeChore({ choreId, householdId, memberId }) {
    const chore = chores.find(
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
