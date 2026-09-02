import { Expose } from 'class-transformer';

export class UserResponseDto {
  @Expose()
  id!: string;

  @Expose()
  name!: string;

  @Expose()
  phoneNumber!: string;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}
