#### 1. identity_db

```sql
CREATE TYPE account_status AS ENUM ('unverified','active','locked','deleted');
CREATE TYPE otp_purpose AS ENUM ('verify_account','reset_password');

CREATE TABLE accounts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          varchar(255) UNIQUE,
  phone          varchar(20) UNIQUE,
  password_hash  varchar(255) NOT NULL,
  status         account_status NOT NULL DEFAULT 'unverified',
  email_verified boolean NOT NULL DEFAULT false, -- true sau khi nhập đúng mã OTP 6 số
  totp_secret    text,                           -- secret TOTP 2FA (không trả ra API)
  totp_enabled   boolean NOT NULL DEFAULT false,
  last_login_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_or_phone CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE TABLE roles (
  id   smallint PRIMARY KEY,
  name varchar(30) UNIQUE NOT NULL          -- USER, PLATFORM_ADMIN (role toàn hệ thống)
);
-- Khi đăng ký public luôn gán USER. Role trong nhóm (owner/moderator/member) thuộc Community.group_members, không phải Identity role.

CREATE TABLE account_roles (
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  role_id    smallint REFERENCES roles(id),
  PRIMARY KEY (account_id, role_id)
);

CREATE TABLE refresh_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash varchar(255) NOT NULL,          -- lưu hash, không lưu token thô
  device_info varchar(255),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_account ON refresh_tokens(account_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_refresh_token_hash ON refresh_tokens(token_hash) WHERE revoked_at IS NULL;

CREATE TABLE otp_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  code_hash  varchar(255) NOT NULL,          -- SHA-256 của OTP 6 số (verify) hoặc reset token; không lưu thô
  purpose    otp_purpose NOT NULL,           -- verify_account hoặc reset_password
  attempts   smallint NOT NULL DEFAULT 0,    -- giữ để rate-limit nếu dùng code challenge sau này
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_profiles (
  id               uuid PRIMARY KEY,          -- = accounts.id (share PK)
  full_name        varchar(100) NOT NULL,
  avatar_url       varchar(500),
  date_of_birth    date,
  gender           varchar(10),
  address          varchar(255),
  province_code    varchar(10),               -- mã tỉnh chuẩn VN, phục vụ lọc
  district_code    varchar(10),
  bio              text,
  reputation_score int NOT NULL DEFAULT 0,    -- cập nhật từ event rating.created
  donation_count   int NOT NULL DEFAULT 0,    -- denormalize cho profile/huy hiệu
  received_count   int NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_otp_account_purpose ON otp_codes(account_id, purpose, created_at DESC) WHERE used_at IS NULL;
CREATE INDEX idx_otp_code_hash ON otp_codes(code_hash) WHERE used_at IS NULL;
CREATE INDEX idx_otp_code_hash_purpose ON otp_codes(code_hash, purpose) WHERE used_at IS NULL;

CREATE INDEX idx_profiles_province ON user_profiles(province_code);

CREATE TABLE user_activity_logs (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL,
  action     varchar(50) NOT NULL,            -- donation_created, request_completed...
  ref_type   varchar(30),
  ref_id     uuid,
  metadata   jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_user ON user_activity_logs(user_id, created_at DESC);
```

#### 2. community_db

```sql
CREATE TYPE group_status AS ENUM ('pending','active','suspended','closed');
CREATE TYPE member_role AS ENUM ('owner','moderator','member');
CREATE TYPE member_status AS ENUM ('pending','approved','rejected','left','banned');
CREATE TYPE post_type AS ENUM ('normal','call_for_donation','thank_you','announcement');
CREATE TYPE content_status AS ENUM ('active','pending_review','hidden','blocked');
CREATE TYPE report_status AS ENUM ('pending','in_review','resolved','dismissed');
CREATE TYPE rating_target AS ENUM ('user','group');
CREATE TYPE report_target AS ENUM ('user','group','post','listing','message');

CREATE TABLE groups (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                varchar(150) NOT NULL,
  slug                varchar(160) UNIQUE NOT NULL,
  description         text,
  avatar_url          varchar(500),
  cover_url           varchar(500),
  address             varchar(255),
  province_code       varchar(10),
  district_code       varchar(10),
  owner_id            uuid NOT NULL,               -- ref identity
  status              group_status NOT NULL DEFAULT 'pending',
  allow_member_post   boolean NOT NULL DEFAULT true,
  require_post_review boolean NOT NULL DEFAULT false,
  member_count        int NOT NULL DEFAULT 1,       -- denormalize
  reputation_score    int NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_groups_province ON groups(province_code) WHERE status = 'active';
CREATE INDEX idx_groups_search ON groups USING gin(to_tsvector('simple', name));

CREATE TABLE group_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  role       member_role NOT NULL DEFAULT 'member',
  status     member_status NOT NULL DEFAULT 'pending',
  joined_at  timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
CREATE INDEX idx_members_user ON group_members(user_id) WHERE status = 'approved';

CREATE TABLE group_join_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  message     text,                                -- lý do xin tham gia
  status      member_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_join_req_group ON group_join_requests(group_id) WHERE status = 'pending';

CREATE TABLE posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  author_id     uuid NOT NULL,
  content       text NOT NULL,
  type          post_type NOT NULL DEFAULT 'normal',
  ref_id        uuid,                              -- link donation/request (bài cảm ơn)
  status        content_status NOT NULL DEFAULT 'active',
  is_pinned     boolean NOT NULL DEFAULT false,
  like_count    int NOT NULL DEFAULT 0,
  comment_count int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_posts_feed ON posts(group_id, is_pinned DESC, created_at DESC)
  WHERE status = 'active';

CREATE TABLE post_images (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  image_url  varchar(500) NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0
);

CREATE TABLE post_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL,
  parent_id  uuid REFERENCES post_comments(id) ON DELETE CASCADE,  -- reply 1 cấp
  content    text NOT NULL,
  status     content_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_post ON post_comments(post_id, created_at);

CREATE TABLE post_reactions (
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  type       varchar(10) NOT NULL DEFAULT 'like',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE ratings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id    uuid NOT NULL,
  target_type rating_target NOT NULL,
  target_id   uuid NOT NULL,
  context_ref uuid NOT NULL,           -- request_id/donation_id: 1 giao dịch chỉ rate 1 lần
  score       smallint NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rater_id, context_ref, target_type)
);
CREATE INDEX idx_ratings_target ON ratings(target_type, target_id);

CREATE TABLE reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  target_type report_target NOT NULL,
  target_id   uuid NOT NULL,
  reason      varchar(50) NOT NULL,     -- spam, scam, inappropriate...
  description text,
  severity    varchar(10),              -- AI gán: low/medium/high
  status      report_status NOT NULL DEFAULT 'pending',
  handled_by  uuid,
  handled_at  timestamptz,
  resolution  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reports_pending ON reports(status, severity) WHERE status = 'pending';
```

#### 3. donation_db

```sql
CREATE TYPE campaign_status AS ENUM ('active','fulfilled','closed','cancelled');
CREATE TYPE contribution_status AS ENUM
  ('pending','accepted','received','completed','rejected','cancelled');
CREATE TYPE contribution_item_status AS ENUM ('pending','accepted','rejected');
CREATE TYPE pickup_method AS ENUM ('drop_off','pickup');
CREATE TYPE item_condition AS ENUM ('new','like_new','good','used','worn');
CREATE TYPE image_type AS ENUM ('declared','actual_check');

CREATE TABLE categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       varchar(100) NOT NULL,
  slug       varchar(120) UNIQUE NOT NULL,
  parent_id  uuid REFERENCES categories(id),
  icon_url   varchar(500),
  is_active  boolean NOT NULL DEFAULT true,
  sort_order smallint NOT NULL DEFAULT 0
);

-- Cuộc quyên góp (đợt)
CREATE TABLE campaigns (
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
CREATE INDEX idx_campaigns_group   ON campaigns(group_id, status);
CREATE INDEX idx_campaigns_active  ON campaigns(status, created_at DESC) WHERE status = 'active';
CREATE INDEX idx_campaigns_province ON campaigns(province_code) WHERE status = 'active';
CREATE INDEX idx_campaigns_search  ON campaigns USING gin(to_tsvector('simple', title));

-- Mục tiêu quyên góp (target items)
CREATE TABLE campaign_items (
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
CREATE INDEX idx_campaign_items ON campaign_items(campaign_id);

-- Đóng góp của donor
CREATE TABLE contributions (
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
CREATE INDEX idx_contributions_campaign ON contributions(campaign_id, status);
CREATE INDEX idx_contributions_donor   ON contributions(donor_id, created_at DESC);

-- Chi tiết đồ đóng góp
CREATE TABLE contribution_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id     uuid NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  campaign_item_id    uuid NOT NULL REFERENCES campaign_items(id),
  name                varchar(200) NOT NULL,             -- tên thực tế
  quantity            int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  condition_declared  item_condition NOT NULL,
  condition_actual    item_condition,                    -- sau khi kiểm
  check_note          text,
  checked_by          uuid,
  checked_at          timestamptz,
  status              contribution_item_status NOT NULL DEFAULT 'pending',
  reject_reason       text
);
CREATE INDEX idx_contrib_items        ON contribution_items(contribution_id);
CREATE INDEX idx_contrib_items_target ON contribution_items(campaign_item_id, status);

-- Ảnh đóng góp
CREATE TABLE contribution_images (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_item_id uuid NOT NULL REFERENCES contribution_items(id) ON DELETE CASCADE,
  image_url            varchar(500) NOT NULL,
  type                 image_type NOT NULL DEFAULT 'declared'
);

-- Xác nhận trao tặng cả đợt
CREATE TABLE campaign_deliveries (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id        uuid UNIQUE NOT NULL REFERENCES campaigns(id),  -- 1 campaign = 1 delivery
  confirmed_by       uuid NOT NULL,
  delivery_photo_url varchar(500),
  delivery_note      text,
  delivered_at       timestamptz NOT NULL DEFAULT now()
);

-- Thống kê hàng ngày (dời từ marketplace_db)
CREATE TABLE daily_stats (
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
```

#### 4. communication_db

```sql
CREATE TYPE conversation_type AS ENUM ('donor_group','receiver_group');
CREATE TYPE participant_type AS ENUM ('user','group');
CREATE TYPE message_type AS ENUM ('text','image','system');
CREATE TYPE noti_channel AS ENUM ('in_app','push','email');

CREATE TABLE conversations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type             conversation_type NOT NULL,
  group_id         uuid NOT NULL,
  user_id          uuid NOT NULL,                -- donor hoặc receiver
  context_type     varchar(20) NOT NULL,          -- donation / request
  context_id       uuid NOT NULL,
  last_message_at  timestamptz,
  last_message_preview varchar(200),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (context_type, context_id)               -- 1 donation/request = 1 hội thoại
);
CREATE INDEX idx_conv_user ON conversations(user_id, last_message_at DESC);
CREATE INDEX idx_conv_group ON conversations(group_id, last_message_at DESC);

CREATE TABLE messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL,                 -- user hoặc moderator cụ thể
  sender_side     participant_type NOT NULL,     -- hiển thị 'group' nếu là moderator
  type            message_type NOT NULL DEFAULT 'text',
  content         text,                          -- text hoặc image_url
  is_hidden       boolean NOT NULL DEFAULT false, -- AI moderation ẩn
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at DESC);

CREATE TABLE message_reads (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  last_read_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)          -- đánh dấu đã đọc theo mốc thời gian
);

CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  type       varchar(50) NOT NULL,               -- donation_accepted, request_approved...
  title      varchar(200) NOT NULL,
  body       text,
  ref_type   varchar(30),
  ref_id     uuid,                               -- deep-link khi bấm vào
  is_read    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_noti_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_noti_unread ON notifications(user_id) WHERE is_read = false;

CREATE TABLE device_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  fcm_token  varchar(500) UNIQUE NOT NULL,
  platform   varchar(10) NOT NULL,               -- android / ios / web
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_device_user ON device_tokens(user_id);

CREATE TABLE scheduled_reminders (                -- cron nhắc lịch hẹn
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  ref_type     varchar(20) NOT NULL,              -- donation / request
  ref_id       uuid NOT NULL,
  remind_at    timestamptz NOT NULL,              -- scheduled_at - 2h
  sent_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reminders_due ON scheduled_reminders(remind_at) WHERE sent_at IS NULL;
```

*(Redis đảm nhiệm: online presence, socket mapping, unread counter cache)*

#### 5. media_db

```sql
CREATE TYPE media_status AS ENUM ('temp','linked','deleted');

CREATE TABLE media_files (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL,
  bucket_key varchar(500) UNIQUE NOT NULL,        -- key trên SeaweedFS: donations/2026/07/xxx.jpg
  public_url varchar(500) NOT NULL,
  mime_type  varchar(100) NOT NULL,
  size_bytes bigint NOT NULL,
  ref_type   varchar(30),                         -- donation/listing/post/avatar/chat/delivery
  ref_id     uuid,
  status     media_status NOT NULL DEFAULT 'temp',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_media_ref ON media_files(ref_type, ref_id);
CREATE INDEX idx_media_temp ON media_files(created_at) WHERE status = 'temp';  -- cron cleanup
```

#### 6. ai_db

```sql
CREATE TYPE llm_feature AS ENUM
  ('item_detection','group_suggestion','moderation','description_generation');
CREATE TYPE llm_status AS ENUM ('success','failed','timeout');
CREATE TYPE moderation_verdict AS ENUM ('approved','flagged','blocked');

CREATE TABLE prompt_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature    llm_feature NOT NULL,
  version    int NOT NULL DEFAULT 1,
  template   text NOT NULL,                       -- có placeholder {{item_description}}
  model      varchar(50) NOT NULL,
  is_active  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (feature, version)
);
CREATE UNIQUE INDEX uq_prompt_active ON prompt_templates(feature) WHERE is_active = true;

CREATE TABLE llm_requests (                        -- log + kiểm soát chi phí
  id            bigserial PRIMARY KEY,
  user_id       uuid,
  feature       llm_feature NOT NULL,
  model         varchar(50) NOT NULL,
  input_tokens  int,
  output_tokens int,
  latency_ms    int,
  status        llm_status NOT NULL,
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_llm_user_day ON llm_requests(user_id, created_at);  -- rate limit theo ngày

CREATE TABLE moderation_results (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_type   varchar(30) NOT NULL,                -- post / listing / message / report
  ref_id     uuid NOT NULL,
  verdict    moderation_verdict NOT NULL,
  categories jsonb,                               -- {spam: 0.1, toxic: 0.8...}
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ref_type, ref_id)
);
```
