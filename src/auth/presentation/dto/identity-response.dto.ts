import { Expose } from 'class-transformer';

export class IdentityResponseDto {
  @Expose()
  id!: string;

  @Expose()
  phoneNumber!: string;

  @Expose()
  role!: string;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}
