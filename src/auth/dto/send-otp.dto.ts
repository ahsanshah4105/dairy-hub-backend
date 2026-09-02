import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendOtpDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phoneNumber!: string;
}
