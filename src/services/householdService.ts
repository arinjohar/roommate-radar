import type { HouseholdMembership } from './contracts';
import { services } from './index';

export type HouseholdSession = HouseholdMembership;

export type CreateHouseholdInput = {
  householdName: string;
  displayName: string;
};

export type JoinHouseholdInput = {
  inviteCode: string;
  displayName: string;
};

const avatarColors = ['#F36F56', '#9ED9C5', '#F4C95D'];

function avatarColorFor(displayName: string) {
  return avatarColors[displayName.trim().length % avatarColors.length];
}

async function persistMembership(membership: HouseholdMembership) {
  await services.session.save({
    guestId: membership.member.id,
    householdId: membership.household.id,
    memberId: membership.member.id,
  });
  return membership;
}

export const householdService = {
  async createHousehold(input: CreateHouseholdInput): Promise<HouseholdSession> {
    const membership = await services.households.create({
      ...input,
      avatarColor: avatarColorFor(input.displayName),
    });
    return persistMembership(membership);
  },

  async joinHousehold(input: JoinHouseholdInput): Promise<HouseholdSession> {
    const membership = await services.households.join({
      ...input,
      avatarColor: avatarColorFor(input.displayName),
    });
    return persistMembership(membership);
  },

  async loadSession(): Promise<HouseholdSession | null> {
    const saved = await services.session.load();
    if (!saved) return null;
    const [household, members] = await Promise.all([
      services.households.get(saved.householdId),
      services.households.listMembers(saved.householdId),
    ]);
    const member = members.find((candidate) => candidate.id === saved.memberId);
    if (!household || !member) {
      await services.session.clear();
      return null;
    }
    return { household, member };
  },

  clearSession: () => services.session.clear(),

  async leaveHousehold(householdId: string, memberId: string) {
    await services.households.leave(householdId, memberId);
    await services.session.clear();
  },

  async deleteHousehold(householdId: string, memberId: string) {
    await services.households.delete(householdId, memberId);
    await services.session.clear();
  },

  async transferOwnershipAndLeave(householdId: string, memberId: string, newOwnerMemberId: string) {
    await services.households.transferOwnershipAndLeave(householdId, memberId, newOwnerMemberId);
    await services.session.clear();
  },
};
