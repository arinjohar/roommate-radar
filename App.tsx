import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { calculateMemberEffort, getFairnessStatus, getPulseInsight, suggestRebalance } from './src/fairness/engine';
import type { Chore, Completion, Member, PulseResponse } from './src/types/domain';

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

const demoMembers: Member[] = [
  { id: 'jamie', displayName: 'Jamie', avatarColor: colors.coral },
  { id: 'sam', displayName: 'Sam', avatarColor: colors.mint },
  { id: 'alex', displayName: 'Alex', avatarColor: colors.yellow },
  { id: 'noor', displayName: 'Noor', avatarColor: '#B9B2E8' },
];

const demoCompletions: Completion[] = [
  { id: 'c1', choreId: 'kitchen', memberId: 'jamie', pointsAwarded: 6, completedAt: '2026-09-01T18:00:00.000Z' },
  { id: 'c2', choreId: 'bathroom', memberId: 'jamie', pointsAwarded: 6, completedAt: '2026-09-03T18:00:00.000Z' },
  { id: 'c3', choreId: 'floors', memberId: 'jamie', pointsAwarded: 6, completedAt: '2026-09-04T18:00:00.000Z' },
  { id: 'c4', choreId: 'dishes', memberId: 'jamie', pointsAwarded: 1, completedAt: '2026-09-05T18:00:00.000Z' },
  { id: 'c5', choreId: 'plants', memberId: 'sam', pointsAwarded: 6, completedAt: '2026-09-02T18:00:00.000Z' },
  { id: 'c6', choreId: 'entry', memberId: 'alex', pointsAwarded: 5, completedAt: '2026-09-02T18:00:00.000Z' },
  { id: 'c7', choreId: 'mail', memberId: 'noor', pointsAwarded: 4, completedAt: '2026-09-04T18:00:00.000Z' },
];

const demoChores: Chore[] = [
  { id: 'kitchen', householdId: 'maple', title: 'Reset the kitchen', points: 6, assigneeId: 'jamie', dueAt: '2026-09-01T18:00:00.000Z', recurrence: 'weekly' },
  { id: 'bathroom', householdId: 'maple', title: 'Clean the bathroom', points: 6, assigneeId: 'jamie', dueAt: '2026-09-03T18:00:00.000Z', recurrence: 'weekly' },
  { id: 'floors', householdId: 'maple', title: 'Vacuum the floors', points: 6, assigneeId: 'jamie', dueAt: '2026-09-04T18:00:00.000Z', recurrence: 'weekly' },
  { id: 'dishes', householdId: 'maple', title: 'Unload the dishes', points: 1, assigneeId: 'jamie', dueAt: '2026-09-05T18:00:00.000Z', recurrence: 'weekly' },
  { id: 'plants', householdId: 'maple', title: 'Water the plants', points: 6, assigneeId: 'sam', dueAt: '2026-09-02T18:00:00.000Z', recurrence: 'weekly' },
  { id: 'entry', householdId: 'maple', title: 'Tidy the entry', points: 5, assigneeId: 'alex', dueAt: '2026-09-02T18:00:00.000Z', recurrence: 'weekly' },
  { id: 'mail', householdId: 'maple', title: 'Sort the mail', points: 4, assigneeId: 'noor', dueAt: '2026-09-04T18:00:00.000Z', recurrence: 'weekly' },
  { id: 'recycling', householdId: 'maple', title: 'Take out recycling', points: 2, assigneeId: 'jamie', dueAt: '2026-09-06T18:00:00.000Z', recurrence: 'weekly' },
  { id: 'fridge', householdId: 'maple', title: 'Wipe down the fridge', points: 3, assigneeId: 'sam', dueAt: '2026-09-07T18:00:00.000Z', recurrence: 'weekly' },
];

const demoPulses: PulseResponse[] = [
  { id: 'p1', householdId: 'maple', memberId: 'jamie', weekStart: '2026-08-31', cleanliness: 4, noise: 3, communication: 4 },
  { id: 'p2', householdId: 'maple', memberId: 'sam', weekStart: '2026-08-31', cleanliness: 3, noise: 2, communication: 3 },
  { id: 'p3', householdId: 'maple', memberId: 'alex', weekStart: '2026-08-31', cleanliness: 4, noise: 2, communication: 3 },
];

export default function App() {
  const [showDashboard, setShowDashboard] = useState(false);

  return showDashboard ? <Dashboard onBack={() => setShowDashboard(false)} /> : <Landing onExplore={() => setShowDashboard(true)} />;
}

function Landing({ onExplore }: { onExplore: () => void }) {
  const { width } = useWindowDimensions();
  const isWide = width >= 760;

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
                  onPress={onExplore}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
                >
                  <Text style={styles.primaryButtonText}>Create a household</Text>
                  <Text style={styles.buttonArrow}>→</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Join with an invite code"
                  onPress={onExplore}
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

function Dashboard({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<'balance' | 'pulse'>('balance');
  const [pulses, setPulses] = useState<PulseResponse[]>(demoPulses);
  const [ratings, setRatings] = useState({ cleanliness: 3, noise: 3, communication: 3 });
  const [submitted, setSubmitted] = useState(false);
  const effort = calculateMemberEffort(demoMembers, demoCompletions);
  const status = getFairnessStatus(effort);
  const suggestion = suggestRebalance(effort, demoChores, demoCompletions);
  const insight = getPulseInsight(pulses);

  const submitPulse = () => {
    if (submitted) return;
    setPulses((current) => [...current, {
      id: 'p4', householdId: 'maple', memberId: 'noor', weekStart: '2026-08-31', ...ratings,
    }]);
    setSubmitted(true);
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View pointerEvents="none" style={styles.topGlow} />
      <ScrollView contentContainerStyle={styles.dashboardScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.dashboardShell}>
          <View style={styles.dashboardHeader}>
            <Pressable accessibilityRole="button" accessibilityLabel="Return to landing page" onPress={onBack} style={styles.backButton}>
              <Text style={styles.backArrow}>←</Text><Text style={styles.backText}>Home</Text>
            </Pressable>
            <View style={styles.brand}><RadarMark size={32} /><Text style={styles.brandName}>Maple House</Text></View>
          </View>

          <View style={styles.dashboardIntro}>
            <Text style={styles.dashboardKicker}>WEEKLY CHECK-IN</Text>
            <Text style={styles.dashboardTitle}>{tab === 'balance' ? 'A little clarity goes a long way.' : 'How is home feeling?'}</Text>
            <Text style={styles.dashboardSubtitle}>{tab === 'balance' ? 'Effort is counted in points, so the smaller tasks and bigger resets both have a place.' : 'Your answers are part of a shared pattern, never a public scorecard.'}</Text>
          </View>

          <View style={styles.tabRow} accessibilityRole="tablist">
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === 'balance' }} onPress={() => setTab('balance')} style={[styles.tab, tab === 'balance' && styles.tabActive]}><Text style={[styles.tabText, tab === 'balance' && styles.tabTextActive]}>Balance</Text></Pressable>
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === 'pulse' }} onPress={() => setTab('pulse')} style={[styles.tab, tab === 'pulse' && styles.tabActive]}><Text style={[styles.tabText, tab === 'pulse' && styles.tabTextActive]}>Pulse</Text></Pressable>
          </View>

          {tab === 'balance' ? (
            <View style={styles.dashboardStack}>
              <View style={styles.sectionHeading}>
                <View><Text style={styles.sectionKicker}>THIS WEEK’S EFFORT</Text><Text style={styles.sectionTitle}>Everyone’s share, at a glance</Text></View>
                <View style={[styles.statusPill, status === 'balanced' ? styles.statusBalanced : styles.statusNudge]}><Text style={[styles.statusText, status === 'balanced' ? styles.statusTextBalanced : styles.statusTextNudge]}>{status === 'balanced' ? 'In balance' : 'Needs a nudge'}</Text></View>
              </View>
              <View style={styles.effortCard}>
                {effort.map((member) => {
                  const fill = member.expected === 0 ? 0 : Math.min((member.actual / (member.expected * 1.55)) * 100, 100);
                  return <View key={member.id} style={styles.effortRow}>
                    <View style={[styles.avatar, styles.dashboardAvatar, { backgroundColor: member.avatarColor }]}><Text style={styles.avatarText}>{member.displayName.slice(0, 2).toUpperCase()}</Text></View>
                    <View style={styles.effortMain}><View style={styles.effortNames}><Text style={styles.memberName}>{member.displayName}</Text><Text style={styles.effortPoints}>{member.actual} pts</Text></View><View style={styles.effortTrack}><View style={[styles.effortFill, { backgroundColor: member.avatarColor, width: `${fill}%` }]} /></View></View>
                    <Text style={[styles.gapText, member.gap > 0 && styles.gapPositive]}>{member.gap > 0 ? '+' : ''}{member.gap.toFixed(1)}</Text>
                  </View>;
                })}
                <Text style={styles.expectedNote}>A shared week works out to {effort[0]?.expected.toFixed(1) ?? '0'} effort points per person.</Text>
              </View>

              {suggestion && <View style={styles.rebalanceCard}>
                <View style={styles.rebalanceIcon}><Text style={styles.rebalanceIconText}>✦</Text></View>
                <View style={styles.rebalanceCopy}><Text style={styles.rebalanceKicker}>A KIND NEXT STEP</Text><Text style={styles.rebalanceTitle}>Try a small handoff</Text><Text style={styles.rebalanceText}>{suggestion.member.displayName} is furthest below the shared pace. Having them take “{suggestion.chore.title}” ({suggestion.chore.points} points) is one gentle way to even things out.</Text></View>
              </View>}
              <Text style={styles.dashboardFootnote}>This is a conversation starter, not a scoreboard. The household decides what feels fair.</Text>
            </View>
          ) : (
            <View style={styles.dashboardStack}>
              <View style={styles.pulseInsight}>
                <View style={styles.insightIcon}><Text style={styles.insightIconText}>✦</Text></View>
                <View style={styles.insightCopy}><Text style={styles.insightLabel}>HOUSEHOLD INSIGHT</Text><Text style={styles.pulseInsightText}>{insight?.message ?? 'Once the house has a few check-ins, a shared pattern will appear here.'}</Text></View>
              </View>
              <View style={styles.pulseCard}>
                <Text style={styles.sectionKicker}>YOUR CHECK-IN</Text>
                <Text style={styles.sectionTitle}>How did this week feel?</Text>
                <Text style={styles.formHelp}>Choose a number from 1 (needs attention) to 5 (feeling good).</Text>
                {(['cleanliness', 'noise', 'communication'] as const).map((category) => <View key={category} style={styles.question}>
                  <Text style={styles.questionLabel}>{category === 'cleanliness' ? 'Cleanliness' : category === 'noise' ? 'Shared quiet' : 'Communication'}</Text>
                  <View style={styles.ratingRow}>{[1, 2, 3, 4, 5].map((rating) => <Pressable key={rating} accessibilityRole="button" accessibilityLabel={`${category}, ${rating} out of 5`} onPress={() => !submitted && setRatings((current) => ({ ...current, [category]: rating }))} style={[styles.ratingButton, ratings[category] === rating && styles.ratingButtonActive, submitted && styles.ratingButtonDisabled]}><Text style={[styles.ratingText, ratings[category] === rating && styles.ratingTextActive]}>{rating}</Text></Pressable>)}</View>
                </View>)}
                <Pressable accessibilityRole="button" accessibilityLabel="Share this pulse check-in" onPress={submitPulse} style={[styles.submitButton, submitted && styles.submitButtonDone]}><Text style={styles.submitText}>{submitted ? 'Check-in shared ✓' : 'Share my check-in'}</Text></Pressable>
                {submitted && <Text style={styles.submittedNote}>Thanks. Your answer has been added to the household pattern.</Text>}
              </View>
            </View>
          )}
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
  dashboardScroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 58 : 34, paddingBottom: 42 },
  dashboardShell: { width: '100%', maxWidth: 660, alignSelf: 'center' },
  dashboardHeader: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { minHeight: 38, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  backArrow: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  backText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  dashboardIntro: { marginTop: 43, marginBottom: 25 },
  dashboardKicker: { color: colors.coralDark, fontSize: 10, fontWeight: '900', letterSpacing: 1.3, marginBottom: 10 },
  dashboardTitle: { color: colors.ink, fontSize: 35, lineHeight: 40, letterSpacing: -1.25, fontWeight: '900', maxWidth: 510 },
  dashboardSubtitle: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 12, maxWidth: 540 },
  tabRow: { flexDirection: 'row', alignSelf: 'flex-start', padding: 4, borderRadius: 15, backgroundColor: '#ECEFE9', marginBottom: 26 },
  tab: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 11 },
  tabActive: { backgroundColor: colors.paper, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  tabTextActive: { color: colors.ink },
  dashboardStack: { gap: 16 },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  sectionKicker: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.25, marginBottom: 5 },
  sectionTitle: { color: colors.ink, fontSize: 20, letterSpacing: -0.55, fontWeight: '900' },
  statusPill: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, marginBottom: 1 },
  statusNudge: { backgroundColor: '#FFF0E8' },
  statusBalanced: { backgroundColor: colors.mintPale },
  statusText: { fontSize: 10, fontWeight: '900' },
  statusTextNudge: { color: colors.coralDark },
  statusTextBalanced: { color: colors.ink },
  effortCard: { borderRadius: 23, padding: 19, backgroundColor: colors.paper, borderWidth: 1, borderColor: '#EDF0EC', gap: 17, shadowColor: '#28443E', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 2 },
  effortRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dashboardAvatar: { width: 36, height: 36, borderRadius: 12 },
  effortMain: { flex: 1, gap: 7 },
  effortNames: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  memberName: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  effortPoints: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  effortTrack: { height: 8, overflow: 'hidden', borderRadius: 6, backgroundColor: '#EEF3F0' },
  effortFill: { height: '100%', borderRadius: 6 },
  gapText: { minWidth: 34, color: colors.muted, fontSize: 10, fontWeight: '800', textAlign: 'right' },
  gapPositive: { color: colors.coralDark },
  expectedNote: { color: colors.muted, fontSize: 11, lineHeight: 17, paddingTop: 2, borderTopWidth: 1, borderTopColor: colors.line },
  rebalanceCard: { flexDirection: 'row', gap: 13, padding: 18, borderRadius: 20, backgroundColor: colors.mintPale, borderWidth: 1, borderColor: '#D3EADF' },
  rebalanceIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  rebalanceIconText: { color: colors.yellow, fontSize: 17 },
  rebalanceCopy: { flex: 1 },
  rebalanceKicker: { color: colors.ink, fontSize: 8, fontWeight: '900', letterSpacing: 1.15, marginBottom: 4 },
  rebalanceTitle: { color: colors.ink, fontSize: 17, fontWeight: '900', letterSpacing: -0.4, marginBottom: 5 },
  rebalanceText: { color: colors.ink, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  dashboardFootnote: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', paddingHorizontal: 12, marginTop: 2 },
  pulseInsight: { flexDirection: 'row', gap: 12, borderRadius: 19, padding: 16, backgroundColor: colors.mintPale },
  pulseInsightText: { color: colors.ink, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  pulseCard: { backgroundColor: colors.paper, borderRadius: 23, padding: 20, borderWidth: 1, borderColor: '#EDF0EC', shadowColor: '#28443E', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 2 },
  formHelp: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 8 },
  question: { marginTop: 23 },
  questionLabel: { color: colors.ink, fontSize: 14, fontWeight: '800', marginBottom: 10 },
  ratingRow: { flexDirection: 'row', gap: 8 },
  ratingButton: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F5F2', borderWidth: 1, borderColor: colors.line },
  ratingButtonActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  ratingButtonDisabled: { opacity: 0.82 },
  ratingText: { color: colors.muted, fontSize: 13, fontWeight: '900' },
  ratingTextActive: { color: colors.paper },
  submitButton: { minHeight: 52, marginTop: 27, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink, shadowColor: colors.ink, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 3 },
  submitButtonDone: { backgroundColor: '#2E685B' },
  submitText: { color: colors.paper, fontSize: 14, fontWeight: '900' },
  submittedNote: { color: '#2E685B', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 12, fontWeight: '700' },
});
