# E2E Full Flow — Donor → Kho → Gian hàng → Người nhận

> Đã chạy thành công trên server `216.108.237.20` (36/36 PASS).  
> Script: `scripts/e2e_full_flow.py`  
> **Không dùng bước hẹn lịch** (schedule).

---

## Tổng quan

```text
Register (owner, donor, receiver)
  → Tạo nhóm + receiver join/approve
  → Donor tạo donation
  → Mod review accepted
  → Mod check item → inventory in_stock
  → Mod tạo listing → inventory listed
  → Receiver tạo request
  → Mod approve → inventory reserved
  → Mod complete (QR) → inventory delivered
```

### Vai trò

| Role | Mô tả |
|---|---|
| **Owner / Moderator** | Chủ nhóm, duyệt join, review donation, check kho, listing, approve/complete request |
| **Donor** | Người quyên góp — **không** cần là member nhóm |
| **Receiver** | Người nhận — **bắt buộc** member approved của nhóm |

### Gateway

- Base: `http://HOST:8000`
- Auth: `Authorization: Bearer <access_token>` (JWT, issuer `charity-auth`)

### Chuỗi trạng thái

```text
DONATION:   pending → accepted → completed
ITEM (đơn): pending → accepted
KHO:        in_stock → listed → reserved → delivered
LISTING:    active (qty giảm khi approve request)
REQUEST:    pending → approved → completed
```

---

## Bước 0 — Health check

| # | API | Expect |
|---|---|---|
| 0.1 | `GET /api/identity/health` | 200 |
| 0.2 | `GET /api/donation/health` | 200 |
| 0.3 | `GET /api/marketplace/health` | 200 |
| 0.4 | `GET /api/community/health` | 200 |
| 0.5 | `GET /api/media/health` | 200 |
| 0.6 | `GET /api/communication/health` | 200 |

---

## Bước 1 — Đăng ký / xác thực email / login (×3 user)

Lặp lại cho **owner**, **donor**, **receiver**.

### 1.1 Register

```http
POST /api/identity/auth/register
Content-Type: application/json

{
  "username": "ue2eowner...",
  "email": "e2e.owner.<ts>@example.com",
  "password": "TestPass123!",
  "full_name": "E2E Owner"
}
```

- `username`: `^[a-zA-Z0-9_]+$`, 3–30 ký tự  
- Expect: **201**, `status=unverified`

### 1.2 Verify email

OTP 6 số (hash SHA-256 trong `identity_db.otp_codes`). E2E đọc hash từ Postgres rồi brute-force 000000–999999.

```http
POST /api/identity/auth/verify-email
Content-Type: application/json

{
  "email": "e2e.owner.<ts>@example.com",
  "code": "954711"
}
```

- Expect: **200**

### 1.3 Login

```http
POST /api/identity/auth/login
Content-Type: application/json

{
  "email": "e2e.owner.<ts>@example.com",
  "password": "TestPass123!",
  "device_info": "e2e-full"
}
```

- Expect: **200**, lấy `data.access_token`  
- `sub` trong JWT = `user_id`

---

## Bước 2 — Tạo nhóm + receiver tham gia

### 2.1 Owner tạo nhóm

```http
POST /api/community/groups
Authorization: Bearer <owner_token>

{
  "name": "Nhom E2E Full <ts>",
  "description": "full e2e no-schedule",
  "province_code": "01"
}
```

- Expect: **201**, `status=active`, `member_count=1` (owner)  
- Lưu `group_id`

### 2.2 Receiver xin join

```http
POST /api/community/groups/{group_id}/join
Authorization: Bearer <recv_token>

{
  "message": "Xin tham gia nhan do"
}
```

- Expect: **201**, `status=pending`  
- Lưu `join_request_id` = `data.id`

### 2.3 Owner duyệt join

```http
POST /api/community/groups/{group_id}/join-requests/{join_request_id}/approve
Authorization: Bearer <owner_token>
```

- Expect: **200**, `status=approved`  
- Event: `group.member_approved` → notify (Communication)

---

## Bước 3 — Quyên góp (Donation) → nhập kho

### 3.1 Lấy danh mục

```http
GET /api/donation/categories
Authorization: Bearer <donor_token>
```

- Expect: **200**, dùng `data[0].id` làm `category_id` (vd. Quần áo)

### 3.2 Donor tạo donation

```http
POST /api/donation/donations
Authorization: Bearer <donor_token>

{
  "group_id": "<group_id>",
  "title": "Quyen gop E2E <ts>",
  "description": "Full flow no schedule",
  "pickup_method": "drop_off",
  "items": [
    {
      "name": "Ao khoac E2E",
      "category_id": "<category_id>",
      "quantity": 1,
      "condition_declared": "good",
      "images": [
        {
          "image_url": "https://example.com/ao-<ts>.jpg",
          "type": "declared"
        }
      ]
    }
  ]
}
```

- Backend: verify group `active` (HTTP → Community)  
- Expect: **201**, `status=pending`, code `DON-YYYY-NNNNN`  
- Lưu `donation_id`, `item_id` = `items[0].id`  
- Event: `donation.created` → Communication (chat donor↔group + notify mods)

> **Chưa vào kho** — chỉ đơn khai báo.

### 3.3 Moderator review (chấp nhận)

```http
PUT /api/donation/donations/{donation_id}/review
Authorization: Bearer <owner_token>

{
  "action": "accepted"
}
```

- Chỉ khi `status=pending`  
- Expect: **200**, `status=accepted`  
- Event: `donation.reviewed`

### 3.4 Check món → **nhập kho** (bỏ schedule)

```http
PUT /api/donation/donations/{donation_id}/items/{item_id}/check
Authorization: Bearer <owner_token>

{
  "action": "accepted",
  "condition_actual": "good",
  "check_note": "OK e2e",
  "images": [
    {
      "image_url": "https://example.com/check-<ts>.jpg",
      "type": "actual_check"
    }
  ]
}
```

**Trong cùng transaction Donation DB:**

1. `donation_items.status` = `accepted`
2. `INSERT inventory_items` → **`status=in_stock`**, code `ITM-YYYY-NNNNN`
3. `INSERT item_status_histories` (`null` → `in_stock`, ref=donation)
4. Donation → `received` (món đầu) rồi `completed` nếu hết item pending  
5. Event: `inventory.imported`, `donation.completed`

- Expect: **200**, donation `status=completed`  
- **Đây là lúc món vào kho**

### 3.5 Xác nhận kho

```http
GET /api/donation/inventory?group_id={group_id}&status=in_stock
Authorization: Bearer <owner_token>
```

- Expect: **200**, có item, lưu `inventory_id`

```http
GET /api/donation/inventory/{inventory_id}/history
Authorization: Bearer <donor_token>
```

- Expect: **200**, timeline có `to_status=in_stock`

---

## Bước 4 — Đăng gian hàng 0 đồng (Marketplace)

### 4.1 Tạo listing từ inventory

```http
POST /api/marketplace/listings
Authorization: Bearer <owner_token>

{
  "inventory_item_id": "<inventory_id>",
  "group_id": "<group_id>",
  "title": "Ao E2E Full <ts>",
  "description": "from donation warehouse",
  "category_id": "<category_id>",
  "condition": "good",
  "quantity_total": 1,
  "province_code": "01",
  "created_by": "<owner_id>",
  "images": [
    { "image_url": "https://example.com/listing-<ts>.jpg" }
  ]
}
```

- Verify owner/mod (Community)  
- Verify inventory `in_stock` (HTTP → Donation internal)  
- Expect: **201**, listing `status=active`  
- Sync: inventory → **`listed`**  
- Event: `listing.created`

### 4.2 Kiểm tra inventory + catalog

```http
GET /api/donation/inventory/{inventory_id}
Authorization: Bearer <owner_token>
```

- Expect: `status=listed`

```http
GET /api/marketplace/catalog
```

- Expect: **200**, listing xuất hiện

---

## Bước 5 — Người nhận xin đồ → trao tặng

### 5.1 Receiver tạo request

```http
POST /api/marketplace/requests
Authorization: Bearer <recv_token>

{
  "listing_id": "<listing_id>",
  "group_id": "<group_id>",
  "receiver_id": "<recv_id>",
  "quantity": 1,
  "reason": "Can ho tro E2E full"
}
```

- Verify membership approved (Community)  
- Expect: **201**, `status=pending`, code `REQ-YYYY-NNNN`  
- Event: `request.created` → notify mods

### 5.2 Moderator approve

```http
PUT /api/marketplace/requests/{request_id}/approve
Authorization: Bearer <owner_token>

{
  "reviewed_by": "<owner_id>"
}
```

- Trừ `listings.quantity_available`  
- Inventory → **`reserved`** (sync Donation)  
- Expect: **200**, request `status=approved`  
- Event: `request.approved`

```http
GET /api/donation/inventory/{inventory_id}
```

- Expect: `status=reserved`

### 5.3 Complete (QR) — không schedule

```http
PUT /api/marketplace/requests/{request_id}/complete
Authorization: Bearer <owner_token>

{
  "confirmed_by": "<owner_id>",
  "qr_token": "e2e-qr-<ts>",
  "photo_url": "https://example.com/delivery-<ts>.jpg",
  "note": "OK no-schedule"
}
```

- `INSERT delivery_confirmations`  
- Request → `completed`  
- Inventory → **`delivered`**  
- Expect: **200**  
- Event: `request.completed` → notify receiver, donor, mods

### 5.4 Xác nhận cuối

| API | Expect |
|---|---|
| `GET /api/donation/inventory/{inventory_id}` | `status=delivered` |
| `GET /api/marketplace/requests/{request_id}/confirmation` | 200 + `qr_token` |
| `GET /api/donation/donations/{donation_id}/timeline` | timeline ≥ 1 |
| `GET /api/marketplace/stats/overview` | 200 |
| `GET /api/communication/notifications?limit=5` (recv) | 200 (vd. `request_approved`, `request_completed`) |

---

## Bảng map Action → API (tóm tắt)

| # | Ai | Action | Method + Path |
|---|---|---|---|
| 1 | All | Register | `POST /api/identity/auth/register` |
| 2 | All | Verify email | `POST /api/identity/auth/verify-email` |
| 3 | All | Login | `POST /api/identity/auth/login` |
| 4 | Owner | Tạo nhóm | `POST /api/community/groups` |
| 5 | Receiver | Xin join | `POST /api/community/groups/{id}/join` |
| 6 | Owner | Duyệt join | `POST /api/community/groups/{id}/join-requests/{rid}/approve` |
| 7 | Donor | Categories | `GET /api/donation/categories` |
| 8 | Donor | Tạo donation | `POST /api/donation/donations` |
| 9 | Owner | Review | `PUT /api/donation/donations/{id}/review` |
| 10 | Owner | Check → kho | `PUT /api/donation/donations/{id}/items/{itemId}/check` |
| 11 | Owner | List kho | `GET /api/donation/inventory?group_id=&status=in_stock` |
| 12 | Donor | History món | `GET /api/donation/inventory/{id}/history` |
| 13 | Owner | Tạo listing | `POST /api/marketplace/listings` |
| 14 | Public | Catalog | `GET /api/marketplace/catalog` |
| 15 | Receiver | Xin nhận | `POST /api/marketplace/requests` |
| 16 | Owner | Duyệt nhận | `PUT /api/marketplace/requests/{id}/approve` |
| 17 | Owner | Trao tặng QR | `PUT /api/marketplace/requests/{id}/complete` |
| 18 | Owner | Confirmation | `GET /api/marketplace/requests/{id}/confirmation` |
| 19 | Donor | Timeline đơn | `GET /api/donation/donations/{id}/timeline` |

**Không gọi:**  
`PUT .../donations/{id}/schedule` · `PUT .../requests/{id}/schedule`

---

## Events (RabbitMQ `charity.events`) trong flow

| Khi | Routing key | Consumer chính |
|---|---|---|
| Tạo donation | `donation.created` | Communication |
| Review | `donation.reviewed` | Communication |
| Check accepted | `inventory.imported` | — |
| Donation xong | `donation.completed` | Communication + Analytics |
| Listing | `listing.created` | Communication + Analytics + AI |
| Request tạo | `request.created` | Communication + Analytics |
| Approve | `request.approved` | Communication |
| Complete | `request.completed` | Communication + Analytics |

Sync HTTP (không queue): Community membership/role, Donation inventory get/status.

---

## Chạy lại E2E trên server

```bash
# SSH vào server
ssh root@216.108.237.20

# Chạy script (gọi localhost:8000 qua Kong)
python3 /opt/charity-platform/scripts/e2e_full_flow.py
```

Hoặc từ máy dev (cần SSH key + script đã scp):

```bash
scp scripts/e2e_full_flow.py root@216.108.237.20:/opt/charity-platform/scripts/
ssh root@216.108.237.20 "python3 /opt/charity-platform/scripts/e2e_full_flow.py"
```

### Kết quả mẫu (run thành công)

```text
36/36 passed
DONATION code: DON-2026-00003
INVENTORY:     ITM-2026-00003  (in_stock → listed → reserved → delivered)
LISTING:       active
REQUEST:       REQ-2026-1596 → completed
```

---

## Ghi chú kỹ thuật

1. **Vào kho** chỉ khi `check` với `action=accepted` — không phải lúc create/review.  
2. **Schedule optional** — code cho phép check ngay từ `accepted`; happy path E2E bỏ hẹn lịch.  
3. **Sinh code** donation/inventory dùng `MAX(code)+1` (tránh duplicate `COUNT`).  
4. Upload Media (presign/confirm) **không bắt buộc** trong E2E này — dùng URL giả; production nên upload qua `/api/media/*`.  
5. OTP verify: production gửi email; E2E đọc DB + crack hash để automation.
