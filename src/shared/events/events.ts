/**
 * Canonical event name constants for cross-module communication.
 * Modules reference these constants — never raw strings.
 */
export const AUTH_EVENTS = {
  USER_AUTHENTICATED: 'auth.user.authenticated',
  ACCOUNT_DELETED: 'auth.account.deleted',
} as const;
