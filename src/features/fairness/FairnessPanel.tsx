import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  calculateMemberEffort,
  getFairnessStatus,
  getPulseInsight,
  suggestRebalance,
} from '../../fairness/engine';
import { colors, spacing } from '../../theme/tokens';
import type { Chore, Completion, Member, PulseResponse } from '../../types/domain';

const householdId = 'maple-house';
const weekStart = '2026-08-31';

const members: Member[] = [
  { id: 'jamie', householdId, displayName: 'Jamie', avatarColor: colors.coral },
  { id: 'sam', householdId, displayName: 'Sam', avatarColor: colors.mint },
  { id: 'alex', householdId, displayName: 'Alex', avatarColor: colors.yellow },
  { id: 'morgan', householdId, displayName: 'Morgan', avatarColor: '#B9B2E8' },
];

const completions: Completion[] = [
  { id: 'c1', choreId: 'bathroom', memberId: 'jamie', pointsAwarded: 6, completedAt: '2026-09-01T18:00:00.000Z' },
  { id: 'c2', choreId: 'floors', memberId: 'jamie', pointsAwarded: 5, completedAt: '2026-09-02T18:00:00.000Z' },
  { id: 'c3', choreId: 'kitchen', memberId: 'sam', pointsAwarded: 3, completedAt: '2026-09-03T18:00:00.000Z' },
  { id: 'c4', choreId: 'mail', memberId: 'alex', pointsAwarded: 2, completedAt: '2026-09-04T18:00:00.000Z' },
];

const chores: Chore[] = [
  { id: 'bathroom', householdId, title: 'Clean the bathroom', points: 6, assigneeId: 'jamie', dueAt: '2026-09-01T18:00:00.000Z', recurrence: 'weekly' },
  { id: 'floors', householdId, title: 'Vacuum shared spaces', points: 5, assigneeId: 'jamie', dueAt: '2026-09-02T18:00:00.000Z', recurrence: 'weekly' },
  { id: 'kitchen', householdId, title: 'Wipe down the kitchen', points: 3, assigneeId: 'sam', dueAt: '2026-09-03T18:00:00.000Z', recurrence: 'weekly' },
  { id: 'mail', householdId, title: 'Sort the mail', points: 2, assigneeId: 'alex', dueAt: '2026-09-04T18:00:00.000Z', recurrence: 'weekly' },
  { id: 'recycling', householdId, title: 'Take out recycling', points: 2, assigneeId: 'morgan', dueAt: '2026-09-06T18:00:00.000Z', recurrence: 'weekly' },
];

const startingPulses: PulseResponse[] = [
  { id: 'p1', householdId, memberId: 'jamie', weekStart, cleanliness: 4, noise: 2, communication: 4 },
  { id: 'p2', householdId, memberId: 'sam', weekStart, cleanliness: 3, noise: 2, communication: 3 },
  { id: 'p3', householdId, memberId: 'alex', weekStart, cleanliness: 4, noise: 3, communication: 3 },
];

export function FairnessPanel({ mode }: { mode: 'balance' | 'pulse' }) {
  const [ratings, setRatings] = useState({ cleanliness: 3, noise: 3, communication: 3 });
  const [responses, setResponses] = useState(startingPulses);
  const [submitted, setSubmitted] = useState(false);
  const effort = useMemo(() => calculateMemberEffort(members, completions), []);
  const status = getFairnessStatus(effort);
  const suggestion = suggestRebalance(effort, chores, completions);
  const insight = getPulseInsight(responses);

  if (mode === 'balance') {
    return <View style={styles.stack}>
      <View style={styles.heading}>
        <View><Text style={styles.kicker}>THIS WEEK’S EFFORT</Text><Text style={styles.title}>Everyone’s share, at a glance</Text></View>
        <View style={styles.status}><Text style={styles.statusText}>{status === 'balanced' ? 'In balance' : 'Needs a nudge'}</Text></View>
      </View>
      <View style={styles.card}>
        {effort.map((member) => {
          const fill = member.expected ? Math.min(member.actual / (member.expected * 1.6), 1) * 100 : 0;
          return <View key={member.id} style={styles.effortRow}>
            <View style={[styles.avatar, { backgroundColor: member.avatarColor }]}><Text style={styles.avatarText}>{member.displayName.slice(0, 2).toUpperCase()}</Text></View>
            <View style={styles.effortMain}>
              <View style={styles.names}><Text style={styles.name}>{member.displayName}</Text><Text style={styles.points}>{member.actual} pts</Text></View>
              <View style={styles.track}><View style={[styles.fill, { backgroundColor: member.avatarColor, width: `${fill}%` }]} /></View>
            </View>
          </View>;
        })}
        <Text style={styles.note}>The shared pace is {effort[0]?.expected.toFixed(1) ?? '0'} points per roommate.</Text>
      </View>
      {suggestion ? <View style={styles.insight}>
        <View style={styles.insightIcon}><Text style={styles.spark}>✦</Text></View>
        <View style={styles.insightCopy}><Text style={styles.kicker}>A KIND NEXT STEP</Text><Text style={styles.insightTitle}>Try a small handoff</Text><Text style={styles.body}>{suggestion.member.displayName} could take “{suggestion.chore.title}” for {suggestion.chore.points} points to bring the week closer to balance.</Text></View>
      </View> : null}
      <Text style={styles.footnote}>A conversation starter, never a public scoreboard.</Text>
    </View>;
  }

  const submit = () => {
    if (submitted) return;
    setResponses((current) => [...current, { id: 'p4', householdId, memberId: 'morgan', weekStart, ...ratings }]);
    setSubmitted(true);
  };

  return <View style={styles.stack}>
    <View style={styles.insight}>
      <View style={styles.insightIcon}><Text style={styles.spark}>✦</Text></View>
      <View style={styles.insightCopy}><Text style={styles.kicker}>HOUSEHOLD INSIGHT</Text><Text style={styles.body}>{insight?.message}</Text></View>
    </View>
    <View style={styles.card}>
      <Text style={styles.kicker}>YOUR PRIVATE CHECK-IN</Text>
      <Text style={styles.title}>How did this week feel?</Text>
      <Text style={styles.help}>Choose 1 for “needs attention” through 5 for “feeling good.”</Text>
      {(['cleanliness', 'noise', 'communication'] as const).map((category) => <View key={category} style={styles.question}>
        <Text style={styles.questionLabel}>{category === 'noise' ? 'Shared quiet' : category[0].toUpperCase() + category.slice(1)}</Text>
        <View style={styles.ratingRow}>{[1, 2, 3, 4, 5].map((rating) => <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${category}, ${rating} out of 5`}
          disabled={submitted}
          key={rating}
          onPress={() => setRatings((current) => ({ ...current, [category]: rating }))}
          style={[styles.rating, ratings[category] === rating && styles.ratingSelected]}
        ><Text style={[styles.ratingText, ratings[category] === rating && styles.ratingTextSelected]}>{rating}</Text></Pressable>)}</View>
      </View>)}
      <Pressable accessibilityRole="button" disabled={submitted} onPress={submit} style={[styles.submit, submitted && styles.submitDone]}>
        <Text style={styles.submitText}>{submitted ? 'Check-in shared ✓' : 'Share my check-in'}</Text>
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  stack: { marginTop: spacing.md, gap: spacing.md },
  heading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.sm },
  kicker: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginBottom: 5 },
  title: { color: colors.ink, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  status: { backgroundColor: '#FFF0E8', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  statusText: { color: colors.coralDark, fontSize: 9, fontWeight: '900' },
  card: { padding: spacing.md, gap: spacing.sm, borderRadius: 22, backgroundColor: colors.paper, borderWidth: 1, borderColor: '#EEF1EE' },
  effortRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.ink, fontSize: 10, fontWeight: '900' },
  effortMain: { flex: 1, gap: 7 },
  names: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  points: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  track: { height: 8, overflow: 'hidden', borderRadius: 4, backgroundColor: '#EEF3F0' },
  fill: { height: 8, borderRadius: 4 },
  note: { color: colors.muted, fontSize: 11, lineHeight: 17, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.line },
  insight: { flexDirection: 'row', gap: 12, padding: spacing.md, borderRadius: 19, backgroundColor: colors.mintPale },
  insightIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  spark: { color: colors.yellow, fontSize: 16 },
  insightCopy: { flex: 1 },
  insightTitle: { color: colors.ink, fontSize: 17, fontWeight: '900', marginBottom: 5 },
  body: { color: colors.ink, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  footnote: { color: colors.muted, fontSize: 11, textAlign: 'center' },
  help: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  question: { marginTop: 7, gap: 9 },
  questionLabel: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  ratingRow: { flexDirection: 'row', gap: 8 },
  rating: { width: 41, height: 41, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#F2F5F2', borderWidth: 1, borderColor: colors.line },
  ratingSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  ratingText: { color: colors.muted, fontWeight: '900' },
  ratingTextSelected: { color: colors.paper },
  submit: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.ink, marginTop: 8 },
  submitDone: { backgroundColor: '#2E685B' },
  submitText: { color: colors.paper, fontSize: 14, fontWeight: '900' },
});
