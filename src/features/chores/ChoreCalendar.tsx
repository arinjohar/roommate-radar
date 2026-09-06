import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { services, type ChoreService } from '../../services';
import { colors, spacing } from '../../theme/tokens';
import type { Chore, Completion, Member } from '../../types/domain';
import { calendarOccurrences, dateKey, type CalendarOccurrence } from './calendarSchedule';

type Props = { householdId: string; memberId: string; service?: ChoreService };
const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfMonth(date: Date) { return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)); }
function addMonths(date: Date, amount: number) { return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1)); }
function dayLabel(date: Date) { return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }); }
function assignees(chore: Chore, members: Member[], viewerId: string) {
  if (!chore.assigneeIds.length) return 'Everyone';
  return chore.assigneeIds.map((id) => id === viewerId ? 'You' : members.find((member) => member.id === id)?.displayName ?? 'A roommate').join(' and ');
}

export function ChoreCalendar({ householdId, memberId, service = services.chores }: Props) {
  const [chores, setChores] = useState<Chore[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [snapshot, roster] = await Promise.all([service.getBoard(householdId), services.households.listMembers(householdId)]);
      setChores(snapshot.chores); setCompletions(snapshot.completions); setMembers(roster);
    } catch {
      setError('We couldn’t load the shared calendar. Please try again.');
    } finally { setLoading(false); }
  }, [householdId, service]);

  useEffect(() => { void load(); }, [load]);

  const range = useMemo(() => ({ from: startOfMonth(month), to: addMonths(month, 1) }), [month]);
  const occurrences = useMemo(() => calendarOccurrences(chores, range.from, range.to), [chores, range]);
  const byDay = useMemo(() => occurrences.reduce((days, occurrence) => {
    const key = dateKey(occurrence.dueAt);
    days.set(key, [...(days.get(key) ?? []), occurrence]);
    return days;
  }, new Map<string, CalendarOccurrence[]>()), [occurrences]);
  const selected = byDay.get(selectedDate) ?? [];
  const firstWeekday = range.from.getUTCDay();
  const daysInMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => index < firstWeekday ? null : new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), index - firstWeekday + 1)));

  if (loading) return <View style={styles.state}><ActivityIndicator color={colors.coral} /><Text style={styles.stateText}>Gathering your household’s schedule…</Text></View>;
  if (error) return <View style={styles.state}><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View>;

  return <View style={styles.card}>
    <View style={styles.heading}><View><Text style={styles.kicker}>SHARED CALENDAR</Text><Text style={styles.title}>Plan the work, together.</Text></View><View style={styles.shared}><Text style={styles.sharedText}>Everyone sees this</Text></View></View>
    <View style={styles.monthNav}><Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth((value) => addMonths(value, -1))} style={styles.monthButton}><Text style={styles.monthButtonText}>‹</Text></Pressable><Text accessibilityRole="header" style={styles.monthTitle}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })}</Text><Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => setMonth((value) => addMonths(value, 1))} style={styles.monthButton}><Text style={styles.monthButtonText}>›</Text></Pressable></View>
    <View style={styles.weekRow}>{weekDays.map((day) => <Text key={day} style={styles.weekDay}>{day}</Text>)}</View>
    <View style={styles.grid}>{cells.map((date, index) => {
      if (!date) return <View key={`blank-${index}`} style={styles.dayCell} />;
      const key = dateKey(date); const due = byDay.get(key) ?? []; const isSelected = selectedDate === key;
      return <Pressable key={key} accessibilityRole="button" accessibilityLabel={`${dayLabel(date)}${due.length ? `, ${due.length} chore${due.length === 1 ? '' : 's'} due` : ', no chores due'}`} accessibilityState={{ selected: isSelected }} onPress={() => setSelectedDate(key)} style={[styles.dayCell, isSelected && styles.daySelected]}><Text style={[styles.dayNumber, isSelected && styles.dayNumberSelected]}>{date.getUTCDate()}</Text>{due.slice(0, 2).map((item) => <View key={item.id} style={[styles.dot, item.isProjected && styles.projectedDot]} />)}{due.length > 2 ? <Text style={styles.more}>+{due.length - 2}</Text> : null}</Pressable>;
    })}</View>
    <View style={styles.detail}><Text style={styles.detailKicker}>{dayLabel(new Date(`${selectedDate}T12:00:00.000Z`)).toUpperCase()}</Text>{selected.length ? selected.map((occurrence) => {
      const done = !occurrence.isProjected && completions.some((completion) => completion.choreId === occurrence.chore.id);
      return <View key={occurrence.id} style={styles.chore}><View style={[styles.status, done ? styles.statusDone : styles.statusOpen]}><Text style={styles.statusText}>{done ? 'Done' : occurrence.isProjected ? 'Planned' : 'Due'}</Text></View><View style={styles.choreCopy}><Text style={styles.choreTitle}>{occurrence.chore.title}</Text><Text style={styles.choreMeta}>{assignees(occurrence.chore, members, memberId)} · {occurrence.chore.points} pts</Text></View></View>;
    }) : <Text style={styles.empty}>No chores are due this day. A little breathing room for the household.</Text>}</View>
  </View>;
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.md, padding: spacing.md, borderRadius: 22, backgroundColor: colors.paper, borderWidth: 1, borderColor: '#EEF1EE' },
  heading: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }, kicker: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, title: { color: colors.ink, marginTop: 5, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 }, shared: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.mintPale }, sharedText: { color: colors.ink, fontSize: 9, fontWeight: '800' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md }, monthTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' }, monthButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#FFF0E8' }, monthButtonText: { color: colors.coralDark, fontSize: 25, fontWeight: '700', lineHeight: 28 },
  weekRow: { flexDirection: 'row', marginTop: spacing.sm }, weekDay: { width: '14.2857%', color: colors.muted, textAlign: 'center', fontSize: 9, fontWeight: '900' }, grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }, dayCell: { width: '14.2857%', minHeight: 53, paddingTop: 6, alignItems: 'center', borderRadius: 10 }, daySelected: { backgroundColor: colors.ink }, dayNumber: { color: colors.ink, fontSize: 13, fontWeight: '800' }, dayNumberSelected: { color: colors.paper }, dot: { width: 6, height: 6, borderRadius: 3, marginTop: 3, backgroundColor: colors.coral }, projectedDot: { backgroundColor: colors.mint }, more: { color: colors.muted, fontSize: 8, fontWeight: '800', marginTop: 2 },
  detail: { marginTop: spacing.md, padding: spacing.sm, borderRadius: 16, backgroundColor: colors.cream }, detailKicker: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }, chore: { flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'center' }, status: { width: 53, alignItems: 'center', paddingVertical: 5, borderRadius: 999 }, statusOpen: { backgroundColor: '#FFF0E8' }, statusDone: { backgroundColor: colors.mintPale }, statusText: { color: colors.ink, fontSize: 9, fontWeight: '900' }, choreCopy: { flex: 1 }, choreTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' }, choreMeta: { color: colors.muted, marginTop: 2, fontSize: 11, fontWeight: '600' }, empty: { color: colors.muted, marginTop: 9, fontSize: 12, lineHeight: 18 },
  state: { marginTop: spacing.md, minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: 22, backgroundColor: colors.paper }, stateText: { color: colors.muted, fontSize: 13, fontWeight: '700' }, error: { color: colors.danger, textAlign: 'center', fontSize: 13, fontWeight: '700' }, retry: { marginTop: 4, paddingHorizontal: 18, minHeight: 43, justifyContent: 'center', borderRadius: 13, backgroundColor: colors.ink }, retryText: { color: colors.paper, fontSize: 13, fontWeight: '900' },
});
