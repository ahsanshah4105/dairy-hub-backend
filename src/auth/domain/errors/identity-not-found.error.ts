import { DomainError } from '../../../shared/domain/domain-error';

export class IdentityNotFoundError extends DomainError {
  readonly code = 'IDENTITY_NOT_FOUND';

  constructor() {
    super('Authentication identity not found.');
  }
}
