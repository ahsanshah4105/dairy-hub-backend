import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  BUYER = 'buyer',
  SELLER = 'seller',
  DELIVERY = 'delivery_boy'
}

@Entity({ name: 'auth_identities' })
export class AuthIdentity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  phoneNumber!: string;

  @Column({
    type: 'varchar',
    nullable: true,
    default: null,
  })
  role!: UserRole;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
