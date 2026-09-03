import { UserProfile } from '../../infrastructure/persistence/user-profile.entity';

/**
 * Port for UserProfile persistence.
 * The domain/application layer depends on this — never on TypeORM directly.
 */
export interface IUserProfileRepository {
  findByUserId(userId: string): Promise<UserProfile | null>;
  createProfile(userId: string): Promise<UserProfile>;
  save(profile: UserProfile): Promise<UserProfile>;
  deleteByUserId(userId: string): Promise<void>;
}

export const USER_PROFILE_REPOSITORY = Symbol('IUserProfileRepository');
