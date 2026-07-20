-- donation_db schema
\connect donation_db

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE TYPE donation_status AS ENUM
  ('pending','accepted','scheduled','received','completed','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE pickup_method AS ENUM ('drop_off','pickup');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE item_condition AS ENUM ('new','like_new','good','used','worn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE donation_item_status AS ENUM ('pending','accepted','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE inventory_status AS ENUM
  ('in_stock','listed','reserved','delivered','discarded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE image_type AS ENUM ('declared','actual_check');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       varchar(100) NOT NULL,
  slug       varchar(120) UNIQUE NOT NULL,
  parent_id  uuid REFERENCES categories(id),
  icon_url   varchar(500),
  is_active  boolean NOT NULL DEFAULT true,
  sort_order smallint NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS donations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            varchar(20) UNIQUE NOT NULL,
  donor_id        uuid NOT NULL,
  group_id        uuid NOT NULL,
  title           varchar(200) NOT NULL,
  description     text,
  status          donation_status NOT NULL DEFAULT 'pending',
  pickup_method   pickup_method NOT NULL DEFAULT 'drop_off',
  pickup_address  varchar(255),
  scheduled_at    timestamptz,
  received_at     timestamptz,
  rejected_reason text,
  reviewed_by     uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_donations_donor ON donations(donor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_group ON donations(group_id, status);

CREATE TABLE IF NOT EXISTS donation_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id        uuid NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  name               varchar(200) NOT NULL,
  category_id        uuid REFERENCES categories(id),
  quantity           int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  condition_declared item_condition NOT NULL,
  condition_actual   item_condition,
  check_note         text,
  checked_by         uuid,
  checked_at         timestamptz,
  status             donation_item_status NOT NULL DEFAULT 'pending',
  reject_reason      text
);

CREATE TABLE IF NOT EXISTS donation_images (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_item_id uuid NOT NULL REFERENCES donation_items(id) ON DELETE CASCADE,
  image_url        varchar(500) NOT NULL,
  type             image_type NOT NULL DEFAULT 'declared'
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             varchar(20) UNIQUE NOT NULL,
  group_id         uuid NOT NULL,
  donation_item_id uuid REFERENCES donation_items(id),
  donor_id         uuid,
  name             varchar(200) NOT NULL,
  category_id      uuid REFERENCES categories(id),
  quantity         int NOT NULL DEFAULT 1,
  condition        item_condition NOT NULL,
  status           inventory_status NOT NULL DEFAULT 'in_stock',
  note             text,
  imported_at      timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_group ON inventory_items(group_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_donor ON inventory_items(donor_id);

CREATE TABLE IF NOT EXISTS item_status_histories (
  id                bigserial PRIMARY KEY,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  from_status       inventory_status,
  to_status         inventory_status NOT NULL,
  actor_id          uuid,
  ref_type          varchar(30),
  ref_id            uuid,
  note              text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_history_item ON item_status_histories(inventory_item_id, created_at);

INSERT INTO categories (name, slug, sort_order)
VALUES
  ('Quần áo', 'quan-ao', 1),
  ('Giày dép', 'giay-dep', 2),
  ('Đồ gia dụng', 'do-gia-dung', 3),
  ('Đồ chơi', 'do-choi', 4),
  ('Sách vở', 'sach-vo', 5),
  ('Khác', 'khac', 99)
ON CONFLICT (slug) DO NOTHING;
