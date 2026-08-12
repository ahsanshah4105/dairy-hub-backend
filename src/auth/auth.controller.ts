import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import express from 'express';

import { Serialize } from '../interceptors/serialize.interceptor';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { RegistrationService } from './registration.service';
import { ACCESS_TOKEN_COOKIE } from './constants/auth.constants';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthResponseDto } from './dto/auth-response.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ResendVerificationDto } from './dto/resend-verification.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly registrationService: RegistrationService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @Serialize(AuthResponseDto)
  register(@Body() registerDto: RegisterDto) {
    return this.registrationService.register(registerDto);
  }

  @Get('verify-email')
  verifyEmail(@Query('token') token: string) {
    return this.registrationService.verifyEmail(token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.registrationService.resendVerificationEmail(dto.email);
  }
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Serialize(LoginResponseDto)
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // Web login: token HttpOnly cookie mein milega.
  @Post('web/login')
  @Serialize(AuthResponseDto)
  async loginWeb(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true })
    response: express.Response,
  ) {
    const result = await this.authService.login(loginDto);

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
    @Body() deleteAccountDto: DeleteAccountDto,
    @Res({ passthrough: true })
    response: Response,
  ) {
    const result = await this.authService.deleteAccount(
      user.id,
      deleteAccountDto,
    );

    response.clearCookie(ACCESS_TOKEN_COOKIE, this.getCookieOptions());

    return result;
  }
}
