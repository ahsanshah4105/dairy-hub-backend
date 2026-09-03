import { DomainError } from '../../../shared/domain/domain-error';

export class OtpInvalidError extends DomainError {
  readonly code = 'OTP_INVALID';

  constructor() {
    super('Invalid OTP.');
  }
}
