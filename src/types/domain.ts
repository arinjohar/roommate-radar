export type Household = {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
};

export type Member = {
  id: string;
  householdId: string;
  displayName: string;
  avatarColor: string;
};

export type Chore = {
  id: string;
  householdId: string;
  title: string;
  points: number;
  assigneeId: string;
  dueAt: string;
  recurrence: string;
};

export type Completion = {
  id: string;
  choreId: string;
  memberId: string;
  pointsAwarded: number;
  completedAt: string;
};

export type PulseResponse = {
  id: string;
  householdId: string;
  memberId: string;
  weekStart: string;
  cleanliness: number;
  noise: number;
  communication: number;
};

export type PulseCategory = 'cleanliness' | 'noise' | 'communication';
