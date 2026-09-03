import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * AuthIdentity is owned exclusively by the AuthModule.
 * It stores authentication-related data: phone number, role, account status.
 * No cross-module foreign keys.
 */
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

@Entity({ name: 'auth_identities' })
export class AuthIdentity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  phoneNumber!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
