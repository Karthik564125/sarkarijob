/**
 * Calculates accurate age in full years from a date of birth string.
 * Accurately accounts for leap years, month boundaries, and exact birthday threshold.
 */
export function calculateAge(dobStr: string | null | undefined, referenceDate = new Date()): number | null {
  if (!dobStr || typeof dobStr !== 'string') return null;
  const trimmed = dobStr.trim();
  if (!trimmed) return null;

  const parts = trimmed.split('-');
  let dob: Date;
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    dob = new Date(year, month, day);
    if (dob.getFullYear() !== year || dob.getMonth() !== month || dob.getDate() !== day) {
      return null;
    }
  } else {
    dob = new Date(trimmed);
    if (isNaN(dob.getTime())) return null;
  }

  const ref = new Date(referenceDate);
  if (isNaN(ref.getTime())) return null;

  let age = ref.getFullYear() - dob.getFullYear();
  const monthDiff = ref.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < dob.getDate())) {
    age--;
  }

  return age >= 0 ? age : null;
}
