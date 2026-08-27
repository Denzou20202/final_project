// Short-lived tokens used only mid-login (challenge / forced setup) — signed
// with their own JWT_TWO_FACTOR_SECRET, never JWT_ACCESS_SECRET, so a leaked
// one can't be replayed against JwtAuthGuard/RolesGuard as a real session.
export const TWO_FACTOR_SETUP_PURPOSE = 'two_factor_setup';
export const TWO_FACTOR_CHALLENGE_PURPOSE = 'two_factor_challenge';

export type TwoFactorTokenPurpose = typeof TWO_FACTOR_SETUP_PURPOSE | typeof TWO_FACTOR_CHALLENGE_PURPOSE;

export interface TwoFactorTokenPayload {
  sub: string;
  purpose: TwoFactorTokenPurpose;
}
