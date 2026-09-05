import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';

import { AuthEventListener } from './auth-event.listener';
import { USER_PROFILE_REPOSITORY } from '../../domain/ports/user-profile.repository';
import { UserAuthenticatedEvent } from '../../../auth/domain/events/user-authenticated.event';
import { AccountDeletedEvent } from '../../../auth/domain/events/account-deleted.event';

describe('AuthEventListener', () => {
  let listener: AuthEventListener;
  let profileRepo: any;

  beforeEach(async () => {
    const mockProfileRepo = {
      findByUserId: jest.fn(),
      createProfile: jest.fn(),
      deleteByUserId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthEventListener,
        { provide: USER_PROFILE_REPOSITORY, useValue: mockProfileRepo },
      ],
    }).compile();

    listener = module.get<AuthEventListener>(AuthEventListener);
    profileRepo = module.get(USER_PROFILE_REPOSITORY);
    
    // Silence logger for clean test output
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  describe('handleUserAuthenticated', () => {
    it('should ignore event if isNewIdentity is false (returning user)', async () => {
      const event = new UserAuthenticatedEvent('u-1', '+123456', false);
      await listener.handleUserAuthenticated(event);
      expect(profileRepo.findByUserId).not.toHaveBeenCalled();
      expect(profileRepo.createProfile).not.toHaveBeenCalled();
    });

    it('should ignore event if profile somehow already exists', async () => {
      const event = new UserAuthenticatedEvent('u-1', '+123456', true);
      profileRepo.findByUserId.mockResolvedValue({ id: 'p-1', userId: 'u-1' });
      await listener.handleUserAuthenticated(event);
      expect(profileRepo.createProfile).not.toHaveBeenCalled();
    });

    it('should create profile for new identity', async () => {
      const event = new UserAuthenticatedEvent('u-1', '+123456', true);
      profileRepo.findByUserId.mockResolvedValue(null);
      await listener.handleUserAuthenticated(event);
      expect(profileRepo.createProfile).toHaveBeenCalledWith('u-1');
    });
  });

  describe('handleAccountDeleted', () => {
    it('should delete profile by user ID', async () => {
      const event = new AccountDeletedEvent('u-1');
      await listener.handleAccountDeleted(event);
      expect(profileRepo.deleteByUserId).toHaveBeenCalledWith('u-1');
    });
  });
});
