export const MIN_PASSWORD_LENGTH = 10;

/** Returns a message that says how to fix the problem, or null when the password is fine. */
export function validatePassword(password: string, confirmation?: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters. A short sentence works well.`;
  }
  if (confirmation !== undefined && password !== confirmation) {
    return 'The two passwords don’t match. Type the same password in both boxes.';
  }
  return null;
}

/** Returns a message that says how to fix the problem, or null when the email looks right. */
export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return 'Enter your email address.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
    return 'That email is missing something. Example: name@example.com';
  }
  return null;
}
