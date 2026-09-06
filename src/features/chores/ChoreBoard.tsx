import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { parseSchedule, type ChoreScope } from '../../services/choreSchedule';
import type { Chore, Completion } from '../../types/domain';
import {
  services,
  type ChoreBoardSnapshot,
  type ChoreStarter,
  type ChoreService,
  type PendingChore,
  type PendingTrustChange,
  type TrustLevel,
} from '../../services';
import { filterRecentCompletions } from './completedHistory';
import { choreErrorMessage, dueDateToIso } from './choreValidation';

const colors = {
  ink: '#132A2E', muted: '#5B6E70', cream: '#FFF9F0', paper: '#FFFFFF',
  coral: '#F36F56', mint: '#9ED9C5', mintPale: '#E3F4ED', yellow: '#F4C95D', line: '#DCE6E2',
};

function viewerMemberName(memberId: string, viewerId: string, names: Record<string, string>) {
  return memberId === viewerId ? 'You' : names[memberId] ?? 'A roommate';
}

function assigneeLabel(assigneeIds: string[], viewerId: string, names: Record<string, string>) {
  if (assigneeIds.length === 0) return 'Everyone';
  return assigneeIds.map((id) => viewerMemberName(id, viewerId, names)).join(' and ');
}

function normalizeAssignees(assigneeIds: string[], memberIds: string[]) {
  return assigneeIds.includes('everyone') ? [] : memberIds.filter((id) => assigneeIds.includes(id));
}

const trustLevels: { id: TrustLevel; label: string; description: string }[] = [
  { id: 'open', label: 'Open', description: 'Add, remove, or change chores without approval.' },
  { id: 'points-and-new', label: 'Points & new chores', description: 'Approval is only needed for new chores and point changes.' },
  { id: 'everything-except-date', label: 'Review changes', description: 'Approval is needed for every change.' },
];
const completedRetentionOptions = [
  { days: 7, label: '1 week' },
  { days: 14, label: '2 weeks' },
  { days: 30, label: '30 days' },
];


function dateInputFromDueInDays(dueInDays: number | null) {
  if (dueInDays === null) return '';
  const date = new Date();
  date.setDate(date.getDate() + dueInDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dueInDaysFromDate(dueAt: string) {
  if (!dueAt) return null;
  const due = new Date(`${dueAt.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function dueIntervalLabel(dueInDays: number | null) {
  if (dueInDays === null) return null;
  return dueInDays === 0 ? 'due the same day' : `due ${dueInDays} ${dueInDays === 1 ? 'day' : 'days'} after creation`;
}

type ChoreBoardProps = {
  householdId: string;
  householdName: string;
  memberId: string;
  service?: ChoreService;
};

export function ChoreBoard({
  householdId,
  householdName,
  memberId,
  service = services.chores,
}: ChoreBoardProps) {
  const [chores, setChores] = useState<Chore[]>([]);
  const scroll = useRef<ScrollView>(null);
  const [editing, setEditing] = useState<Chore | null>(null);
  const [deleting, setDeleting] = useState<Chore | null>(null);
  const [scope, setScope] = useState<ChoreScope>('occurrence');
  const [notice, setNotice] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newPoints, setNewPoints] = useState(2);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(['everyone']);
  const [dueDate, setDueDate] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceEvery, setRecurrenceEvery] = useState(1);
  const [recurrenceUnit, setRecurrenceUnit] = useState<'days' | 'weeks' | 'months'>('weeks');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSavedOptionsOpen, setIsSavedOptionsOpen] = useState(false);
  const [isTrustLevelOpen, setIsTrustLevelOpen] = useState(false);
  const [isCompletedHistoryOpen, setIsCompletedHistoryOpen] = useState(false);
  const [trustLevel, setTrustLevel] = useState<TrustLevel>('everything-except-date');
  const [completedRetentionDays, setCompletedRetentionDays] = useState(7);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [updatingPointId, setUpdatingPointId] = useState<string | null>(null);
  const [choreStarters, setChoreStarters] = useState<ChoreStarter[]>([]);
  const [selectedStarter, setSelectedStarter] = useState<ChoreStarter | null>(null);
  const [visibleList, setVisibleList] = useState<'active' | 'completed' | 'pending'>('active');
  const [pendingChores, setPendingChores] = useState<PendingChore[]>([]);
  const [pendingTrustChanges, setPendingTrustChanges] = useState<PendingTrustChange[]>([]);
  const [householdMemberIds, setHouseholdMemberIds] = useState<string[]>([]);
  const [householdMemberNames, setHouseholdMemberNames] = useState<Record<string, string>>({});
  const [completedByFilter, setCompletedByFilter] = useState<string>('all');
  const matchingStarters = !editing && showSuggestions && newTitle.trim()
    ? choreStarters.filter((starter) => starter.title.toLowerCase().includes(newTitle.trim().toLowerCase()))
    : [];
  const recentCompletions = filterRecentCompletions(completions, completedRetentionDays);
  const activeChores = chores.filter((chore) => !chore.archivedAt && !completions.some((completion) => completion.choreId === chore.id));
  const completedChores = chores.filter((chore) => recentCompletions.some((completion) => completion.choreId === chore.id));
  const filteredCompletedChores = completedByFilter === 'all'
    ? completedChores
    : completedChores.filter((chore) => recentCompletions.find((completion) => completion.choreId === chore.id)?.memberId === completedByFilter);
  const completedSummary = recentCompletions.filter((completion) => completedByFilter === 'all' || completion.memberId === completedByFilter);
  const completedPoints = completedSummary.reduce((total, completion) => total + completion.pointsAwarded, 0);
  const pendingCount = pendingChores.length + pendingTrustChanges.length;

  const applySnapshot = useCallback((snapshot: ChoreBoardSnapshot) => {
    setChores(snapshot.chores);
    setCompletions(snapshot.completions);
    setChoreStarters(snapshot.choreStarters);
    setTrustLevel(snapshot.trustLevel);
    setCompletedRetentionDays(snapshot.completedRetentionDays);
    setPendingChores(snapshot.pendingChores);
    setPendingTrustChanges(snapshot.pendingTrustChanges);
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const members = await services.households.listMembers(householdId);
      setHouseholdMemberIds(members.map((member) => member.id));
      setHouseholdMemberNames(
        Object.fromEntries(members.map((member) => [member.id, member.displayName])),
      );
      applySnapshot(await service.getBoard(householdId));
    } catch {
      setError('We could not load this week’s chores. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [applySnapshot, householdId, service]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let isActive = true;
    const refresh = async () => {
      try {
        const snapshot = await service.getBoard(householdId);
        if (isActive) applySnapshot(snapshot);
      } catch {
        // The visible error and retry path belong to the foreground load.
      }
    };
    const interval = setInterval(() => void refresh(), 3000);
    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [applySnapshot, householdId, service]);

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

  const undoComplete = async (chore: Chore) => {
    if (undoingId) return;
    setUndoingId(chore.id);
    setError(null);
    try {
      await service.undoCompletion({ choreId: chore.id, householdId, memberId });
      applySnapshot(await service.getBoard(householdId));
      setNotice('Completion undone. Chore moved back to In progress.');
      setVisibleList('active');
    } catch (undoError) {
      setError(undoError instanceof Error ? undoError.message : 'Could not undo that completion.');
    } finally {
      setUndoingId(null);
    }
  };

  const chooseStarter = (starter: ChoreStarter) => {
    setSelectedStarter(starter);
    setNewTitle(starter.title);
    setNewPoints(starter.points);
    setAssigneeIds(starter.assigneeIds.length === 0 ? ['everyone'] : starter.assigneeIds);
    setDueDate(dateInputFromDueInDays(starter.dueInDays));
    setIsRecurring(starter.recurrence !== 'one time');
    const match = starter.recurrence.match(/^every (\d+) (day|week|month)s?$/);
    setRecurrenceEvery(match ? Number(match[1]) : 1);
    setRecurrenceUnit(match ? `${match[2]}s` as 'days' | 'weeks' | 'months' : 'weeks');
    setShowSuggestions(false);
  };

  const addChore = async () => {
    if (isAdding) return;
    setIsAdding(true);
    setError(null);
    try {
      const recurrence = isRecurring ? `every ${recurrenceEvery} ${recurrenceEvery === 1 ? recurrenceUnit.slice(0, -1) : recurrenceUnit}` : 'one time';
      const normalizedAssigneeIds = normalizeAssignees(assigneeIds, householdMemberIds);
      if (!newTitle.trim()) throw new Error('Give this chore a short, clear name.');
      const dueAt = editing && dueDate === editing.dueAt.slice(0, 10)
        ? editing.dueAt
        : dueDateToIso(dueDate);
      const input = {
        householdId,
        requestedById: memberId,
        title: newTitle,
        points: newPoints,
        assigneeIds: normalizedAssigneeIds,
        dueAt,
        dueInDays: dueInDaysFromDate(dueAt),
        recurrence,
        starterTitle: selectedStarter?.title ?? null,
      };
      if (editing) await service.requestEdit({ ...input, choreId: editing.id, expectedVersion: editing.version ?? 1, scope });
      else await service.requestChore(input);
      const snapshot = await service.getBoard(householdId);
      applySnapshot(snapshot);
      const isPending = snapshot.pendingChores.some((item) => editing ? item.choreId === editing.id : item.title === newTitle.trim());
      setNotice(isPending ? 'Sent to Pending for household approval.' : editing ? 'Chore updated.' : 'Chore added.');
      setEditing(null);
      setNewTitle('');
      setSelectedStarter(null);
      setNewPoints(2);
      setAssigneeIds(['everyone']);
      setDueDate('');
      setIsRecurring(false);
      setRecurrenceEvery(1);
      setRecurrenceUnit('weeks');
    } catch (creationError) {
      setError(choreErrorMessage(creationError, 'Could not add that chore.'));
    } finally {
      setIsAdding(false);
    }
  };

  const startEdit = (chore: Chore) => {
    setEditing(chore); setDeleting(null); setScope('occurrence'); setSelectedStarter(null);
    setNewTitle(chore.title); setNewPoints(chore.points); setAssigneeIds(chore.assigneeIds.length ? chore.assigneeIds : ['everyone']);
    setDueDate(chore.dueAt.slice(0, 10));
    const schedule = parseSchedule(chore.recurrence);
    setIsRecurring(Boolean(schedule.repeatEvery)); setRecurrenceEvery(schedule.repeatEvery ?? 1); setRecurrenceUnit(schedule.repeatUnit ?? 'weeks');
    setIsDetailsOpen(true); setShowSuggestions(false); setNotice(null);
    scroll.current?.scrollTo({ y: 0, animated: true });
  };

  const runAction = async (action: () => Promise<unknown>) => {
    if (actionBusy) return;
    setActionBusy(true); setError(null);
    try { await action(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save that change. Please try again.'); }
    finally { setActionBusy(false); }
  };

  const archive = async () => {
    if (!deleting) return;
    await service.requestArchive({ householdId, choreId: deleting.id, requestedById: memberId, scope, expectedVersion: deleting.version ?? 1 });
    const snapshot = await service.getBoard(householdId);
    applySnapshot(snapshot); setDeleting(null);
    setNotice(snapshot.pendingChores.some((item) => item.choreId === deleting.id) ? 'Deletion sent to Pending for household approval.' : 'Chore deleted. Earned points stay in history.');
  };

  const voteOnPending = async (pending: PendingChore, vote: 'approved' | 'rejected') => {
    await service.voteOnChore({ householdId, pendingId: pending.id, memberId, vote });
    applySnapshot(await service.getBoard(householdId));
  };

  const requestTrustLevelChange = async (nextTrustLevel: TrustLevel) => {
    await service.requestTrustLevelChange({ householdId, memberId, nextTrustLevel });
    applySnapshot(await service.getBoard(householdId));
  };

  const voteOnPendingTrustChange = async (pending: PendingTrustChange, vote: 'approved' | 'rejected') => {
    await service.voteOnTrustLevelChange({ householdId, pendingId: pending.id, memberId, vote });
    applySnapshot(await service.getBoard(householdId));
  };

  const updatePoints = async (chore: Chore, points: number) => {
    if (updatingPointId || points === chore.points) return;
    setUpdatingPointId(chore.id);
    setError(null);
    try {
      const updated = await service.updateChorePoints({ choreId: chore.id, householdId, points });
      setChores((current) => current.map((item) => item.id === updated.id ? updated : item));
      setChoreStarters((current) => current.map((starter) => starter.title.toLowerCase() === updated.title.toLowerCase() ? { ...starter, title: updated.title, points: updated.points } : starter));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update effort points.');
    } finally {
      setUpdatingPointId(null);
    }
  };

  const removeStarter = async (title: string) => {
    await service.removeChoreStarter(householdId, title);
    applySnapshot(await service.getBoard(householdId));
    setSelectedStarter((current) => current?.title === title ? null : current);
  };

  const updateCompletedRetention = async (days: number) => {
    await service.setCompletedRetentionDays(householdId, days);
    applySnapshot(await service.getBoard(householdId));
  };

  const toggleAssignee = (id: string) => {
    if (id === 'everyone') { setAssigneeIds(['everyone']); return; }
    setAssigneeIds((current) => {
      const withoutEveryone = current.filter((memberId) => memberId !== 'everyone');
      if (withoutEveryone.includes(id)) return withoutEveryone.length === 1 ? ['everyone'] : withoutEveryone.filter((memberId) => memberId !== id);
      return [...withoutEveryone, id];
    });
  };

  if (isSettingsOpen) {
    return <View style={styles.screen}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.settingsHeader}><Pressable accessibilityRole="button" accessibilityLabel="Back to chore board" onPress={() => setIsSettingsOpen(false)} style={styles.backButton}><Text style={styles.backButtonText}>‹ Back</Text></Pressable><Text style={styles.eyebrow}>CHORE BOARD</Text></View>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Tidy up the shared chore options your household can reuse.</Text>
      {error ? <Text accessibilityLiveRegion="polite" style={styles.errorText}>{error}</Text> : null}
      <View style={styles.settingsSection}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${isSavedOptionsOpen ? 'Hide' : 'Show'} saved chore options`} accessibilityState={{ expanded: isSavedOptionsOpen }} onPress={() => setIsSavedOptionsOpen((open) => !open)} style={styles.settingsDropdown}><Text style={styles.settingsSectionTitle}>Saved chore options</Text><Text style={styles.settingsChevron}>{isSavedOptionsOpen ? '⌃' : '⌄'}</Text></Pressable>
        {isSavedOptionsOpen ? <><Text style={styles.settingsSectionHint}>Removing an option does not affect chores already on the board.</Text>{choreStarters.map((starter) => <View key={starter.title} style={styles.settingsOption}><View style={styles.copy}><Text style={styles.settingsOptionTitle}>{starter.title}</Text><Text style={styles.meta}>{starter.points} pts · {assigneeLabel(starter.assigneeIds, memberId, householdMemberNames)}{recurrenceLabel(starter.recurrence) ? ` · ${recurrenceLabel(starter.recurrence)}` : ''}{dueIntervalLabel(starter.dueInDays) ? ` · ${dueIntervalLabel(starter.dueInDays)}` : ''}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Remove saved option ${starter.title}`} onPress={() => void runAction(() => removeStarter(starter.title))} style={styles.settingsRemove}><Text style={styles.settingsRemoveText}>Remove</Text></Pressable></View>)}</> : null}
      </View>
      <View style={styles.settingsSection}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${isTrustLevelOpen ? 'Hide' : 'Show'} trust level`} accessibilityState={{ expanded: isTrustLevelOpen }} onPress={() => setIsTrustLevelOpen((open) => !open)} style={styles.settingsDropdown}><Text style={styles.settingsSectionTitle}>Trust level</Text><Text style={styles.settingsChevron}>{isTrustLevelOpen ? '⌃' : '⌄'}</Text></Pressable>
        {isTrustLevelOpen ? <><Text style={styles.settingsSectionHint}>More open levels are sent to Pending; stricter levels apply immediately.</Text><View style={styles.trustChoices}>{trustLevels.map((level) => {
          const isCurrent = trustLevel === level.id;
          const isPending = pendingTrustChanges.some((change) => change.nextTrustLevel === level.id);
          const hasPendingTrustChange = pendingTrustChanges.length > 0;
          return <Pressable key={level.id} accessibilityRole="radio" accessibilityState={{ checked: isCurrent, disabled: hasPendingTrustChange && !isCurrent }} disabled={hasPendingTrustChange || isCurrent} onPress={() => void runAction(() => requestTrustLevelChange(level.id))} style={[styles.trustChoice, isCurrent && styles.trustChoiceSelected, isPending && styles.trustChoicePending, hasPendingTrustChange && !isPending && !isCurrent && styles.trustChoiceUnavailable]}><View style={styles.copy}><Text style={[styles.trustChoiceTitle, isCurrent && styles.trustChoiceTitleSelected]}>{level.label}</Text><Text style={[styles.trustChoiceDescription, isCurrent && styles.trustChoiceDescriptionSelected]}>{level.description}</Text>{isPending ? <Text style={styles.pendingTrustOption}>Pending approval</Text> : null}</View><View style={[styles.radioMark, isCurrent && styles.radioMarkSelected, isPending && styles.radioMarkPending]}>{isCurrent || isPending ? <View style={[styles.radioDot, isPending && styles.radioDotPending]} /> : null}</View></Pressable>;
        })}</View></> : null}
      </View>
      <View style={styles.settingsSection}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${isCompletedHistoryOpen ? 'Hide' : 'Show'} completed chore history`} accessibilityState={{ expanded: isCompletedHistoryOpen }} onPress={() => setIsCompletedHistoryOpen((open) => !open)} style={styles.settingsDropdown}><Text style={styles.settingsSectionTitle}>Completed chore history</Text><Text style={styles.settingsChevron}>{isCompletedHistoryOpen ? '⌃' : '⌄'}</Text></Pressable>
        {isCompletedHistoryOpen ? <><Text style={styles.settingsSectionHint}>Completed chores disappear after the selected amount of time.</Text><View style={styles.retentionChoices}>{completedRetentionOptions.map((option) => <FilterButton key={option.days} label={option.label} selected={completedRetentionDays === option.days} onPress={() => void runAction(() => updateCompletedRetention(option.days))} />)}</View></> : null}
      </View>
    </ScrollView></View>;
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.boardHeader}><Text style={styles.eyebrow}>{householdName.toLocaleUpperCase()} · THIS WEEK</Text><Pressable accessibilityRole="button" accessibilityLabel="Open chore board settings" onPress={() => { setIsSavedOptionsOpen(false); setIsTrustLevelOpen(false); setIsCompletedHistoryOpen(false); setIsSettingsOpen(true); }} style={styles.settingsButton}><Text style={styles.settingsGear}>⚙</Text><View pointerEvents="none" style={styles.settingsGearCenter} /></Pressable></View>
        <Text style={styles.title}>A little shared effort goes a long way.</Text>
        <Text style={styles.subtitle}>Mark a task when it’s done so the household picture stays kind and clear.</Text>

        <View style={styles.addPanel}>
          <Text style={styles.addTitle}>{editing ? 'Edit chore' : 'Add a chore'}</Text>
          <Text style={styles.addHint}>Start typing to pick a common task, or make one that fits your home.</Text>
          <TextInput
            accessibilityLabel="Chore name"
            value={newTitle}
            onChangeText={(title) => { setNewTitle(title); setSelectedStarter(null); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="What needs doing?"
            placeholderTextColor="#728285"
            style={styles.choreInput}
          />
          {matchingStarters.length > 0 ? <View style={styles.starterList}>{matchingStarters.map((starter) => <View key={starter.title} style={styles.starterOption}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Autofill ${starter.title}, ${starter.points} points`} onPress={() => chooseStarter(starter)} style={styles.starterSelect}><Text style={styles.starterOptionText}>{starter.title}</Text><Text style={styles.starterPoints}>{starter.points} pts</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Delete saved option ${starter.title}`} onPress={() => void runAction(() => removeStarter(starter.title))} style={styles.starterDelete}><Text style={styles.starterDeleteText}>×</Text></Pressable>
          </View>)}</View> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Show chore details" onPress={() => setIsDetailsOpen((open) => !open)} style={styles.detailsToggle}><Text style={styles.detailsToggleText}>Add details</Text><Text style={styles.detailsChevron}>{isDetailsOpen ? '⌃' : '⌄'}</Text></Pressable>
          {isDetailsOpen ? <View>
            <View style={styles.pointRow}><Text style={styles.pointLabel}>Effort points</Text><View style={styles.stepper}><Pressable accessibilityRole="button" accessibilityLabel="Decrease effort points" disabled={newPoints === 1} onPress={() => setNewPoints((points) => Math.max(1, points - 1))} style={[styles.stepButton, newPoints === 1 && styles.stepButtonDisabled]}><Text style={styles.stepText}>−</Text></Pressable><Text accessibilityLabel={`${newPoints} effort points`} style={styles.stepValue}>{newPoints}</Text><Pressable accessibilityRole="button" accessibilityLabel="Increase effort points" disabled={newPoints === 10} onPress={() => setNewPoints((points) => Math.min(10, points + 1))} style={[styles.stepButton, newPoints === 10 && styles.stepButtonDisabled]}><Text style={styles.stepText}>+</Text></Pressable></View></View>
            <Text style={styles.assignmentLabel}>Assign to</Text>
            <View style={styles.assignmentChoices}>{['everyone', ...householdMemberIds].map((id) => <FilterButton key={id} label={id === 'everyone' ? 'Everyone' : viewerMemberName(id, memberId, householdMemberNames)} selected={assigneeIds.includes(id)} onPress={() => toggleAssignee(id)} />)}</View>
            <Text style={styles.assignmentLabel}>Due date</Text>
            <TextInput accessibilityLabel="Due date" value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" placeholderTextColor="#728285" style={styles.choreInput} />
            <Text style={styles.assignmentLabel}>Schedule</Text>
            <View style={styles.assignmentChoices}><FilterButton label="One time" selected={!isRecurring} onPress={() => setIsRecurring(false)} /><FilterButton label="Repeats" selected={isRecurring} onPress={() => setIsRecurring(true)} /></View>
            {isRecurring ? <View style={styles.recurrenceRow}><Text style={styles.repeatLabel}>Every</Text><View style={styles.stepper}><Pressable accessibilityRole="button" accessibilityLabel="Decrease repeat interval" disabled={recurrenceEvery === 1} onPress={() => setRecurrenceEvery((value) => Math.max(1, value - 1))} style={[styles.stepButton, recurrenceEvery === 1 && styles.stepButtonDisabled]}><Text style={styles.stepText}>−</Text></Pressable><Text style={styles.stepValue}>{recurrenceEvery}</Text><Pressable accessibilityRole="button" accessibilityLabel="Increase repeat interval" onPress={() => setRecurrenceEvery((value) => value + 1)} style={styles.stepButton}><Text style={styles.stepText}>+</Text></Pressable></View><View style={styles.unitChoices}>{(['days', 'weeks', 'months'] as const).map((unit) => <FilterButton key={unit} label={unit} selected={recurrenceUnit === unit} onPress={() => setRecurrenceUnit(unit)} />)}</View></View> : null}
          </View> : null}
          {editing ? <><ScopeChoices scope={scope} onChange={setScope} /><Pressable accessibilityRole="button" onPress={() => { setEditing(null); setNewTitle(''); setNewPoints(2); setDueDate(''); setIsRecurring(false); }}><Text style={styles.retry}>Cancel edit</Text></Pressable></> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={editing ? 'Save chore changes' : 'Add new chore'} disabled={isAdding} onPress={() => void addChore()} style={({ pressed }) => [styles.addButton, isAdding && styles.addButtonDisabled, pressed && styles.pressed]}>
            <Text style={styles.addButtonText}>{isAdding ? 'Saving…' : editing ? 'Save changes' : 'Add chore'}</Text>
          </Pressable>
        </View>

        {notice ? <Text accessibilityLiveRegion="polite" style={styles.addHint}>{notice}</Text> : null}
        {deleting ? <View style={styles.addPanel}><Text style={styles.addTitle}>Delete “{deleting.title}”?</Text><Text style={styles.addHint}>Completed work and earned points stay in history.</Text><ScopeChoices scope={scope} onChange={setScope} /><View style={styles.voteRow}><Pressable accessibilityRole="button" disabled={actionBusy} style={styles.rejectButton} onPress={() => void runAction(archive)}><Text style={styles.rejectText}>{actionBusy ? 'Saving…' : 'Confirm delete'}</Text></Pressable><Pressable accessibilityRole="button" style={styles.approveButton} onPress={() => setDeleting(null)}><Text style={styles.approveText}>Cancel</Text></Pressable></View></View> : null}
        <View style={styles.listToggle}>
          <FilterButton label={`In progress · ${activeChores.length}`} selected={visibleList === 'active'} onPress={() => setVisibleList('active')} />
          <FilterButton label={`Pending · ${pendingCount}`} selected={visibleList === 'pending'} onPress={() => setVisibleList('pending')} />
          <FilterButton label={`Completed · ${completedChores.length}`} selected={visibleList === 'completed'} onPress={() => setVisibleList('completed')} />
        </View>

        {isLoading ? <View style={styles.center}><ActivityIndicator color={colors.coral} /></View> : null}
        {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.retry}>Try again</Text></Pressable></View> : null}
        {!isLoading && visibleList === 'active' && activeChores.length > 0 ? <View style={styles.list}>{activeChores.map((chore) => {
          const completion = completions.find((item) => item.choreId === chore.id);
          return <View key={chore.id}><ChoreCard chore={chore} completion={completion} viewerId={memberId} memberNames={householdMemberNames} isCompleting={completingId === chore.id} isUndoing={false} isUpdatingPoints={updatingPointId === chore.id} onComplete={() => void complete(chore)} onUndoComplete={() => undefined} onChangePoints={(points) => void updatePoints(chore, points)} /><View style={styles.voteRow}><Pressable accessibilityRole="button" accessibilityLabel={`Edit ${chore.title}`} onPress={() => startEdit(chore)} style={styles.approveButton}><Text style={styles.approveText}>Edit</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Delete ${chore.title}`} onPress={() => { setDeleting(chore); setScope('occurrence'); scroll.current?.scrollTo({ y: 0, animated: true }); }} style={styles.rejectButton}><Text style={styles.rejectText}>Delete</Text></Pressable></View></View>;
        })}</View> : null}
        {!isLoading && !error && visibleList === 'active' && activeChores.length === 0 ? <View style={styles.activeEmpty}><Text style={styles.activeEmptyTitle}>No chores in progress</Text><Text style={styles.activeEmptyText}>{pendingCount > 0 ? 'Visit Pending to review household requests.' : completedChores.length > 0 ? 'Visit Completed to see the household’s finished work.' : 'Add a chore when there’s shared work to do.'}</Text></View> : null}
        {!isLoading && visibleList === 'pending' ? <View style={styles.list}>{pendingCount === 0 ? <Text style={styles.emptyFilterText}>No chore requests are waiting for approval.</Text> : <>{pendingChores.map((pending) => <PendingCard key={pending.id} pending={pending} memberId={memberId} memberIds={householdMemberIds} memberNames={householdMemberNames} onVote={(vote) => void runAction(() => voteOnPending(pending, vote))} />)}{pendingTrustChanges.map((pending) => <PendingTrustCard key={pending.id} pending={pending} memberId={memberId} memberIds={householdMemberIds} memberNames={householdMemberNames} onVote={(vote) => void runAction(() => voteOnPendingTrustChange(pending, vote))} />)}</>}</View> : null}
        {!isLoading && visibleList === 'completed' ? <View style={styles.completedContent}>
          <Text style={styles.filterLabel}>Completed by</Text>
          <View style={styles.filters}>
            <FilterButton label="Everyone" selected={completedByFilter === 'all'} onPress={() => setCompletedByFilter('all')} />
            {householdMemberIds.map((id) => <FilterButton key={id} label={viewerMemberName(id, memberId, householdMemberNames)} selected={completedByFilter === id} onPress={() => setCompletedByFilter(id)} />)}
          </View>
          <View style={styles.completedSummary}><Text style={styles.completedSummaryText}>{completedByFilter === 'all' ? 'Everyone' : viewerMemberName(completedByFilter, memberId, householdMemberNames)} completed {completedSummary.length} {completedSummary.length === 1 ? 'task' : 'tasks'} · {completedPoints} {completedPoints === 1 ? 'point' : 'points'}</Text></View>
          {filteredCompletedChores.length === 0 ? <Text style={styles.emptyFilterText}>No completed chores by {completedByFilter === 'all' ? 'everyone' : viewerMemberName(completedByFilter, memberId, householdMemberNames)} yet.</Text> : <View style={styles.list}>{filteredCompletedChores.map((chore) => {
              const completion = recentCompletions.find((item) => item.choreId === chore.id);
              return <ChoreCard key={chore.id} chore={chore} completion={completion} viewerId={memberId} memberNames={householdMemberNames} isCompleting={false} isUndoing={undoingId === chore.id} isUpdatingPoints={updatingPointId === chore.id} onComplete={() => undefined} onUndoComplete={() => void undoComplete(chore)} onChangePoints={(points) => void updatePoints(chore, points)} />;
          })}</View>}
        </View> : null}
      </ScrollView>
    </View>
  );
}

type ChoreCardProps = { chore: Chore; completion?: Completion; viewerId: string; memberNames: Record<string, string>; isCompleting: boolean; isUndoing: boolean; isUpdatingPoints: boolean; onComplete: () => void; onUndoComplete: () => void; onChangePoints: (points: number) => void };

export function ChoreCard({ chore, completion, viewerId, memberNames: names, isCompleting, isUndoing, onComplete, onUndoComplete }: ChoreCardProps) {
  const isComplete = Boolean(completion);
  const canUndoComplete = isComplete && completion?.memberId === viewerId;
  const due = chore.dueAt ? new Date(chore.dueAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : null;
  const isOverdue = !isComplete && isPastDue(chore.dueAt);
  const assignee = assigneeLabel(chore.assigneeIds, viewerId, names);
  const repeats = recurrenceLabel(chore.recurrence);

  return <View style={[styles.card, isComplete && styles.cardComplete]}>
    <View style={styles.cardTop}>
      <View style={styles.copy}><Text style={styles.choreTitle}>{chore.title}</Text><Text style={styles.meta}>For {assignee}{due ? isOverdue ? <Text style={styles.overdue}> · overdue · was due {due}</Text> : ` · due ${due}` : ''}{repeats ? ` · ${repeats}` : ''}</Text></View>
      <View style={styles.lockedPoints}><Text style={styles.lockedPointsText}>{chore.points} pts</Text></View>
    </View>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isComplete ? canUndoComplete ? `Undo completion for ${chore.title}` : `${chore.title} completed by ${viewerMemberName(completion!.memberId, viewerId, names)}` : `Mark ${chore.title} complete`}
      accessibilityState={{ disabled: isCompleting || isUndoing || (isComplete && !canUndoComplete), busy: isCompleting || isUndoing }}
      disabled={isCompleting || isUndoing || (isComplete && !canUndoComplete)}
      onPress={canUndoComplete ? onUndoComplete : onComplete}
      style={({ pressed }) => [styles.completeButton, isComplete && styles.completeButtonDone, pressed && styles.pressed]}
    >
      <Text style={[styles.completeText, isComplete && styles.completeTextDone]}>{isComplete ? canUndoComplete ? isUndoing ? 'Undoing…' : `Undo complete · remove ${completion?.pointsAwarded} points` : `Completed by ${viewerMemberName(completion!.memberId, viewerId, names)} · +${completion?.pointsAwarded} points` : isCompleting ? 'Saving…' : 'Mark complete'}</Text>
      <Text style={[styles.check, isComplete && styles.checkDone]}>{isComplete ? canUndoComplete ? '↶' : '✓' : '○'}</Text>
    </Pressable>
  </View>;
}

function ScopeChoices({ scope, onChange }: { scope: ChoreScope; onChange: (scope: ChoreScope) => void }) {
  return <View style={styles.recurrenceRow}><Text style={styles.pointLabel}>Apply to</Text><View style={styles.assignmentChoices}><FilterButton label="This occurrence" selected={scope === 'occurrence'} onPress={() => onChange('occurrence')} /><FilterButton label="This and future" selected={scope === 'future'} onPress={() => onChange('future')} /></View></View>;
}

function FilterButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.filterButton, selected && styles.filterButtonSelected]}><Text style={[styles.filterText, selected && styles.filterTextSelected]}>{label}</Text></Pressable>;
}

function recurrenceLabel(recurrence: string) {
  if (recurrence === 'one time' || recurrence === 'once') return null;
  return recurrence === 'weekly' ? 'repeats weekly' : `repeats ${recurrence}`;
}

function isPastDue(dueAt: string) {
  if (!dueAt) return false;
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return dueAt.slice(0, 10) < todayKey;
}

function PendingCard({ pending, memberId, memberIds, memberNames: names, onVote }: { pending: PendingChore; memberId: string; memberIds: string[]; memberNames: Record<string, string>; onVote: (vote: 'approved' | 'rejected') => void }) {
  const otherMemberIds = memberIds.filter((id) => id !== pending.requestedById);
  const approvals = otherMemberIds.filter((id) => pending.approvals[id] === 'approved').length;
  const repeats = recurrenceLabel(pending.recurrence);
  const due = pending.dueAt ? new Date(pending.dueAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : null;
  const isOverdue = isPastDue(pending.dueAt);
  return <View style={styles.card}><View style={styles.cardTop}><View style={styles.copy}><Text style={styles.choreTitle}>{pending.action === 'archive' ? 'Delete: ' : pending.action === 'edit' ? 'Edit: ' : ''}{pending.title}</Text><Text style={styles.meta}>For {assigneeLabel(pending.assigneeIds, memberId, names)} · {pending.points} pts{due ? isOverdue ? <Text style={styles.overdue}> · overdue · was due {due}</Text> : ` · due ${due}` : ''}{repeats ? ` · ${repeats}` : ''}</Text></View><View style={styles.lockedPoints}><Text style={styles.lockedPointsText}>{approvals}/{otherMemberIds.length} yes</Text></View></View>{'scope' in pending ? <Text style={styles.meta}>Applies to {pending.scope === 'future' ? 'this and future occurrences' : 'this occurrence'}</Text> : null}<Text style={styles.addedBy}>Requested by {viewerMemberName(pending.requestedById, memberId, names)}</Text><Text style={styles.approvalStatus}>{otherMemberIds.map((id) => `${viewerMemberName(id, memberId, names)}: ${pending.approvals[id] === 'approved' ? 'accepted' : 'waiting'}`).join(' · ')}</Text><View style={styles.voteRow}><Pressable accessibilityRole="button" disabled={pending.approvals[memberId] === 'approved'} onPress={() => onVote('approved')} style={[styles.approveButton, pending.approvals[memberId] === 'approved' && styles.stepButtonDisabled]}><Text style={styles.approveText}>Approve</Text></Pressable><Pressable accessibilityRole="button" onPress={() => onVote('rejected')} style={styles.rejectButton}><Text style={styles.rejectText}>Reject</Text></Pressable></View></View>;
}

function PendingTrustCard({ pending, memberId, memberIds, memberNames: names, onVote }: { pending: PendingTrustChange; memberId: string; memberIds: string[]; memberNames: Record<string, string>; onVote: (vote: 'approved' | 'rejected') => void }) {
  const otherMemberIds = memberIds.filter((id) => id !== pending.requestedById);
  const approvals = otherMemberIds.filter((id) => pending.approvals[id] === 'approved').length;
  const requestedLevel = trustLevels.find((level) => level.id === pending.nextTrustLevel);
  return <View style={[styles.card, styles.pendingTrustCard]}><View style={styles.cardTop}><View style={styles.copy}><View style={styles.pendingTrustTitleRow}><Text style={styles.choreTitle}>Change trust level</Text><View pointerEvents="none" style={styles.pendingTrustGear}><Text style={styles.pendingTrustGearGlyph}>⚙</Text><View style={styles.pendingTrustGearCenter} /></View></View><Text style={styles.meta}>Requested: {requestedLevel?.label}</Text></View><View style={styles.lockedPoints}><Text style={styles.lockedPointsText}>{approvals}/{otherMemberIds.length} yes</Text></View></View>{'scope' in pending ? <Text style={styles.meta}>Applies to {pending.scope === 'future' ? 'this and future occurrences' : 'this occurrence'}</Text> : null}<Text style={styles.addedBy}>Requested by {viewerMemberName(pending.requestedById, memberId, names)}</Text><Text style={styles.approvalStatus}>{otherMemberIds.map((id) => `${viewerMemberName(id, memberId, names)}: ${pending.approvals[id] === 'approved' ? 'accepted' : 'waiting'}`).join(' · ')}</Text><View style={styles.voteRow}><Pressable accessibilityRole="button" disabled={pending.approvals[memberId] === 'approved'} onPress={() => onVote('approved')} style={[styles.approveButton, pending.approvals[memberId] === 'approved' && styles.stepButtonDisabled]}><Text style={styles.approveText}>Approve</Text></Pressable><Pressable accessibilityRole="button" onPress={() => onVote('rejected')} style={styles.rejectButton}><Text style={styles.rejectText}>Reject</Text></Pressable></View></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream }, content: { padding: 24, paddingTop: 56, paddingBottom: 44, width: '100%', maxWidth: 640, alignSelf: 'center' },
  boardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, eyebrow: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.3, borderLeftWidth: 3, borderLeftColor: colors.coral, paddingLeft: 9 }, settingsButton: { width: 39, height: 39, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line }, settingsGear: { color: colors.ink, fontSize: 25, lineHeight: 28, fontWeight: '900', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 0.6 }, settingsGearCenter: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: colors.paper },
  title: { color: colors.ink, fontSize: 34, lineHeight: 39, fontWeight: '900', letterSpacing: -1.25, marginTop: 16 }, subtitle: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 12, marginBottom: 28 },
  list: { gap: 13 }, card: { backgroundColor: colors.paper, borderRadius: 20, borderWidth: 1, borderColor: '#EEF1EE', padding: 17, shadowColor: colors.ink, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 }, cardComplete: { backgroundColor: '#F6FBF8', borderColor: colors.mint },
  addPanel: { backgroundColor: colors.mintPale, borderRadius: 21, padding: 17, marginBottom: 20, borderWidth: 1, borderColor: colors.mint }, addTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' }, addHint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 13 },
  starterList: { marginTop: 5, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 12, overflow: 'hidden' }, starterOption: { minHeight: 41, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EEF1EE' }, starterSelect: { flex: 1, minHeight: 41, paddingLeft: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, starterOptionText: { color: colors.ink, fontSize: 13, fontWeight: '700' }, starterPoints: { color: colors.coral, fontSize: 11, fontWeight: '900' }, starterDelete: { width: 40, minHeight: 41, marginLeft: 10, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: '#EEF1EE' }, starterDeleteText: { color: colors.coral, fontSize: 21, fontWeight: '700' },
  choreInput: { minHeight: 45, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 12, color: colors.ink, fontSize: 14, backgroundColor: colors.paper }, pointRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }, pointLabel: { color: colors.ink, fontSize: 13, fontWeight: '800' }, stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 }, stepButton: { height: 30, width: 30, borderRadius: 15, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, stepButtonDisabled: { opacity: 0.45 }, stepText: { color: colors.ink, fontSize: 19, lineHeight: 21, fontWeight: '700' }, stepValue: { color: colors.ink, width: 12, textAlign: 'center', fontSize: 14, fontWeight: '900' },
  addButton: { marginTop: 14, minHeight: 45, borderRadius: 13, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' }, addButtonDisabled: { opacity: 0.65 }, addButtonText: { color: colors.paper, fontSize: 14, fontWeight: '900' },
  assignmentLabel: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 14, marginBottom: 8 }, assignmentChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  recurrenceRow: { marginTop: 12, gap: 9 }, repeatLabel: { color: colors.ink, fontSize: 13, fontWeight: '800' }, unitChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  detailsToggle: { alignSelf: 'flex-start', marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 5 }, detailsToggleText: { color: colors.ink, fontSize: 13, fontWeight: '900', textDecorationLine: 'underline' }, detailsChevron: { color: colors.ink, fontSize: 17 },
  cardTop: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' }, copy: { flex: 1 }, choreTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 }, meta: { color: colors.muted, fontSize: 12, marginTop: 6 },
  overdue: { color: colors.coral, fontWeight: '900' },
  settingsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, backButton: { paddingVertical: 8, paddingRight: 10 }, backButtonText: { color: colors.ink, fontSize: 14, fontWeight: '900' }, settingsSection: { backgroundColor: colors.paper, borderRadius: 20, padding: 17, borderWidth: 1, borderColor: colors.line, marginBottom: 14 }, settingsDropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, settingsSectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' }, settingsChevron: { color: colors.ink, fontSize: 19 }, settingsSectionHint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5, marginBottom: 13 }, settingsOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#EEF1EE' }, settingsOptionTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' }, settingsRemove: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: '#FFF0E8' }, settingsRemoveText: { color: colors.coral, fontSize: 11, fontWeight: '900' }, trustChoices: { gap: 8 }, trustChoice: { borderRadius: 13, borderWidth: 1, borderColor: colors.line, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' }, trustChoiceSelected: { borderColor: colors.ink, backgroundColor: colors.mintPale }, trustChoicePending: { borderColor: '#AAB7B8', backgroundColor: '#EEF1EE', opacity: 1 }, trustChoiceUnavailable: { opacity: 0.42 }, trustChoiceTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' }, trustChoiceTitleSelected: { color: colors.ink }, trustChoiceDescription: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 }, trustChoiceDescriptionSelected: { color: colors.ink }, pendingTrustOption: { color: colors.coral, fontSize: 11, fontWeight: '900', marginTop: 7 }, radioMark: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' }, radioMarkSelected: { borderColor: colors.ink }, radioMarkPending: { borderColor: '#8C9A9B' }, radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ink }, radioDotPending: { backgroundColor: '#8C9A9B' }, retentionChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  cardPointStepper: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, padding: 3, backgroundColor: '#FFF0E8' }, cardPointButton: { height: 25, width: 25, borderRadius: 13, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' }, cardPointButtonText: { color: colors.coral, fontSize: 17, lineHeight: 19, fontWeight: '900' }, cardPointsText: { color: colors.coral, minWidth: 13, textAlign: 'center', fontSize: 12, fontWeight: '900' }, futurePointsLabel: { color: colors.muted, fontSize: 10, marginTop: 8, fontWeight: '700' },
  lockedPoints: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.mintPale }, lockedPointsText: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  completeButton: { marginTop: 15, minHeight: 46, borderRadius: 13, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }, completeButtonDone: { backgroundColor: colors.mintPale }, completeText: { color: colors.paper, fontSize: 13, fontWeight: '800' }, completeTextDone: { color: colors.ink }, check: { color: colors.mint, fontSize: 17, fontWeight: '900' }, checkDone: { color: colors.ink }, pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  center: { paddingVertical: 60, alignItems: 'center' }, error: { borderRadius: 16, backgroundColor: '#FFF0E8', padding: 16, gap: 8 }, errorText: { color: colors.ink, fontSize: 14, lineHeight: 20 }, retry: { color: colors.coral, fontSize: 13, fontWeight: '800' },
  activeEmpty: { backgroundColor: colors.paper, borderRadius: 18, padding: 19, borderWidth: 1, borderColor: colors.mint, marginBottom: 15 }, activeEmptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' }, activeEmptyText: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  listToggle: { flexDirection: 'row', gap: 8, marginBottom: 16 }, completedContent: { paddingBottom: 4 }, filterLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginBottom: 8 }, filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 }, completedSummary: { alignSelf: 'flex-start', backgroundColor: colors.mintPale, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14 }, completedSummaryText: { color: colors.ink, fontSize: 12, fontWeight: '900' }, filterButton: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line }, filterButtonSelected: { backgroundColor: colors.ink, borderColor: colors.ink }, filterText: { color: colors.ink, fontSize: 11, fontWeight: '800' }, filterTextSelected: { color: colors.paper },
  emptyFilterText: { color: colors.muted, fontSize: 13, lineHeight: 19, paddingVertical: 6 },
  approvalStatus: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 11 }, pendingTrustCard: { backgroundColor: '#EEF1EE', borderColor: '#D5DEDE' }, pendingTrustTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, pendingTrustGear: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }, pendingTrustGearGlyph: { color: colors.ink, fontSize: 16, lineHeight: 18, fontWeight: '900', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 0.4 }, pendingTrustGearCenter: { position: 'absolute', width: 5, height: 5, borderRadius: 3, backgroundColor: '#EEF1EE' }, voteRow: { flexDirection: 'row', gap: 9, marginTop: 14 }, approveButton: { flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, approveText: { color: colors.paper, fontSize: 13, fontWeight: '900' }, rejectButton: { flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: '#FFF0E8', alignItems: 'center', justifyContent: 'center' }, rejectText: { color: colors.coral, fontSize: 13, fontWeight: '900' },
  addedBy: { color: colors.ink, fontSize: 12, fontWeight: '800', marginTop: 10 },
});
