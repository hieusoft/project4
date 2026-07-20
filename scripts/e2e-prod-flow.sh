#!/usr/bin/env bash
# Full E2E against local Kong on prod host (register → verify → group → join → post → marketplace).
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:8000}"
TS=$(date +%s)
OWNER_EMAIL="e2e.owner.${TS}@example.com"
MEMBER_EMAIL="e2e.member.${TS}@example.com"
PASS='TestPass123!'

json() { python3 -c 'import sys,json; print(json.dumps(json.load(sys.stdin), ensure_ascii=False, indent=2))' 2>/dev/null || cat; }

step() { echo; echo "==== $* ===="; }

req() {
  local method=$1 url=$2
  shift 2
  local tmp
  tmp=$(mktemp)
  local code
  code=$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" "$url" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json' \
    "$@" || true)
  BODY=$(cat "$tmp")
  rm -f "$tmp"
  HTTP_CODE=$code
  echo "HTTP $HTTP_CODE  $method $url"
  echo "$BODY" | head -c 800
  echo
}

get_otp() {
  local email=$1
  docker exec charity-prod-postgres-1 psql -U charity -d identity_db -t -A -c \
    "SELECT o.code_hash FROM otp_codes o
     JOIN accounts a ON a.id = o.account_id
     WHERE a.email = '${email}' AND o.purpose = 'verify_account' AND o.used_at IS NULL
     ORDER BY o.created_at DESC LIMIT 1;" | tr -d '[:space:]' | while read -r HASH; do
    python3 - <<PY
import hashlib
h = "${HASH}"
for i in range(1_000_000):
    c = f"{i:06d}"
    if hashlib.sha256(c.encode()).hexdigest() == h:
        print(c)
        break
else:
    raise SystemExit("OTP not found for hash")
PY
  done
}

apply_marketplace_schema() {
  step "Ensure marketplace_db schema"
  docker exec -i charity-prod-postgres-1 psql -U charity -d marketplace_db <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE listing_status AS ENUM ('active','reserved','closed','blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE request_status AS ENUM
    ('pending','approved','rejected','scheduled','completed','cancelled','no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS listings (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id  uuid NOT NULL,
  group_id           uuid NOT NULL,
  title              varchar(200) NOT NULL,
  description         text,
  category_id        uuid NOT NULL,
  condition          varchar(20) NOT NULL,
  quantity_total     int NOT NULL DEFAULT 1,
  quantity_available int NOT NULL DEFAULT 1 CHECK (quantity_available >= 0),
  province_code      varchar(10),
  district_code      varchar(10),
  status             listing_status NOT NULL DEFAULT 'active',
  view_count         int NOT NULL DEFAULT 0,
  created_by         uuid NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS listing_images (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  image_url  varchar(500) NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS item_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          varchar(20) UNIQUE NOT NULL,
  listing_id    uuid NOT NULL REFERENCES listings(id),
  group_id      uuid NOT NULL,
  receiver_id   uuid NOT NULL,
  quantity      int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  reason        text,
  status        request_status NOT NULL DEFAULT 'pending',
  reviewed_by   uuid,
  reviewed_at   timestamptz,
  reject_reason text,
  scheduled_at  timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delivery_confirmations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   uuid UNIQUE NOT NULL REFERENCES item_requests(id),
  confirmed_by uuid NOT NULL,
  qr_token     varchar(100),
  photo_url    varchar(500),
  note         text,
  confirmed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_stats (
  id               bigserial PRIMARY KEY,
  stat_date        date NOT NULL,
  group_id         uuid,
  donations_count  int NOT NULL DEFAULT 0,
  items_received   int NOT NULL DEFAULT 0,
  items_listed     int NOT NULL DEFAULT 0,
  items_delivered  int NOT NULL DEFAULT 0,
  requests_count   int NOT NULL DEFAULT 0,
  people_helped    int NOT NULL DEFAULT 0,
  new_users        int NOT NULL DEFAULT 0,
  new_members      int NOT NULL DEFAULT 0,
  UNIQUE (stat_date, group_id)
);

CREATE INDEX IF NOT EXISTS idx_listings_browse ON listings(status, category_id, province_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_group ON listings(group_id, status);
SQL
  echo "marketplace schema OK"
}

register_and_login() {
  local email=$1 name=$2
  step "Register $email"
  req POST "$BASE/api/identity/auth/register" \
    -d "{\"email\":\"$email\",\"password\":\"$PASS\",\"full_name\":\"$name\"}"
  [[ "$HTTP_CODE" == "201" || "$HTTP_CODE" == "200" ]] || { echo FAIL register; return 1; }

  step "Recover OTP for $email"
  local code
  code=$(get_otp "$email")
  echo "OTP=$code"

  step "Verify email $email"
  req POST "$BASE/api/identity/auth/verify-email" \
    -d "{\"email\":\"$email\",\"code\":\"$code\"}"
  [[ "$HTTP_CODE" == "200" ]] || { echo FAIL verify; return 1; }

  step "Login $email"
  req POST "$BASE/api/identity/auth/login" \
    -d "{\"email\":\"$email\",\"password\":\"$PASS\",\"device_info\":\"e2e-script\"}"
  [[ "$HTTP_CODE" == "200" ]] || { echo FAIL login; return 1; }

  ACCESS=$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(d.get('data',d).get('access_token') or d.get('data',d).get('accessToken') or '')" "$BODY")
  # try nested shapes
  if [[ -z "$ACCESS" ]]; then
    ACCESS=$(python3 - <<PY
import json
d=json.loads('''$BODY''')
def find(o):
  if isinstance(o, dict):
    for k,v in o.items():
      if k in ('access_token','accessToken') and isinstance(v,str):
        print(v); return True
      if find(v): return True
  return False
find(d)
PY
)
  fi
  USER_ID=$(python3 - <<PY
import json,base64
tok='''$ACCESS'''.split('.')[1]
tok += '=' * (-len(tok)%4)
import json as J
payload=J.loads(base64.urlsafe_b64decode(tok.encode()))
print(payload.get('sub',''))
PY
)
  echo "ACCESS_LEN=${#ACCESS} USER_ID=$USER_ID"
  [[ -n "$ACCESS" && -n "$USER_ID" ]] || { echo FAIL token parse; echo "$BODY"; return 1; }
}

# ---------- main ----------
echo "E2E BASE=$BASE TS=$TS"
apply_marketplace_schema

# Health
step "Health checks"
for s in identity community media marketplace communication; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE/api/$s/health" || true)
  echo "$s: $code"
done
DON=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE/api/donation/health" || true)
echo "donation: $DON (expect 503 if not deployed)"

register_and_login "$OWNER_EMAIL" "E2E Owner"
OWNER_TOKEN=$ACCESS
OWNER_ID=$USER_ID

register_and_login "$MEMBER_EMAIL" "E2E Member"
MEMBER_TOKEN=$ACCESS
MEMBER_ID=$USER_ID

step "Profile me (owner)"
req GET "$BASE/api/identity/profile/me" -H "Authorization: Bearer $OWNER_TOKEN"
[[ "$HTTP_CODE" == "200" ]] || echo WARN profile

step "Create group"
req POST "$BASE/api/community/groups" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -d "{\"name\":\"Nhóm E2E ${TS}\",\"description\":\"Test group\",\"province_code\":\"01\",\"address\":\"Hà Nội\"}"
[[ "$HTTP_CODE" == "201" ]] || { echo FAIL create group; exit 1; }
GROUP_ID=$(python3 - <<PY
import json
d=json.loads('''$BODY''')
print(d.get('data',{}).get('id',''))
PY
)
echo "GROUP_ID=$GROUP_ID"

step "List groups catalog"
req GET "$BASE/api/community/groups?limit=5"

step "Member join group"
req POST "$BASE/api/community/groups/${GROUP_ID}/join" \
  -H "Authorization: Bearer $MEMBER_TOKEN" \
  -d '{"message":"Xin tham gia test E2E"}'
[[ "$HTTP_CODE" == "201" ]] || { echo FAIL join; exit 1; }
JOIN_ID=$(python3 - <<PY
import json
d=json.loads('''$BODY''')
print(d.get('data',{}).get('id',''))
PY
)
echo "JOIN_ID=$JOIN_ID"

step "Owner list join requests"
req GET "$BASE/api/community/groups/${GROUP_ID}/join-requests" \
  -H "Authorization: Bearer $OWNER_TOKEN"

step "Owner approve join"
req POST "$BASE/api/community/groups/${GROUP_ID}/join-requests/${JOIN_ID}/approve" \
  -H "Authorization: Bearer $OWNER_TOKEN"
[[ "$HTTP_CODE" == "200" ]] || { echo FAIL approve join; exit 1; }

step "Create post in group"
req POST "$BASE/api/community/groups/${GROUP_ID}/posts" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -d '{"content":"Bài viết E2E test","type":"normal"}' || true
# path may differ - try posts router
if [[ "$HTTP_CODE" != "201" && "$HTTP_CODE" != "200" ]]; then
  req POST "$BASE/api/community/posts" \
    -H "Authorization: Bearer $OWNER_TOKEN" \
    -d "{\"group_id\":\"$GROUP_ID\",\"content\":\"Bài viết E2E\",\"type\":\"normal\"}" || true
fi

step "List members"
req GET "$BASE/api/community/groups/${GROUP_ID}/members" \
  -H "Authorization: Bearer $OWNER_TOKEN"

step "Media presign (owner)"
req POST "$BASE/api/media/presign" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -d '{"mime_type":"image/jpeg","ref_type":"avatar","file_size":1024}' || true

step "Donation health (expected fail)"
req GET "$BASE/api/donation/health" || true
echo "NOTE: donation-service not deployed — skip donation flow"

step "Marketplace create listing"
CAT_ID=$(python3 -c 'import uuid; print(uuid.uuid4())')
INV_ID=$(python3 -c 'import uuid; print(uuid.uuid4())')
req POST "$BASE/api/marketplace/listings" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -d "{\"inventory_item_id\":\"$INV_ID\",\"group_id\":\"$GROUP_ID\",\"title\":\"Áo E2E ${TS}\",\"description\":\"Test listing\",\"category_id\":\"$CAT_ID\",\"condition\":\"good\",\"quantity_total\":1,\"province_code\":\"01\",\"created_by\":\"$OWNER_ID\",\"images\":[{\"image_url\":\"https://example.com/a.jpg\"}]}"
[[ "$HTTP_CODE" == "201" || "$HTTP_CODE" == "200" ]] || { echo FAIL create listing; exit 1; }
LISTING_ID=$(python3 - <<PY
import json
d=json.loads('''$BODY''')
print((d.get('data') or {}).get('id',''))
PY
)
echo "LISTING_ID=$LISTING_ID"

step "Marketplace catalog"
req GET "$BASE/api/marketplace/catalog"

step "Member create request"
req POST "$BASE/api/marketplace/requests" \
  -H "Authorization: Bearer $MEMBER_TOKEN" \
  -d "{\"listing_id\":\"$LISTING_ID\",\"group_id\":\"$GROUP_ID\",\"receiver_id\":\"$MEMBER_ID\",\"quantity\":1,\"reason\":\"Cần hỗ trợ E2E\"}"
[[ "$HTTP_CODE" == "201" || "$HTTP_CODE" == "200" ]] || { echo FAIL create request; exit 1; }
REQ_ID=$(python3 - <<PY
import json
d=json.loads('''$BODY''')
print((d.get('data') or {}).get('id',''))
PY
)
echo "REQ_ID=$REQ_ID"

step "Owner approve request"
req PUT "$BASE/api/marketplace/requests/${REQ_ID}/approve" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -d "{\"reviewed_by\":\"$OWNER_ID\"}"
[[ "$HTTP_CODE" == "200" ]] || { echo FAIL approve request; exit 1; }

step "Owner schedule request"
req PUT "$BASE/api/marketplace/requests/${REQ_ID}/schedule" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -d "{\"reviewed_by\":\"$OWNER_ID\",\"scheduled_at\":\"2026-08-20T10:00:00.000Z\"}"
[[ "$HTTP_CODE" == "200" ]] || { echo FAIL schedule; exit 1; }

step "Owner complete request (QR)"
req PUT "$BASE/api/marketplace/requests/${REQ_ID}/complete" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -d "{\"confirmed_by\":\"$OWNER_ID\",\"qr_token\":\"e2e-qr-${TS}\",\"photo_url\":\"https://example.com/d.jpg\",\"note\":\"OK\"}"
[[ "$HTTP_CODE" == "200" ]] || { echo FAIL complete; exit 1; }

step "Delivery confirmation"
req GET "$BASE/api/marketplace/requests/${REQ_ID}/confirmation" \
  -H "Authorization: Bearer $OWNER_TOKEN"

step "Stats"
req GET "$BASE/api/marketplace/stats"

step "Notifications (member)"
req GET "$BASE/api/communication/notifications?limit=5" \
  -H "Authorization: Bearer $MEMBER_TOKEN" || true

echo
echo "=========================================="
echo "E2E DONE"
echo "OWNER=$OWNER_EMAIL"
echo "MEMBER=$MEMBER_EMAIL"
echo "GROUP_ID=$GROUP_ID"
echo "LISTING_ID=$LISTING_ID"
echo "REQ_ID=$REQ_ID"
echo "donation: SKIPPED (503 / not deployed)"
echo "=========================================="
