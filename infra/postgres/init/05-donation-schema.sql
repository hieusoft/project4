-- donation_db schema (campaign-driven model)
\connect donation_db

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Enums (reused) ──────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE pickup_method AS ENUM ('drop_off','pickup');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE item_condition AS ENUM ('new','like_new','good','used','worn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE image_type AS ENUM ('declared','actual_check');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Enums (new) ─────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE campaign_status AS ENUM ('active','fulfilled','closed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE contribution_status AS ENUM
  ('pending','accepted','received','completed','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE contribution_item_status AS ENUM ('pending','accepted','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Categories (keep) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       varchar(100) NOT NULL,
  slug       varchar(120) UNIQUE NOT NULL,
  parent_id  uuid REFERENCES categories(id),
  icon_url   varchar(500),
  is_active  boolean NOT NULL DEFAULT true,
  sort_order smallint NOT NULL DEFAULT 0
);

-- ── Campaigns (cuộc quyên góp) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                    varchar(20) UNIQUE NOT NULL,    -- CP-2026-001
  group_id                uuid NOT NULL,
  title                   varchar(200) NOT NULL,
  description             text,
  province_code           varchar(10),                    -- địa phương nhận
  district_code           varchar(10),
  beneficiary_description text,                           -- "bà con vùng lũ xã X"
  status                  campaign_status NOT NULL DEFAULT 'active',
  deadline                date,                           -- hạn chót đóng góp
  created_by              uuid NOT NULL,
  fulfilled_at            timestamptz,                   -- khi giao thành công
  closed_at               timestamptz,                   -- khi đóng (hết hạn / đủ)
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaigns_group   ON campaigns(group_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_active  ON campaigns(status, created_at DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_campaigns_province ON campaigns(province_code) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_campaigns_search  ON campaigns USING gin(to_tsvector('simple', title));

-- ── Campaign items (mục tiêu quyên góp) ────────────────────────
CREATE TABLE IF NOT EXISTS campaign_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name              varchar(200) NOT NULL,
  category_id       uuid REFERENCES categories(id),
  target_quantity   int NOT NULL CHECK (target_quantity > 0),
  received_quantity int NOT NULL DEFAULT 0,             -- denormalized progress
  unit              varchar(20),                         -- cái, bao, kg, hộp...
  condition_required item_condition,                    -- new, good, like_new...
  note              text,
  UNIQUE(campaign_id, name)
);
CREATE INDEX IF NOT EXISTS idx_campaign_items ON campaign_items(campaign_id);

-- ── Contributions (đóng góp của donor) ─────────────────────────
CREATE TABLE IF NOT EXISTS contributions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            varchar(20) UNIQUE NOT NULL,           -- CTR-2026-001
  campaign_id     uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  donor_id        uuid NOT NULL,
  status          contribution_status NOT NULL DEFAULT 'pending',
  pickup_method   pickup_method NOT NULL DEFAULT 'drop_off',
  pickup_address  varchar(255),
  received_at     timestamptz,
  rejected_reason text,
  reviewed_by     uuid,
  reviewed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contributions_campaign ON contributions(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_contributions_donor   ON contributions(donor_id, created_at DESC);

-- ── Contribution items (chi tiết đồ đóng góp) ──────────────────
CREATE TABLE IF NOT EXISTS contribution_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id     uuid NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  campaign_item_id    uuid NOT NULL REFERENCES campaign_items(id),
  name                varchar(200) NOT NULL,             -- tên thực tế (có thể khác target)
  quantity            int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  condition_declared  item_condition NOT NULL,
  condition_actual    item_condition,                    -- sau khi kiểm thực tế
  check_note          text,
  checked_by           uuid,
  checked_at          timestamptz,
  status              contribution_item_status NOT NULL DEFAULT 'pending',
  reject_reason       text
);
CREATE INDEX IF NOT EXISTS idx_contrib_items        ON contribution_items(contribution_id);
CREATE INDEX IF NOT EXISTS idx_contrib_items_target ON contribution_items(campaign_item_id, status);

-- ── Contribution images ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS contribution_images (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_item_id uuid NOT NULL REFERENCES contribution_items(id) ON DELETE CASCADE,
  image_url            varchar(500) NOT NULL,
  type                 image_type NOT NULL DEFAULT 'declared'
);

-- ── Campaign deliveries (xác nhận trao tặng cả đợt) ────────────
CREATE TABLE IF NOT EXISTS campaign_deliveries (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id        uuid UNIQUE NOT NULL REFERENCES campaigns(id),  -- 1 campaign = 1 delivery
  confirmed_by       uuid NOT NULL,
  delivery_photo_url varchar(500),
  delivery_note      text,
  delivered_at       timestamptz NOT NULL DEFAULT now()
);

-- ── Daily stats ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_stats (
  id                  bigserial PRIMARY KEY,
  stat_date           date NOT NULL,
  group_id            uuid,                              -- NULL = toàn hệ thống
  campaigns_count     int NOT NULL DEFAULT 0,
  contributions_count int NOT NULL DEFAULT 0,
  items_received      int NOT NULL DEFAULT 0,
  items_delivered     int NOT NULL DEFAULT 0,
  donors_count        int NOT NULL DEFAULT 0,
  new_users           int NOT NULL DEFAULT 0,
  new_members         int NOT NULL DEFAULT 0,
  UNIQUE (stat_date, group_id)
);

-- ── Seed categories ───────────────────────────────────────────
INSERT INTO categories (name, slug, sort_order)
VALUES
  ('Quần áo', 'quan-ao', 1),
  ('Giày dép', 'giay-dep', 2),
  ('Đồ gia dụng', 'do-gia-dung', 3),
  ('Đồ chơi', 'do-choi', 4),
  ('Sách vở', 'sach-vo', 5),
  ('Khác', 'khac', 99)
ON CONFLICT (slug) DO NOTHING;
