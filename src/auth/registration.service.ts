import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type ms from 'ms';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UserRole } from '../users/enums/user-role.enum';
import { UsersService } from '../users/services/users.service';
import { RegisterDto } from './dto/register.dto';

import {
  REGISTRATION_POLICY,
  type RegistrationPolicy,
} from './policies/registration-policy.interface';
import { EMAIL_SENDER, type EmailSender } from './email/email-sender.interface';

interface VerificationTokenPayload {
  sub: string;
  purpose: 'email-verification';
}

@Injectable()
export class RegistrationService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,

    @Inject(REGISTRATION_POLICY)
    private readonly registrationPolicy: RegistrationPolicy<UserRole>,

    @Inject(EMAIL_SENDER)
    private readonly emailSender: EmailSender,
  ) {}

  async register(registerDto: RegisterDto) {
    const role = this.registrationPolicy.resolveRole(registerDto.role);

    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await argon2.hash(registerDto.password);

    const user = await this.usersService.create({
      name: registerDto.name,
      email: registerDto.email,
      passwordHash,
      role,
    });

    const verificationToken = this.generateVerificationToken(user.id);

    await this.emailSender.sendVerificationEmail(user.email, verificationToken);

    return {
      message:
        'Registration successful. Please check your email to verify your account.',
      user,
    };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    let payload: VerificationTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<VerificationTokenPayload>(
        token,
        {
          secret: this.configService.getOrThrow<string>(
            'JWT_VERIFICATION_SECRET',
          ),
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired verification token');
    }

    if (payload.purpose !== 'email-verification') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException(
        'User associated with this token no longer exists',
      );
    }

    if (user.emailVerifiedAt !== null) {
      return { message: 'Email already verified' };
    }

    user.emailVerifiedAt = new Date();
    await this.usersService.save(user);

    return { message: 'Email verified successfully. You can now log in.' };
  }

  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);

    const response = {
      message:
        'If an unverified account exists with this email, a verification link has been sent.',
    };

    if (!user || user.emailVerifiedAt !== null) {
      return response;
    }

    const verificationToken = this.generateVerificationToken(user.id);

    await this.emailSender.sendVerificationEmail(user.email, verificationToken);

    return response;
  }
  private generateVerificationToken(userId: string): string {
    const payload: VerificationTokenPayload = {
      sub: userId,
      purpose: 'email-verification',
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_VERIFICATION_SECRET'),
      expiresIn: this.configService.getOrThrow<string>(
        'JWT_VERIFICATION_EXPIRES_IN',
      ) as ms.StringValue,
    });
  }
}
