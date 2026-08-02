#!/usr/bin/env python3
"""E2E Campaign flow test — full luồng quyên góp theo đợt.

Flow: login → tạo nhóm → join → duyệt → tạo campaign → đóng góp
      → duyệt đóng góp → kiểm tra món → trao tặng đợt

Usage:
  python scripts/e2e_campaign_flow.py
  python scripts/e2e_campaign_flow.py --base http://localhost:8000
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

PASS = "SamplePass123!"
OWNER_EMAIL = "an.nguyen@example.com"      # nguyenvanan — PLATFORM_ADMIN
DONOR_EMAIL = "binh.tran@example.com"       # tranthibinh — USER

results: list[tuple[str, bool, str]] = []


def log(msg: str) -> None:
    print(msg)
    sys.stdout.flush()


def record(name: str, ok: bool, detail: str = "") -> None:
    tag = "OK  " if ok else "FAIL"
    log(f"  [{tag}] {name}: {detail}" if detail else f"  [{tag}] {name}")
    results.append((name, ok, detail))


def http(
    base: str,
    method: str,
    path: str,
    *,
    token: str | None = None,
    body: dict | None = None,
) -> tuple[int, dict]:
    url = f"{base}{path}"
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            err = json.loads(raw)
        except json.JSONDecodeError:
            err = {"raw": raw[:300]}
        return e.code, err


def data_of(resp: dict) -> dict:
    d = resp.get("data", resp)
    return d if isinstance(d, dict) else {}


def login(base: str, email: str, password: str) -> str | None:
    code, resp = http(base, "POST", "/api/identity/auth/login",
                      body={"email": email, "password": password})
    if code != 200:
        record("login", False, f"{code} {resp}")
        return None
    d = data_of(resp)
    token = d.get("access_token")
    record("login", bool(token), f"{email} -> token={'yes' if token else 'no'}")
    return token


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://161.118.247.84:8000")
    args = ap.parse_args()
    base = args.base.rstrip("/")
    ts = str(int(time.time()))

    log(f"\n{'='*60}")
    log(f"E2E Campaign Flow -- {base}")
    log(f"{'='*60}\n")

    # -- 1. Health check --
    log("-- Step 1: Health check --")
    for svc in ("identity", "community", "donation", "communication", "media", "ai"):
        code, _ = http(base, "GET", f"/api/{svc}/health")
        record(f"health {svc}", code == 200, str(code))

    # -- 2. Login --
    log("\n-- Step 2: Login --")
    owner_token = login(base, OWNER_EMAIL, PASS)
    donor_token = login(base, DONOR_EMAIL, PASS)
    if not owner_token or not donor_token:
        log("\nFATAL: login failed — aborting")
        return 1

    # -- 3. Create group --
    log("\n-- Step 3: Create group --")
    code, resp = http(base, "POST", "/api/community/groups", token=owner_token, body={
        "name": f"E2E Test Group {ts}",
        "description": "Nhóm test E2E campaign flow",
        "province_code": "01",
        "allow_member_post": True,
        "require_post_review": False,
    })
    group = data_of(resp)
    group_id = group.get("id")
    record("create group", code in (200, 201) and bool(group_id),
           f"id={group_id} status={group.get('status')}")

    # -- 4. Donor joins group --
    log("\n-- Step 4: Donor joins group --")
    code, resp = http(base, "POST", f"/api/community/groups/{group_id}/join",
                      token=donor_token, body={"message": "Xin tham gia để test"})
    join_req = data_of(resp)
    join_req_id = join_req.get("id")
    record("join request", code in (200, 201) and bool(join_req_id),
           f"req_id={join_req_id} status={join_req.get('status')}")

    # -- 5. Owner approves join --
    log("\n-- Step 5: Owner approves join --")
    code, resp = http(base, "POST",
                      f"/api/community/groups/{group_id}/join-requests/{join_req_id}/approve",
                      token=owner_token)
    record("approve join", code == 200, f"status={data_of(resp).get('status')}")

    # Verify donor is now a member
    code, resp = http(base, "GET", f"/api/community/groups/{group_id}",
                      token=donor_token)
    grp = data_of(resp)
    record("donor membership", grp.get("my_status") == "approved",
           f"my_role={grp.get('my_role')} my_status={grp.get('my_status')}")

    # -- 6. Create campaign --
    log("\n-- Step 6: Create campaign --")
    code, resp = http(base, "POST", "/api/donation/campaigns", token=owner_token, body={
        "group_id": group_id,
        "title": f"Đợt quyên góp E2E {ts}",
        "description": "15 áo khoác + 20 bao gạo cho vùng lũ",
        "province_code": "01",
        "beneficiary_description": "Bà con vùng bão lũ",
        "items": [
            {"name": "Áo khoác", "target_quantity": 15, "unit": "chiếc"},
            {"name": "Bao gạo", "target_quantity": 20, "unit": "bao"},
        ],
    })
    campaign = data_of(resp)
    campaign_id = campaign.get("id")
    campaign_items = campaign.get("items", [])
    record("create campaign", code in (200, 201) and bool(campaign_id),
           f"id={campaign_id} code={campaign.get('code')} items={len(campaign_items)}")

    # -- 7. Donor creates contribution --
    log("\n-- Step 7: Donor creates contribution --")
    item1_id = campaign_items[0]["id"] if campaign_items else None
    item2_id = campaign_items[1]["id"] if len(campaign_items) > 1 else None
    code, resp = http(base, "POST", "/api/donation/contributions", token=donor_token, body={
        "campaign_id": campaign_id,
        "pickup_method": "drop_off",
        "pickup_address": "123 Lê Lợi, Q.1, TP.HCM",
        "items": [
            {
                "campaign_item_id": item1_id,
                "name": "Áo khoác nam đông lạnh",
                "quantity": 5,
                "condition_declared": "good",
                "images": [],
            },
            {
                "campaign_item_id": item2_id,
                "name": "Bao gạo 5kg",
                "quantity": 10,
                "condition_declared": "new",
                "images": [],
            },
        ],
    })
    contribution = data_of(resp)
    contribution_id = contribution.get("id")
    contrib_items = contribution.get("items", [])
    record("create contribution", code in (200, 201) and bool(contribution_id),
           f"id={contribution_id} code={contribution.get('code')} status={contribution.get('status')} items={len(contrib_items)}")

    # -- 8. Owner reviews contribution (accept) --
    log("\n-- Step 8: Review contribution (accept) --")
    code, resp = http(base, "PUT", f"/api/donation/contributions/{contribution_id}/review",
                      token=owner_token, body={"action": "accepted"})
    record("review accept", code == 200,
           f"status={data_of(resp).get('status')}")

    # -- 9. Owner receives items --
    log("\n-- Step 9: Receive contribution --")
    code, resp = http(base, "POST", f"/api/donation/contributions/{contribution_id}/receive",
                      token=owner_token)
    record("receive", code == 200,
           f"status={data_of(resp).get('status')} received_at={data_of(resp).get('received_at')}")

    # -- 10. Check items (accept each) --
    log("\n-- Step 10: Check items --")
    for ci in contrib_items:
        ci_id = ci.get("id")
        ci_name = ci.get("name", "")
        code, resp = http(base, "PUT",
                          f"/api/donation/contributions/{contribution_id}/items/{ci_id}/check",
                          token=owner_token, body={
                              "action": "accepted",
                              "condition_actual": ci.get("condition_declared", "good"),
                              "check_note": "Đạt yêu cầu",
                              "images": [],
                          })
        c = data_of(resp)
        record(f"check item '{ci_name}'", code == 200,
               f"contrib_status={c.get('status')}")

    # -- 11. Check campaign progress --
    log("\n-- Step 11: Campaign progress --")
    code, resp = http(base, "GET", f"/api/donation/campaigns/{campaign_id}/progress",
                      token=owner_token)
    progress = data_of(resp)
    prog_items = progress.get("items", [])
    record("campaign progress", code == 200 and len(prog_items) > 0,
           f"fulfilled={progress.get('fulfilled_targets')}/{progress.get('total_targets')}")
    for pi in prog_items:
        log(f"    {pi.get('name')}: {pi.get('received_quantity')}/{pi.get('target_quantity')} {pi.get('unit', '')} (remaining={pi.get('remaining')})")

    # -- 12. Deliver campaign --
    log("\n-- Step 12: Deliver campaign --")
    code, resp = http(base, "POST", f"/api/donation/campaigns/{campaign_id}/deliver",
                      token=owner_token, body={
                          "delivery_photo_url": "https://example.com/delivery.jpg",
                          "delivery_note": "Đã trao tặng toàn bộ đồ cho bà con vùng lũ",
                      })
    record("deliver campaign", code == 200,
           f"status={data_of(resp).get('status')} fulfilled_at={data_of(resp).get('fulfilled_at')}")

    # -- 13. Verify campaign status = fulfilled --
    log("\n-- Step 13: Verify fulfilled --")
    code, resp = http(base, "GET", f"/api/donation/campaigns/{campaign_id}",
                      token=owner_token)
    final = data_of(resp)
    record("campaign fulfilled", final.get("status") == "fulfilled",
           f"status={final.get('status')}")

    # -- Summary --
    passed = sum(1 for _, ok, _ in results if ok)
    failed = [r for r in results if not r[1]]
    log(f"\n{'='*60}")
    log(f"SUMMARY: {passed}/{len(results)} passed")
    log(f"GROUP={group_id}  CAMPAIGN={campaign_id}  CONTRIBUTION={contribution_id}")
    if failed:
        log("FAILED:")
        for name, _, detail in failed:
            log(f"  - {name}: {detail}")
        return 1
    log("ALL STEPS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
