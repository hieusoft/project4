-- communication_db schema (also safe to re-run via scripts/migrate if needed)
\connect communication_db

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE conversation_type AS ENUM ('donor_group', 'receiver_group');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE participant_type AS ENUM ('user', 'group');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE message_type AS ENUM ('text', 'image', 'system');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS conversations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type                 conversation_type NOT NULL,
  group_id             uuid NOT NULL,
  user_id              uuid NOT NULL,
  context_type         varchar(20) NOT NULL,
  context_id           uuid NOT NULL,
  last_message_at      timestamptz,
  last_message_preview varchar(200),
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (context_type, context_id)
);
CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_conv_group ON conversations(group_id, last_message_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL,
  sender_side     participant_type NOT NULL,
  type            message_type NOT NULL DEFAULT 'text',
  content         text,
  is_hidden       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS message_reads (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  last_read_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  type       varchar(50) NOT NULL,
  title      varchar(200) NOT NULL,
  body       text,
  ref_type   varchar(30),
  ref_id     uuid,
  is_read    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_noti_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_noti_unread ON notifications(user_id) WHERE is_read = false;

CREATE TABLE IF NOT EXISTS device_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  fcm_token  varchar(500) UNIQUE NOT NULL,
  platform   varchar(10) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_device_user ON device_tokens(user_id);

CREATE TABLE IF NOT EXISTS scheduled_reminders (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  ref_type   varchar(20) NOT NULL,
  ref_id     uuid NOT NULL,
  remind_at  timestamptz NOT NULL,
  sent_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON scheduled_reminders(remind_at) WHERE sent_at IS NULL;
