import AsyncStorage from '@react-native-async-storage/async-storage';

import { createLocalServices } from './local';
import {
  createAnonymousSupabaseSession,
  createSupabaseServices,
  refreshSupabaseSession,
  type SupabaseAuthSession,
} from './supabase';

export type { RoommateRadarServices } from './contracts';
export * from './contracts';
export { createLocalServices } from './local';
export {
  createAnonymousSupabaseSession,
  createSupabaseServices,
  refreshSupabaseSession,
} from './supabase';

export type DataSource = 'local' | 'supabase';

export interface ServiceConfiguration {
  dataSource?: DataSource;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  getAccessToken?: () => Promise<string | null>;
}

const localServices = createLocalServices();
const AUTH_KEY = '@roommate-radar/supabase-auth/v1';

export function createServices(configuration: ServiceConfiguration = {}) {
  const dataSource = configuration.dataSource
    ?? (process.env.EXPO_PUBLIC_DATA_SOURCE as DataSource | undefined)
    ?? 'local';

  if (dataSource === 'local') return localServices;

  const url = configuration.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = configuration.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'Supabase mode requires EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  return createSupabaseServices({
    url,
    anonKey,
    getAccessToken: configuration.getAccessToken ?? createStoredAccessTokenProvider(url, anonKey),
    session: localServices.session,
  });
}

export const services = createServices();

function createStoredAccessTokenProvider(url: string, anonKey: string) {
  return async (): Promise<string> => {
    const serialized = await AsyncStorage.getItem(AUTH_KEY);
    let session = serialized ? JSON.parse(serialized) as SupabaseAuthSession : null;
    if (!session) {
      session = await createAnonymousSupabaseSession(url, anonKey);
    } else if (session.expiresAt <= Math.floor(Date.now() / 1000) + 60) {
      session = await refreshSupabaseSession(url, anonKey, session.refreshToken);
    }
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(session));
    return session.accessToken;
  };
}
