import { DomainError } from '../../../shared/domain/domain-error';

export class OtpExpiredError extends DomainError {
  readonly code = 'OTP_EXPIRED';

  constructor() {
    super('Invalid or expired OTP.');
  }
}
