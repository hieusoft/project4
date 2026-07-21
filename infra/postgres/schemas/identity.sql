-- identity_db (idempotent)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE TYPE account_status AS ENUM ('unverified','active','locked','deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE otp_purpose AS ENUM ('verify_account','reset_password');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS accounts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username       varchar(30) UNIQUE NOT NULL,
  email          varchar(255) UNIQUE,
  phone          varchar(20) UNIQUE,
  password_hash  varchar(255) NOT NULL,
  status         account_status NOT NULL DEFAULT 'unverified',
  email_verified boolean NOT NULL DEFAULT false,
  totp_secret    text,
  totp_enabled   boolean NOT NULL DEFAULT false,
  last_login_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_or_phone CHECK (email IS NOT NULL OR phone IS NOT NULL),
  CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]{3,30}$')
);

CREATE TABLE IF NOT EXISTS roles (
  id   smallint PRIMARY KEY,
  name varchar(30) UNIQUE NOT NULL
);

INSERT INTO roles (id, name) VALUES (1, 'USER'), (2, 'PLATFORM_ADMIN')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS account_roles (
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  role_id    smallint REFERENCES roles(id),
  PRIMARY KEY (account_id, role_id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash  varchar(255) NOT NULL,
  device_info varchar(255),
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_account ON refresh_tokens(account_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_refresh_token_hash ON refresh_tokens(token_hash) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS otp_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  code_hash  varchar(255) NOT NULL,
  purpose    otp_purpose NOT NULL,
  attempts   smallint NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_account_purpose ON otp_codes(account_id, purpose, created_at DESC) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_otp_code_hash ON otp_codes(code_hash) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_otp_code_hash_purpose ON otp_codes(code_hash, purpose) WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS user_profiles (
  id               uuid PRIMARY KEY,
  full_name        varchar(100) NOT NULL,
  avatar_url       varchar(500),
  date_of_birth    date,
  gender           varchar(10),
  address          varchar(255),
  province_code    varchar(10),
  district_code    varchar(10),
  bio              text,
  reputation_score int NOT NULL DEFAULT 0,
  donation_count   int NOT NULL DEFAULT 0,
  received_count   int NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_province ON user_profiles(province_code);

CREATE TABLE IF NOT EXISTS user_activity_logs (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL,
  action     varchar(50) NOT NULL,
  ref_type   varchar(30),
  ref_id     uuid,
  metadata   jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_user ON user_activity_logs(user_id, created_at DESC);
