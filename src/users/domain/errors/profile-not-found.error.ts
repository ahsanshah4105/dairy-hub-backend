import { DomainError } from '../../../shared/domain/domain-error';

export class ProfileNotFoundError extends DomainError {
  readonly code = 'PROFILE_NOT_FOUND';

  constructor() {
    super('User profile not found.');
  }
}
