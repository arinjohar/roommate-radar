import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AppHeader } from '../../src/components/AppHeader';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { useHouseholdSession } from '../../src/context/HouseholdSessionContext';
import { colors, spacing } from '../../src/theme/tokens';

export default function CreateHouseholdScreen() {
  const router = useRouter();
  const { createHousehold } = useHouseholdSession();
  const [householdName, setHouseholdName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const householdError = submitted && !householdName.trim() ? 'Give your home a name so everyone recognizes it.' : undefined;
  const nameError = submitted && !displayName.trim() ? 'Add the name your roommates know you by.' : undefined;

  const handleCreate = async () => {
    setSubmitted(true);
    if (!householdName.trim() || !displayName.trim()) {
      setSubmitError(null);
      return;
    }
    setLoading(true);
    setSubmitError(null);
    try {
      await createHousehold({ householdName: householdName.trim(), displayName: displayName.trim() });
      router.replace('/home');
    } catch {
      setSubmitError('We couldn’t create your household just now. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <AppHeader />
      <View style={styles.card}>
        <View style={styles.step}><Text style={styles.stepText}>STEP 1 OF 2</Text></View>
        <Text style={styles.title}>Start your shared home.</Text>
        <Text style={styles.subtitle}>A private place to make everyday effort feel a little more visible—and a lot less awkward.</Text>
        <View style={styles.form}>
          <TextField label="What do you call your household?" placeholder="e.g. The Sunflower House" value={householdName} onChangeText={setHouseholdName} autoCapitalize="words" returnKeyType="next" error={householdError} />
          <TextField label="What should roommates call you?" placeholder="Your first name" value={displayName} onChangeText={setDisplayName} autoCapitalize="words" returnKeyType="done" onSubmitEditing={handleCreate} error={nameError} />
          {submitError ? <Text accessibilityLiveRegion="polite" style={styles.submitError}>{submitError}</Text> : null}
          <Button label="Create household" onPress={handleCreate} loading={loading} />
        </View>
        <Text style={styles.footnote}>You’ll get an invite code to share next. Nothing is public outside your household.</Text>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { flexGrow: 1, width: '100%', maxWidth: 580, alignSelf: 'center', paddingTop: Platform.OS === 'ios' ? 58 : 36, paddingHorizontal: 24, paddingBottom: spacing.xl },
  card: { marginTop: 58, padding: spacing.lg, borderRadius: 26, backgroundColor: colors.paper, borderWidth: 1, borderColor: '#EEF1EE', shadowColor: '#28443E', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.1, shadowRadius: 24, elevation: 5 },
  step: { alignSelf: 'flex-start', backgroundColor: colors.mintPale, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  stepText: { color: colors.ink, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { marginTop: spacing.md, color: colors.ink, fontSize: 34, lineHeight: 38, fontWeight: '900', letterSpacing: -1.4 },
  subtitle: { marginTop: spacing.sm, color: colors.muted, fontSize: 16, lineHeight: 24 },
  form: { gap: spacing.md, marginTop: spacing.lg },
  submitError: { color: colors.danger, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  footnote: { marginTop: spacing.md, color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
