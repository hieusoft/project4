#!/usr/bin/env python3
# Full E2E: donor -> review -> check/warehouse -> listing -> request -> approve -> complete
# No schedule steps (per product decision). Python 3.6+ compatible.
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
DONOR_EMAIL = "e2e.donor.%s@example.com" % TS
RECV_EMAIL = "e2e.recv.%s@example.com" % TS

results = []


def log(msg):
    print(msg)
    sys.stdout.flush()


def record(name, ok, detail=""):
    results.append((name, ok, detail))
    log("  [%s] %s%s" % ("PASS" if ok else "FAIL", name, (" — " + detail) if detail else ""))


def http(method, path, body=None, token=None, timeout=45):
    url = BASE + path
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = "Bearer " + token
    try:
        req = Request(url, data=data, headers=headers, method=method)
        resp = urlopen(req, timeout=timeout)
        raw = resp.read().decode("utf-8")
        code = resp.getcode()
    except TypeError:
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
    snippet = json.dumps(parsed, ensure_ascii=False)[:600] if isinstance(parsed, dict) else str(parsed)[:600]
    log("    %s" % snippet)
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
        log("CMD FAIL: %s\n%s" % (cmd, (err or "")[:400]))
    return (out or "").strip()


def recover_otp(email):
    h = sh(
        "docker exec charity-prod-postgres-1 psql -U charity -d identity_db -t -A -c "
        "\"SELECT o.code_hash FROM otp_codes o JOIN accounts a ON a.id=o.account_id "
        "WHERE a.email='%s' AND o.purpose='verify_account' AND o.used_at IS NULL "
        "ORDER BY o.created_at DESC LIMIT 1;\"" % email
    )
    if not h:
        raise RuntimeError("no otp for %s" % email)
    for i in range(1000000):
        c = "%06d" % i
        if hashlib.sha256(c.encode("utf-8")).hexdigest() == h:
            return c
    raise RuntimeError("otp not found")


def register_login(email, name):
    # username: letters/digits/_ only, 3-30 chars
    uname = "u%s" % (email.split("@")[0].replace(".", "").replace("-", "")[-20:])
    c, _ = http("POST", "/api/identity/auth/register", body={
        "username": uname,
        "email": email,
        "password": PASS,
        "full_name": name,
    })
    record("register %s" % uname, c in (200, 201), str(c))
    otp = recover_otp(email)
    log("    OTP=%s" % otp)
    c, _ = http("POST", "/api/identity/auth/verify-email", body={"email": email, "code": otp})
    record("verify %s" % uname, c == 200, str(c))
    c, resp = http("POST", "/api/identity/auth/login", body={
        "email": email, "password": PASS, "device_info": "e2e-full"
    })
    d = data_of(resp) or {}
    token = d.get("access_token") if isinstance(d, dict) else None
    record("login %s" % email.split("@")[0], c == 200 and bool(token), str(c))
    if not token:
        raise RuntimeError("login failed for %s" % email)
    return token, jwt_sub(token)


def main():
    log("=== FULL E2E (no schedule) TS=%s BASE=%s ===" % (TS, BASE))

    for svc in ("identity", "donation", "marketplace", "community", "media", "communication"):
        c, _ = http("GET", "/api/%s/health" % svc)
        record("health %s" % svc, c == 200, str(c))
        if c != 200 and svc in ("identity", "donation", "marketplace", "community"):
            log("Critical service down, abort")
            return 1

    owner_token, owner_id = register_login(OWNER_EMAIL, "E2E Owner")
    donor_token, donor_id = register_login(DONOR_EMAIL, "E2E Donor")
    recv_token, recv_id = register_login(RECV_EMAIL, "E2E Receiver")

    # --- Group ---
    c, resp = http("POST", "/api/community/groups", token=owner_token, body={
        "name": "Nhom E2E Full %s" % TS,
        "description": "full e2e no-schedule",
        "province_code": "01",
    })
    group = data_of(resp) or {}
    group_id = group.get("id") if isinstance(group, dict) else None
    record("create group", c in (200, 201) and bool(group_id), str(group_id))
    if not group_id:
        return 1

    # Receiver join + approve (required for request)
    c, resp = http("POST", "/api/community/groups/%s/join" % group_id, token=recv_token, body={
        "message": "Xin tham gia nhan do"
    })
    join = data_of(resp) or {}
    join_id = join.get("id") if isinstance(join, dict) else None
    # Some APIs return request nested
    if not join_id and isinstance(join, dict):
        join_id = join.get("join_request_id") or join.get("request_id")
    record("receiver join", c in (200, 201), "join_id=%s body_keys=%s" % (join_id, list(join.keys()) if isinstance(join, dict) else type(join)))

    if not join_id:
        c2, resp2 = http("GET", "/api/community/groups/%s/join-requests" % group_id, token=owner_token)
        page = data_of(resp2) or {}
        items = page.get("items") if isinstance(page, dict) else (page if isinstance(page, list) else [])
        if items:
            join_id = items[0].get("id")
        record("list join-requests fallback", bool(join_id), str(join_id))

    if join_id:
        c, _ = http(
            "POST",
            "/api/community/groups/%s/join-requests/%s/approve" % (group_id, join_id),
            token=owner_token,
        )
        record("approve join", c == 200, str(c))
    else:
        record("approve join", False, "no join_id")

    # --- Categories ---
    c, resp = http("GET", "/api/donation/categories", token=donor_token)
    cats = data_of(resp) or []
    if isinstance(cats, dict):
        cats = cats.get("items") or cats.get("data") or []
    cat_id = cats[0]["id"] if cats else str(uuid.uuid4())
    record("list categories", c == 200, "n=%s cat=%s" % (len(cats) if isinstance(cats, list) else 0, cat_id))

    # --- Donation create ---
    c, resp = http("POST", "/api/donation/donations", token=donor_token, body={
        "group_id": group_id,
        "title": "Quyen gop E2E %s" % TS,
        "description": "Full flow no schedule",
        "pickup_method": "drop_off",
        "items": [{
            "name": "Ao khoac E2E",
            "category_id": cat_id,
            "quantity": 1,
            "condition_declared": "good",
            "images": [{"image_url": "https://example.com/ao-%s.jpg" % TS, "type": "declared"}]
        }]
    })
    donation = data_of(resp) or {}
    donation_id = donation.get("id") if isinstance(donation, dict) else None
    items = donation.get("items") if isinstance(donation, dict) else []
    item_id = items[0]["id"] if items else None
    record("create donation", c == 201 and bool(donation_id) and bool(item_id),
           "%s status=%s items=%s" % (donation.get("code"), donation.get("status"), len(items) if items else 0))
    if not donation_id or not item_id:
        return 1

    # Review accept
    c, resp = http("PUT", "/api/donation/donations/%s/review" % donation_id, token=owner_token, body={
        "action": "accepted"
    })
    d = data_of(resp) or {}
    record("review accepted", c == 200 and d.get("status") == "accepted", str(d.get("status")))

    # Check item -> inventory (SKIP schedule)
    c, resp = http(
        "PUT",
        "/api/donation/donations/%s/items/%s/check" % (donation_id, item_id),
        token=owner_token,
        body={
            "action": "accepted",
            "condition_actual": "good",
            "check_note": "OK e2e",
            "images": [{"image_url": "https://example.com/check-%s.jpg" % TS, "type": "actual_check"}]
        },
    )
    d = data_of(resp) or {}
    record(
        "check item -> warehouse",
        c == 200 and d.get("status") in ("received", "completed"),
        "donation_status=%s" % d.get("status"),
    )

    # Inventory
    c, resp = http("GET", "/api/donation/inventory?group_id=%s&status=in_stock" % group_id, token=owner_token)
    inv_page = data_of(resp) or {}
    inv_items = inv_page.get("items") if isinstance(inv_page, dict) else (inv_page if isinstance(inv_page, list) else [])
    inv_id = inv_items[0]["id"] if inv_items else None
    record("inventory in_stock", c == 200 and bool(inv_id), "n=%s inv=%s" % (len(inv_items), inv_id))
    if not inv_id:
        return 1

    c, resp = http("GET", "/api/donation/inventory/%s/history" % inv_id, token=donor_token)
    hist = data_of(resp) or []
    if isinstance(hist, dict):
        hist = hist.get("items") or hist.get("data") or []
    record("inventory history", c == 200 and len(hist) >= 1, "n=%s" % len(hist))

    # --- Listing ---
    c, resp = http("POST", "/api/marketplace/listings", token=owner_token, body={
        "inventory_item_id": inv_id,
        "group_id": group_id,
        "title": "Ao E2E Full %s" % TS,
        "description": "from donation warehouse",
        "category_id": cat_id,
        "condition": "good",
        "quantity_total": 1,
        "province_code": "01",
        "created_by": owner_id,
        "images": [{"image_url": "https://example.com/listing-%s.jpg" % TS}],
    })
    listing = data_of(resp) or {}
    listing_id = listing.get("id") if isinstance(listing, dict) else None
    record("create listing", c in (200, 201) and bool(listing_id), "%s status=%s" % (listing_id, listing.get("status") if isinstance(listing, dict) else None))
    if not listing_id:
        return 1

    # Inventory should become listed (via internal status update)
    c, resp = http("GET", "/api/donation/inventory/%s" % inv_id, token=owner_token)
    inv = data_of(resp) or {}
    inv_status = inv.get("status") if isinstance(inv, dict) else None
    record("inventory after listing", inv_status == "listed", str(inv_status))

    c, _ = http("GET", "/api/marketplace/catalog")
    record("catalog", c == 200, str(c))

    # --- Request (receiver must be member) ---
    c, resp = http("POST", "/api/marketplace/requests", token=recv_token, body={
        "listing_id": listing_id,
        "group_id": group_id,
        "receiver_id": recv_id,
        "quantity": 1,
        "reason": "Can ho tro E2E full",
    })
    req = data_of(resp) or {}
    req_id = req.get("id") if isinstance(req, dict) else None
    record("create request", c in (200, 201) and bool(req_id), "%s status=%s" % (req_id, req.get("status") if isinstance(req, dict) else None))
    if not req_id:
        return 1

    c, resp = http("PUT", "/api/marketplace/requests/%s/approve" % req_id, token=owner_token, body={
        "reviewed_by": owner_id,
    })
    d = data_of(resp) or {}
    record("approve request", c == 200, "status=%s" % (d.get("status") if isinstance(d, dict) else c))

    # Inventory reserved
    c, resp = http("GET", "/api/donation/inventory/%s" % inv_id, token=owner_token)
    inv = data_of(resp) or {}
    record("inventory reserved", isinstance(inv, dict) and inv.get("status") == "reserved", str(inv.get("status") if isinstance(inv, dict) else inv))

    # Complete without schedule
    c, resp = http("PUT", "/api/marketplace/requests/%s/complete" % req_id, token=owner_token, body={
        "confirmed_by": owner_id,
        "qr_token": "e2e-qr-%s" % TS,
        "photo_url": "https://example.com/delivery-%s.jpg" % TS,
        "note": "OK no-schedule",
    })
    d = data_of(resp) or {}
    record("complete request (QR)", c == 200, "status=%s" % (d.get("status") if isinstance(d, dict) else c))

    c, resp = http("GET", "/api/donation/inventory/%s" % inv_id, token=owner_token)
    inv = data_of(resp) or {}
    record("inventory delivered", isinstance(inv, dict) and inv.get("status") == "delivered", str(inv.get("status") if isinstance(inv, dict) else inv))

    c, _ = http("GET", "/api/marketplace/requests/%s/confirmation" % req_id, token=owner_token)
    record("delivery confirmation", c == 200, str(c))

    c, resp = http("GET", "/api/donation/donations/%s/timeline" % donation_id, token=donor_token)
    timeline = data_of(resp) or []
    if isinstance(timeline, dict):
        timeline = timeline.get("items") or timeline.get("data") or []
    record("donation timeline", c == 200 and len(timeline) >= 1, "n=%s" % len(timeline))

    c, _ = http("GET", "/api/marketplace/stats/overview")
    record("stats overview", c == 200, str(c))

    c, _ = http("GET", "/api/communication/notifications?limit=5", token=recv_token)
    record("receiver notifications", c == 200, str(c))

    passed = sum(1 for _, ok, _ in results if ok)
    failed = [r for r in results if not r[1]]
    log("\n========== SUMMARY ==========")
    log("%s/%s passed" % (passed, len(results)))
    log("OWNER=%s DONOR=%s RECV=%s" % (OWNER_EMAIL, DONOR_EMAIL, RECV_EMAIL))
    log("GROUP=%s DONATION=%s INV=%s LISTING=%s REQ=%s" % (group_id, donation_id, inv_id, listing_id, req_id))
    if failed:
        log("FAILED:")
        for n, _, d in failed:
            log("  - %s: %s" % (n, d))
        return 1
    log("ALL FULL FLOW STEPS OK (no schedule)")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        log("FATAL: %s" % e)
        sys.exit(1)
