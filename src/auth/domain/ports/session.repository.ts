/**
 * Port (interface) for session storage operations.
 * The domain layer depends on this abstraction — never on Redis directly.
 */
export interface ISessionRepository {
  storeSession(userId: string, sessionId: string, hashedToken: string, ttlSeconds: number): Promise<void>;
  getSession(userId: string, sessionId: string): Promise<string | null>;
  deleteSession(userId: string, sessionId: string): Promise<void>;
  deleteAllSessions(userId: string): Promise<void>;
}

export const SESSION_REPOSITORY = Symbol('ISessionRepository');
