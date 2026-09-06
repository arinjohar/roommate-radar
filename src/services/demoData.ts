import type { Chore, Completion, Household, Member, PulseResponse } from '../types/domain';

export interface DemoData {
  households: Household[];
  members: Member[];
  chores: Chore[];
  completions: Completion[];
  completionRequestIds: Record<string, string>;
  pulseResponses: PulseResponse[];
}

export const DEMO_HOUSEHOLD_ID = '10000000-0000-4000-8000-000000000001';
export const DEMO_INVITE_CODE = 'RADAR4';

const household: Household = {
  id: DEMO_HOUSEHOLD_ID,
  name: 'Shared Home',
  inviteCode: DEMO_INVITE_CODE,
  createdAt: '2026-09-01T16:00:00.000Z',
};

const members: Member[] = [
  ['20000000-0000-4000-8000-000000000001', 'Jamie', '#F36F56'],
  ['20000000-0000-4000-8000-000000000002', 'Sam', '#9ED9C5'],
  ['20000000-0000-4000-8000-000000000003', 'Alex', '#F4C95D'],
  ['20000000-0000-4000-8000-000000000004', 'Riley', '#A8B7E8'],
].map(([id, displayName, avatarColor]) => ({
  id,
  householdId: DEMO_HOUSEHOLD_ID,
  displayName,
  avatarColor,
}));

const choreRows: Array<[string, string, number, number, string]> = [
  ['30000000-0000-4000-8000-000000000001', 'Clean bathroom', 6, 1, '2026-09-07T18:00:00.000Z'],
  ['30000000-0000-4000-8000-000000000002', 'Take out recycling', 2, 2, '2026-09-07T19:00:00.000Z'],
  ['30000000-0000-4000-8000-000000000003', 'Vacuum common room', 4, 3, '2026-09-08T18:00:00.000Z'],
  ['30000000-0000-4000-8000-000000000004', 'Wipe kitchen counters', 3, 4, '2026-09-08T20:00:00.000Z'],
  ['30000000-0000-4000-8000-000000000005', 'Unload dishwasher', 2, 1, '2026-09-09T17:00:00.000Z'],
  ['30000000-0000-4000-8000-000000000006', 'Mop kitchen floor', 5, 2, '2026-09-10T18:00:00.000Z'],
  ['30000000-0000-4000-8000-000000000007', 'Water houseplants', 1, 3, '2026-09-11T17:00:00.000Z'],
  ['30000000-0000-4000-8000-000000000008', 'Clean fridge shelf', 4, 4, '2026-09-12T19:00:00.000Z'],
];

const chores: Chore[] = choreRows.map(([id, title, points, memberNumber, dueAt]) => ({
  id,
  householdId: DEMO_HOUSEHOLD_ID,
  title,
  points,
  assigneeIds: [members[memberNumber - 1].id],
  dueAt,
  recurrence: 'weekly',
}));

const completions: Completion[] = [
  ['40000000-0000-4000-8000-000000000001', 0, 0, 6, '2026-09-01T19:00:00.000Z'],
  ['40000000-0000-4000-8000-000000000002', 2, 0, 4, '2026-09-02T18:30:00.000Z'],
  ['40000000-0000-4000-8000-000000000003', 4, 0, 2, '2026-09-03T17:15:00.000Z'],
  ['40000000-0000-4000-8000-000000000004', 1, 1, 2, '2026-09-03T20:00:00.000Z'],
  ['40000000-0000-4000-8000-000000000005', 6, 2, 1, '2026-09-04T17:00:00.000Z'],
].map(([id, choreIndex, memberIndex, pointsAwarded, completedAt]) => ({
  id: String(id),
  choreId: chores[Number(choreIndex)].id,
  memberId: members[Number(memberIndex)].id,
  pointsAwarded: Number(pointsAwarded),
  completedAt: String(completedAt),
}));

export function createDemoData(): DemoData {
  return JSON.parse(JSON.stringify({
    households: [household],
    members,
    chores,
    completions,
    completionRequestIds: {},
    pulseResponses: [] as PulseResponse[],
  })) as DemoData;
}
