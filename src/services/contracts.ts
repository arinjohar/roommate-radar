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

export interface HouseholdService {
  create(input: CreateHouseholdInput): Promise<HouseholdMembership>;
  join(input: JoinHouseholdInput): Promise<HouseholdMembership>;
  get(householdId: string): Promise<Household | null>;
  listMembers(householdId: string): Promise<Member[]>;
}

export interface ChoreService {
  list(householdId: string): Promise<Chore[]>;
  listCompletions(householdId: string, from: string, to: string): Promise<Completion[]>;
  complete(choreId: string, idempotencyKey: string): Promise<Completion>;
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
