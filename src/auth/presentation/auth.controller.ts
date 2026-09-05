import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { Serialize } from '../../interceptors/serialize.interceptor';
import { AuthService } from '../application/auth.service';
import { AuthIdentity } from '../infrastructure/persistence/auth-identity.entity';
import { CurrentUser } from './decorators/current-user.decorator';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { IdentityResponseDto } from './dto/identity-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.phoneNumber);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Serialize(AuthResponseDto)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.phoneNumber, dto.otp);
  }


  @Post('complete-registration')
  @HttpCode(HttpStatus.OK)
  @Serialize(AuthResponseDto)
  async completeRegistration(@Body() dto: CompleteRegistrationDto) {
    const result = await this.authService.completeRegistration(
      dto.setupToken,
      dto.name,
      dto.role,
    );

    return result;
  }


  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Serialize(AuthResponseDto)
  async refresh(@Req() req: Request, @Body() dto: RefreshTokenDto) {
    const [type, token] = req.headers.authorization?.split(' ') ?? [];
    const accessToken = type === 'Bearer' ? token : undefined;

    if (!accessToken) {
      const { UnauthorizedException } = await import('@nestjs/common');
      throw new UnauthorizedException('Access token required in Authorization header for refresh');
    }

    const result = await this.authService.refreshTokens(accessToken, dto.refreshToken);

    return {
      message: 'Token refreshed successfully',
      ...result
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: any) {
    if (user.sessionId) {
      await this.authService.logout(user.id, user.sessionId);
    }
    return { message: 'Logout successful' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(@CurrentUser() user: AuthIdentity) {
    return this.authService.logoutAll(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @Serialize(IdentityResponseDto)
  getIdentity(@CurrentUser() user: AuthIdentity) {
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Delete('account')
  @HttpCode(HttpStatus.OK)
  async deleteAccount(@CurrentUser() user: AuthIdentity) {
    return this.authService.deleteAccount(user.id);
  }
}
