export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export interface EmailSender {
  sendVerificationEmail(to: string, verificationData: string): Promise<void>;
}
