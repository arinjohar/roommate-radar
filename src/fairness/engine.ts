import type { Chore, Completion, Member, PulseCategory, PulseResponse } from '../types/domain';

export type MemberEffort = Member & {
  actual: number;
  expected: number;
  gap: number;
};

export type FairnessStatus = 'balanced' | 'needs-nudge';

export type RebalanceSuggestion = {
  member: MemberEffort;
  chore: Chore;
};

export type PulseInsight = {
  category: PulseCategory;
  average: number;
  message: string;
};

const PULSE_LABELS: Record<PulseCategory, string> = {
  cleanliness: 'cleanliness',
  noise: 'shared quiet',
  communication: 'communication',
};

export function calculateMemberEffort(members: Member[], completions: Completion[]): MemberEffort[] {
  const total = completions.reduce((sum, completion) => sum + completion.pointsAwarded, 0);
  const expected = members.length === 0 ? 0 : total / members.length;

  return members.map((member) => {
    const actual = completions
      .filter((completion) => completion.memberId === member.id)
      .reduce((sum, completion) => sum + completion.pointsAwarded, 0);

    return { ...member, actual, expected, gap: actual - expected };
  });
}

export function getFairnessStatus(effort: MemberEffort[]): FairnessStatus {
  if (effort.length === 0 || effort[0].expected === 0) return 'balanced';

  return effort.every(({ gap, expected }) => Math.abs(gap) <= expected * 0.2)
    ? 'balanced'
    : 'needs-nudge';
}

export function calculateFairnessScore(effort: MemberEffort[]): number | null {
  if (effort.length < 2 || effort[0].expected <= 0) return null;

  const totalCloseness = effort.reduce((sum, member) => {
    const distanceFromShare = Math.abs(member.gap) / member.expected;
    return sum + Math.max(0, 1 - distanceFromShare);
  }, 0);

  return Math.round((totalCloseness / effort.length) * 100);
}

export function suggestRebalance(
  effort: MemberEffort[],
  chores: Chore[],
  completions: Completion[],
): RebalanceSuggestion | null {
  if (effort.length === 0) return null;

  const lowest = [...effort].sort((a, b) => a.gap - b.gap || a.id.localeCompare(b.id))[0];
  if (lowest.gap >= -lowest.expected * 0.2) return null;
  const completeChoreIds = new Set(completions.map((completion) => completion.choreId));
  const upcoming = chores.filter((chore) => !completeChoreIds.has(chore.id));
  const largestChore = Math.max(...chores.map((chore) => chore.points), 0);
  const suitable = upcoming
    .filter((chore) => chore.points > 0 && lowest.actual + chore.points <= lowest.expected + largestChore)
    .sort((a, b) => a.points - b.points || a.dueAt.localeCompare(b.dueAt) || a.id.localeCompare(b.id))[0];

  return suitable ? { member: lowest, chore: suitable } : null;
}

export function getPulseInsight(responses: PulseResponse[]): PulseInsight | null {
  if (responses.length === 0) return null;

  const categories: PulseCategory[] = ['cleanliness', 'noise', 'communication'];
  const averages = categories.map((category) => ({
    category,
    average: responses.reduce((sum, response) => sum + response[category], 0) / responses.length,
  }));
  const lowest = averages.sort((a, b) => a.average - b.average || a.category.localeCompare(b.category))[0];
  const label = PULSE_LABELS[lowest.category];

  return {
    ...lowest,
    message: `The check-ins point to ${label} as a gentle place to focus this week. A small, specific conversation could help everyone feel more at ease.`,
  };
}
