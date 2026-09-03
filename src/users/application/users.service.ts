import { Inject, Injectable } from '@nestjs/common';

import type { IUserProfileRepository } from '../domain/ports/user-profile.repository';
import { USER_PROFILE_REPOSITORY } from '../domain/ports/user-profile.repository';
import { UserProfile } from '../infrastructure/persistence/user-profile.entity';
import { ProfileNotFoundError } from '../domain/errors/profile-not-found.error';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly profileRepo: IUserProfileRepository,
  ) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new ProfileNotFoundError();
    }
    return profile;
  }

  async updateProfile(userId: string, name: string): Promise<UserProfile> {
    let profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      // Auto-create if missing (edge case)
      profile = await this.profileRepo.createProfile(userId);
    }
    profile.name = name;
    return this.profileRepo.save(profile);
  }
}
