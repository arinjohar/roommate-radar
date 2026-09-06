import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  calculateFairnessScore,
  calculateMemberEffort,
  getFairnessStatus,
  getPulseInsight,
  suggestRebalance,
} from '../../fairness/engine';
import { services } from '../../services';
import { colors, spacing } from '../../theme/tokens';
import type { Chore, Completion, Member, PulseResponse } from '../../types/domain';

function currentWeek() {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return {
    weekStart: start.toISOString().slice(0, 10),
    from: start.toISOString(),
    to: end.toISOString(),
  };
}

function formatWeekStart(weekStart: string) {
  return new Date(`${weekStart}T00:00:00.000Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function FairnessPanel({ householdId, memberId, mode }: { householdId: string; memberId: string; mode: 'balance' | 'pulse' }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [chores, setChores] = useState<Chore[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [responses, setResponses] = useState<PulseResponse[]>([]);
  const [pointTotals, setPointTotals] = useState<Record<string, number>>({});
  const [ratings, setRatings] = useState({ cleanliness: 3, noise: 3, communication: 3 });
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const week = currentWeek();

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    const refresh = () => Promise.all([
      services.households.listMembers(householdId),
      services.chores.list(householdId),
      services.chores.listCompletions(householdId, week.from, week.to),
      services.pulse.list(householdId, week.weekStart),
      services.chores.listMemberPoints(householdId),
    ]).then(([nextMembers, nextChores, nextCompletions, nextResponses, totals]) => {
      if (!active) return;
      setMembers(nextMembers);
      setChores(nextChores);
      setCompletions(nextCompletions);
      setResponses(nextResponses);
      setPointTotals(Object.fromEntries(totals.map((item) => [item.memberId, item.totalPoints])));
      setError(null);
    }).catch(() => {
      if (active) setError('We could not load the household picture. Please try again.');
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    void refresh();
    const interval = setInterval(() => void refresh(), 3000);
    return () => { active = false; clearInterval(interval); };
  }, [householdId, week.from, week.to, week.weekStart]);

  const effort = useMemo(() => calculateMemberEffort(members, completions), [members, completions]);
  const fairnessScore = useMemo(() => calculateFairnessScore(effort), [effort]);
  const status = getFairnessStatus(effort);
  const suggestion = suggestRebalance(effort, chores, completions);
  const weeklyResponses = useMemo(
    () => responses.filter((response) => /^\d{4}-\d{2}-\d{2}$/.test(response.weekStart) && response.weekStart === week.weekStart),
    [responses, week.weekStart],
  );
  const insight = getPulseInsight(weeklyResponses);
  const weeklyRoommateReports = useMemo(() => {
    const responseByMember = new Map(weeklyResponses.map((response) => [response.memberId, response]));
    return members
      .filter((member) => member.id !== memberId)
      .map((member) => ({ member, response: responseByMember.get(member.id) }))
      .filter((report): report is { member: Member; response: PulseResponse } => Boolean(report.response));
  }, [memberId, members, weeklyResponses]);

  if (isLoading) return <View style={styles.loading}><ActivityIndicator color={colors.coral} /></View>;
  if (error) return <View style={styles.error}><Text style={styles.body}>{error}</Text></View>;

  if (mode === 'balance') {
    return <View style={styles.stack}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}><Text style={styles.kicker}>THIS WEEK’S EFFORT</Text><Text style={styles.title}>Everyone’s share, at a glance</Text></View>
        <View style={styles.status}><Text style={styles.statusText}>{fairnessScore === null ? 'Waiting for data' : status === 'balanced' ? 'In balance' : 'Needs a nudge'}</Text></View>
      </View>
      <View style={styles.scoreCard}>
        <View style={styles.scoreCopy}>
          <Text style={styles.kicker}>FAIRNESS SCORE</Text>
          <Text style={styles.scoreTitle}>How closely this week matches an equal share</Text>
          <Text style={styles.help}>{fairnessScore === null
            ? 'Complete at least one chore in a household with two or more roommates to calculate a score.'
            : 'A score of 100 means everyone completed exactly their equal share of effort points this week.'}</Text>
        </View>
        {fairnessScore === null ? <View style={styles.scoreEmpty}><Text style={styles.scoreEmptyText}>—</Text></View> : <View accessibilityLabel={`Fairness Score, ${fairnessScore} out of 100`} style={styles.scoreValue}>
          <Text style={styles.scoreNumber}>{fairnessScore}</Text>
          <Text style={styles.scoreOutOf}>/100</Text>
        </View>}
      </View>
      <View style={styles.card}>
        {effort.length === 0 ? <Text style={styles.body}>Invite a roommate to start seeing the household balance.</Text> : effort.map((member) => {
          const fill = member.expected ? Math.min(member.actual / (member.expected * 1.6), 1) * 100 : 0;
          return <View key={member.id} style={styles.effortRow}>
            <View style={[styles.avatar, { backgroundColor: member.avatarColor }]}><Text style={styles.avatarText}>{member.displayName.slice(0, 2).toUpperCase()}</Text></View>
            <View style={styles.effortMain}>
              <View style={styles.names}><Text style={styles.name}>{member.displayName}</Text><Text style={styles.points}>{member.actual} pts</Text></View>
              <View style={styles.track}><View style={[styles.fill, { backgroundColor: member.avatarColor, width: `${fill}%` }]} /></View>
              <Text style={styles.note}>{pointTotals[member.id] ?? 0} points earned overall</Text>
            </View>
          </View>;
        })}
        {effort.length > 0 ? <Text style={styles.note}>The shared pace is {effort[0].expected.toFixed(1)} points per roommate.</Text> : null}
      </View>
      {suggestion ? <View style={styles.insight}>
        <View style={styles.insightIcon}><Text style={styles.spark}>✦</Text></View>
        <View style={styles.insightCopy}><Text style={styles.kicker}>A KIND NEXT STEP</Text><Text style={styles.insightTitle}>Try a small handoff</Text><Text style={styles.body}>{suggestion.member.displayName} could take “{suggestion.chore.title}” for {suggestion.chore.points} points to bring the week closer to balance.</Text></View>
      </View> : null}
      <Text style={styles.footnote}>A conversation starter, never a public scoreboard.</Text>
    </View>;
  }

  const submit = async () => {
    if (submitted) return;
    try {
      const response = await services.pulse.submit(householdId, week.weekStart, ratings);
      setResponses((current) => [...current.filter((item) => item.memberId !== response.memberId), response]);
      setSubmitted(true);
    } catch {
      setError('We could not share that check-in. Please try again.');
    }
  };

  return <View style={styles.stack}>
    <View style={styles.insight}>
      <View style={styles.insightIcon}><Text style={styles.spark}>✦</Text></View>
      <View style={styles.insightCopy}><Text style={styles.kicker}>HOUSEHOLD INSIGHT</Text><Text style={styles.body}>{insight?.message ?? 'Once the house checks in, a shared pattern will appear here.'}</Text></View>
    </View>
    <View style={styles.card}>
      <Text style={styles.kicker}>YOUR PRIVATE CHECK-IN</Text>
      <Text style={styles.title}>How did this week feel?</Text>
      <Text style={styles.help}>Choose 1 for “needs attention” through 5 for “feeling good.” Your report is visible only inside this household.</Text>
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
      <Pressable accessibilityRole="button" disabled={submitted} onPress={() => void submit()} style={[styles.submit, submitted && styles.submitDone]}>
        <Text style={styles.submitText}>{submitted ? 'Check-in shared ✓' : 'Share my check-in'}</Text>
      </Pressable>
    </View>
    <View style={styles.card}>
      <View>
        <Text style={styles.kicker}>THIS WEEK’S REPORTS</Text>
        <Text style={styles.title}>How your roommates are feeling</Text>
        <Text style={styles.help}>Week of {formatWeekStart(week.weekStart)} · Shared within your household to make kind, specific conversations easier.</Text>
      </View>
      {weeklyRoommateReports.length === 0 ? <View style={styles.reportsEmpty}>
        <Text style={styles.reportsEmptyTitle}>No roommate reports yet</Text>
        <Text style={styles.help}>Reports from other household members will appear here after they check in.</Text>
      </View> : weeklyRoommateReports.map(({ member, response }) => <View key={response.id} style={styles.report}>
        <View style={styles.reportHeader}>
          <View style={[styles.avatar, { backgroundColor: member.avatarColor }]}><Text style={styles.avatarText}>{member.displayName.slice(0, 2).toUpperCase()}</Text></View>
          <View style={styles.reportHeading}><Text style={styles.name}>{member.displayName}</Text><Text style={styles.reportWeek}>Week of {formatWeekStart(response.weekStart)}</Text></View>
        </View>
        <View style={styles.reportScores}>
          <ReportScore label="Cleanliness" value={response.cleanliness} />
          <ReportScore label="Shared quiet" value={response.noise} />
          <ReportScore label="Communication" value={response.communication} />
        </View>
      </View>)}
    </View>
  </View>;
}

function ReportScore({ label, value }: { label: string; value: number }) {
  return <View style={styles.reportScore}>
    <Text style={styles.reportScoreLabel}>{label}</Text>
    <Text accessibilityLabel={`${label}, ${value} out of 5`} style={styles.reportScoreValue}>{value}/5</Text>
  </View>;
}

const styles = StyleSheet.create({
  stack: { marginTop: spacing.md, gap: spacing.md },
  loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center' },
  error: { marginTop: spacing.md, padding: spacing.md, borderRadius: 18, backgroundColor: '#FFF0E8' },
  heading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.sm },
  headingCopy: { flex: 1, minWidth: 0 },
  kicker: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginBottom: 5 },
  title: { color: colors.ink, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  status: { flexShrink: 0, backgroundColor: '#FFF0E8', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  statusText: { color: colors.coralDark, fontSize: 9, fontWeight: '900' },
  scoreCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: 22, backgroundColor: colors.mintPale, borderWidth: 1, borderColor: '#CFE9DF' },
  scoreCopy: { flex: 1, minWidth: 0 },
  scoreTitle: { color: colors.ink, fontSize: 15, lineHeight: 20, fontWeight: '900', marginBottom: 5 },
  scoreValue: { width: 82, height: 82, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  scoreNumber: { color: colors.paper, fontSize: 30, lineHeight: 33, fontWeight: '900', letterSpacing: -1 },
  scoreOutOf: { color: colors.mint, fontSize: 10, fontWeight: '800' },
  scoreEmpty: { width: 82, height: 82, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  scoreEmptyText: { color: colors.muted, fontSize: 28, fontWeight: '800' },
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
  reportsEmpty: { padding: spacing.sm, borderRadius: 15, backgroundColor: colors.mintPale },
  reportsEmptyTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', marginBottom: 3 },
  report: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line },
  reportHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reportHeading: { flex: 1 },
  reportWeek: { color: colors.muted, fontSize: 10, marginTop: 2 },
  reportScores: { flexDirection: 'row', gap: 7 },
  reportScore: { flex: 1, minWidth: 0, paddingHorizontal: 8, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.mintPale },
  reportScoreLabel: { color: colors.muted, fontSize: 9, lineHeight: 12, fontWeight: '800' },
  reportScoreValue: { color: colors.ink, fontSize: 15, fontWeight: '900', marginTop: 4 },
});
