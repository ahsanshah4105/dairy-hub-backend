import type ms from 'ms';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegistrationService } from './registration.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import {
  REGISTRATION_POLICY,
} from './policies/registration-policy.interface';
import { DefaultRegistrationPolicy } from './policies/default-registration.policy';
import { EMAIL_SENDER } from './email/email-sender.interface';
import { DevEmailSender } from './email/dev-email-sender';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: configService.getOrThrow<string>(
            'JWT_ACCESS_EXPIRES_IN',
          ) as ms.StringValue,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    RegistrationService,
    JwtAuthGuard,
    RolesGuard,
    // Public registration policy: swap this binding to change which roles can
    // self-register without touching RegistrationService.
    {
      provide: REGISTRATION_POLICY,
      useClass: DefaultRegistrationPolicy,
    },
    // Email sender: swap this binding for a real provider (Mailtrap, SES, etc.)
    // without touching RegistrationService.
    {
      provide: EMAIL_SENDER,
      useClass: DevEmailSender,
    },
  ],
  exports: [JwtAuthGuard, JwtModule, UsersModule],
})
export class AuthModule {}
