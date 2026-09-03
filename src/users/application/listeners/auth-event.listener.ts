import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { AUTH_EVENTS } from '../../../shared/events/events';
import { UserAuthenticatedEvent } from '../../../auth/domain/events/user-authenticated.event';
import { AccountDeletedEvent } from '../../../auth/domain/events/account-deleted.event';
import type { IUserProfileRepository } from '../../domain/ports/user-profile.repository';
import { USER_PROFILE_REPOSITORY } from '../../domain/ports/user-profile.repository';

@Injectable()
export class AuthEventListener {
  private readonly logger = new Logger(AuthEventListener.name);

  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly profileRepo: IUserProfileRepository,
  ) {}

  @OnEvent(AUTH_EVENTS.USER_AUTHENTICATED)
  async handleUserAuthenticated(event: UserAuthenticatedEvent): Promise<void> {
    if (!event.isNewIdentity) {
      return; // Profile already exists for returning users
    }

    const existing = await this.profileRepo.findByUserId(event.userId);
    if (existing) {
      return; // Safety check — don't create duplicates
    }

    await this.profileRepo.createProfile(event.userId);
    this.logger.log({
      msg: 'Created user profile for new identity',
      userId: event.userId,
    });
  }

  @OnEvent(AUTH_EVENTS.ACCOUNT_DELETED)
  async handleAccountDeleted(event: AccountDeletedEvent): Promise<void> {
    await this.profileRepo.deleteByUserId(event.userId);
    this.logger.log({
      msg: 'Deleted user profile for deleted account',
      userId: event.userId,
    });
  }
}
