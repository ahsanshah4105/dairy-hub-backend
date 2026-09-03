import { Expose } from 'class-transformer';

export class ProfileResponseDto {
  @Expose()
  id!: string;

  @Expose()
  userId!: string;

  @Expose()
  name!: string | null;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}
