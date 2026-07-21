export interface UserRegisteredEvent {
  userId: string;
  username?: string;
  email?: string;
  phone?: string;
  fullName?: string;
}

export interface UserVerifiedEvent {
  userId: string;
}

export interface EmailVerificationRequestedEvent {
  userId: string;
  email: string;
  /** 6-digit OTP shown in email; identity stores only the hash */
  code: string;
  expiresAt: string;
}

export interface EmailVerifiedEvent {
  userId: string;
  email?: string;
}

export interface PasswordResetRequestedEvent {
  userId: string;
  email: string;
  /** 6-digit OTP shown in email; identity stores only the hash */
  code: string;
  expiresAt: string;
}

export interface PasswordResetCompletedEvent {
  userId: string;
  email?: string;
}
