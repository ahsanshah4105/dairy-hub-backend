import { Injectable } from '@nestjs/common';

import { User } from '../entities/user.entity';
import {
  CreateUserData,
  UsersRepository,
} from '../repositories/users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  save(user: User): Promise<User> {
    return this.usersRepository.save(user);
  }

  remove(user: User): Promise<void> {
    return this.usersRepository.remove(user);
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  findByPhoneNumber(phoneNumber: string): Promise<User | null> {
    return this.usersRepository.findByPhoneNumber(phoneNumber);
  }

  async create(data: CreateUserData): Promise<User> {
    const user = this.usersRepository.create(data);

    return this.usersRepository.save(user);
  }
}
