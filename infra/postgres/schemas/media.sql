-- media_db (idempotent)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE TYPE media_status AS ENUM ('temp','linked','deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS media_files (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL,
  bucket_key varchar(500) UNIQUE NOT NULL,
  public_url varchar(500) NOT NULL,
  mime_type  varchar(100) NOT NULL,
  size_bytes bigint NOT NULL,
  ref_type   varchar(30),
  ref_id     uuid,
  status     media_status NOT NULL DEFAULT 'temp',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_media_ref ON media_files(ref_type, ref_id);
CREATE INDEX IF NOT EXISTS idx_media_temp ON media_files(created_at) WHERE status = 'temp';
