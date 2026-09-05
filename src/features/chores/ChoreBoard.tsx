import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Chore, Completion } from '../../types/domain';
import {
  choreService,
  DEMO_HOUSEHOLD_ID,
  DEMO_MEMBER_ID,
  type ChoreService,
} from '../../services/choreService';

const colors = {
  ink: '#132A2E', muted: '#5B6E70', cream: '#FFF9F0', paper: '#FFFFFF',
  coral: '#F36F56', mint: '#9ED9C5', mintPale: '#E3F4ED', yellow: '#F4C95D', line: '#DCE6E2',
};

const memberNames: Record<string, string> = {
  jamie: 'Jamie', sam: 'Sam', alex: 'Alex', morgan: 'Morgan',
};

type ChoreBoardProps = {
  householdId?: string;
  memberId?: string;
  service?: ChoreService;
};

export function ChoreBoard({
  householdId = DEMO_HOUSEHOLD_ID,
  memberId = DEMO_MEMBER_ID,
  service = choreService,
}: ChoreBoardProps) {
  const [chores, setChores] = useState<Chore[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [nextChores, nextCompletions] = await Promise.all([
        service.getWeeklyChores(householdId),
        service.getCompletions(householdId),
      ]);
      setChores(nextChores);
      setCompletions(nextCompletions);
    } catch {
      setError('We could not load this week’s chores. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [householdId, service]);

  useEffect(() => { void load(); }, [load]);

  const complete = async (chore: Chore) => {
    if (completingId || completions.some((completion) => completion.choreId === chore.id)) return;
    setCompletingId(chore.id);
    setError(null);
    try {
      const completion = await service.completeChore({ choreId: chore.id, householdId, memberId });
      setCompletions((current) => current.some((item) => item.choreId === chore.id) ? current : [...current, completion]);
    } catch (completionError) {
      setError(completionError instanceof Error ? completionError.message : 'Could not mark that chore complete.');
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <View style={styles.content}>
        <Text style={styles.eyebrow}>MAPLE HOUSE · THIS WEEK</Text>
        <Text style={styles.title}>A little shared effort goes a long way.</Text>
        <Text style={styles.subtitle}>Mark a task when it’s done so the household picture stays kind and clear.</Text>

        {isLoading ? <View style={styles.center}><ActivityIndicator color={colors.coral} /></View> : null}
        {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.retry}>Try again</Text></Pressable></View> : null}
        {!isLoading && !error && chores.length === 0 ? <EmptyState /> : null}
        {!isLoading && chores.length > 0 ? <View style={styles.list}>{chores.map((chore) => {
          const completion = completions.find((item) => item.choreId === chore.id);
          return <ChoreCard key={chore.id} chore={chore} completion={completion} isCompleting={completingId === chore.id} onComplete={() => void complete(chore)} />;
        })}</View> : null}
    </View>
  );
}

type ChoreCardProps = { chore: Chore; completion?: Completion; isCompleting: boolean; onComplete: () => void };

export function ChoreCard({ chore, completion, isCompleting, onComplete }: ChoreCardProps) {
  const isComplete = Boolean(completion);
  const dueDate = new Date(chore.dueAt);
  const due = dueDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const assignee = memberNames[chore.assigneeId] ?? 'A roommate';

  return <View style={[styles.card, isComplete && styles.cardComplete]}>
    <View style={styles.cardTop}>
      <View style={styles.copy}><Text style={styles.choreTitle}>{chore.title}</Text><Text style={styles.meta}>For {assignee} · due {due}</Text></View>
      <View style={styles.points}><Text style={styles.pointsText}>{chore.points} pt{chore.points === 1 ? '' : 's'}</Text></View>
    </View>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isComplete ? `${chore.title} completed` : `Mark ${chore.title} complete`}
      accessibilityState={{ disabled: isComplete || isCompleting, busy: isCompleting }}
      disabled={isComplete || isCompleting}
      onPress={onComplete}
      style={({ pressed }) => [styles.completeButton, isComplete && styles.completeButtonDone, pressed && styles.pressed]}
    >
      <Text style={[styles.completeText, isComplete && styles.completeTextDone]}>{isComplete ? `Completed · +${completion?.pointsAwarded} points` : isCompleting ? 'Saving…' : 'Mark complete'}</Text>
      <Text style={[styles.check, isComplete && styles.checkDone]}>{isComplete ? '✓' : '○'}</Text>
    </Pressable>
  </View>;
}

function EmptyState() {
  return <View style={styles.empty}><View style={styles.emptyIcon}><Text style={styles.emptyCheck}>✓</Text></View><Text style={styles.emptyTitle}>All clear for now</Text><Text style={styles.emptyText}>There are no chores for this week. Enjoy the extra breathing room.</Text></View>;
}

const styles = StyleSheet.create({
  content: { marginTop: 16, padding: 18, width: '100%', borderRadius: 22, backgroundColor: colors.paper, borderWidth: 1, borderColor: '#EEF1EE' },
  eyebrow: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.3, borderLeftWidth: 3, borderLeftColor: colors.coral, paddingLeft: 9 },
  title: { color: colors.ink, fontSize: 34, lineHeight: 39, fontWeight: '900', letterSpacing: -1.25, marginTop: 16 }, subtitle: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 12, marginBottom: 28 },
  list: { gap: 13 }, card: { backgroundColor: colors.paper, borderRadius: 20, borderWidth: 1, borderColor: '#EEF1EE', padding: 17, shadowColor: colors.ink, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 }, cardComplete: { backgroundColor: '#F6FBF8', borderColor: colors.mint },
  cardTop: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' }, copy: { flex: 1 }, choreTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 }, meta: { color: colors.muted, fontSize: 12, marginTop: 6 },
  points: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FFF0E8' }, pointsText: { color: colors.coral, fontSize: 11, fontWeight: '900' },
  completeButton: { marginTop: 15, minHeight: 46, borderRadius: 13, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }, completeButtonDone: { backgroundColor: colors.mintPale }, completeText: { color: colors.paper, fontSize: 13, fontWeight: '800' }, completeTextDone: { color: colors.ink }, check: { color: colors.mint, fontSize: 17, fontWeight: '900' }, checkDone: { color: colors.ink }, pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  center: { paddingVertical: 60, alignItems: 'center' }, error: { borderRadius: 16, backgroundColor: '#FFF0E8', padding: 16, gap: 8 }, errorText: { color: colors.ink, fontSize: 14, lineHeight: 20 }, retry: { color: colors.coral, fontSize: 13, fontWeight: '800' },
  empty: { alignItems: 'center', backgroundColor: colors.paper, borderRadius: 22, padding: 30, borderWidth: 1, borderColor: colors.line }, emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.mintPale, justifyContent: 'center', alignItems: 'center' }, emptyCheck: { color: colors.ink, fontSize: 22, fontWeight: '900' }, emptyTitle: { color: colors.ink, fontSize: 19, fontWeight: '900', marginTop: 16 }, emptyText: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 },
});
