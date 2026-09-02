import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import express from 'express';

import { Serialize } from '../interceptors/serialize.interceptor';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { ACCESS_TOKEN_COOKIE } from './constants/auth.constants';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthResponseDto } from './dto/auth-response.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { VerifyOtpResponseDto } from './dto/verify-otp-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.sendOtp(sendOtpDto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Serialize(VerifyOtpResponseDto)
  verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  // Web login: token HttpOnly cookie mein milega.
  @Post('web/verify-otp')
  @HttpCode(HttpStatus.OK)
  @Serialize(AuthResponseDto)
  async verifyOtpWeb(
    @Body() verifyOtpDto: VerifyOtpDto,
    @Res({ passthrough: true })
    response: express.Response,
  ) {
    const result = await this.authService.verifyOtp(verifyOtpDto);

    response.cookie(ACCESS_TOKEN_COOKIE, result.accessToken, {
      ...this.getCookieOptions(),
      maxAge: Number(
        this.configService.getOrThrow<string>('JWT_ACCESS_COOKIE_MAX_AGE_MS'),
      ),
    });

    return { message: 'Web login successful', user: result.user };
  }

  @Post('web/logout')
  @HttpCode(HttpStatus.OK)
  logoutWeb(
    @Res({ passthrough: true })
    response: express.Response,
  ) {
    response.clearCookie(ACCESS_TOKEN_COOKIE, this.getCookieOptions());

    return {
      message: 'Web logout successful',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @Serialize(UserResponseDto)
  getProfile(@CurrentUser() user: User) {
    return user;
  }

  private getCookieOptions(): express.CookieOptions {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  @Serialize(AuthResponseDto)
  updateProfile(
    @CurrentUser() user: User,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user, updateProfileDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('account')
  @HttpCode(HttpStatus.OK)
  async deleteAccount(
    @CurrentUser() user: User,
    @Res({ passthrough: true })
    response: Response,
  ) {
    const result = await this.authService.deleteAccount(user.id);

    response.clearCookie(ACCESS_TOKEN_COOKIE, this.getCookieOptions());

    return result;
  }
}

