import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useState } from 'react';

const colors = {
  ink: '#132A2E', muted: '#5B6E70', cream: '#FFF9F0', paper: '#FFFFFF',
  coral: '#F36F56', coralDark: '#D9533C', mint: '#9ED9C5',
  mintPale: '#E3F4ED', yellow: '#F4C95D', line: '#DCE6E2',
};

const roommates = [
  { initials: 'JM', color: colors.coral, width: '78%' },
  { initials: 'SK', color: colors.mint, width: '61%' },
  { initials: 'AR', color: colors.yellow, width: '42%' },
] as const;

type OnboardingMode = 'create' | 'join' | null;

const demoInviteCode = 'MAPLE7';

const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 350));

async function createHousehold(name: string) {
  await pause();
  if (name.trim().toLowerCase() === 'offline') {
    throw new Error('We could not save that household just now. Check your connection and try again.');
  }

  return { name: name.trim(), inviteCode: demoInviteCode };
}

async function joinHousehold(code: string) {
  await pause();
  if (code !== demoInviteCode) {
    throw new Error('That invite code is not active. Ask a roommate to resend it, then try again.');
  }

  return { name: 'Maple House' };
}

export default function App() {
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
  const [onboardingMode, setOnboardingMode] = useState<OnboardingMode>(null);

  if (onboardingMode) {
    return <OnboardingScreen mode={onboardingMode} onBack={() => setOnboardingMode(null)} />;
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View pointerEvents="none" style={styles.topGlow} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.shell, isWide && styles.shellWide]}>
          <View style={styles.header}>
            <View style={styles.brand}>
              <RadarMark size={36} />
              <Text style={styles.brandName}>Roommate Radar</Text>
            </View>
            <View style={styles.betaPill}>
              <View style={styles.betaDot} />
              <Text style={styles.betaText}>EARLY ACCESS</Text>
            </View>
          </View>

          <View style={[styles.hero, isWide && styles.heroWide]}>
            <View style={[styles.copyColumn, isWide && styles.copyColumnWide]}>
              <View style={styles.eyebrow}>
                <Text style={styles.eyebrowText}>A CALMER WAY TO LIVE TOGETHER</Text>
              </View>
              <Text style={[styles.title, isWide && styles.titleWide]}>
                See the chores{`\n`}<Text style={styles.titleAccent}>nobody talks about.</Text>
              </Text>
              <Text style={styles.subtitle}>
                Share the work, spot imbalances early, and keep small household
                tensions from turning into big ones.
              </Text>

              <View style={[styles.actions, isWide && styles.actionsWide]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Create a household"
                  onPress={() => setOnboardingMode('create')}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
                >
                  <Text style={styles.primaryButtonText}>Create a household</Text>
                  <Text style={styles.buttonArrow}>→</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Join with an invite code"
                  onPress={() => setOnboardingMode('join')}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
                >
                  <Text style={styles.secondaryButtonText}>Join with a code</Text>
                </Pressable>
              </View>

              <View style={styles.promiseRow}>
                <Promise label="No public scoreboards" />
                <Promise label="Built for cooperation" />
              </View>
            </View>

            <View style={[styles.previewWrap, isWide && styles.previewWrapWide]}>
              <View style={styles.decorativeDotGrid}>
                {Array.from({ length: 12 }).map((_, index) => <View key={index} style={styles.decorativeDot} />)}
              </View>
              <View style={styles.previewCard}>
                <View style={styles.previewHeader}>
                  <View>
                    <Text style={styles.previewKicker}>THIS WEEK</Text>
                    <Text style={styles.previewTitle}>Household balance</Text>
                  </View>
                  <View style={styles.balancePill}><Text style={styles.balanceText}>Needs a nudge</Text></View>
                </View>

                <View style={styles.roommateList}>
                  {roommates.map((roommate) => (
                    <View key={roommate.initials} style={styles.roommateRow}>
                      <View style={[styles.avatar, { backgroundColor: roommate.color }]}>
                        <Text style={styles.avatarText}>{roommate.initials}</Text>
                      </View>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { backgroundColor: roommate.color, width: roommate.width }]} />
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.insightCard}>
                  <View style={styles.insightIcon}><Text style={styles.insightIconText}>✦</Text></View>
                  <View style={styles.insightCopy}>
                    <Text style={styles.insightLabel}>RADAR INSIGHT</Text>
                    <Text style={styles.insightText}>
                      Jamie has covered most cleanup this week. A small swap could bring things back into balance.
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.floatingChore}>
                <View style={styles.checkCircle}><Text style={styles.check}>✓</Text></View>
                <View>
                  <Text style={styles.floatingLabel}>Bathroom cleaned</Text>
                  <Text style={styles.floatingPoints}>+6 effort points</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>FAIR WORK · FRIENDLY NUDGES · FEWER AWKWARD TEXTS</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function OnboardingScreen({ mode, onBack }: { mode: Exclude<OnboardingMode, null>; onBack: () => void }) {
  const isCreate = mode === 'create';
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState<{ name: string; inviteCode?: string } | null>(null);

  const updateValue = (nextValue: string) => {
    setValue(isCreate ? nextValue : nextValue.toUpperCase().replace(/[^A-Z0-9]/g, ''));
    if (error) setError(null);
  };

  const submit = async () => {
    const cleanedValue = value.trim();
    if (!cleanedValue) {
      setError(isCreate ? 'Add a household name so everyone knows where they belong.' : 'Enter the invite code your roommate shared.');
      return;
    }

    if (!isCreate && cleanedValue.length < 4) {
      setError('That code looks a little short. Invite codes are at least four characters.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      if (isCreate) {
        const household = await createHousehold(cleanedValue);
        setComplete(household);
      } else {
        const household = await joinHousehold(cleanedValue);
        setComplete(household);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = isCreate ? 'Start your household' : 'Join your household';
  const description = isCreate
    ? 'Give your shared space a name. You can invite roommates right after.'
    : 'Use the invite code from a roommate to find your shared space.';

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View pointerEvents="none" style={styles.topGlow} />
      <ScrollView contentContainerStyle={styles.onboardingScroll} keyboardShouldPersistTaps="handled">
        <View style={styles.onboardingShell}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to landing page" onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <View style={styles.onboardingBrand}>
            <RadarMark size={36} />
            <Text style={styles.brandName}>Roommate Radar</Text>
          </View>
          <View style={styles.onboardingCard}>
            {complete ? (
              <View style={styles.completeContent}>
                <View style={styles.successIcon}><Text style={styles.successIconText}>✓</Text></View>
                <Text style={styles.formEyebrow}>YOU’RE ALL SET</Text>
                <Text style={styles.formTitle}>{complete.name} is ready.</Text>
                <Text style={styles.formDescription}>
                  {complete.inviteCode
                    ? `Share ${complete.inviteCode} with your roommates so they can join the same household.`
                    : 'You’re connected to this household. Next, choose how you’d like to appear to your roommates.'}
                </Text>
                <Pressable accessibilityRole="button" onPress={onBack} style={({ pressed }) => [styles.primaryButton, styles.formButton, pressed && styles.buttonPressed]}>
                  <Text style={styles.primaryButtonText}>Back to welcome</Text>
                  <Text style={styles.buttonArrow}>→</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.formEyebrow}>{isCreate ? 'A FRESH START' : 'WELCOME BACK'}</Text>
                <Text style={styles.formTitle}>{title}</Text>
                <Text style={styles.formDescription}>{description}</Text>
                <Text style={styles.inputLabel}>{isCreate ? 'Household name' : 'Invite code'}</Text>
                <TextInput
                  accessibilityLabel={isCreate ? 'Household name' : 'Invite code'}
                  autoCapitalize={isCreate ? 'words' : 'characters'}
                  autoCorrect={false}
                  editable={!isSubmitting}
                  maxLength={isCreate ? 48 : 12}
                  onChangeText={updateValue}
                  onSubmitEditing={submit}
                  placeholder={isCreate ? 'e.g. Maple House' : 'e.g. MAPLE7'}
                  placeholderTextColor="#829092"
                  returnKeyType="done"
                  style={[styles.textInput, error && styles.textInputError]}
                  value={value}
                />
                {error ? <Text accessibilityLiveRegion="polite" style={styles.formError}>{error}</Text> : null}
                {!isCreate ? <Text style={styles.helpText}>For this demo, try code {demoInviteCode}.</Text> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ busy: isSubmitting, disabled: isSubmitting }}
                  disabled={isSubmitting}
                  onPress={submit}
                  style={({ pressed }) => [styles.primaryButton, styles.formButton, (pressed || isSubmitting) && styles.buttonPressed, isSubmitting && styles.buttonDisabled]}
                >
                  {isSubmitting ? <ActivityIndicator color={colors.mint} /> : <><Text style={styles.primaryButtonText}>{isCreate ? 'Create household' : 'Join household'}</Text><Text style={styles.buttonArrow}>→</Text></>}
                </Pressable>
              </>
            )}
          </View>
          <Text style={styles.onboardingFooter}>A little clarity makes a home feel lighter.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function RadarMark({ size }: { size: number }) {
  return (
    <View accessible={false} style={[styles.radarMark, { height: size, width: size, borderRadius: size / 2 }]}>
      <View style={[styles.radarRing, { height: size * 0.58, width: size * 0.58 }]} />
      <View style={styles.radarNeedle} />
      <View style={styles.radarCenter} />
    </View>
  );
}

function Promise({ label }: { label: string }) {
  return (
    <View style={styles.promise}>
      <View style={styles.promiseCheck}><Text style={styles.promiseCheckText}>✓</Text></View>
      <Text style={styles.promiseText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  topGlow: { position: 'absolute', right: -100, top: -140, width: 340, height: 340, borderRadius: 170, backgroundColor: colors.mintPale, opacity: 0.9 },
  scrollContent: { flexGrow: 1 },
  shell: { width: '100%', maxWidth: 1180, alignSelf: 'center', flex: 1, paddingTop: Platform.OS === 'ios' ? 58 : 36, paddingHorizontal: 24, paddingBottom: 24 },
  shellWide: { paddingHorizontal: 54 },
  onboardingScroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: Platform.OS === 'ios' ? 58 : 36, paddingBottom: 36 },
  onboardingShell: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  backButton: { alignSelf: 'flex-start', paddingVertical: 10, paddingRight: 12, marginBottom: 30 },
  backButtonText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  onboardingBrand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 26 },
  onboardingCard: { borderRadius: 28, padding: 25, backgroundColor: colors.paper, borderWidth: 1, borderColor: '#EEF1EE', shadowColor: '#28443E', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.12, shadowRadius: 26, elevation: 6 },
  formEyebrow: { color: colors.coralDark, fontSize: 10, fontWeight: '900', letterSpacing: 1.35, marginBottom: 11 },
  formTitle: { color: colors.ink, fontSize: 30, lineHeight: 35, fontWeight: '900', letterSpacing: -1.1 },
  formDescription: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 12 },
  inputLabel: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 27, marginBottom: 9 },
  textInput: { minHeight: 54, borderRadius: 14, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.cream, paddingHorizontal: 15, color: colors.ink, fontSize: 16, fontWeight: '700' },
  textInputError: { borderColor: colors.coral },
  formError: { color: colors.coralDark, fontSize: 13, lineHeight: 19, fontWeight: '700', marginTop: 10 },
  helpText: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 10 },
  formButton: { marginTop: 24, width: '100%' },
  buttonDisabled: { opacity: 0.82 },
  completeContent: { alignItems: 'flex-start' },
  successIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mintPale, marginBottom: 20 },
  successIconText: { color: colors.ink, fontSize: 23, fontWeight: '900' },
  onboardingFooter: { color: colors.muted, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 25 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandName: { color: colors.ink, fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  radarMark: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: colors.ink },
  radarRing: { borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.52)' },
  radarNeedle: { position: 'absolute', left: '50%', bottom: '50%', width: 2, height: '38%', backgroundColor: colors.mint, transform: [{ rotate: '42deg' }], transformOrigin: 'bottom' },
  radarCenter: { position: 'absolute', width: 5, height: 5, borderRadius: 3, backgroundColor: colors.paper },
  betaPill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: 'rgba(255,255,255,0.7)' },
  betaDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.coral },
  betaText: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  hero: { flex: 1, paddingTop: 62, paddingBottom: 48, gap: 62 },
  heroWide: { minHeight: 650, flexDirection: 'row', alignItems: 'center', paddingTop: 48, gap: 72 },
  copyColumn: { width: '100%' },
  copyColumnWide: { flex: 1.03 },
  eyebrow: { alignSelf: 'flex-start', borderLeftWidth: 3, borderLeftColor: colors.coral, paddingLeft: 10, marginBottom: 18 },
  eyebrowText: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.45 },
  title: { color: colors.ink, fontSize: 46, lineHeight: 51, fontWeight: '900', letterSpacing: -2.1 },
  titleWide: { fontSize: 62, lineHeight: 66, letterSpacing: -3 },
  titleAccent: { color: colors.coral },
  subtitle: { maxWidth: 540, marginTop: 22, color: colors.muted, fontSize: 17, lineHeight: 26 },
  actions: { marginTop: 32, gap: 12 },
  actionsWide: { flexDirection: 'row' },
  primaryButton: { minHeight: 54, paddingHorizontal: 21, borderRadius: 15, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, shadowColor: colors.ink, shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.17, shadowRadius: 13, elevation: 4 },
  primaryButtonText: { color: colors.paper, fontSize: 15, fontWeight: '800' },
  buttonArrow: { color: colors.mint, fontSize: 21, lineHeight: 21 },
  secondaryButton: { minHeight: 54, paddingHorizontal: 20, borderRadius: 15, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.38)' },
  secondaryButtonText: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  buttonPressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  promiseRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 23 },
  promise: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  promiseCheck: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.mintPale, alignItems: 'center', justifyContent: 'center' },
  promiseCheckText: { color: colors.ink, fontSize: 10, fontWeight: '900' },
  promiseText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  previewWrap: { width: '100%', alignSelf: 'center', maxWidth: 490, paddingHorizontal: 7, paddingBottom: 34 },
  previewWrapWide: { flex: 0.97 },
  decorativeDotGrid: { position: 'absolute', top: -27, right: -2, width: 64, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  decorativeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.coral, opacity: 0.46 },
  previewCard: { borderRadius: 28, padding: 22, backgroundColor: colors.paper, borderWidth: 1, borderColor: '#EEF1EE', shadowColor: '#28443E', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.13, shadowRadius: 30, elevation: 7 },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  previewKicker: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.3, marginBottom: 5 },
  previewTitle: { color: colors.ink, fontSize: 21, fontWeight: '900', letterSpacing: -0.6 },
  balancePill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#FFF0E8' },
  balanceText: { color: colors.coralDark, fontSize: 9, fontWeight: '800' },
  roommateList: { gap: 15, marginTop: 28, marginBottom: 24 },
  roommateRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.ink, fontSize: 9, fontWeight: '900' },
  progressTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: '#EFF3F1', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5 },
  insightCard: { flexDirection: 'row', gap: 12, borderRadius: 17, padding: 15, backgroundColor: colors.mintPale },
  insightIcon: { width: 31, height: 31, borderRadius: 10, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  insightIconText: { color: colors.yellow, fontSize: 16 },
  insightCopy: { flex: 1 },
  insightLabel: { color: colors.ink, fontSize: 8, fontWeight: '900', letterSpacing: 1.2, marginBottom: 5 },
  insightText: { color: colors.ink, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  floatingChore: { position: 'absolute', bottom: 2, left: -5, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 15, paddingHorizontal: 13, paddingVertical: 11, backgroundColor: colors.ink, shadowColor: colors.ink, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 7 },
  checkCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  check: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  floatingLabel: { color: colors.paper, fontSize: 10, fontWeight: '800' },
  floatingPoints: { color: colors.mint, fontSize: 9, marginTop: 2 },
  footer: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 19, alignItems: 'center' },
  footerText: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 1.15, textAlign: 'center' },
});
