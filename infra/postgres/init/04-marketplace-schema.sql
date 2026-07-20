CREATE TYPE listing_status AS ENUM ('active','reserved','closed','blocked');
CREATE TYPE request_status AS ENUM
  ('pending','approved','rejected','scheduled','completed','cancelled','no_show');

CREATE TABLE listings (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id  uuid NOT NULL,               -- ref donation_db (không FK)
  group_id           uuid NOT NULL,
  title              varchar(200) NOT NULL,
  description        text,
  category_id        uuid NOT NULL,               -- ref categories bên donation_db
  condition          varchar(20) NOT NULL,
  quantity_total     int NOT NULL DEFAULT 1,
  quantity_available int NOT NULL DEFAULT 1 CHECK (quantity_available >= 0),
  province_code      varchar(10),                 -- denormalize để lọc địa điểm
  district_code      varchar(10),
  status             listing_status NOT NULL DEFAULT 'active',
  view_count         int NOT NULL DEFAULT 0,
  created_by         uuid NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_listings_browse ON listings(status, category_id, province_code, created_at DESC);
CREATE INDEX idx_listings_group ON listings(group_id, status);
CREATE INDEX idx_listings_search ON listings USING gin(to_tsvector('simple', title));

CREATE TABLE listing_images (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  image_url  varchar(500) NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0
);

CREATE TABLE item_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          varchar(20) UNIQUE NOT NULL,      -- REQ-2026-00789
  listing_id    uuid NOT NULL REFERENCES listings(id),
  group_id      uuid NOT NULL,                    -- denormalize cho query nhóm
  receiver_id   uuid NOT NULL,
  quantity      int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  reason        text,                             -- lý do cần hỗ trợ
  status        request_status NOT NULL DEFAULT 'pending',
  reviewed_by   uuid,
  reviewed_at   timestamptz,
  reject_reason text,
  scheduled_at  timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_requests_receiver ON item_requests(receiver_id, created_at DESC);
CREATE INDEX idx_requests_group ON item_requests(group_id, status);
-- 1 người không gửi 2 request đang mở cho cùng listing:
CREATE UNIQUE INDEX uq_request_open ON item_requests(listing_id, receiver_id)
  WHERE status IN ('pending','approved','scheduled');

CREATE TABLE delivery_confirmations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   uuid UNIQUE NOT NULL REFERENCES item_requests(id),
  confirmed_by uuid NOT NULL,                     -- moderator xác nhận
  qr_token     varchar(100),                      -- token trong QR người nhận đưa
  photo_url    varchar(500),                      -- ảnh trao tặng
  note         text,
  confirmed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE daily_stats (
  id               bigserial PRIMARY KEY,
  stat_date        date NOT NULL,
  group_id         uuid,                          -- NULL = toàn hệ thống
  donations_count  int NOT NULL DEFAULT 0,
  items_received   int NOT NULL DEFAULT 0,
  items_listed     int NOT NULL DEFAULT 0,
  items_delivered  int NOT NULL DEFAULT 0,
  requests_count   int NOT NULL DEFAULT 0,
  people_helped    int NOT NULL DEFAULT 0,        -- distinct receiver completed
  new_users        int NOT NULL DEFAULT 0,
  new_members      int NOT NULL DEFAULT 0,
  UNIQUE (stat_date, group_id)
);
