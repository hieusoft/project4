-- community_db schema
\connect community_db

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE TYPE group_status AS ENUM ('pending','active','suspended','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE member_role AS ENUM ('owner','moderator','member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE member_status AS ENUM ('pending','approved','rejected','left','banned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE post_type AS ENUM ('normal','call_for_donation','thank_you','announcement');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE content_status AS ENUM ('active','pending_review','hidden','blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE report_status AS ENUM ('pending','in_review','resolved','dismissed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE rating_target AS ENUM ('user','group');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE report_target AS ENUM ('user','group','post','listing','message');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS groups (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                varchar(150) NOT NULL,
  slug                varchar(160) UNIQUE NOT NULL,
  description         text,
  avatar_url          varchar(500),
  cover_url           varchar(500),
  address             varchar(255),
  province_code       varchar(10),
  district_code       varchar(10),
  owner_id            uuid NOT NULL,
  status              group_status NOT NULL DEFAULT 'pending',
  allow_member_post   boolean NOT NULL DEFAULT true,
  require_post_review boolean NOT NULL DEFAULT false,
  member_count        int NOT NULL DEFAULT 1,
  reputation_score    int NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_groups_province ON groups(province_code) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_groups_status ON groups(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_groups_owner ON groups(owner_id);

CREATE TABLE IF NOT EXISTS group_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  role       member_role NOT NULL DEFAULT 'member',
  status     member_status NOT NULL DEFAULT 'pending',
  joined_at  timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_members_user ON group_members(user_id) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_members_group ON group_members(group_id, status);

CREATE TABLE IF NOT EXISTS group_join_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  message     text,
  status      member_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_join_req_group ON group_join_requests(group_id) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS uq_join_req_pending
  ON group_join_requests(group_id, user_id) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  author_id     uuid NOT NULL,
  content       text NOT NULL,
  type          post_type NOT NULL DEFAULT 'normal',
  ref_id        uuid,
  status        content_status NOT NULL DEFAULT 'active',
  is_pinned     boolean NOT NULL DEFAULT false,
  like_count    int NOT NULL DEFAULT 0,
  comment_count int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_posts_feed ON posts(group_id, is_pinned DESC, created_at DESC)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS post_images (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  image_url  varchar(500) NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS post_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL,
  parent_id  uuid REFERENCES post_comments(id) ON DELETE CASCADE,
  content    text NOT NULL,
  status     content_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON post_comments(post_id, created_at);

CREATE TABLE IF NOT EXISTS post_reactions (
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  type       varchar(10) NOT NULL DEFAULT 'like',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS ratings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id    uuid NOT NULL,
  target_type rating_target NOT NULL,
  target_id   uuid NOT NULL,
  context_ref uuid NOT NULL,
  score       smallint NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rater_id, context_ref, target_type)
);
CREATE INDEX IF NOT EXISTS idx_ratings_target ON ratings(target_type, target_id);

CREATE TABLE IF NOT EXISTS reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  target_type report_target NOT NULL,
  target_id   uuid NOT NULL,
  reason      varchar(50) NOT NULL,
  description text,
  severity    varchar(10),
  status      report_status NOT NULL DEFAULT 'pending',
  handled_by  uuid,
  handled_at  timestamptz,
  resolution  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reports_pending ON reports(status, severity) WHERE status = 'pending';
