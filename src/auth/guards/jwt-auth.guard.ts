import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

import { ACCESS_TOKEN_COOKIE } from '../constants/auth.constants';
import { UsersService } from '../../users/services/users.service';
import { AuthenticatedRequest } from '../../users/interface/authenticated-request.interface';
import { JwtPayload } from '../../users/interface/jwt-payload.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const token = this.extractTokenFromRequest(request);

    if (!token) {
      throw new UnauthorizedException('Access token is required');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      const user = await this.usersService.findById(payload.sub);

      if (!user) {
        throw new UnauthorizedException('Authenticated user no longer exists');
      }

      request.user = user;

      return true;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private extractTokenFromRequest(request: Request): string | undefined {
    const bearerToken = this.extractBearerToken(request);

    if (bearerToken) {
      return bearerToken;
    }

    const cookies = request.cookies as Record<string, string> | undefined;

    return cookies?.[ACCESS_TOKEN_COOKIE];
  }

  private extractBearerToken(request: Request): string | undefined {
    const authorization = request.headers.authorization;

    const [type, token] = authorization?.split(' ') ?? [];

    return type === 'Bearer' ? token : undefined;
  }
}
