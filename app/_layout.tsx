import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { HouseholdSessionProvider } from '../src/context/HouseholdSessionContext';

export default function RootLayout() {
  return <HouseholdSessionProvider>
    <StatusBar style="dark" />
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="home" />
    </Stack>
  </HouseholdSessionProvider>;
}
