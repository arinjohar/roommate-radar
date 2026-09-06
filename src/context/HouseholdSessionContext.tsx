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
};

const HouseholdSessionContext = createContext<HouseholdSessionContextValue | null>(null);

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
      setMemberships(await householdService.listMemberships());
    },
    async joinHousehold(input: JoinHouseholdInput) {
      const next = await householdService.joinHousehold(input);
      setSession(next);
      setMemberships(await householdService.listMemberships());
    },
    async selectMembership(membership: HouseholdMembership) {
      setSession(await householdService.selectMembership(membership));
    },
    clearSession() {
      setSession(null);
      setMemberships([]);
      void householdService.clearSession();
    },
  }), [memberships, session]);

  return <HouseholdSessionContext.Provider value={value}>{children}</HouseholdSessionContext.Provider>;
}

export function useHouseholdSession() {
  const context = useContext(HouseholdSessionContext);
  if (!context) throw new Error('useHouseholdSession must be used inside HouseholdSessionProvider');
  return context;
}
