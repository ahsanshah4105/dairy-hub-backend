import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { UsersService } from '../users/services/users.service';
import { JwtPayload } from '../users/interface/jwt-payload.interface';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async sendOtp(sendOtpDto: SendOtpDto) {
    let user = await this.usersService.findByPhoneNumber(sendOtpDto.phoneNumber);

    if (user && user.otpExpiresAt && user.otpExpiresAt > new Date()) {
      const timeDiff = user.otpExpiresAt.getTime() - new Date().getTime();
      if (timeDiff > 0) {
        throw new BadRequestException('Please wait 1 minute before requesting a new OTP.');
      }
    }

    if (!user) {
      user = await this.usersService.create({
        phoneNumber: sendOtpDto.phoneNumber,
      });
    }

    // Generate a 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(new Date().getTime() + 60 * 1000); // 1 minute from now

    user.otpCode = otp;
    user.otpExpiresAt = expiresAt;
    await this.usersService.save(user);

    // Mock SMS sending
    console.log(`[Mock SMS] Sending OTP ${otp} to phone number ${sendOtpDto.phoneNumber}`);

    return { message: 'OTP sent successfully' };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const user = await this.usersService.findByPhoneNumber(verifyOtpDto.phoneNumber);

    if (!user || !user.otpCode || user.otpCode !== verifyOtpDto.otp) {
      throw new UnauthorizedException('Invalid OTP');
    }

    if (user.otpExpiresAt && user.otpExpiresAt < new Date()) {
      throw new UnauthorizedException('OTP has expired');
    }

    // Clear OTP after successful verification
    user.otpCode = null;
    user.otpExpiresAt = null;
    await this.usersService.save(user);

    const payload: JwtPayload = { sub: user.id, phoneNumber: user.phoneNumber };
    const accessToken = this.jwtService.sign(payload);

    return { accessToken, user };
  }

  async updateProfile(user: User, updateProfileDto: UpdateProfileDto) {
    user.name = updateProfileDto.name;
    const updatedUser = await this.usersService.save(user);
    return { message: 'Profile updated successfully', user: updatedUser };
  }

  async deleteAccount(userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Authenticated user no longer exists');
    }

    await this.usersService.remove(user);

    return {
      message: 'Account deleted successfully',
    };
  }
}
