import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AppHeader } from '../../src/components/AppHeader';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { useHouseholdSession } from '../../src/context/HouseholdSessionContext';
import { colors, spacing } from '../../src/theme/tokens';

export default function JoinHouseholdScreen() {
  const router = useRouter();
  const { joinHousehold } = useHouseholdSession();
  const [inviteCode, setInviteCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const inviteError = submitted && inviteCode.trim().length < 4 ? 'Enter the invite code your roommate sent.' : undefined;
  const nameError = submitted && !displayName.trim() ? 'Add the name your roommates know you by.' : undefined;

  const handleJoin = async () => {
    setSubmitted(true);
    if (inviteCode.trim().length < 4 || !displayName.trim()) return;
    setLoading(true);
    await joinHousehold({ inviteCode: inviteCode.trim(), displayName: displayName.trim() });
    router.replace('/home');
  };

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <AppHeader />
      <View style={styles.card}>
        <View style={styles.step}><Text style={styles.stepText}>WELCOME IN</Text></View>
        <Text style={styles.title}>Join the household.</Text>
        <Text style={styles.subtitle}>Use the short code from a roommate. We’ll keep the conversation constructive from there.</Text>
        <View style={styles.form}>
          <TextField label="Invite code" placeholder="e.g. HOME-7Q2K" value={inviteCode} onChangeText={setInviteCode} autoCapitalize="characters" autoCorrect={false} error={inviteError} />
          <TextField label="What should roommates call you?" placeholder="Your first name" value={displayName} onChangeText={setDisplayName} autoCapitalize="words" returnKeyType="done" onSubmitEditing={handleJoin} error={nameError} />
          <Button label="Join household" onPress={handleJoin} loading={loading} />
        </View>
        <Text style={styles.footnote}>No code yet? Ask a roommate to create the household and send you their invite.</Text>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { flexGrow: 1, width: '100%', maxWidth: 580, alignSelf: 'center', paddingTop: Platform.OS === 'ios' ? 58 : 36, paddingHorizontal: 24, paddingBottom: spacing.xl },
  card: { marginTop: 58, padding: spacing.lg, borderRadius: 26, backgroundColor: colors.paper, borderWidth: 1, borderColor: '#EEF1EE', shadowColor: '#28443E', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.1, shadowRadius: 24, elevation: 5 },
  step: { alignSelf: 'flex-start', backgroundColor: '#FFF0E8', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  stepText: { color: colors.coralDark, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { marginTop: spacing.md, color: colors.ink, fontSize: 34, lineHeight: 38, fontWeight: '900', letterSpacing: -1.4 },
  subtitle: { marginTop: spacing.sm, color: colors.muted, fontSize: 16, lineHeight: 24 },
  form: { gap: spacing.md, marginTop: spacing.lg },
  footnote: { marginTop: spacing.md, color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
