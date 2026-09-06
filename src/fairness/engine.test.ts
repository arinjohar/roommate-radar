import {
  calculateFairnessScore,
  calculateMemberEffort,
  getFairnessStatus,
  getPulseInsight,
  suggestRebalance,
} from './engine';
import type { Chore, Completion, Member, PulseResponse } from '../types/domain';

function equal<T>(actual: T, expected: T, description: string) {
  if (actual !== expected) throw new Error(`${description}: expected ${String(expected)}, got ${String(actual)}`);
}

const members: Member[] = [
  { id: 'a', householdId: 'house', displayName: 'Ari', avatarColor: '#FFFFFF' },
  { id: 'b', householdId: 'house', displayName: 'Bea', avatarColor: '#000000' },
];
const completions: Completion[] = [
  { id: 'one', choreId: 'done', memberId: 'a', pointsAwarded: 8, completedAt: '2026-09-01T10:00:00.000Z' },
  { id: 'two', choreId: 'done-too', memberId: 'b', pointsAwarded: 2, completedAt: '2026-09-01T10:00:00.000Z' },
];
const chores: Chore[] = [
  { id: 'large', householdId: 'house', title: 'Bathroom', points: 6, assigneeIds: ['a'], dueAt: '2026-09-06T18:00:00.000Z', recurrence: 'weekly' },
  { id: 'small', householdId: 'house', title: 'Recycling', points: 2, assigneeIds: ['a'], dueAt: '2026-09-05T18:00:00.000Z', recurrence: 'weekly' },
];

const effort = calculateMemberEffort(members, completions);
equal(effort[0].actual, 8, 'sums a member’s completed effort');
equal(effort[1].expected, 5, 'splits expected effort equally');
equal(getFairnessStatus(effort), 'needs-nudge', 'flags effort outside the 20% band');
equal(calculateFairnessScore(effort), 40, 'scores average closeness to the equal share');
equal(suggestRebalance(effort, chores, completions)?.chore.id, 'small', 'chooses the smallest suitable upcoming chore');
const equalEffort = calculateMemberEffort(members, [
  { ...completions[0], pointsAwarded: 5 },
  { ...completions[1], pointsAwarded: 5 },
]);
equal(calculateFairnessScore(equalEffort), 100, 'scores an equal split at 100');
equal(suggestRebalance(equalEffort, chores, completions), null, 'does not suggest a swap when effort is balanced');

const boundaryEffort = calculateMemberEffort(members, [
  { ...completions[0], pointsAwarded: 6 },
  { ...completions[1], pointsAwarded: 4 },
]);
equal(calculateFairnessScore(boundaryEffort), 80, 'scores the 20% balance boundary at 80');
equal(getFairnessStatus(boundaryEffort), 'balanced', 'includes the exact 20% boundary in balance');
equal(calculateFairnessScore(calculateMemberEffort(members, [
  { ...completions[0], pointsAwarded: 10 },
])), 0, 'floors extreme imbalance at zero');
equal(calculateFairnessScore(calculateMemberEffort(members, [])), null, 'requires completed effort');
equal(calculateFairnessScore(calculateMemberEffort(members.slice(0, 1), completions.slice(0, 1))), null, 'requires at least two members');
equal(calculateFairnessScore([]), null, 'handles a missing roster');

const pulses: PulseResponse[] = [
  { id: 'pulse', householdId: 'house', memberId: 'a', weekStart: '2026-08-31', cleanliness: 4, noise: 2, communication: 3 },
];
equal(getPulseInsight(pulses)?.category, 'noise', 'uses the lowest aggregate pulse category');
