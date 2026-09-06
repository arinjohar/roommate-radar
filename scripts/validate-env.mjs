const source = process.env.EXPO_PUBLIC_DATA_SOURCE ?? 'local';

if (!['local', 'supabase'].includes(source)) {
  console.error('EXPO_PUBLIC_DATA_SOURCE must be either "local" or "supabase".');
  process.exitCode = 1;
} else if (source === 'supabase') {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Supabase mode requires EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
    process.exitCode = 1;
  } else {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') throw new Error('not HTTPS');
      console.log(`Environment is valid for Supabase project ${parsed.hostname}.`);
    } catch {
      console.error('EXPO_PUBLIC_SUPABASE_URL must be a valid HTTPS URL.');
      process.exitCode = 1;
    }
  }
} else {
  console.log('Environment is valid for the persistent local demo adapter.');
}
