/** Shared shapes for values that cross the screen/service boundary. */
export type ISODateString = string;
export type ISODateTimeString = string;
export type ChoreRecurrence = 'once' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
export type RepeatUnit = 'days' | 'weeks' | 'months';

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
  assigneeIds: string[];
  dueAt: string;
  recurrence: string;
  dueIntervalDays?: number | null;
  isPreApproved?: boolean;
  seriesId?: string;
  repeatEvery?: number | null;
  repeatUnit?: RepeatUnit | null;
  scheduledAt?: string;
  archivedAt?: string | null;
  version?: number;
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
  memberships?: Array<{
    householdId: string;
    memberId: string;
  }>;
}
