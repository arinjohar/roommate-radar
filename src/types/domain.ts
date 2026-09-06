/** Shared shapes for values that cross the screen/service boundary. */
export type Chore = {
  id: string;
  householdId: string;
  title: string;
  points: number;
  assigneeId: string;
  dueAt: string;
  recurrence: string;
  isPreApproved: boolean;
  seriesId?: string;
};

export type Completion = {
  id: string;
  choreId: string;
  memberId: string;
  pointsAwarded: number;
  completedAt: string;
};
