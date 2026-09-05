import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { AuthService } from './auth.service';
import { OTP_REPOSITORY } from '../domain/ports/otp.repository';
import { SESSION_REPOSITORY } from '../domain/ports/session.repository';
import { AuthIdentityRepository } from '../infrastructure/persistence/auth-identity.repository';
import { AuthIdentity, UserRole } from '../infrastructure/persistence/auth-identity.entity';

import { OtpCooldownError } from '../domain/errors/otp-cooldown.error';
import { OtpExpiredError } from '../domain/errors/otp-expired.error';
import { MaxAttemptsError } from '../domain/errors/max-attempts.error';
import { InvalidSessionError } from '../domain/errors/invalid-session.error';
import { AUTH_EVENTS } from '../../shared/events/events';

describe('AuthService', () => {
  let service: AuthService;
  let otpRepo: any;
  let sessionRepo: any;
  let identityRepo: any;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    // 1. Create mocks for all Ports and external dependencies
    const mockOtpRepo = {
      setCooldown: jest.fn(),
      storeOtpHash: jest.fn(),
      getOtpHash: jest.fn(),
      consumeOtp: jest.fn(),
      incrementAttempts: jest.fn(),
      clearAttempts: jest.fn(),
    };

    const mockSessionRepo = {
      storeSession: jest.fn(),
      getSession: jest.fn(),
      deleteSession: jest.fn(),
      deleteAllSessions: jest.fn(),
    };

    const mockIdentityRepo = {
      findById: jest.fn(),
      findByPhoneNumber: jest.fn(),
      createIdentity: jest.fn(),
      remove: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn().mockReturnValue('mockAccessToken'),
      decode: jest.fn(),
    };

    const mockConfigService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'JWT_VERIFICATION_SECRET') return 'supersecret-verification';
        if (key === 'JWT_ACCESS_SECRET') return 'supersecret-access';
        if (key === 'JWT_ACCESS_EXPIRES_IN') return '15m';
        return 'test';
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: OTP_REPOSITORY, useValue: mockOtpRepo },
        { provide: SESSION_REPOSITORY, useValue: mockSessionRepo },
        { provide: AuthIdentityRepository, useValue: mockIdentityRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    otpRepo = module.get(OTP_REPOSITORY);
    sessionRepo = module.get(SESSION_REPOSITORY);
    identityRepo = module.get(AuthIdentityRepository);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendOtp', () => {
    it('should throw OtpCooldownError if cooldown is active', async () => {
      otpRepo.setCooldown.mockResolvedValue(false); // User cannot proceed
      await expect(service.sendOtp('+1234567890')).rejects.toThrow(OtpCooldownError);
    });

    it('should generate, hash, and store OTP if cooldown is not active', async () => {
      otpRepo.setCooldown.mockResolvedValue(true); // User can proceed
      otpRepo.storeOtpHash.mockResolvedValue(undefined);

      const result = await service.sendOtp('+1234567890');
      expect(result).toEqual({ message: 'OTP sent successfully' });
      expect(otpRepo.setCooldown).toHaveBeenCalledWith('+1234567890', 60);
      expect(otpRepo.storeOtpHash).toHaveBeenCalled();
    });
  });

  describe('verifyOtp', () => {
    it('should throw MaxAttemptsError if attempts exceed 5', async () => {
      otpRepo.incrementAttempts.mockResolvedValue(6);
      await expect(service.verifyOtp('+1234567890', '123456')).rejects.toThrow(MaxAttemptsError);
    });

    it('should throw OtpExpiredError if OTP is not in Redis', async () => {
      otpRepo.incrementAttempts.mockResolvedValue(1);
      otpRepo.getOtpHash.mockResolvedValue(null);
      await expect(service.verifyOtp('+1234567890', '123456')).rejects.toThrow(OtpExpiredError);
    });

    it('should verify OTP and return a setupToken for NEW users', async () => {
      const crypto = require('crypto');
      const validOtp = '123456';
      const validHash = crypto.createHmac('sha256', 'supersecret-verification').update(validOtp).digest('hex');

      otpRepo.incrementAttempts.mockResolvedValue(1);
      otpRepo.getOtpHash.mockResolvedValue(validHash);

      identityRepo.findByPhoneNumber.mockResolvedValue(null);

      const result = await service.verifyOtp('+1234567890', validOtp);

      expect(result.isRegistered).toBe(false);
      expect(result.setupToken).toBe('mockAccessToken'); // our mocked JWT service returns this
      expect(result.accessToken).toBeUndefined();

      expect(otpRepo.consumeOtp).toHaveBeenCalledWith('+1234567890');

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    describe('completeRegistration', () => {
      it('should create identity and return tokens for a valid setup token', async () => {
        // Temporarily mock verify just for this test
        service['jwtService'].verify = jest.fn().mockReturnValue({
          phoneNumber: '+1234567890',
          scope: 'registration' // Scope matches!
        });

        const mockIdentity: AuthIdentity = {
          id: 'uuid-1234',
          phoneNumber: '+1234567890',
          role: UserRole.BUYER,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        identityRepo.createIdentity.mockResolvedValue(mockIdentity);

        const result = await service.completeRegistration('mockSetupToken', 'John Doe', UserRole.BUYER);

        expect(result.isRegistered).toBe(true);
        expect(result.accessToken).toBe('mockAccessToken');
        expect(identityRepo.createIdentity).toHaveBeenCalledWith('+1234567890', UserRole.BUYER);

        // Ensure we emit the event WITH the name
        expect(eventEmitter.emit).toHaveBeenCalledWith(
          AUTH_EVENTS.USER_AUTHENTICATED,
          expect.objectContaining({ isNewIdentity: true, name: 'John Doe' })
        );
      });
    });


    it('should verify OTP, return tokens, and emit event for EXISTING users', async () => {
      const crypto = require('crypto');
      const validOtp = '123456';
      const validHash = crypto.createHmac('sha256', 'supersecret-verification').update(validOtp).digest('hex');

      otpRepo.incrementAttempts.mockResolvedValue(1);
      otpRepo.getOtpHash.mockResolvedValue(validHash);

      const mockIdentity: AuthIdentity = {
        id: 'uuid-1234',
        phoneNumber: '+1234567890',
        role: UserRole.BUYER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock identity DB to return an existing user
      identityRepo.findByPhoneNumber.mockResolvedValue(mockIdentity);

      const result = await service.verifyOtp('+1234567890', validOtp);

      expect(result.isRegistered).toBe(true);
      expect(result.accessToken).toBe('mockAccessToken');
      expect(result.setupToken).toBeUndefined();

      // Ensure we DO emit the event, but with isNewIdentity = false
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        AUTH_EVENTS.USER_AUTHENTICATED,
        expect.objectContaining({ isNewIdentity: false }),
      );
    });

  });

  describe('refreshTokens', () => {
    it('should throw InvalidSessionError if session does not exist in Redis', async () => {
      const jwtServiceMock = require('@nestjs/jwt').JwtService.prototype;
      // In tests, we mocked the instance, not prototype.
      service['jwtService'].decode = jest.fn().mockReturnValue({ sub: 'user-1', sessionId: 'session-1' });
      sessionRepo.getSession.mockResolvedValue(null);

      await expect(service.refreshTokens('mockAccessToken', 'mockRefreshToken'))
        .rejects.toThrow(InvalidSessionError);
    });
  });
});
