/**
 * Port (interface) for OTP storage operations.
 * The domain layer depends on this abstraction — never on Redis directly.
 */
export interface IOtpRepository {
  /** Returns true if cooldown was set (not active), false if already cooling down. */
  setCooldown(phoneNumber: string, ttlSeconds: number): Promise<boolean>;
  storeOtpHash(phoneNumber: string, hash: string, ttlSeconds: number): Promise<void>;
  getOtpHash(phoneNumber: string): Promise<string | null>;
  consumeOtp(phoneNumber: string): Promise<void>;
  /** Returns the new attempt count after incrementing. */
  incrementAttempts(phoneNumber: string, windowSeconds: number): Promise<number>;
  clearAttempts(phoneNumber: string): Promise<void>;
}

export const OTP_REPOSITORY = Symbol('IOtpRepository');
