import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';

import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { UsersService } from '../../users/services/users.service';
import { DevEmailSender } from '../email/dev-email-sender';
import { EMAIL_SENDER } from '../email/email-sender.interface';
import { DefaultRegistrationPolicy } from '../policies/default-registration.policy';
import { REGISTRATION_POLICY } from '../policies/registration-policy.interface';
import { RegistrationService } from '../registration.service';

jest.mock('argon2');

describe('RegistrationService', () => {
  let registrationService: RegistrationService;
  let fakeUsers: User[];

  const createdAt = new Date('2026-08-01T10:00:00.000Z');
  const updatedAt = new Date('2026-08-01T10:00:00.000Z');

  const createMockUser = (overrides: Partial<User> = {}): User => ({
    id: 'user-1',
    name: 'Ali',
    email: 'ali@example.com',
    passwordHash: 'hashed:Password123!',
    role: UserRole.USER,
    emailVerifiedAt: null, // new users are unverified by default
    phoneNumber: null,
    createdAt,
    updatedAt,
    ...overrides,
  });

  const usersServiceMock: Partial<jest.Mocked<UsersService>> = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const jwtServiceMock: Partial<jest.Mocked<JwtService>> = {
    sign: jest.fn(),
    verifyAsync: jest.fn(),
  };

  // Plain function (not jest.fn()) so jest.resetAllMocks() does not erase the implementation.
  const configServiceMock = {
    getOrThrow: (key: string): string => {
      const values: Record<string, string> = {
        JWT_VERIFICATION_SECRET: 'test-verification-secret',
        JWT_VERIFICATION_EXPIRES_IN: '24h',
      };
      if (!(key in values))
        throw new Error(`Missing config key in test mock: ${key}`);
      return values[key];
    },
  };

  const emailSenderMock = {
    sendVerificationEmail: jest.fn(),
  };

  const setupMocks = () => {
    usersServiceMock.findByEmail!.mockImplementation(async (email) => {
      return fakeUsers.find((u) => u.email === email) ?? null;
    });

    usersServiceMock.findById!.mockImplementation(async (id) => {
      return fakeUsers.find((u) => u.id === id) ?? null;
    });

    usersServiceMock.create!.mockImplementation(async (data) => {
      const user = createMockUser({
        id: `user-${fakeUsers.length + 1}`,
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role ?? UserRole.USER,
        emailVerifiedAt: null,
      });
      fakeUsers.push(user);
      return user;
    });

    usersServiceMock.save!.mockImplementation(async (user) => {
      const idx = fakeUsers.findIndex((u) => u.id === user.id);
      if (idx !== -1) fakeUsers[idx] = { ...user };
      return user;
    });

    jest
      .mocked(argon2.hash)
      .mockImplementation(async (pw) => `hashed:${String(pw)}`);
    jest
      .mocked(argon2.verify)
      .mockImplementation(async (hash, pw) => hash === `hashed:${String(pw)}`);

    jwtServiceMock.sign!.mockReturnValue('fake-verification-token');

    emailSenderMock.sendVerificationEmail.mockResolvedValue(undefined);
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    fakeUsers = [createMockUser({ emailVerifiedAt: new Date() })]; // pre-existing verified user
    setupMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrationService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: REGISTRATION_POLICY, useClass: DefaultRegistrationPolicy },
        { provide: EMAIL_SENDER, useValue: emailSenderMock },
      ],
    }).compile();

    registrationService = module.get<RegistrationService>(RegistrationService);
  });

  it('should be defined', () => {
    expect(registrationService).toBeDefined();
  });

  // ─── register() ───────────────────────────────────────────────────────────

  describe('register', () => {
    it('should register a user with USER role when no role is specified', async () => {
      const dto = {
        name: 'New User',
        email: 'new@example.com',
        password: 'Password123!',
      };

      const result = await registrationService.register(dto);

      expect(usersServiceMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.USER }),
      );
      expect(result.message).toContain('verify your account');
      expect(result.user.email).toBe('new@example.com');
    });

    it('should register a user when USER role is explicitly requested', async () => {
      const dto = {
        name: 'Explicit User',
        email: 'explicit@example.com',
        password: 'Password123!',
        role: UserRole.USER,
      };

      await registrationService.register(dto);

      expect(usersServiceMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.USER }),
      );
    });

    it('should reject ADMIN role with ForbiddenException', async () => {
      const dto = {
        name: 'Hacker',
        email: 'hacker@example.com',
        password: 'Password123!',
        role: UserRole.ADMIN,
      };

      await expect(registrationService.register(dto)).rejects.toThrow(
        ForbiddenException,
      );

      // Must not reach DB or email
      expect(usersServiceMock.findByEmail).not.toHaveBeenCalled();
      expect(usersServiceMock.create).not.toHaveBeenCalled();
      expect(emailSenderMock.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when email already exists', async () => {
      const dto = {
        name: 'Ali',
        email: 'ali@example.com', // already in fakeUsers
        password: 'Password123!',
      };

      await expect(registrationService.register(dto)).rejects.toThrow(
        ConflictException,
      );

      expect(usersServiceMock.create).not.toHaveBeenCalled();
      expect(emailSenderMock.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('newly registered user has emailVerifiedAt = null', async () => {
      const dto = {
        name: 'Unverified',
        email: 'unverified@example.com',
        password: 'Password123!',
      };

      const result = await registrationService.register(dto);

      expect(result.user.emailVerifiedAt).toBeNull();
    });

    it('should hash the password with argon2', async () => {
      const dto = {
        name: 'Hashed',
        email: 'hashed@example.com',
        password: 'Password123!',
      };

      await registrationService.register(dto);

      expect(argon2.hash).toHaveBeenCalledWith('Password123!');
      expect(usersServiceMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: 'hashed:Password123!' }),
      );
    });

    it('should invoke EmailSender after creating the user', async () => {
      const dto = {
        name: 'Email Test',
        email: 'emailtest@example.com',
        password: 'Password123!',
      };

      await registrationService.register(dto);

      expect(emailSenderMock.sendVerificationEmail).toHaveBeenCalledTimes(1);
      expect(emailSenderMock.sendVerificationEmail).toHaveBeenCalledWith(
        'emailtest@example.com',
        'fake-verification-token',
      );
    });

    it('should generate a verification token signed with JWT_VERIFICATION_SECRET', async () => {
      const dto = {
        name: 'Token Test',
        email: 'token@example.com',
        password: 'Password123!',
      };

      await registrationService.register(dto);

      expect(jwtServiceMock.sign).toHaveBeenCalledWith(
        expect.objectContaining({ purpose: 'email-verification' }),
        expect.objectContaining({ secret: 'test-verification-secret' }),
      );
    });
  });

  // ─── verifyEmail() ────────────────────────────────────────────────────────

  describe('verifyEmail', () => {
    it('should set emailVerifiedAt when token is valid', async () => {
      const unverifiedUser = createMockUser({
        id: 'user-unverified',
        email: 'unverified@example.com',
        emailVerifiedAt: null,
      });
      fakeUsers.push(unverifiedUser);

      jwtServiceMock.verifyAsync!.mockResolvedValue({
        sub: 'user-unverified',
        purpose: 'email-verification',
      });

      const result = await registrationService.verifyEmail('valid-token');

      expect(result.message).toContain('verified successfully');
      expect(usersServiceMock.save).toHaveBeenCalledWith(
        expect.objectContaining({ emailVerifiedAt: expect.any(Date) }),
      );
    });

    it('should return already-verified message without saving when user is already verified', async () => {
      const verifiedUser = createMockUser({
        id: 'user-already-verified',
        emailVerifiedAt: new Date(),
      });
      fakeUsers.push(verifiedUser);

      jwtServiceMock.verifyAsync!.mockResolvedValue({
        sub: 'user-already-verified',
        purpose: 'email-verification',
      });

      const result = await registrationService.verifyEmail('valid-token');

      expect(result.message).toBe('Email already verified');
      expect(usersServiceMock.save).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for an invalid (tampered) token', async () => {
      jwtServiceMock.verifyAsync!.mockRejectedValue(
        new Error('invalid signature'),
      );

      await expect(
        registrationService.verifyEmail('tampered-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for an expired token', async () => {
      const err = new Error('jwt expired');
      (err as any).name = 'TokenExpiredError';
      jwtServiceMock.verifyAsync!.mockRejectedValue(err);

      await expect(
        registrationService.verifyEmail('expired-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when token has wrong purpose', async () => {
      jwtServiceMock.verifyAsync!.mockResolvedValue({
        sub: 'user-1',
        purpose: 'access', // not email-verification
      });

      await expect(
        registrationService.verifyEmail('wrong-purpose-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user no longer exists', async () => {
      jwtServiceMock.verifyAsync!.mockResolvedValue({
        sub: 'deleted-user-id',
        purpose: 'email-verification',
      });

      await expect(
        registrationService.verifyEmail('orphan-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('resendVerificationEmail', () => {
    it('should send verification email for an unverified user', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        emailVerifiedAt: null,
      };

      usersServiceMock.findByEmail!.mockResolvedValue(user as any);

      await registrationService.resendVerificationEmail(user.email);

      expect(emailSenderMock.sendVerificationEmail).toHaveBeenCalledTimes(1);
      expect(emailSenderMock.sendVerificationEmail).toHaveBeenCalledWith(
        user.email,
        expect.any(String),
      );
    });

    it('should not send email when user is already verified', async () => {
      usersServiceMock.findByEmail!.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        emailVerifiedAt: new Date(),
      } as any);

      await registrationService.resendVerificationEmail('test@example.com');

      expect(emailSenderMock.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('should return same response when user does not exist', async () => {
      usersServiceMock.findByEmail!.mockResolvedValue(null);

      const result = await registrationService.resendVerificationEmail(
        'unknown@example.com',
      );

      expect(result).toEqual({
        message:
          'If an unverified account exists with this email, a verification link has been sent.',
      });

      expect(emailSenderMock.sendVerificationEmail).not.toHaveBeenCalled();
    });
  });
});
