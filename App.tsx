import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

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

const householdMembers = [
  { id: 'aanya', name: 'Aanya', initials: 'AC', color: colors.coral, isCurrentUser: true },
  { id: 'jamie', name: 'Jamie', initials: 'JM', color: colors.mint, isCurrentUser: false },
  { id: 'sam', name: 'Sam', initials: 'SK', color: colors.yellow, isCurrentUser: false },
  { id: 'alex', name: 'Alex', initials: 'AR', color: '#B8C8EE', isCurrentUser: false },
] as const;

type HomeTab = 'Chores' | 'Balance' | 'Pulse' | 'Members';

export default function App() {
  const [hasHousehold, setHasHousehold] = useState(false);

  if (hasHousehold) {
    return <HouseholdHome onExit={() => setHasHousehold(false)} />;
  }

  return <LandingScreen onCreateHousehold={() => setHasHousehold(true)} />;
}

function LandingScreen({ onCreateHousehold }: { onCreateHousehold: () => void }) {
  const { width } = useWindowDimensions();
  const isWide = width >= 760;

  const showComingSoon = (action: string) => Alert.alert(
    `${action} is next`,
    'The landing page is ready. Connect this button to the household onboarding flow on its feature branch.',
  );

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
                  onPress={onCreateHousehold}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
                >
                  <Text style={styles.primaryButtonText}>Create a household</Text>
                  <Text style={styles.buttonArrow}>→</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Join with an invite code"
                  onPress={() => showComingSoon('Invite codes')}
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

function HouseholdHome({ onExit }: { onExit: () => void }) {
  const [activeTab, setActiveTab] = useState<HomeTab>('Chores');
  const { width } = useWindowDimensions();
  const isNarrow = width < 390;

  return (
    <View style={styles.homeScreen}>
      <StatusBar style="dark" />
      <View pointerEvents="none" style={styles.homeGlow} />
      <ScrollView contentContainerStyle={styles.homeScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.homeShell}>
          <View style={styles.homeHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Return to the landing screen"
              onPress={onExit}
              style={({ pressed }) => [styles.brand, pressed && styles.buttonPressed]}
            >
              <RadarMark size={34} />
              <View>
                <Text style={styles.homeKicker}>YOUR RESIDENCE</Text>
                <Text style={styles.homeTitle}>Maple House</Text>
              </View>
            </Pressable>
            <View style={styles.homeAvatar}><Text style={styles.homeAvatarText}>AC</Text></View>
          </View>

          <View style={styles.welcomeCard}>
            <View style={styles.welcomeIcon}><Text style={styles.welcomeIconText}>⌂</Text></View>
            <View style={styles.welcomeCopy}>
              <Text style={styles.welcomeEyebrow}>HOUSEHOLD READY</Text>
              <Text style={styles.welcomeTitle}>You’re all set, Aanya.</Text>
              <Text style={styles.welcomeText}>A small view of the shared work, made for kinder check-ins.</Text>
            </View>
          </View>

          <View accessibilityRole="tablist" style={[styles.tabBar, isNarrow && styles.tabBarNarrow]}>
            {(['Chores', 'Balance', 'Pulse', 'Members'] as const).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <Pressable
                  key={tab}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={`${tab} tab`}
                  onPress={() => setActiveTab(tab)}
                  style={({ pressed }) => [styles.tab, isActive && styles.tabActive, pressed && styles.buttonPressed]}
                >
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab}</Text>
                </Pressable>
              );
            })}
          </View>

          {activeTab === 'Members' ? <MembersList /> : <HouseholdPlaceholder tab={activeTab} />}
        </View>
      </ScrollView>
    </View>
  );
}

function MembersList() {
  return (
    <View style={styles.membersCard}>
      <View style={styles.membersHeading}>
        <View>
          <Text style={styles.membersKicker}>MAPLE HOUSE</Text>
          <Text style={styles.membersTitle}>The people at home</Text>
        </View>
        <View style={styles.memberCount}><Text style={styles.memberCountText}>{householdMembers.length} MEMBERS</Text></View>
      </View>
      <Text style={styles.membersIntro}>Everyone in your residence, all in one gentle little list.</Text>
      <View style={styles.memberList}>
        {householdMembers.map((member) => (
          <View key={member.id} style={styles.memberRow}>
            <View style={[styles.memberAvatar, { backgroundColor: member.color }]}>
              <Text style={styles.memberAvatarText}>{member.initials}</Text>
            </View>
            <Text style={styles.memberName}>
              {member.name}{member.isCurrentUser ? <Text style={styles.youLabel}> (You)</Text> : null}
            </Text>
            {member.isCurrentUser ? <View style={styles.herePill}><Text style={styles.hereText}>HERE</Text></View> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function HouseholdPlaceholder({ tab }: { tab: Exclude<HomeTab, 'Members'> }) {
  const copy = {
    Chores: ['THIS WEEK', 'Your shared to-dos will live here.', 'Start with one small thing, then let the balance build.'],
    Balance: ['HOUSEHOLD BALANCE', 'A clear, calm view is on its way.', 'Effort points will help make the invisible work visible.'],
    Pulse: ['WEEKLY PULSE', 'A quick check-in is on its way.', 'A few honest signals can keep a home feeling good.'],
  } as const;
  const [eyebrow, title, text] = copy[tab];

  return (
    <View style={styles.placeholderCard}>
      <View style={styles.placeholderIcon}><Text style={styles.placeholderIconText}>✦</Text></View>
      <Text style={styles.membersKicker}>{eyebrow}</Text>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderText}>{text}</Text>
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
  homeScreen: { flex: 1, backgroundColor: colors.cream },
  homeGlow: { position: 'absolute', top: -120, right: -115, height: 290, width: 290, borderRadius: 145, backgroundColor: colors.mintPale },
  homeScroll: { flexGrow: 1 },
  homeShell: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingTop: Platform.OS === 'ios' ? 58 : 36, paddingHorizontal: 20, paddingBottom: 36 },
  homeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  homeKicker: { color: colors.muted, fontSize: 8, lineHeight: 12, fontWeight: '900', letterSpacing: 1.1 },
  homeTitle: { color: colors.ink, fontSize: 19, lineHeight: 23, fontWeight: '900', letterSpacing: -0.45 },
  homeAvatar: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.coral, borderWidth: 2, borderColor: colors.paper },
  homeAvatarText: { color: colors.ink, fontSize: 10, fontWeight: '900' },
  welcomeCard: { flexDirection: 'row', gap: 13, marginTop: 31, padding: 18, borderRadius: 20, backgroundColor: colors.mintPale, borderWidth: 1, borderColor: '#CFE9DF' },
  welcomeIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  welcomeIconText: { color: colors.mint, fontSize: 19, fontWeight: '900', marginTop: -2 },
  welcomeCopy: { flex: 1 },
  welcomeEyebrow: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.15, marginBottom: 4 },
  welcomeTitle: { color: colors.ink, fontSize: 17, fontWeight: '900', letterSpacing: -0.35 },
  welcomeText: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  tabBar: { flexDirection: 'row', gap: 5, marginTop: 24, padding: 5, borderRadius: 16, backgroundColor: '#F1F2EB', borderWidth: 1, borderColor: colors.line },
  tabBarNarrow: { gap: 3, padding: 4 },
  tab: { flex: 1, minHeight: 39, paddingHorizontal: 7, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: colors.paper, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  tabTextActive: { color: colors.ink },
  membersCard: { marginTop: 18, padding: 21, borderRadius: 24, backgroundColor: colors.paper, borderWidth: 1, borderColor: '#EEF1EE', shadowColor: '#28443E', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 3 },
  membersHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  membersKicker: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.25 },
  membersTitle: { color: colors.ink, fontSize: 23, lineHeight: 29, fontWeight: '900', letterSpacing: -0.75, marginTop: 4 },
  memberCount: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#FFF0E8' },
  memberCountText: { color: colors.coralDark, fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  membersIntro: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 12 },
  memberList: { marginTop: 19, borderTopWidth: 1, borderTopColor: colors.line },
  memberRow: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  memberAvatar: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { color: colors.ink, fontSize: 10, fontWeight: '900' },
  memberName: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: '800' },
  youLabel: { color: colors.coralDark, fontSize: 13, fontWeight: '800' },
  herePill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: colors.mintPale },
  hereText: { color: colors.ink, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  placeholderCard: { alignItems: 'flex-start', marginTop: 18, padding: 23, borderRadius: 24, backgroundColor: colors.paper, borderWidth: 1, borderColor: '#EEF1EE' },
  placeholderIcon: { width: 39, height: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.mintPale, marginBottom: 18 },
  placeholderIconText: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  placeholderTitle: { color: colors.ink, fontSize: 21, lineHeight: 27, fontWeight: '900', letterSpacing: -0.55, marginTop: 5 },
  placeholderText: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 8 },
});
