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
  const saved = await services.session.load();
  const memberships = [
    ...(saved?.memberships ?? (saved ? [{ householdId: saved.householdId, memberId: saved.memberId }] : [])),
    { householdId: membership.household.id, memberId: membership.member.id },
  ].filter((value, index, values) => values.findIndex((candidate) => candidate.householdId === value.householdId) === index);
  await services.session.save({
    guestId: saved?.guestId ?? membership.member.id,
    householdId: membership.household.id,
    memberId: membership.member.id,
    memberships,
  });
  return membership;
}

async function membershipsForSavedSession() {
  const saved = await services.session.load();
  if (!saved) return [];
  const memberships = await services.households.listMemberships();
  if (memberships.length > 0) return memberships;
  return [];
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
    const memberships = await membershipsForSavedSession();
    const active = memberships.find((membership) => (
      membership.household.id === saved.householdId && membership.member.id === saved.memberId
    )) ?? memberships[0];
    if (!active) {
      await services.session.clear();
      return null;
    }
    await services.session.save({
      ...saved,
      householdId: active.household.id,
      memberId: active.member.id,
      memberships: memberships.map((membership) => ({
        householdId: membership.household.id,
        memberId: membership.member.id,
      })),
    });
    return active;
  },

  async listMemberships(): Promise<HouseholdMembership[]> {
    return membershipsForSavedSession();
  },

  async selectMembership(membership: HouseholdMembership): Promise<HouseholdSession> {
    const saved = await services.session.load();
    if (!saved) throw new Error('Choose a household after signing in.');
    const memberships = await membershipsForSavedSession();
    if (!memberships.some((candidate) => candidate.member.id === membership.member.id && candidate.household.id === membership.household.id)) {
      throw new Error('That household is no longer available.');
    }
    await services.session.save({
      ...saved,
      householdId: membership.household.id,
      memberId: membership.member.id,
      memberships: memberships.map((candidate) => ({ householdId: candidate.household.id, memberId: candidate.member.id })),
    });
    return membership;
  },

  clearSession: () => services.session.clear(),
};
