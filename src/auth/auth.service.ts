import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

import { UsersService } from '../users/services/users.service';
import { JwtPayload } from '../users/interface/jwt-payload.interface';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User } from '../users/entities/user.entity';
import { DeleteAccountDto } from './dto/delete-account.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(
      loginDto.email,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      loginDto.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Unverified users must complete email verification before they can log in.
    // emailVerifiedAt is the single source of truth for verification state.
    if (user.emailVerifiedAt === null) {
      throw new UnauthorizedException(
        'Please verify your email before logging in.',
      );
    }

    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    return { accessToken, user };
  }

  async updateProfile(user: User, updateProfileDto: UpdateProfileDto) {
    user.name = updateProfileDto.name;

    const updatedUser = await this.usersService.save(user);

    return { message: 'Profile updated successfully', user: updatedUser };
  }

  async deleteAccount(userId: string, deleteAccountDto: DeleteAccountDto) {
    const user = await this.usersService.findByIdWithPassword(userId);

    if (!user) {
      throw new UnauthorizedException('Authenticated user no longer exists');
    }

    const passwordIsValid = await argon2.verify(
      user.passwordHash,
      deleteAccountDto.password,
    );

    if (!passwordIsValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    await this.usersService.remove(user);

    return {
      message: 'Account deleted successfully',
    };
  }
}
