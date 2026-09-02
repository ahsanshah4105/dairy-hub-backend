import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../entities/user.entity';
import { UserRole } from '../enums/user-role.enum';

export interface CreateUserData {
  phoneNumber: string;
  name?: string;
  role?: UserRole;
}

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  async remove(user: User): Promise<void> {
    await this.repository.delete(user.id);
  }

  findById(id: string): Promise<User | null> {
    return this.repository.findOne({
      where: { id },
    });
  }

  findByPhoneNumber(phoneNumber: string): Promise<User | null> {
    return this.repository.findOne({
      where: { phoneNumber },
    });
  }

  create(data: CreateUserData): User {
    return this.repository.create(data);
  }

  save(user: User): Promise<User> {
    return this.repository.save(user);
  }
}
