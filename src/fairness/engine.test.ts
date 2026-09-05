import { calculateMemberEffort, getFairnessStatus, getPulseInsight, suggestRebalance } from './engine';
import type { Chore, Completion, Member, PulseResponse } from '../types/domain';

function equal<T>(actual: T, expected: T, description: string) {
  if (actual !== expected) throw new Error(`${description}: expected ${String(expected)}, got ${String(actual)}`);
}

const members: Member[] = [
  { id: 'a', householdId: 'house', displayName: 'Ari', avatarColor: '#fff' },
  { id: 'b', householdId: 'house', displayName: 'Bea', avatarColor: '#000' },
];
const completions: Completion[] = [
  { id: 'one', choreId: 'done', memberId: 'a', pointsAwarded: 8, completedAt: '2026-09-01T10:00:00.000Z' },
  { id: 'two', choreId: 'done-too', memberId: 'b', pointsAwarded: 2, completedAt: '2026-09-01T10:00:00.000Z' },
];
const chores: Chore[] = [
  { id: 'large', householdId: 'house', title: 'Bathroom', points: 6, assigneeId: 'a', dueAt: '2026-09-06T18:00:00.000Z', recurrence: 'weekly' },
  { id: 'small', householdId: 'house', title: 'Recycling', points: 2, assigneeId: 'a', dueAt: '2026-09-05T18:00:00.000Z', recurrence: 'weekly' },
];

const effort = calculateMemberEffort(members, completions);
equal(effort[0].actual, 8, 'sums a member’s completed effort');
equal(effort[1].expected, 5, 'splits expected effort equally');
equal(getFairnessStatus(effort), 'needs-nudge', 'flags effort outside the 20% band');
equal(suggestRebalance(effort, chores, completions)?.chore.id, 'small', 'chooses the smallest suitable upcoming chore');
equal(suggestRebalance(calculateMemberEffort(members, [
  { ...completions[0], pointsAwarded: 5 },
  { ...completions[1], pointsAwarded: 5 },
]), chores, completions), null, 'does not suggest a swap when effort is balanced');

const pulses: PulseResponse[] = [
  { id: 'pulse', householdId: 'house', memberId: 'a', weekStart: '2026-08-31', cleanliness: 4, noise: 2, communication: 3 },
];
equal(getPulseInsight(pulses)?.category, 'noise', 'uses the lowest aggregate pulse category');
