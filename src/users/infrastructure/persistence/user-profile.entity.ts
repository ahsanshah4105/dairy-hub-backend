import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * UserProfile is owned exclusively by the UsersModule.
 * It relates to AuthIdentity by storing the same UUID as `userId`,
 * but has NO hard TypeORM foreign key — true database independence.
 */
@Entity({ name: 'user_profiles' })
export class UserProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true, name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
