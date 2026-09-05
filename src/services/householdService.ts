import type { Household, Member } from '../types/domain';

export type HouseholdSession = {
  household: Household;
  member: Member;
};

export type CreateHouseholdInput = {
  householdName: string;
  displayName: string;
};

export type JoinHouseholdInput = {
  inviteCode: string;
  displayName: string;
};

export interface HouseholdService {
  createHousehold(input: CreateHouseholdInput): Promise<HouseholdSession>;
  joinHousehold(input: JoinHouseholdInput): Promise<HouseholdSession>;
}

const avatarColors = ['#F36F56', '#9ED9C5', '#F4C95D'];

const compactId = () => Math.random().toString(36).slice(2, 10);

const makeSession = (householdName: string, displayName: string, inviteCode: string): HouseholdSession => {
  const householdId = `household-${compactId()}`;

  return {
    household: {
      id: householdId,
      name: householdName,
      inviteCode,
      createdAt: new Date().toISOString(),
    },
    member: {
      id: `member-${compactId()}`,
      householdId,
      displayName,
      avatarColor: avatarColors[displayName.length % avatarColors.length],
    },
  };
};

/**
 * Deliberately small boundary for the future persistence adapter. Screens only
 * depend on this interface, so a Supabase-backed implementation can replace it.
 */
export const householdService: HouseholdService = {
  async createHousehold({ householdName, displayName }) {
    return makeSession(householdName, displayName, `HOME-${compactId().slice(0, 4).toUpperCase()}`);
  },
  async joinHousehold({ inviteCode, displayName }) {
    return makeSession('Your shared home', displayName, inviteCode.trim().toUpperCase());
  },
};
