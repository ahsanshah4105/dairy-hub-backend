import { DomainError } from '../../../shared/domain/domain-error';

export class OtpCooldownError extends DomainError {
  readonly code = 'OTP_COOLDOWN';

  constructor() {
    super('Please wait 1 minute before requesting a new OTP.');
  }
}
