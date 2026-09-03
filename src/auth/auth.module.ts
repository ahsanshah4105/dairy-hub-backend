import type ms from 'ms';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthController } from './presentation/auth.controller';
import { AuthService } from './application/auth.service';
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard';
import { RolesGuard } from './presentation/guards/roles.guard';

import { AuthIdentity } from './infrastructure/persistence/auth-identity.entity';
import { AuthIdentityRepository } from './infrastructure/persistence/auth-identity.repository';
import { RedisOtpRepository } from './infrastructure/redis/redis-otp.repository';
import { RedisSessionRepository } from './infrastructure/redis/redis-session.repository';

import { OTP_REPOSITORY } from './domain/ports/otp.repository';
import { SESSION_REPOSITORY } from './domain/ports/session.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuthIdentity]),
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
    AuthIdentityRepository,
    JwtAuthGuard,
    RolesGuard,
    // Port → Adapter bindings (Dependency Inversion)
    { provide: OTP_REPOSITORY, useClass: RedisOtpRepository },
    { provide: SESSION_REPOSITORY, useClass: RedisSessionRepository },
  ],
  exports: [JwtAuthGuard, JwtModule, AuthIdentityRepository],
})
export class AuthModule {}
