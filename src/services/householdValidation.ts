export const HOUSEHOLD_NAME_MAX_LENGTH = 80;
export const DISPLAY_NAME_MAX_LENGTH = 60;

function characterCount(value: string) {
  return Array.from(value).length;
}

export function householdNameError(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) return 'Give your home a name so everyone recognizes it.';
  if (characterCount(normalized) > HOUSEHOLD_NAME_MAX_LENGTH) {
    return `Keep the household name to ${HOUSEHOLD_NAME_MAX_LENGTH} characters or fewer.`;
  }
  return undefined;
}

export function displayNameError(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) return 'Add the name your roommates know you by.';
  if (characterCount(normalized) > DISPLAY_NAME_MAX_LENGTH) {
    return `Keep your name to ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`;
  }
  return undefined;
}

export function validateHouseholdName(value: string): string {
  const error = householdNameError(value);
  if (error) throw new Error(error);
  return value.trim();
}

export function validateDisplayName(value: string): string {
  const error = displayNameError(value);
  if (error) throw new Error(error);
  return value.trim();
}
