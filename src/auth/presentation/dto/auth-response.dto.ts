import { Expose, Type } from 'class-transformer';
import { IdentityResponseDto } from './identity-response.dto';

export class AuthResponseDto {
  @Expose()
  message!: string;

  @Expose()
  accessToken?: string;

  @Expose()
  refreshToken?: string;

  @Expose()
  sessionId?: string;

  @Expose()
  @Type(() => IdentityResponseDto)
  identity?: IdentityResponseDto;
}
