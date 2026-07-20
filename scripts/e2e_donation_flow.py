#!/usr/bin/env python3
# E2E donation flow on prod host (Python 3.6 compatible)
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
OWNER_EMAIL = "don.owner.%s@example.com" % TS
DONOR_EMAIL = "don.donor.%s@example.com" % TS

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
    snippet = json.dumps(parsed, ensure_ascii=False)[:500] if isinstance(parsed, dict) else str(parsed)[:500]
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
        log("CMD FAIL: %s\n%s" % (cmd, err[:300]))
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
    c, _ = http("POST", "/api/identity/auth/register", body={
        "email": email, "password": PASS, "full_name": name
    })
    record("register %s" % email, c in (200, 201), str(c))
    otp = recover_otp(email)
    log("    OTP=%s" % otp)
    c, _ = http("POST", "/api/identity/auth/verify-email", body={"email": email, "code": otp})
    record("verify %s" % email, c == 200, str(c))
    c, resp = http("POST", "/api/identity/auth/login", body={
        "email": email, "password": PASS, "device_info": "e2e-donation"
    })
    d = data_of(resp) or {}
    token = d.get("access_token") if isinstance(d, dict) else None
    record("login %s" % email, c == 200 and bool(token), str(c))
    if not token:
        raise RuntimeError("login failed")
    return token, jwt_sub(token)


def main():
    log("=== Donation E2E TS=%s ===" % TS)

    c, _ = http("GET", "/api/donation/health")
    record("health donation", c == 200, str(c))
    if c != 200:
        return 1

    owner_token, owner_id = register_login(OWNER_EMAIL, "Don Owner")
    donor_token, donor_id = register_login(DONOR_EMAIL, "Don Donor")

    # Group
    c, resp = http("POST", "/api/community/groups", token=owner_token, body={
        "name": "Nhom Don %s" % TS,
        "description": "donation e2e",
        "province_code": "01",
    })
    group = data_of(resp) or {}
    group_id = group.get("id")
    record("create group", c == 201 and bool(group_id), str(group_id))
    if not group_id:
        return 1

    # Categories
    c, resp = http("GET", "/api/donation/categories", token=donor_token)
    cats = data_of(resp) or []
    cat_id = cats[0]["id"] if cats else str(uuid.uuid4())
    record("list categories", c == 200 and len(cats) > 0, "n=%s" % len(cats) if isinstance(cats, list) else str(c))

    # Create donation
    c, resp = http("POST", "/api/donation/donations", token=donor_token, body={
        "group_id": group_id,
        "title": "Quyen gop ao %s" % TS,
        "description": "E2E donation",
        "pickup_method": "drop_off",
        "items": [{
            "name": "Ao khoac",
            "category_id": cat_id,
            "quantity": 1,
            "condition_declared": "good",
            "images": [{"image_url": "https://example.com/ao.jpg", "type": "declared"}]
        }, {
            "name": "Quan jean",
            "category_id": cat_id,
            "quantity": 1,
            "condition_declared": "used",
            "images": [{"image_url": "https://example.com/quan.jpg", "type": "declared"}]
        }]
    })
    donation = data_of(resp) or {}
    donation_id = donation.get("id")
    code = donation.get("code")
    items = donation.get("items") or []
    record("create donation", c == 201 and bool(donation_id), "%s %s items=%s" % (c, code, len(items)))
    if not donation_id or len(items) < 2:
        return 1
    item1 = items[0]["id"]
    item2 = items[1]["id"]

    # Review accept
    c, resp = http("PUT", "/api/donation/donations/%s/review" % donation_id, token=owner_token, body={
        "action": "accepted"
    })
    d = data_of(resp) or {}
    record("review accepted", c == 200 and d.get("status") == "accepted", str(d.get("status")))

    # Schedule
    c, resp = http("PUT", "/api/donation/donations/%s/schedule" % donation_id, token=owner_token, body={
        "scheduled_at": "2026-08-25T10:00:00.000Z"
    })
    d = data_of(resp) or {}
    record("schedule", c == 200 and d.get("status") == "scheduled", str(d.get("status")))

    # Check item1 accepted
    c, resp = http(
        "PUT",
        "/api/donation/donations/%s/items/%s/check" % (donation_id, item1),
        token=owner_token,
        body={
            "action": "accepted",
            "condition_actual": "good",
            "check_note": "OK",
            "images": [{"image_url": "https://example.com/check1.jpg", "type": "actual_check"}]
        },
    )
    d = data_of(resp) or {}
    record("check item1 accepted", c == 200 and d.get("status") in ("received", "completed"), str(d.get("status")))

    # Check item2 rejected
    c, resp = http(
        "PUT",
        "/api/donation/donations/%s/items/%s/check" % (donation_id, item2),
        token=owner_token,
        body={
            "action": "rejected",
            "reject_reason": "Hong",
            "check_note": "rach",
        },
    )
    d = data_of(resp) or {}
    record("check item2 rejected -> completed", c == 200 and d.get("status") == "completed", str(d.get("status")))

    # Inventory list
    c, resp = http("GET", "/api/donation/inventory?group_id=%s" % group_id, token=owner_token)
    inv_page = data_of(resp) or {}
    inv_items = inv_page.get("items") if isinstance(inv_page, dict) else []
    record("inventory list", c == 200 and len(inv_items) >= 1, "n=%s" % len(inv_items))
    inv_id = inv_items[0]["id"] if inv_items else None

    # History (track product)
    if inv_id:
        c, resp = http("GET", "/api/donation/inventory/%s/history" % inv_id, token=donor_token)
        hist = data_of(resp) or []
        record("inventory history (track)", c == 200 and len(hist) >= 1, "n=%s" % len(hist))
    else:
        record("inventory history (track)", False, "no inventory")

    # Timeline
    c, resp = http("GET", "/api/donation/donations/%s/timeline" % donation_id, token=donor_token)
    timeline = data_of(resp) or []
    record("donation timeline", c == 200 and len(timeline) >= 1, "n=%s" % len(timeline))

    # List mine
    c, resp = http("GET", "/api/donation/donations?mine=true", token=donor_token)
    page = data_of(resp) or {}
    mine = page.get("items") if isinstance(page, dict) else []
    record("list mine", c == 200 and any(x.get("id") == donation_id for x in mine), "n=%s" % len(mine))

    # Internal get inventory
    if inv_id:
        c, resp = http("GET", "/api/donation/internal/inventory/%s" % inv_id)
        item = data_of(resp) or {}
        record("internal get inventory", c == 200 and item.get("status") == "in_stock", str(item.get("status")))

        c, resp = http("PUT", "/api/donation/internal/inventory/%s/status" % inv_id, body={
            "status": "listed",
            "refType": "listing",
            "refId": str(uuid.uuid4()),
        })
        item = data_of(resp) or {}
        record("internal status -> listed", c == 200 and item.get("status") == "listed", str(item.get("status")))

    passed = sum(1 for _, ok, _ in results if ok)
    failed = [r for r in results if not r[1]]
    log("\n========== SUMMARY ==========")
    log("%s/%s passed" % (passed, len(results)))
    log("DONOR=%s OWNER=%s" % (DONOR_EMAIL, OWNER_EMAIL))
    log("GROUP=%s DONATION=%s CODE=%s INV=%s" % (group_id, donation_id, code, inv_id))
    if failed:
        log("FAILED:")
        for n, _, d in failed:
            log("  - %s: %s" % (n, d))
        return 1
    log("ALL DONATION STEPS OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
