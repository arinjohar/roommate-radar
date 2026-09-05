import { useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../src/components/AppHeader';
import { useHouseholdSession } from '../src/context/HouseholdSessionContext';
import { ChoreBoard } from '../src/features/chores/ChoreBoard';
import { colors, spacing } from '../src/theme/tokens';

const tabs = ['Chores', 'Balance', 'Pulse'] as const;
type Tab = typeof tabs[number];

export default function HomeScreen() {
  const router = useRouter();
  const { session, clearSession } = useHouseholdSession();
  const [activeTab, setActiveTab] = useState<Tab>('Chores');
  const [pulseSent, setPulseSent] = useState(false);
  if (!session) return <Redirect href="/" />;

  const initial = session.member.displayName.slice(0, 1).toUpperCase();
  return <View style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <AppHeader />
      <View style={styles.welcomeRow}>
        <View>
          <Text style={styles.eyebrow}>YOUR HOUSEHOLD</Text>
          <Text style={styles.title}>{session.household.name}</Text>
        </View>
        <View style={[styles.avatar, { backgroundColor: session.member.avatarColor }]}><Text style={styles.avatarText}>{initial}</Text></View>
      </View>
      <View style={styles.inviteCard}>
        <Text style={styles.inviteLabel}>SHARE THIS INVITE CODE</Text>
        <Text style={styles.inviteCode}>{session.household.inviteCode}</Text>
        <Text style={styles.inviteCopy}>Send it to your roommates so everyone starts from the same calm, shared view.</Text>
      </View>
      <Text style={styles.next}>A calmer week starts here.</Text>
      <Text style={styles.nextCopy}>Here’s a friendly, at-a-glance demo of the work your household is sharing.</Text>
      <View style={styles.tabRow}>{tabs.map((tab) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab }} key={tab} onPress={() => setActiveTab(tab)} style={[styles.tab, activeTab === tab && styles.tabActive]}><Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text></Pressable>)}</View>
      <DemoPanel activeTab={activeTab} pulseSent={pulseSent} onPulse={() => setPulseSent(true)} />
      <Pressable accessibilityRole="button" onPress={() => { clearSession(); router.replace('/'); }} style={styles.reset}><Text style={styles.resetText}>Leave this demo household</Text></Pressable>
    </ScrollView>
  </View>;
}

function DemoPanel({ activeTab, pulseSent, onPulse }: { activeTab: Tab; pulseSent: boolean; onPulse: () => void }) {
  if (activeTab === 'Chores') return <ChoreBoard />;

  if (activeTab === 'Balance') return <View style={styles.panel}>
    <View style={styles.panelHeading}><View><Text style={styles.panelKicker}>HOUSEHOLD BALANCE</Text><Text style={styles.panelTitle}>A gentle nudge.</Text></View><View style={styles.nudge}><Text style={styles.nudgeText}>NEEDS A NUDGE</Text></View></View>
    <Text style={styles.balanceCopy}>Jamie has carried more of the cleanup this week. Passing one small chore to Sam would bring the effort closer together.</Text>
    <View style={styles.suggestion}><Text style={styles.suggestionLabel}>ONE KIND SWAP</Text><Text style={styles.suggestionText}>Sam takes “Wipe kitchen counters” · 3 points</Text></View>
  </View>;

  return <View style={styles.panel}>
    <Text style={styles.panelKicker}>WEEKLY PULSE</Text><Text style={styles.panelTitle}>{pulseSent ? 'Thanks for checking in.' : 'How’s the house feeling?'}</Text>
    <Text style={styles.balanceCopy}>{pulseSent ? 'Your private pulse helps the household notice small tensions early.' : 'A two-second, private check-in keeps the signal clear without turning it into a scoreboard.'}</Text>
    {pulseSent ? <View style={styles.sent}><Text style={styles.sentText}>✓ Pulse shared</Text></View> : <Pressable accessibilityRole="button" onPress={onPulse} style={styles.pulseButton}><Text style={styles.pulseButtonText}>Pretty good this week</Text><Text style={styles.pulseArrow}>→</Text></Pressable>}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { flexGrow: 1, width: '100%', maxWidth: 580, alignSelf: 'center', paddingTop: 58, paddingHorizontal: 24, paddingBottom: spacing.xl },
  welcomeRow: { marginTop: 54, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  eyebrow: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 33, fontWeight: '900', letterSpacing: -1.3, marginTop: 6 },
  avatar: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.ink, fontWeight: '900', fontSize: 17 },
  inviteCard: { marginTop: spacing.lg, borderRadius: 22, padding: spacing.md, backgroundColor: colors.ink },
  inviteLabel: { color: colors.mint, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  inviteCode: { color: colors.paper, marginTop: 8, fontSize: 27, fontWeight: '900', letterSpacing: 1.2 },
  inviteCopy: { color: '#DCE6E2', marginTop: 10, fontSize: 13, lineHeight: 19 },
  next: { color: colors.ink, marginTop: 34, fontSize: 22, fontWeight: '900', letterSpacing: -0.6 },
  nextCopy: { color: colors.muted, marginTop: 8, fontSize: 15, lineHeight: 22 },
  tabRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.lg },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 13, backgroundColor: colors.mintPale },
  tabActive: { backgroundColor: colors.ink },
  tabText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  tabTextActive: { color: colors.paper },
  panel: { marginTop: spacing.md, borderRadius: 22, padding: spacing.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: '#EEF1EE' },
  panelHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  panelKicker: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  panelTitle: { marginTop: 5, color: colors.ink, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  nudge: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 999, backgroundColor: '#FFF0E8' },
  nudgeText: { color: colors.coralDark, fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  balanceCopy: { color: colors.muted, marginTop: spacing.sm, fontSize: 14, lineHeight: 21 },
  suggestion: { marginTop: spacing.md, padding: spacing.sm, borderRadius: 14, backgroundColor: colors.mintPale },
  suggestionLabel: { color: colors.ink, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  suggestionText: { color: colors.ink, marginTop: 5, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  pulseButton: { marginTop: spacing.md, paddingHorizontal: spacing.sm, minHeight: 49, borderRadius: 14, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  pulseButtonText: { color: colors.paper, fontSize: 14, fontWeight: '800' },
  pulseArrow: { color: colors.mint, fontSize: 20, lineHeight: 20 },
  sent: { marginTop: spacing.md, alignSelf: 'flex-start', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.mintPale },
  sentText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  reset: { alignSelf: 'center', paddingVertical: 14, marginTop: spacing.xl },
  resetText: { color: colors.muted, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
});
