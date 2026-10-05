export const PASSWORD_MIN_LENGTH = 12;

/**
 * Igual que LoginAuthResetDto y UpdateUsuarioContrasena:
 * letra, número, un símbolo de @$!%*?&., sin espacios, mínimo 12.
 */
export const PASSWORD_PATTERN =
  /^(?=.*\p{L})(?=.*\d)(?=.*[@$!%*?&.])[^\s]{12,}$/u;

export type PasswordRuleKey =
  | 'needLetter'
  | 'needNumber'
  | 'needSymbol'
  | 'needLength'
  | 'ok';

const GUIDE_TEXT: Record<PasswordRuleKey, string> = {
  needLetter: 'La contraseña debe tener al menos una letra.',
  needNumber: 'La contraseña debe tener al menos un número.',
  needSymbol:
    'La contraseña debe incluir un símbolo de estos: @ $ ! % * ? & . y no contener espacios.',
  needLength: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  ok: 'Contraseña válida.',
};

export function getPasswordRuleKey(value: string): PasswordRuleKey {
  const v = value || '';
  if (v.length < PASSWORD_MIN_LENGTH) return 'needLength';
  if (/\s/.test(v)) return 'needSymbol';
  if (!/\p{L}/u.test(v)) return 'needLetter';
  if (!/\d/.test(v)) return 'needNumber';
  if (!/[@$!%*?&.]/.test(v)) return 'needSymbol';
  return 'ok';
}

export function getPasswordGuideText(key: PasswordRuleKey): string {
  return GUIDE_TEXT[key];
}

export function isPasswordValid(value: string): boolean {
  return getPasswordRuleKey(value) === 'ok';
}
