/** Shared shapes for values that cross the screen/service boundary. */
export type ISODateString = string;
export type ISODateTimeString = string;
export type ChoreRecurrence = 'once' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: ISODateTimeString;
}

export interface Member {
  id: string;
  householdId: string;
  displayName: string;
  avatarColor: string;
}

export type Chore = {
  id: string;
  householdId: string;
  title: string;
  points: number;
  assigneeId: string | null;
  dueAt: string;
  recurrence: string;
  isPreApproved?: boolean;
  seriesId?: string;
};

export type Completion = {
  id: string;
  choreId: string;
  memberId: string;
  pointsAwarded: number;
  completedAt: string;
};

export interface PulseScores {
  cleanliness: number;
  noise: number;
  communication: number;
}

export interface PulseResponse extends PulseScores {
  id: string;
  householdId: string;
  memberId: string;
  weekStart: ISODateString;
}

export type PulseCategory = keyof PulseScores;

export interface HouseholdSession {
  guestId: string;
  householdId: string;
  memberId: string;
}
