import { DomainError } from '../../../shared/domain/domain-error';

export class InvalidSessionError extends DomainError {
  readonly code = 'INVALID_SESSION';

  constructor() {
    super('Session not found or expired.');
  }
}
