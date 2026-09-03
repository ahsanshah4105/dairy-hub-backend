import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IUserProfileRepository } from '../../domain/ports/user-profile.repository';
import { UserProfile } from './user-profile.entity';

@Injectable()
export class TypeOrmUserProfileRepository implements IUserProfileRepository {
  constructor(
    @InjectRepository(UserProfile)
    private readonly repository: Repository<UserProfile>,
  ) {}

  async findByUserId(userId: string): Promise<UserProfile | null> {
    return this.repository.findOne({ where: { userId } });
  }

  async createProfile(userId: string): Promise<UserProfile> {
    const profile = this.repository.create({ userId });
    return this.repository.save(profile);
  }

  async save(profile: UserProfile): Promise<UserProfile> {
    return this.repository.save(profile);
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.repository.delete({ userId });
  }
}
