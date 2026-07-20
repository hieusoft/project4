#!/usr/bin/env python3
# Full E2E on prod host via Kong. Compatible with Python 3.6+
from __future__ import print_function

import base64
import hashlib
import json
import subprocess
import sys
import time
import uuid

try:
    from urllib.request import Request, urlopen
    from urllib.error import HTTPError
except ImportError:
    from urllib2 import Request, urlopen, HTTPError

BASE = "http://127.0.0.1:8000"
PASS = "TestPass123!"
TS = str(int(time.time()))
OWNER_EMAIL = "e2e.owner.%s@example.com" % TS
MEMBER_EMAIL = "e2e.member.%s@example.com" % TS

results = []


def log(msg):
    print(msg)
    sys.stdout.flush()


def record(name, ok, detail=""):
    results.append((name, ok, detail))
    log("  [%s] %s%s" % ("PASS" if ok else "FAIL", name, (" — " + detail) if detail else ""))


def http(method, path, body=None, token=None, timeout=30):
    url = BASE + path
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = "Bearer " + token
    req = Request(url, data=data, headers=headers)
    if hasattr(req, "get_method"):
        req.get_method = lambda: method  # py2 style; py3 uses method below
    try:
        # Python 3
        req = Request(url, data=data, headers=headers, method=method)
        resp = urlopen(req, timeout=timeout)
        raw = resp.read().decode("utf-8")
        code = resp.getcode()
    except TypeError:
        # older Request without method=
        req = Request(url, data=data, headers=headers)
        req.get_method = lambda: method
        try:
            resp = urlopen(req, timeout=timeout)
            raw = resp.read().decode("utf-8")
            code = resp.getcode()
        except HTTPError as e:
            raw = e.read().decode("utf-8", "replace")
            code = e.code
        except Exception as e:
            return 0, {"error": str(e)}
    except HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        code = e.code
    except Exception as e:
        return 0, {"error": str(e)}
    try:
        parsed = json.loads(raw) if raw else None
    except Exception:
        parsed = raw
    log("    %s %s -> %s" % (method, path, code))
    log("    %s" % (json.dumps(parsed, ensure_ascii=False)[:400] if isinstance(parsed, dict) else str(parsed)[:400]))
    return code, parsed


def data_of(resp):
    if isinstance(resp, dict) and "data" in resp:
        return resp["data"]
    return resp


def jwt_sub(token):
    part = token.split(".")[1]
    part += "=" * (-len(part) % 4)
    payload = json.loads(base64.urlsafe_b64decode(part.encode("utf-8")))
    return str(payload["sub"])


def sh(cmd):
    p = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    out, err = p.communicate()
    if isinstance(out, bytes):
        out = out.decode("utf-8", "replace")
        err = err.decode("utf-8", "replace")
    if p.returncode != 0:
        log("CMD FAIL: %s\n%s" % (cmd, err[:300]))
    return (out or "").strip()


def apply_marketplace_schema():
    sql = """
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN CREATE TYPE listing_status AS ENUM ('active','reserved','closed','blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE request_status AS ENUM
  ('pending','approved','rejected','scheduled','completed','cancelled','no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid NOT NULL,
  group_id uuid NOT NULL,
  title varchar(200) NOT NULL,
  description text,
  category_id uuid NOT NULL,
  condition varchar(20) NOT NULL,
  quantity_total int NOT NULL DEFAULT 1,
  quantity_available int NOT NULL DEFAULT 1 CHECK (quantity_available >= 0),
  province_code varchar(10),
  district_code varchar(10),
  status listing_status NOT NULL DEFAULT 'active',
  view_count int NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS listing_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  image_url varchar(500) NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS item_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(20) UNIQUE NOT NULL,
  listing_id uuid NOT NULL REFERENCES listings(id),
  group_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  reason text,
  status request_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  reject_reason text,
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS delivery_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid UNIQUE NOT NULL REFERENCES item_requests(id),
  confirmed_by uuid NOT NULL,
  qr_token varchar(100),
  photo_url varchar(500),
  note text,
  confirmed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS daily_stats (
  id bigserial PRIMARY KEY,
  stat_date date NOT NULL,
  group_id uuid,
  donations_count int NOT NULL DEFAULT 0,
  items_received int NOT NULL DEFAULT 0,
  items_listed int NOT NULL DEFAULT 0,
  items_delivered int NOT NULL DEFAULT 0,
  requests_count int NOT NULL DEFAULT 0,
  people_helped int NOT NULL DEFAULT 0,
  new_users int NOT NULL DEFAULT 0,
  new_members int NOT NULL DEFAULT 0,
  UNIQUE (stat_date, group_id)
);
"""
    p = subprocess.Popen(
        "docker exec -i charity-prod-postgres-1 psql -U charity -d marketplace_db",
        shell=True,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    out, err = p.communicate(sql.encode("utf-8"))
    ok = p.returncode == 0
    msg = (err or out or b"").decode("utf-8", "replace")[:200]
    record("marketplace_db schema", ok, msg)


def recover_otp(email):
    h = sh(
        "docker exec charity-prod-postgres-1 psql -U charity -d identity_db -t -A -c "
        "\"SELECT o.code_hash FROM otp_codes o JOIN accounts a ON a.id=o.account_id "
        "WHERE a.email='%s' AND o.purpose='verify_account' AND o.used_at IS NULL "
        "ORDER BY o.created_at DESC LIMIT 1;\"" % email
    )
    if not h:
        raise RuntimeError("no otp hash for %s" % email)
    for i in range(1000000):
        c = "%06d" % i
        if hashlib.sha256(c.encode("utf-8")).hexdigest() == h:
            return c
    raise RuntimeError("otp brute force failed")


def register_verify_login(email, full_name):
    code, resp = http(
        "POST",
        "/api/identity/auth/register",
        body={"email": email, "password": PASS, "full_name": full_name},
    )
    record("register %s" % email, code in (200, 201), str(code))
    otp = recover_otp(email)
    log("    OTP=%s" % otp)
    code, resp = http(
        "POST",
        "/api/identity/auth/verify-email",
        body={"email": email, "code": otp},
    )
    record("verify-email %s" % email, code == 200, str(code))
    code, resp = http(
        "POST",
        "/api/identity/auth/login",
        body={"email": email, "password": PASS, "device_info": "e2e"},
    )
    d = data_of(resp) or {}
    token = None
    if isinstance(d, dict):
        token = d.get("access_token") or d.get("accessToken")
        if not token and isinstance(d.get("tokens"), dict):
            token = d["tokens"].get("access_token")
    if not token and isinstance(resp, dict):
        token = resp.get("access_token")
    ok = code == 200 and bool(token)
    record("login %s" % email, ok, str(code))
    if not token:
        raise RuntimeError("login failed: %s" % resp)
    return token, jwt_sub(token)


def main():
    log("E2E BASE=%s TS=%s" % (BASE, TS))
    apply_marketplace_schema()

    for svc in ("identity", "community", "media", "marketplace", "communication"):
        c, _ = http("GET", "/api/%s/health" % svc)
        record("health %s" % svc, c == 200, str(c))
    c, _ = http("GET", "/api/donation/health")
    record("health donation (expect fail)", c != 200, "got %s" % c)

    owner_token, owner_id = register_verify_login(OWNER_EMAIL, "E2E Owner")
    member_token, member_id = register_verify_login(MEMBER_EMAIL, "E2E Member")

    c, resp = http("GET", "/api/identity/profile/me", token=owner_token)
    record("profile/me", c == 200, str(c))

    c, resp = http(
        "POST",
        "/api/community/groups",
        token=owner_token,
        body={
            "name": "Nhom E2E %s" % TS,
            "description": "Test group",
            "province_code": "01",
            "address": "Ha Noi",
        },
    )
    group = data_of(resp) or {}
    group_id = group.get("id") if isinstance(group, dict) else None
    record("create group", c == 201 and bool(group_id), "%s %s" % (c, group_id))
    if not group_id:
        return 1

    c, _ = http("GET", "/api/community/groups?limit=5")
    record("list groups", c == 200, str(c))

    c, resp = http(
        "POST",
        "/api/community/groups/%s/join" % group_id,
        token=member_token,
        body={"message": "Xin tham gia E2E"},
    )
    join = data_of(resp) or {}
    join_id = join.get("id") if isinstance(join, dict) else None
    record("join group", c == 201 and bool(join_id), "%s %s" % (c, join_id))

    c, _ = http(
        "GET",
        "/api/community/groups/%s/join-requests" % group_id,
        token=owner_token,
    )
    record("list join-requests", c == 200, str(c))

    c, resp = http(
        "POST",
        "/api/community/groups/%s/join-requests/%s/approve" % (group_id, join_id),
        token=owner_token,
    )
    record("approve join", c == 200, str(c))

    c, resp = http(
        "POST",
        "/api/community/groups/%s/posts" % group_id,
        token=owner_token,
        body={"content": "Bai E2E %s" % TS, "type": "normal"},
    )
    record("create post", c in (200, 201), str(c))

    c, _ = http(
        "GET",
        "/api/community/groups/%s/members" % group_id,
        token=owner_token,
    )
    record("list members", c == 200, str(c))

    c, resp = http(
        "POST",
        "/api/media/presign",
        token=owner_token,
        body={"mime_type": "image/jpeg", "ref_type": "avatar", "file_size": 1024},
    )
    record("media presign", c in (200, 201), str(c))

    log("\n--- Donation skipped (service not deployed) ---")

    inv = str(uuid.uuid4())
    cat = str(uuid.uuid4())
    c, resp = http(
        "POST",
        "/api/marketplace/listings",
        token=owner_token,
        body={
            "inventory_item_id": inv,
            "group_id": group_id,
            "title": "Ao E2E %s" % TS,
            "description": "listing test",
            "category_id": cat,
            "condition": "good",
            "quantity_total": 1,
            "province_code": "01",
            "created_by": owner_id,
            "images": [{"image_url": "https://example.com/a.jpg"}],
        },
    )
    listing = data_of(resp) or {}
    listing_id = listing.get("id") if isinstance(listing, dict) else None
    record("create listing", c in (200, 201) and bool(listing_id), "%s %s" % (c, listing_id))
    if not listing_id:
        return 1

    c, _ = http("GET", "/api/marketplace/catalog")
    record("catalog", c == 200, str(c))

    c, resp = http(
        "POST",
        "/api/marketplace/requests",
        token=member_token,
        body={
            "listing_id": listing_id,
            "group_id": group_id,
            "receiver_id": member_id,
            "quantity": 1,
            "reason": "Can ho tro E2E",
        },
    )
    req = data_of(resp) or {}
    req_id = req.get("id") if isinstance(req, dict) else None
    record("create request", c in (200, 201) and bool(req_id), "%s %s" % (c, req_id))
    if not req_id:
        return 1

    c, _ = http(
        "PUT",
        "/api/marketplace/requests/%s/approve" % req_id,
        token=owner_token,
        body={"reviewed_by": owner_id},
    )
    record("approve request", c == 200, str(c))

    c, _ = http(
        "PUT",
        "/api/marketplace/requests/%s/schedule" % req_id,
        token=owner_token,
        body={"reviewed_by": owner_id, "scheduled_at": "2026-08-20T10:00:00.000Z"},
    )
    record("schedule request", c == 200, str(c))

    c, _ = http(
        "PUT",
        "/api/marketplace/requests/%s/complete" % req_id,
        token=owner_token,
        body={
            "confirmed_by": owner_id,
            "qr_token": "e2e-qr-%s" % TS,
            "photo_url": "https://example.com/d.jpg",
            "note": "OK",
        },
    )
    record("complete request", c == 200, str(c))

    c, _ = http(
        "GET",
        "/api/marketplace/requests/%s/confirmation" % req_id,
        token=owner_token,
    )
    record("delivery confirmation", c == 200, str(c))

    c, _ = http("GET", "/api/marketplace/stats")
    record("stats", c == 200, str(c))

    c, _ = http(
        "GET",
        "/api/communication/notifications?limit=5",
        token=member_token,
    )
    record("notifications", c == 200, str(c))

    passed = sum(1 for _, ok, _ in results if ok)
    failed = [r for r in results if not r[1]]
    log("\n========== SUMMARY ==========")
    log("%s/%s passed" % (passed, len(results)))
    log("OWNER=%s\nMEMBER=%s" % (OWNER_EMAIL, MEMBER_EMAIL))
    log("GROUP=%s\nLISTING=%s\nREQUEST=%s" % (group_id, listing_id, req_id))
    if failed:
        log("FAILED:")
        for n, _, d in failed:
            log("  - %s: %s" % (n, d))
        return 1
    log("ALL CRITICAL STEPS OK (donation not deployed)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
