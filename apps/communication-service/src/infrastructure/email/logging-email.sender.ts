import { Injectable, Logger } from '@nestjs/common';
import { EmailSenderPort, SendPasswordResetEmailInput, SendVerificationEmailInput } from '../../application/interfaces/email-sender.port';

@Injectable()
export class LoggingEmailSender implements EmailSenderPort {
  private readonly logger = new Logger(LoggingEmailSender.name);

  async sendVerificationEmail(input: SendVerificationEmailInput): Promise<void> {
    this.logger.log(`Verification email queued for ${input.email}: ${input.verificationUrl} (expires ${input.expiresAt})`);
  }

  async sendPasswordResetEmail(input: SendPasswordResetEmailInput): Promise<void> {
    this.logger.log(`Password reset email queued for ${input.email}: ${input.resetUrl} (expires ${input.expiresAt})`);
  }
}
