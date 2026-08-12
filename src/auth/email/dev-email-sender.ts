import { Injectable } from '@nestjs/common';

import { EmailSender } from './email-sender.interface';

@Injectable()
export class DevEmailSender implements EmailSender {
  async sendVerificationEmail(
    to: string,
    verificationData: string,
  ): Promise<void> {
    console.log('[DEV EMAIL] ─────────────────────────────────────────────');
    console.log(`[DEV EMAIL] To:    ${to}`);
    console.log(`[DEV EMAIL] Token: ${verificationData}`);
    console.log(
      `[DEV EMAIL] URL:   /api/auth/verify-email?token=${verificationData}`,
    );
    console.log('[DEV EMAIL] ─────────────────────────────────────────────');
  }
}
