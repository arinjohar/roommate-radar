import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { services } from '../../services';
import { colors, spacing } from '../../theme/tokens';
import type { Member } from '../../types/domain';

export function MembersPanel({ householdId, currentMemberId }: { householdId: string; currentMemberId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    services.households.listMembers(householdId)
      .then((nextMembers) => {
        if (!active) return;
        setMembers(nextMembers);
        setError(null);
      })
      .catch(() => {
        if (active) setError('We could not load the household roster. Please try again.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, [householdId]);

  if (isLoading) return <View style={styles.loading}><ActivityIndicator color={colors.coral} /></View>;
  if (error) return <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View>;

  return <View style={styles.card}>
    <View style={styles.heading}>
      <View>
        <Text style={styles.kicker}>YOUR HOUSEHOLD</Text>
        <Text style={styles.title}>The people at home</Text>
      </View>
      <View style={styles.count}><Text style={styles.countText}>{members.length} MEMBERS</Text></View>
    </View>
    <Text style={styles.intro}>A simple shared roster, so every check-in starts from the same calm context.</Text>
    {members.length === 0 ? <Text style={styles.empty}>Invite a roommate to start your household roster.</Text> : <View style={styles.list}>
      {members.map((member) => {
        const isCurrentMember = member.id === currentMemberId;
        return <View key={member.id} style={styles.row}>
          <View style={[styles.avatar, { backgroundColor: member.avatarColor }]}>
            <Text style={styles.avatarText}>{member.displayName.slice(0, 2).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{member.displayName}{isCurrentMember ? <Text style={styles.youLabel}> (You)</Text> : null}</Text>
          {isCurrentMember ? <View style={styles.here}><Text style={styles.hereText}>HERE</Text></View> : null}
        </View>;
      })}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center' },
  error: { marginTop: spacing.md, padding: spacing.md, borderRadius: 18, backgroundColor: '#FFF0E8' },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  card: { marginTop: spacing.md, padding: spacing.md, borderRadius: 22, backgroundColor: colors.paper, borderWidth: 1, borderColor: '#EEF1EE' },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  kicker: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: colors.ink, marginTop: 5, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  count: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#FFF0E8' },
  countText: { color: colors.coralDark, fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  intro: { color: colors.muted, marginTop: spacing.sm, fontSize: 13, lineHeight: 19 },
  empty: { color: colors.muted, marginTop: spacing.md, fontSize: 13, lineHeight: 19 },
  list: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.line },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.line },
  avatar: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.ink, fontSize: 10, fontWeight: '900' },
  name: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: '800' },
  youLabel: { color: colors.coralDark, fontSize: 13, fontWeight: '800' },
  here: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: colors.mintPale },
  hereText: { color: colors.ink, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
});
