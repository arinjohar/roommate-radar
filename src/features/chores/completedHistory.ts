import type { Completion } from '../../types/domain';

export function filterRecentCompletions(
  completions: Completion[],
  retentionDays: number,
  currentTime = Date.now(),
) {
  const cutoff = currentTime - retentionDays * 24 * 60 * 60 * 1000;
  return completions.filter((completion) => Date.parse(completion.completedAt) >= cutoff);
}
