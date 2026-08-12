import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';

import { AuthService } from '../auth.service';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { UsersService } from '../../users/services/users.service';

jest.mock('argon2');

describe('AuthService', () => {
  let authService: AuthService;
  let fakeUsers: User[];

  const usersServiceMock: Partial<jest.Mocked<UsersService>> = {
    findByEmail: jest.fn(),
    findByEmailWithPassword: jest.fn(),
    findByIdWithPassword: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const jwtServiceMock: Partial<jest.Mocked<JwtService>> = {
    sign: jest.fn(),
  };

  const createdAt = new Date('2026-07-24T10:00:00.000Z');
  const updatedAt = new Date('2026-07-24T11:00:00.000Z');

  const createMockUser = (overrides: Partial<User> = {}): User => {
    return {
      id: 'user-1',
      name: 'Ali',
      email: 'ali@example.com',
      passwordHash: 'hashed:Password123!',
      role: UserRole.USER,
      emailVerifiedAt: new Date('2026-08-01T09:00:00.000Z'), // verified by default
      phoneNumber: null,
      createdAt,
      updatedAt,
      reports: [],
      ...overrides,
    } as User;
  };

  const setupIntelligentMocks = () => {
    /*
     * Email ke mutabiq user search karega.
     */
    usersServiceMock.findByEmail!.mockImplementation(async (email: string) => {
      return fakeUsers.find((user) => user.email === email) ?? null;
    });

    /*
     * Login ke waqt email ke mutabiq user
     * password hash ke saath return karega.
     */
    usersServiceMock.findByEmailWithPassword!.mockImplementation(
      async (email: string) => {
        return fakeUsers.find((user) => user.email === email) ?? null;
      },
    );

    /*
     * User ID ke mutabiq account find karega.
     */
    usersServiceMock.findByIdWithPassword!.mockImplementation(
      async (userId: string) => {
        return fakeUsers.find((user) => user.id === userId) ?? null;
      },
    );

    /*
     * Fake database mein user create karega.
     */
    usersServiceMock.create!.mockImplementation(async (data) => {
      const newUser = createMockUser({
        id: `user-${fakeUsers.length + 1}`,
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
      });

      fakeUsers.push(newUser);

      return newUser;
    });

    /*
     * Updated user return karega.
     */
    usersServiceMock.save!.mockImplementation(async (user: User) => {
      const updatedUser = createMockUser({
        ...user,
        updatedAt,
      });

      const userIndex = fakeUsers.findIndex(
        (existingUser) => existingUser.id === user.id,
      );

      if (userIndex !== -1) {
        fakeUsers[userIndex] = updatedUser;
      }

      return updatedUser;
    });

    /*
     * Fake database se user remove karega.
     */
    usersServiceMock.remove!.mockImplementation(async (user: User) => {
      fakeUsers = fakeUsers.filter(
        (existingUser) => existingUser.id !== user.id,
      );
    });

    /*
     * Plain password ka predictable fake hash banega.
     */
    jest.mocked(argon2.hash).mockImplementation(async (password) => {
      return `hashed:${String(password)}`;
    });

    /*
     * Entered password aur stored hash compare honge.
     */
    jest
      .mocked(argon2.verify)
      .mockImplementation(async (storedHash, password) => {
        return storedHash === `hashed:${String(password)}`;
      });
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    /*
     * Har test ek fresh fake database se start hoga.
     */
    fakeUsers = [createMockUser()];

    setupIntelligentMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersServiceMock,
        },
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  // Registration tests have moved to registration.service.spec.ts

  describe('login', () => {
    it('should login user with correct credentials', async () => {
      const loginDto = {
        email: 'ali@example.com',
        password: 'Password123!',
      };

      jwtServiceMock.sign!.mockReturnValue('fake-access-token');

      const result = await authService.login(loginDto);

      expect(usersServiceMock.findByEmailWithPassword).toHaveBeenCalledWith(
        loginDto.email,
      );

      expect(argon2.verify).toHaveBeenCalledWith(
        'hashed:Password123!',
        loginDto.password,
      );

      expect(jwtServiceMock.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        email: loginDto.email,
      });

      // Service returns raw entities; DTO serialization happens in the HTTP layer.
      // Use objectContaining so the test is not brittle to additional entity fields.
      expect(result).toEqual({
        accessToken: 'fake-access-token',
        user: expect.objectContaining({
          id: 'user-1',
          name: 'Ali',
          email: 'ali@example.com',
        }),
      });
    });

    it('should throw UnauthorizedException when email does not exist', async () => {
      const loginDto = {
        email: 'missing@example.com',
        password: 'Password123!',
      };

      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(argon2.verify).not.toHaveBeenCalled();

      expect(jwtServiceMock.sign).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when password is incorrect', async () => {
      const loginDto = {
        email: 'ali@example.com',
        password: 'WrongPassword!',
      };

      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(argon2.verify).toHaveBeenCalledWith(
        'hashed:Password123!',
        loginDto.password,
      );

      expect(jwtServiceMock.sign).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when email is not verified', async () => {
      // Push an unverified user into the fake DB for this test.
      const unverifiedUser = createMockUser({
        id: 'user-unverified',
        email: 'unverified@example.com',
        passwordHash: 'hashed:Password123!',
        emailVerifiedAt: null,
      });
      fakeUsers.push(unverifiedUser);

      const loginDto = {
        email: 'unverified@example.com',
        password: 'Password123!',
      };

      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );

      // Password must be checked before the verification gate so we don't
      // reveal which account exists by throwing a different error earlier.
      expect(argon2.verify).toHaveBeenCalled();

      expect(jwtServiceMock.sign).not.toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const user = fakeUsers[0];

      const updateProfileDto = {
        name: 'Ali Updated',
      };

      const result = await authService.updateProfile(user, updateProfileDto);

      expect(user.name).toBe(updateProfileDto.name);

      expect(usersServiceMock.save).toHaveBeenCalledWith(user);

      expect(result).toEqual({
        message: 'Profile updated successfully',
        user: expect.objectContaining({
          id: 'user-1',
          name: 'Ali Updated',
          email: 'ali@example.com',
          createdAt,
          updatedAt,
        }),
      });

      expect(fakeUsers[0].name).toBe('Ali Updated');
    });
  });

  describe('deleteAccount', () => {
    it('should delete account when password is correct', async () => {
      const result = await authService.deleteAccount('user-1', {
        password: 'Password123!',
      });

      expect(usersServiceMock.findByIdWithPassword).toHaveBeenCalledWith(
        'user-1',
      );

      expect(argon2.verify).toHaveBeenCalledWith(
        'hashed:Password123!',
        'Password123!',
      );

      expect(usersServiceMock.remove).toHaveBeenCalled();

      expect(result).toEqual({
        message: 'Account deleted successfully',
      });

      expect(fakeUsers).toHaveLength(0);
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      await expect(
        authService.deleteAccount('missing-user', {
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(argon2.verify).not.toHaveBeenCalled();

      expect(usersServiceMock.remove).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when password is incorrect', async () => {
      await expect(
        authService.deleteAccount('user-1', {
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(argon2.verify).toHaveBeenCalledWith(
        'hashed:Password123!',
        'WrongPassword!',
      );

      expect(usersServiceMock.remove).not.toHaveBeenCalled();

      expect(fakeUsers).toHaveLength(1);
    });
  });
});
