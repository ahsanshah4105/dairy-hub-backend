import { DomainError } from '../../../shared/domain/domain-error';

export class InvalidTokenError extends DomainError {
  readonly code = 'INVALID_TOKEN';

  constructor() {
    super('Invalid token.');
  }
}
