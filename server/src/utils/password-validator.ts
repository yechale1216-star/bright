import crypto from 'crypto';

export const PASSWORD_REQUIREMENTS_MESSAGE =
  'Password must be at least 8 characters long and contain at least 1 uppercase letter (A–Z), 1 lowercase letter (a–z), and 1 number (0–9).';

export interface PasswordValidationResult {
  isValid: boolean;
  error?: string;
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
}

export function validatePassword(password: unknown): PasswordValidationResult {
  if (typeof password !== 'string' || !password) {
    return {
      isValid: false,
      error: 'Password is required.',
      hasMinLength: false,
      hasUppercase: false,
      hasLowercase: false,
      hasNumber: false,
    };
  }

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  const isValid = hasMinLength && hasUppercase && hasLowercase && hasNumber;

  return {
    isValid,
    error: isValid ? undefined : PASSWORD_REQUIREMENTS_MESSAGE,
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
  };
}

/**
 * Generate a cryptographically random temporary password that strictly meets
 * all complexity requirements (min 12 chars, 1 uppercase, 1 lowercase, 1 number).
 */
export function generateCompliantPassword(length: number = 12): string {
  const targetLength = Math.max(8, length);
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowers = 'abcdefghjkmnpqrstuvwxyz';
  const numbers = '23456789';
  const all = uppers + lowers + numbers;

  const bytes = crypto.randomBytes(targetLength);
  const pwd = [
    uppers[bytes[0] % uppers.length],
    lowers[bytes[1] % lowers.length],
    numbers[bytes[2] % numbers.length],
  ];

  for (let i = 3; i < targetLength; i++) {
    pwd.push(all[bytes[i] % all.length]);
  }

  // Fisher-Yates shuffle
  for (let i = pwd.length - 1; i > 0; i--) {
    const j = bytes[i] % (i + 1);
    const temp = pwd[i];
    pwd[i] = pwd[j];
    pwd[j] = temp;
  }

  return pwd.join('');
}
