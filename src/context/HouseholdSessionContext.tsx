import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

import { householdService, type CreateHouseholdInput, type HouseholdSession, type JoinHouseholdInput } from '../services/householdService';

type HouseholdSessionContextValue = {
  session: HouseholdSession | null;
  createHousehold: (input: CreateHouseholdInput) => Promise<void>;
  joinHousehold: (input: JoinHouseholdInput) => Promise<void>;
  clearSession: () => void;
};

const HouseholdSessionContext = createContext<HouseholdSessionContextValue | null>(null);

export function HouseholdSessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<HouseholdSession | null>(null);

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
    },
  }), [session]);

  return <HouseholdSessionContext.Provider value={value}>{children}</HouseholdSessionContext.Provider>;
}

export function useHouseholdSession() {
  const context = useContext(HouseholdSessionContext);
  if (!context) throw new Error('useHouseholdSession must be used inside HouseholdSessionProvider');
  return context;
}
