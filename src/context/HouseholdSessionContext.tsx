import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { householdService, type CreateHouseholdInput, type HouseholdSession, type JoinHouseholdInput } from '../services/householdService';

type HouseholdSessionContextValue = {
  session: HouseholdSession | null;
  createHousehold: (input: CreateHouseholdInput) => Promise<void>;
  joinHousehold: (input: JoinHouseholdInput) => Promise<void>;
  clearSession: () => void;
  leaveHousehold: () => Promise<void>;
  deleteHousehold: () => Promise<void>;
  transferOwnershipAndLeave: (newOwnerMemberId: string) => Promise<void>;
};

const HouseholdSessionContext = createContext<HouseholdSessionContextValue | null>(null);

export function HouseholdSessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<HouseholdSession | null>(null);

  useEffect(() => {
    let active = true;
    householdService.loadSession()
      .then((saved) => { if (active) setSession(saved); })
      .catch(() => { if (active) setSession(null); });
    return () => { active = false; };
  }, []);

  const value = useMemo(() => ({
    session,
    async createHousehold(input: CreateHouseholdInput) {
      setSession(await householdService.createHousehold(input));
    },
    async joinHousehold(input: JoinHouseholdInput) {
      setSession(await householdService.joinHousehold(input));
    },
    clearSession() {
      setSession(null);
      void householdService.clearSession();
    },
    async leaveHousehold() {
      if (!session) return;
      await householdService.leaveHousehold(session.household.id, session.member.id);
      setSession(null);
    },
    async deleteHousehold() {
      if (!session) return;
      await householdService.deleteHousehold(session.household.id, session.member.id);
      setSession(null);
    },
    async transferOwnershipAndLeave(newOwnerMemberId: string) {
      if (!session) return;
      await householdService.transferOwnershipAndLeave(session.household.id, session.member.id, newOwnerMemberId);
      setSession(null);
    },
  }), [session]);

  return <HouseholdSessionContext.Provider value={value}>{children}</HouseholdSessionContext.Provider>;
}

export function useHouseholdSession() {
  const context = useContext(HouseholdSessionContext);
  if (!context) throw new Error('useHouseholdSession must be used inside HouseholdSessionProvider');
  return context;
}
