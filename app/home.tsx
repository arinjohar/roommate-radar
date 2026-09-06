import { useEffect, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../src/components/AppHeader';
import { useHouseholdSession } from '../src/context/HouseholdSessionContext';
import { ChoreBoard } from '../src/features/chores/ChoreBoard';
import { FairnessPanel } from '../src/features/fairness/FairnessPanel';
import { MembersPanel } from '../src/features/members/MembersPanel';
import { services } from '../src/services';
import { colors, spacing } from '../src/theme/tokens';
import type { Member } from '../src/types/domain';

const tabs = ['Chores', 'Balance', 'Pulse', 'Members'] as const;
type Tab = typeof tabs[number];

export default function HomeScreen() {
  const router = useRouter();
  const { session, leaveHousehold, deleteHousehold, transferOwnershipAndLeave } = useHouseholdSession();
  const [activeTab, setActiveTab] = useState<Tab>('Chores');
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [exitDialog, setExitDialog] = useState<'owner-leave' | 'delete' | null>(null);
  const [isOwnerMenuOpen, setIsOwnerMenuOpen] = useState(false);
  const [newOwnerId, setNewOwnerId] = useState('');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!session || !isProfileSettingsOpen) return;
    let active = true;
    services.households.listMembers(session.household.id)
      .then((items) => { if (active) setMembers(items); })
      .catch(() => { if (active) setProfileError('We could not load the household members. Try again.'); });
    return () => { active = false; };
  }, [isProfileSettingsOpen, session]);

  if (!session) return <Redirect href="/" />;

  const initial = session.member.displayName.slice(0, 1).toUpperCase();
  const isCreator = session.household.creatorMemberId === session.member.id;
  const eligibleNewOwners = members.filter((member) => member.id !== session.member.id);
  const selectedNewOwner = eligibleNewOwners.find((member) => member.id === newOwnerId);

  const finishExit = async (action: 'leave' | 'delete' | 'transfer') => {
    setProfileError(null);
    setIsProcessing(true);
    try {
      if (action === 'delete') await deleteHousehold();
      else if (action === 'transfer') await transferOwnershipAndLeave(newOwnerId);
      else await leaveHousehold();
      setExitDialog(null);
      router.replace('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setProfileError(message.startsWith('Supabase request failed')
        ? 'We couldn’t finish that household change. Please try again.'
        : message || 'Something went wrong. Try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return <View style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <AppHeader />
      {isProfileSettingsOpen ? <>
        <View style={styles.profileSettingsHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to household" hitSlop={10} onPress={() => setIsProfileSettingsOpen(false)} style={styles.profileBackButton}><Text style={styles.profileBackText}>‹ Back</Text></Pressable>
          <Text style={styles.eyebrow}>PROFILE SETTINGS</Text>
        </View>
        <View style={styles.profileCard}>
          <View style={[styles.profileAvatar, { backgroundColor: session.member.avatarColor }]}><Text style={styles.profileAvatarText}>{initial}</Text></View>
          <Text style={styles.profileName}>{session.member.displayName}</Text>
          <Text style={styles.profileHousehold}>{isCreator ? 'Household creator' : 'Member'} of {session.household.name}</Text>
        </View>
        <View style={styles.profileSection}>
          <Text style={styles.eyebrow}>HOUSEHOLD</Text>
          <Text style={styles.profileSectionTitle}>Your shared home</Text>
          <Text style={styles.profileSectionCopy}>{isCreator ? 'As the creator, you can delete this household or pass ownership to one roommate before leaving.' : 'Leaving removes your membership and returns you to the welcome screen.'}</Text>
          {profileError ? <Text accessibilityLiveRegion="polite" style={styles.profileError}>{profileError}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={`Leave ${session.household.name}`} onPress={() => isCreator ? setExitDialog('owner-leave') : void finishExit('leave')} style={({ pressed }) => [styles.leaveButton, pressed && styles.pressed]}><Text style={styles.leaveButtonText}>Leave household</Text></Pressable>
          {isCreator ? <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${session.household.name}`} onPress={() => setExitDialog('delete')} style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}><Text style={styles.profileDeleteButtonText}>Delete household</Text></Pressable> : null}
        </View>
      </> : <>
      <View style={styles.welcomeRow}>
        <View>
          <Text style={styles.eyebrow}>YOUR HOUSEHOLD</Text>
          <Text style={styles.title}>{session.household.name}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Open profile settings" hitSlop={8} onPress={() => setIsProfileSettingsOpen(true)} style={({ pressed }) => [styles.avatar, { backgroundColor: session.member.avatarColor }, pressed && styles.pressed]}><Text style={styles.avatarText}>{initial}</Text></Pressable>
      </View>
      <View style={styles.inviteCard}>
        <Text style={styles.inviteLabel}>SHARE THIS INVITE CODE</Text>
        <Text style={styles.inviteCode}>{session.household.inviteCode}</Text>
        <Text style={styles.inviteCopy}>Send it to your roommates so everyone starts from the same calm, shared view.</Text>
      </View>
      <Text style={styles.next}>A calmer week starts here.</Text>
      <Text style={styles.nextCopy}>Here’s a friendly, at-a-glance view of the work your household is sharing.</Text>
      <View style={styles.tabRow}>{tabs.map((tab) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab }} key={tab} onPress={() => setActiveTab(tab)} style={[styles.tab, activeTab === tab && styles.tabActive]}><Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text></Pressable>)}</View>
      <HouseholdPanel activeTab={activeTab} householdId={session.household.id} householdName={session.household.name} memberId={session.member.id} />
      </>}
    </ScrollView>
    <Modal transparent animationType="fade" visible={exitDialog !== null} onRequestClose={() => !isProcessing && setExitDialog(null)}>
      <View style={styles.modalBackdrop}>
        <View accessibilityViewIsModal style={styles.modalCard}>
          <Text style={styles.eyebrow}>{exitDialog === 'delete' ? 'DELETE HOUSEHOLD' : 'BEFORE YOU LEAVE'}</Text>
          <Text style={styles.modalTitle}>{exitDialog === 'delete' ? `Delete ${session.household.name}?` : 'Choose what happens to your household'}</Text>
          <Text style={styles.modalCopy}>{exitDialog === 'delete' ? 'This permanently removes the household and its shared history for everyone.' : 'A household must always have one owner. Delete it, or transfer ownership to one current roommate and leave.'}</Text>
          {profileError ? <Text accessibilityLiveRegion="polite" style={styles.profileError}>{profileError}</Text> : null}
          {exitDialog === 'owner-leave' ? <>
            <Pressable accessibilityRole="button" accessibilityLabel="Choose new household owner" accessibilityState={{ expanded: isOwnerMenuOpen }} onPress={() => setIsOwnerMenuOpen((open) => !open)} style={styles.ownerSelect}>
              <Text style={[styles.ownerSelectText, !selectedNewOwner && styles.ownerPlaceholder]}>{selectedNewOwner?.displayName ?? 'Choose one roommate'}</Text>
              <Text style={styles.ownerChevron}>{isOwnerMenuOpen ? '⌃' : '⌄'}</Text>
            </Pressable>
            {isOwnerMenuOpen ? <View style={styles.ownerOptions}>{eligibleNewOwners.length ? eligibleNewOwners.map((member) => <Pressable key={member.id} accessibilityRole="radio" accessibilityState={{ selected: member.id === newOwnerId }} onPress={() => { setNewOwnerId(member.id); setIsOwnerMenuOpen(false); }} style={[styles.ownerOption, member.id === newOwnerId && styles.ownerOptionSelected]}><Text style={styles.ownerOptionText}>{member.displayName}</Text>{member.id === newOwnerId ? <Text style={styles.ownerCheck}>✓</Text> : null}</Pressable>) : <Text style={styles.noOwnerOption}>Invite another roommate before transferring ownership.</Text>}</View> : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Transfer ownership and leave" disabled={!newOwnerId || isProcessing} onPress={() => void finishExit('transfer')} style={[styles.transferButton, (!newOwnerId || isProcessing) && styles.disabledButton]}>{isProcessing ? <ActivityIndicator color={colors.paper} /> : <Text style={styles.transferButtonText}>Transfer ownership and leave</Text>}</Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Delete household instead" disabled={isProcessing} onPress={() => void finishExit('delete')} style={[styles.modalDeleteButton, isProcessing && styles.disabledButton]}><Text style={styles.deleteButtonText}>Delete household instead</Text></Pressable>
          </> : <Pressable accessibilityRole="button" accessibilityLabel={`Confirm delete ${session.household.name}`} disabled={isProcessing} onPress={() => void finishExit('delete')} style={[styles.modalDeleteButton, isProcessing && styles.disabledButton]}>{isProcessing ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.deleteButtonText}>Yes, delete household</Text>}</Pressable>}
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel household action" disabled={isProcessing} onPress={() => { setExitDialog(null); setIsOwnerMenuOpen(false); }} style={styles.cancelButton}><Text style={styles.cancelButtonText}>Cancel</Text></Pressable>
        </View>
      </View>
    </Modal>
  </View>;
}

function HouseholdPanel({ activeTab, householdId, householdName, memberId }: { activeTab: Tab; householdId: string; householdName: string; memberId: string }) {
  if (activeTab === 'Chores') return <ChoreBoard householdId={householdId} householdName={householdName} memberId={memberId} />;
  if (activeTab === 'Members') return <MembersPanel householdId={householdId} currentMemberId={memberId} />;
  return <FairnessPanel householdId={householdId} memberId={memberId} mode={activeTab === 'Balance' ? 'balance' : 'pulse'} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { flexGrow: 1, width: '100%', maxWidth: 580, alignSelf: 'center', paddingTop: 58, paddingHorizontal: 24, paddingBottom: spacing.xl },
  welcomeRow: { marginTop: 54, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  eyebrow: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 33, fontWeight: '900', letterSpacing: -1.3, marginTop: 6 },
  avatar: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.ink, fontWeight: '900', fontSize: 17 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  profileSettingsHeader: { marginTop: spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  profileBackButton: { paddingVertical: 8, paddingRight: 12 },
  profileBackText: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  profileCard: { marginTop: spacing.md, alignItems: 'center', padding: spacing.lg, borderRadius: 24, backgroundColor: colors.mintPale, borderWidth: 1, borderColor: colors.mint },
  profileAvatar: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { color: colors.ink, fontSize: 25, fontWeight: '900' },
  profileName: { color: colors.ink, marginTop: spacing.sm, fontSize: 24, fontWeight: '900', letterSpacing: -0.6 },
  profileHousehold: { color: colors.muted, marginTop: 5, fontSize: 13, fontWeight: '700' },
  profileSection: { marginTop: spacing.md, padding: spacing.md, borderRadius: 22, backgroundColor: colors.paper, borderWidth: 1, borderColor: '#EEF1EE' },
  profileSectionTitle: { color: colors.ink, marginTop: 4, fontSize: 19, fontWeight: '900' },
  profileSectionCopy: { color: colors.muted, marginTop: spacing.xs, fontSize: 13, lineHeight: 20 },
  leaveButton: { minHeight: 50, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#FFF0E8', borderWidth: 1, borderColor: '#F6C8BD' },
  leaveButtonText: { color: colors.danger, fontSize: 14, fontWeight: '900' },
  deleteButton: { minHeight: 50, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.danger },
  profileDeleteButtonText: { color: colors.paper, fontSize: 14, fontWeight: '900' },
  deleteButtonText: { color: colors.danger, fontSize: 14, fontWeight: '900' },
  profileError: { color: colors.danger, marginTop: spacing.sm, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: 'rgba(22, 44, 47, 0.42)' },
  modalCard: { width: '100%', maxWidth: 480, alignSelf: 'center', padding: spacing.lg, borderRadius: 24, backgroundColor: colors.paper },
  modalTitle: { color: colors.ink, marginTop: 6, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  modalCopy: { color: colors.muted, marginTop: spacing.xs, fontSize: 13, lineHeight: 20 },
  ownerSelect: { minHeight: 50, marginTop: spacing.md, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, borderWidth: 1, borderColor: colors.mint, backgroundColor: colors.mintPale },
  ownerSelectText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  ownerPlaceholder: { color: colors.muted },
  ownerChevron: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  ownerOptions: { marginTop: 6, overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: '#DDE8E4' },
  ownerOption: { minHeight: 46, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.paper, borderBottomWidth: 1, borderBottomColor: '#EEF1EE' },
  ownerOptionSelected: { backgroundColor: colors.mintPale },
  ownerOptionText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  ownerCheck: { color: colors.coralDark, fontSize: 16, fontWeight: '900' },
  noOwnerOption: { color: colors.muted, padding: 14, fontSize: 12, lineHeight: 18 },
  transferButton: { minHeight: 50, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.ink },
  transferButtonText: { color: colors.paper, fontSize: 14, fontWeight: '900' },
  modalDeleteButton: { minHeight: 50, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#FFF0E8', borderWidth: 1, borderColor: '#F6C8BD' },
  cancelButton: { minHeight: 46, marginTop: spacing.xs, alignItems: 'center', justifyContent: 'center' },
  cancelButtonText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  disabledButton: { opacity: 0.45 },
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
});
