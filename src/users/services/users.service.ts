import { Injectable } from '@nestjs/common';

import { User } from '../entities/user.entity';
import {
  CreateUserData,
  UsersRepository,
} from '../repositories/users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  findByIdWithPassword(id: string): Promise<User | null> {
    return this.usersRepository.findByIdWithPassword(id);
  }

  save(user: User): Promise<User> {
    return this.usersRepository.save(user);
  }

  remove(user: User): Promise<void> {
    return this.usersRepository.remove(user);
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository.findByEmailWithPassword(email);
  }

  async create(data: CreateUserData): Promise<User> {
    const user = this.usersRepository.create(data);

    return this.usersRepository.save(user);
  }
}
