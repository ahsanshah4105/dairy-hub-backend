import { Test, TestingModule } from '@nestjs/testing';

import { UsersService } from './users.service';
import { USER_PROFILE_REPOSITORY } from '../domain/ports/user-profile.repository';
import { ProfileNotFoundError } from '../domain/errors/profile-not-found.error';
import { UserProfile } from '../infrastructure/persistence/user-profile.entity';

describe('UsersService', () => {
  let service: UsersService;
  let profileRepo: any;

  beforeEach(async () => {
    const mockProfileRepo = {
      findByUserId: jest.fn(),
      createProfile: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: USER_PROFILE_REPOSITORY, useValue: mockProfileRepo },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    profileRepo = module.get(USER_PROFILE_REPOSITORY);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return profile if found', async () => {
      const mockProfile: UserProfile = { id: 'p-1', userId: 'u-1', name: 'John', createdAt: new Date(), updatedAt: new Date() };
      profileRepo.findByUserId.mockResolvedValue(mockProfile);

      const result = await service.getProfile('u-1');
      expect(result).toEqual(mockProfile);
      expect(profileRepo.findByUserId).toHaveBeenCalledWith('u-1');
    });

    it('should throw ProfileNotFoundError if not found', async () => {
      profileRepo.findByUserId.mockResolvedValue(null);

      await expect(service.getProfile('u-1')).rejects.toThrow(ProfileNotFoundError);
    });
  });

  describe('updateProfile', () => {
    it('should auto-create profile if missing, then update name', async () => {
      // 1. Not found initially
      profileRepo.findByUserId.mockResolvedValue(null);
      // 2. Auto-created
      const newProfile: UserProfile = { id: 'p-1', userId: 'u-1', name: null, createdAt: new Date(), updatedAt: new Date() };
      profileRepo.createProfile.mockResolvedValue(newProfile);
      // 3. Save
      const updatedProfile = { ...newProfile, name: 'Alice' };
      profileRepo.save.mockResolvedValue(updatedProfile);

      const result = await service.updateProfile('u-1', 'Alice');
      expect(result).toEqual(updatedProfile);
      expect(profileRepo.createProfile).toHaveBeenCalledWith('u-1');
    });
  });
});
