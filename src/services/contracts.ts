import type {
  Chore,
  Completion,
  Household,
  HouseholdSession,
  ISODateString,
  Member,
  PulseResponse,
  PulseScores,
} from '../types/domain';

export interface CreateHouseholdInput {
  householdName: string;
  displayName: string;
  avatarColor: string;
}

export interface JoinHouseholdInput {
  inviteCode: string;
  displayName: string;
  avatarColor: string;
}

export interface HouseholdMembership {
  household: Household;
  member: Member;
}

export type TrustLevel = 'open' | 'points-and-new' | 'everything-except-date';
export type Approval = 'pending' | 'approved';

export interface ChoreStarter {
  title: string;
  points: number;
  assigneeIds: string[];
  recurrence: string;
  dueInDays: number | null;
}

export interface PendingChore extends ChoreStarter {
  action?: 'create' | 'edit' | 'archive';
  choreId?: string;
  scope?: import('./choreSchedule').ChoreScope;
  expectedVersion?: number;
  id: string;
  householdId: string;
  dueAt: string;
  requestedById: string;
  approvals: Record<string, Approval>;
}

export interface PendingTrustChange {
  id: string;
  householdId: string;
  nextTrustLevel: TrustLevel;
  requestedById: string;
  approvals: Record<string, Approval>;
}

export interface ChoreBoardSnapshot {
  chores: Chore[];
  completions: Completion[];
  choreStarters: ChoreStarter[];
  trustLevel: TrustLevel;
  completedRetentionDays: number;
  pendingChores: PendingChore[];
  pendingTrustChanges: PendingTrustChange[];
}

export interface ChoreRequest extends ChoreStarter {
  householdId: string;
  requestedById: string;
  dueAt: string;
  starterTitle: string | null;
}

export interface HouseholdService {
  create(input: CreateHouseholdInput): Promise<HouseholdMembership>;
  join(input: JoinHouseholdInput): Promise<HouseholdMembership>;
  listMemberships(): Promise<HouseholdMembership[]>;
  get(householdId: string): Promise<Household | null>;
  listMembers(householdId: string): Promise<Member[]>;
  leave(householdId: string, memberId: string): Promise<void>;
  delete(householdId: string, memberId: string): Promise<void>;
  transferOwnershipAndLeave(householdId: string, memberId: string, newOwnerMemberId: string): Promise<void>;
}

export interface ChoreService {
  requestEdit(input: ChoreRequest & { choreId: string; scope: import('./choreSchedule').ChoreScope; expectedVersion: number }): Promise<void>;
  requestArchive(input: { householdId: string; choreId: string; requestedById: string; scope: import('./choreSchedule').ChoreScope; expectedVersion: number }): Promise<void>;
  listMemberPoints(householdId: string): Promise<{ memberId: string; totalPoints: number }[]>;
  list(householdId: string): Promise<Chore[]>;
  listCompletions(householdId: string, from: string, to: string): Promise<Completion[]>;
  complete(choreId: string, idempotencyKey: string): Promise<Completion>;
  getBoard(householdId: string): Promise<ChoreBoardSnapshot>;
  requestChore(input: ChoreRequest): Promise<
    { status: 'created'; chore: Chore } | { status: 'pending'; pending: PendingChore }
  >;
  voteOnChore(input: {
    householdId: string;
    pendingId: string;
    memberId: string;
    vote: 'approved' | 'rejected';
  }): Promise<Chore | null>;
  requestTrustLevelChange(input: {
    householdId: string;
    memberId: string;
    nextTrustLevel: TrustLevel;
  }): Promise<void>;
  voteOnTrustLevelChange(input: {
    householdId: string;
    pendingId: string;
    memberId: string;
    vote: 'approved' | 'rejected';
  }): Promise<void>;
  setCompletedRetentionDays(householdId: string, days: number): Promise<void>;
  removeChoreStarter(householdId: string, title: string): Promise<void>;
  updateChorePoints(input: {
    choreId: string;
    householdId: string;
    points: number;
  }): Promise<Chore>;
  completeChore(input: {
    choreId: string;
    householdId: string;
    memberId: string;
  }): Promise<Completion>;
  undoCompletion(input: {
    choreId: string;
    householdId: string;
    memberId: string;
  }): Promise<void>;
}

export interface PulseService {
  list(householdId: string, weekStart: ISODateString): Promise<PulseResponse[]>;
  submit(
    householdId: string,
    weekStart: ISODateString,
    scores: PulseScores,
  ): Promise<PulseResponse>;
}

export interface SessionService {
  load(): Promise<HouseholdSession | null>;
  save(session: HouseholdSession): Promise<void>;
  clear(): Promise<void>;
}

export interface DemoService {
  reset(): Promise<void>;
}

export interface RoommateRadarServices {
  households: HouseholdService;
  chores: ChoreService;
  pulse: PulseService;
  session: SessionService;
  demo: DemoService;
}
