export interface SendVerificationEmailInput {
  userId: string;
  email: string;
  verificationUrl: string;
  expiresAt: string;
}

export interface SendPasswordResetEmailInput {
  userId: string;
  email: string;
  resetUrl: string;
  expiresAt: string;
}

export interface EmailSenderPort {
  sendVerificationEmail(input: SendVerificationEmailInput): Promise<void>;
  sendPasswordResetEmail(input: SendPasswordResetEmailInput): Promise<void>;
}
