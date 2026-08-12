import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { RegistrationService } from '../registration.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

describe('AuthController', () => {
  let authController: AuthController;

  const authServiceMock: Partial<jest.Mocked<AuthService>> = {
    login: jest.fn(),
    updateProfile: jest.fn(),
    deleteAccount: jest.fn(),
  };

  const registrationServiceMock: Partial<jest.Mocked<RegistrationService>> = {
    register: jest.fn(),
    verifyEmail: jest.fn(),
  };

  const configServiceMock = {
    get: jest.fn(),
    getOrThrow: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
        {
          provide: RegistrationService,
          useValue: registrationServiceMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    authController = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(authController).toBeDefined();
  });

  describe('register', () => {
    it('should delegate to RegistrationService', async () => {
      const registerDto = {
        name: 'Ali',
        email: 'ali@example.com',
        password: 'Password123!',
      };

      const serviceResponse = {
        message: 'Registration successful. Please check your email to verify your account.',
        user: {
          id: 'user-1',
          name: registerDto.name,
          email: registerDto.email,
          emailVerifiedAt: null,
          createdAt: new Date('2026-07-24T10:00:00.000Z'),
        },
      };

      registrationServiceMock.register!.mockResolvedValue(serviceResponse as any);

      const result = await authController.register(registerDto);

      expect(registrationServiceMock.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(serviceResponse);
    });
  });

  describe('login', () => {
    it('should delegate to AuthService', async () => {
      const loginDto = {
        email: 'ali@example.com',
        password: 'Password123!',
      };

      const serviceResponse = {
        accessToken: 'fake-access-token',
        user: {
          id: 'user-1',
          name: 'Ali',
          email: loginDto.email,
        },
      };

      authServiceMock.login!.mockResolvedValue(serviceResponse as any);

      const result = await authController.login(loginDto);

      expect(authServiceMock.login).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(serviceResponse);
    });
  });

  describe('verifyEmail', () => {
    it('should delegate to RegistrationService', async () => {
      registrationServiceMock.verifyEmail!.mockResolvedValue({
        message: 'Email verified successfully. You can now log in.',
      });

      const result = await authController.verifyEmail('some-token');

      expect(registrationServiceMock.verifyEmail).toHaveBeenCalledWith('some-token');
      expect(result.message).toContain('verified');
    });
  });
});
