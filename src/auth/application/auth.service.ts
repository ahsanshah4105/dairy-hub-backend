import { Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { SignOptions } from 'jsonwebtoken';

import type { IOtpRepository } from '../domain/ports/otp.repository';
import { OTP_REPOSITORY } from '../domain/ports/otp.repository';
import type { ISessionRepository } from '../domain/ports/session.repository';
import { SESSION_REPOSITORY } from '../domain/ports/session.repository';
import { AuthIdentityRepository } from '../infrastructure/persistence/auth-identity.repository';
import { AuthIdentity, UserRole } from '../infrastructure/persistence/auth-identity.entity';

import { OtpCooldownError } from '../domain/errors/otp-cooldown.error';
import { OtpExpiredError } from '../domain/errors/otp-expired.error';
import { OtpInvalidError } from '../domain/errors/otp-invalid.error';
import { MaxAttemptsError } from '../domain/errors/max-attempts.error';
import { InvalidSessionError } from '../domain/errors/invalid-session.error';
import { InvalidTokenError } from '../domain/errors/invalid-token.error';
import { IdentityNotFoundError } from '../domain/errors/identity-not-found.error';

import { UserAuthenticatedEvent } from '../domain/events/user-authenticated.event';
import { AccountDeletedEvent } from '../domain/events/account-deleted.event';
import { AUTH_EVENTS } from '../../shared/events/events';

const OTP_TTL_SECONDS = 300;
const COOLDOWN_TTL_SECONDS = 60;
const MAX_OTP_ATTEMPTS = 5;
const ATTEMPTS_WINDOW_SECONDS = 300;
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(OTP_REPOSITORY) private readonly otpRepo: IOtpRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessionRepo: ISessionRepository,
    private readonly identityRepo: AuthIdentityRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  async sendOtp(phoneNumber: string): Promise<{ message: string }> {
    const canProceed = await this.otpRepo.setCooldown(phoneNumber, COOLDOWN_TTL_SECONDS);
    if (!canProceed) {
      this.logger.warn({ msg: 'OTP request blocked by cooldown', phoneNumber });
      throw new OtpCooldownError();
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const secret = this.configService.getOrThrow<string>('JWT_VERIFICATION_SECRET');

    const otpHash = crypto.createHmac('sha256', secret).update(otp).digest('hex');

    await this.otpRepo.storeOtpHash(phoneNumber, otpHash, OTP_TTL_SECONDS);

    this.logger.log({ msg: 'OTP sent via mock SMS', phoneNumber });
    console.log(`[Mock SMS] Sending OTP ${otp} to phone number ${phoneNumber}`);

    return { message: 'OTP sent successfully' };
  }

  async verifyOtp(phoneNumber: string, otp: string) {
    const attempts = await this.otpRepo.incrementAttempts(phoneNumber, ATTEMPTS_WINDOW_SECONDS);
    if (attempts > MAX_OTP_ATTEMPTS) {
      this.logger.warn({ msg: 'Max OTP attempts reached', phoneNumber });
      throw new MaxAttemptsError();
    }

    const storedHash = await this.otpRepo.getOtpHash(phoneNumber);
    if (!storedHash) {
      throw new OtpExpiredError();
    }

    const secret = this.configService.getOrThrow<string>('JWT_VERIFICATION_SECRET');
    const inputHash = crypto.createHmac('sha256', secret).update(otp).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(storedHash), Buffer.from(inputHash))) {
      throw new OtpInvalidError();
    }

    await this.otpRepo.consumeOtp(phoneNumber);
    await this.otpRepo.clearAttempts(phoneNumber);

    const identity = await this.identityRepo.findByPhoneNumber(phoneNumber);
    if (!identity) {
      return this.generateSetupToken(phoneNumber);
    }

    const sessionId = uuidv4();
    const tokens = await this.generateTokens(identity, sessionId);

    this.eventEmitter.emit(
      AUTH_EVENTS.USER_AUTHENTICATED,
      new UserAuthenticatedEvent(identity.id, identity.phoneNumber, false),
    );

    return { ...tokens, identity };
  }

  private generateSetupToken(phoneNumber: string) {
    const setupToken = this.jwtService.sign(
      { phoneNumber, scope: 'registration' },
      {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      },
    );
    return {
      message: 'OTP verified.',
      isRegistered: false,
      setupToken,
    };
  }
  async completeRegistration(setupToken: string, name: string, role?: UserRole) {
    let payload;
    try {
      payload = this.jwtService.verify(setupToken, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new InvalidTokenError();
    }
    if (payload.scope !== 'registration' || !payload.phoneNumber) {
      throw new InvalidTokenError();
    }
    const identity = await this.identityRepo.createIdentity(payload.phoneNumber, role);
    const sessionId = uuidv4();
    const tokens = await this.generateTokens(identity, sessionId);
    this.eventEmitter.emit(
      AUTH_EVENTS.USER_AUTHENTICATED,
      new UserAuthenticatedEvent(identity.id, identity.phoneNumber, true, name),
    );
    return {
      message: 'Registration complete',
      isRegistered: true,
      ...tokens,
      identity,
    };
  }


  async refreshTokens(accessToken: string, refreshToken: string) {
    const payload = this.jwtService.decode(accessToken) as any;
    if (!payload?.sub || !payload?.sessionId) {
      throw new InvalidTokenError();
    }
    return this.refreshSession(payload.sub, payload.sessionId, refreshToken);
  }

  private async refreshSession(userId: string, sessionId: string, refreshToken: string) {
    const storedHash = await this.sessionRepo.getSession(userId, sessionId);
    if (!storedHash) {
      this.logger.warn({ msg: 'Session not found or expired', userId, sessionId });
      throw new InvalidSessionError();
    }

    const isMatch = await argon2.verify(storedHash, refreshToken);
    if (!isMatch) {
      this.logger.warn({ msg: 'Refresh token mismatch — possible theft', userId, sessionId });
      await this.sessionRepo.deleteSession(userId, sessionId);
      throw new InvalidTokenError();
    }

    const identity = await this.identityRepo.findById(userId);
    if (!identity) {
      throw new IdentityNotFoundError();
    }

    return this.generateTokens(identity, sessionId);
  }

  async logout(userId: string, sessionId: string) {
    await this.sessionRepo.deleteSession(userId, sessionId);
    this.logger.log({ msg: 'User logged out', userId, sessionId });
    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string) {
    await this.sessionRepo.deleteAllSessions(userId);
    this.logger.log({ msg: 'User logged out from all devices', userId });
    return { message: 'Logged out from all devices successfully' };
  }

  async deleteAccount(userId: string) {
    const identity = await this.identityRepo.findById(userId);
    if (!identity) {
      throw new IdentityNotFoundError();
    }

    await this.identityRepo.remove(identity);
    await this.sessionRepo.deleteAllSessions(userId);

    this.eventEmitter.emit(
      AUTH_EVENTS.ACCOUNT_DELETED,
      new AccountDeletedEvent(userId),
    );

    return { message: 'Account deleted successfully' };
  }

  private async generateTokens(identity: AuthIdentity, sessionId: string) {
    const payload = { sub: identity.id, phoneNumber: identity.phoneNumber, sessionId };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.getOrThrow<string>(
        'JWT_ACCESS_EXPIRES_IN',
      ) as SignOptions['expiresIn'],
    });

    const refreshToken = crypto.randomBytes(32).toString('hex');
    const hashedRt = await argon2.hash(refreshToken);

    await this.sessionRepo.storeSession(identity.id, sessionId, hashedRt, SESSION_TTL_SECONDS);

    return { accessToken, refreshToken, sessionId };
  }
}
