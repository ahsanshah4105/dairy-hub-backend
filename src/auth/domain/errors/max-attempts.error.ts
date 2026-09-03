import { DomainError } from '../../../shared/domain/domain-error';

export class MaxAttemptsError extends DomainError {
  readonly code = 'MAX_ATTEMPTS';

  constructor() {
    super('Too many failed attempts. Try again later.');
  }
}
