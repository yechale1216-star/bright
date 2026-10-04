/**
 * Shared frontend password validation – mirrors the backend rules exactly.
 * Requirements:
 *  - At least 8 characters
 *  - At least 1 uppercase letter (A–Z)
 *  - At least 1 lowercase letter (a–z)
 *  - At least 1 number (0–9)
 */

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_REQUIREMENTS =
  'Password must be at least 8 characters and contain at least 1 uppercase letter (A–Z), 1 lowercase letter (a–z), and 1 number (0–9).';

export interface PasswordValidation {
  isValid: boolean;
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  message: string;
}

export function validatePassword(password: string): PasswordValidation {
  const hasMinLength = password.length >= PASSWORD_MIN_LENGTH;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isValid = hasMinLength && hasUppercase && hasLowercase && hasNumber;

  const missing: string[] = [];
  if (!hasMinLength) missing.push('at least 8 characters');
  if (!hasUppercase) missing.push('1 uppercase letter (A–Z)');
  if (!hasLowercase) missing.push('1 lowercase letter (a–z)');
  if (!hasNumber) missing.push('1 number (0–9)');

  const message = isValid
    ? '✓ Password meets all requirements'
    : `Password must include: ${missing.join(', ')}.`;

  return { isValid, hasMinLength, hasUppercase, hasLowercase, hasNumber, message };
}

/** Visual indicator component data for password strength checker */
export function getPasswordStrengthColor(validation: PasswordValidation): string {
  const score = [
    validation.hasMinLength,
    validation.hasUppercase,
    validation.hasLowercase,
    validation.hasNumber,
  ].filter(Boolean).length;

  if (score <= 1) return 'text-red-600 dark:text-red-400';
  if (score <= 2) return 'text-orange-500 dark:text-orange-400';
  if (score === 3) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-green-600 dark:text-green-400';
}
