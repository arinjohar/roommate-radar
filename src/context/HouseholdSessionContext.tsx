import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { householdService, type CreateHouseholdInput, type HouseholdSession, type JoinHouseholdInput } from '../services/householdService';
import type { HouseholdMembership } from '../services/contracts';

type HouseholdSessionContextValue = {
  session: HouseholdSession | null;
  createHousehold: (input: CreateHouseholdInput) => Promise<void>;
  joinHousehold: (input: JoinHouseholdInput) => Promise<void>;
  memberships: HouseholdMembership[];
  selectMembership: (membership: HouseholdMembership) => Promise<void>;
  clearSession: () => void;
  leaveHousehold: () => Promise<void>;
  deleteHousehold: () => Promise<void>;
  transferOwnershipAndLeave: (newOwnerMemberId: string) => Promise<void>;
};

const HouseholdSessionContext = createContext<HouseholdSessionContextValue | null>(null);

function includeMembership(current: HouseholdMembership[], next: HouseholdMembership) {
  return [
    ...current.filter((membership) => membership.household.id !== next.household.id),
    next,
  ];
}

export function HouseholdSessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<HouseholdSession | null>(null);
  const [memberships, setMemberships] = useState<HouseholdMembership[]>([]);

  useEffect(() => {
    let active = true;
    householdService.loadSession()
      .then(async (saved) => {
        if (!active) return;
        setSession(saved);
        setMemberships(saved ? await householdService.listMemberships() : []);
      })
      .catch(() => { if (active) { setSession(null); setMemberships([]); } });
    return () => { active = false; };
  }, []);

  const value = useMemo(() => ({
    session,
    memberships,
    async createHousehold(input: CreateHouseholdInput) {
      const next = await householdService.createHousehold(input);
      setSession(next);
      setMemberships((current) => includeMembership(current, next));
      void householdService.listMemberships().then(setMemberships).catch(() => undefined);
    },
    async joinHousehold(input: JoinHouseholdInput) {
      const next = await householdService.joinHousehold(input);
      setSession(next);
      setMemberships((current) => includeMembership(current, next));
      void householdService.listMemberships().then(setMemberships).catch(() => undefined);
    },
    async selectMembership(membership: HouseholdMembership) {
      setSession(await householdService.selectMembership(membership));
    },
    clearSession() {
      setSession(null);
      setMemberships([]);
      void householdService.clearSession();
    },
    async leaveHousehold() {
      if (!session) return;
      const departedHouseholdId = session.household.id;
      const next = await householdService.leaveHousehold(departedHouseholdId, session.member.id, memberships);
      setSession(next);
      setMemberships(next ? includeMembership(memberships.filter((membership) => membership.household.id !== departedHouseholdId), next) : []);
      void householdService.listMemberships().then(setMemberships).catch(() => undefined);
    },
    async deleteHousehold() {
      if (!session) return;
      const departedHouseholdId = session.household.id;
      const next = await householdService.deleteHousehold(departedHouseholdId, session.member.id, memberships);
      setSession(next);
      setMemberships(next ? includeMembership(memberships.filter((membership) => membership.household.id !== departedHouseholdId), next) : []);
      void householdService.listMemberships().then(setMemberships).catch(() => undefined);
    },
    async transferOwnershipAndLeave(newOwnerMemberId: string) {
      if (!session) return;
      const departedHouseholdId = session.household.id;
      const next = await householdService.transferOwnershipAndLeave(departedHouseholdId, session.member.id, newOwnerMemberId, memberships);
      setSession(next);
      setMemberships(next ? includeMembership(memberships.filter((membership) => membership.household.id !== departedHouseholdId), next) : []);
      void householdService.listMemberships().then(setMemberships).catch(() => undefined);
    },
  }), [memberships, session]);

  return <HouseholdSessionContext.Provider value={value}>{children}</HouseholdSessionContext.Provider>;
}

export function useHouseholdSession() {
  const context = useContext(HouseholdSessionContext);
  if (!context) throw new Error('useHouseholdSession must be used inside HouseholdSessionProvider');
  return context;
}
