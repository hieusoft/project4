# Luồng Quyên góp (Campaign Flow)

> Nền tảng kết nối **người quyên góp** với **hội nhóm thiện nguyện** theo mô hình **cuộc quyên góp (campaign) theo đợt**.

## Kiến trúc

```text
Client (Web / Mobile)
        │
   Kong Gateway :8000
        │
  Identity · Community · Donation · Communication · Media · AI
        │
  PostgreSQL (db-per-service) · Redis · RabbitMQ · SeaweedFS
```

## Vai trò

| Vai trò | Mô tả |
|---|---|
| **Người quyên góp (donor)** | Chọn nhóm, đóng góp vào đợt, theo dõi hành trình món đồ. Phải là thành viên đã được duyệt của nhóm. |
| **Hội nhóm thiện nguyện** | Tạo cuộc quyên góp, duyệt đóng góp, kiểm tra từng món, trao tặng đợt. |
| **Quản trị viên** | Duyệt hội nhóm, xử lý báo cáo vi phạm, thống kê toàn hệ thống. |

---

## Luồng đầy đủ

```text
Đăng ký/Login (Identity)
    → Tạo/tham gia nhóm (Community)
    → Moderator tạo cuộc quyên góp (Donation)
    → Donor đóng góp vào campaign
    → Moderator duyệt đóng góp
    → Moderator kiểm tra từng món (có ảnh)
    → Trao tặng đợt
    → Chat/email/push (Communication)
```

---

## 1. Moderator tạo cuộc quyên góp

```
POST /api/donation/campaigns
Auth: JWT (moderator/owner của nhóm)
```

```json
{
  "group_id": "uuid",
  "title": "Đợt quyên góp vùng lũ",
  "description": "15 áo, 20 bao gạo cho địa phương X",
  "province_code": "01",
  "beneficiary_description": "Bà con vùng bão lũ",
  "items": [
    {"name": "Áo khoác", "target_quantity": 15, "unit": "chiếc"},
    {"name": "Bao gạo",   "target_quantity": 20, "unit": "bao"}
  ]
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "code": "CP-2026-00021",
    "group_id": "uuid",
    "title": "Đợt quyên góp vùng lũ",
    "status": "active",
    "items": [
      {"id": "uuid", "name": "Áo khoác", "target_quantity": 15, "received_quantity": 0, "unit": "chiếc"},
      {"id": "uuid", "name": "Bao gạo",   "target_quantity": 20, "received_quantity": 0, "unit": "bao"}
    ]
  }
}
```

**Logic:**
- Hệ thống verify moderator qua Community service (sync HTTP).
- Campaign `status=active`, code tự sinh `CP-{year}-{seq}`.
- Event: `campaign.created` → Communication notify thành viên nhóm.

---

## 2. Donor đóng góp vào campaign

```
POST /api/donation/contributions
Auth: JWT (thành viên đã được duyệt của nhóm)
```

```json
{
  "campaign_id": "uuid",
  "pickup_method": "drop_off",
  "pickup_address": "123 Lê Lợi, Q.1, TP.HCM",
  "items": [
    {
      "campaign_item_id": "uuid (lấy từ campaign items)",
      "name": "Áo khoác nam đông lạnh",
      "quantity": 5,
      "condition_declared": "good",
      "images": [
        {"image_url": "https://cdn/declared/photo1.jpg", "type": "declared"}
      ]
    },
    {
      "campaign_item_id": "uuid",
      "name": "Bao gạo 5kg",
      "quantity": 10,
      "condition_declared": "new",
      "images": []
    }
  ]
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "code": "CTR-2026-00023",
    "campaign_id": "uuid",
    "donor_id": "uuid",
    "status": "pending",
    "pickup_method": "drop_off",
    "pickup_address": "123 Lê Lợi, Q.1, TP.HCM",
    "items": [
      {"id": "uuid", "name": "Áo khoác nam đông lạnh", "quantity": 5, "status": "pending", "condition_declared": "good"},
      {"id": "uuid", "name": "Bao gạo 5kg", "quantity": 10, "status": "pending", "condition_declared": "new"}
    ]
  }
}
```

**Logic:**
- Campaign phải `status=active`.
- Donor phải là thành viên `approved` của nhóm (gọi Community sync HTTP).
- `campaign_item_id` phải thuộc campaign.
- Contribution `status=pending`, code tự sinh `CTR-{year}-{seq}`.
- Event: `contribution.created` → Communication tạo conversation + notify moderators.

---

## 3. Moderator duyệt đóng góp (sơ bộ)

```
PUT /api/donation/contributions/{id}/review
Auth: JWT (moderator/owner)
```

```json
{"action": "accepted", "reason": null}
```

Hoặc từ chối:
```json
{"action": "rejected", "reason": "Không phù hợp nhu cầu đợt"}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "status": "accepted",
    "reviewed_by": "uuid",
    "reviewed_at": "2026-08-02T16:55:00Z"
  }
}
```

**Logic:**
- Chỉ duyệt được contribution `status=pending`.
- Verify moderator qua Community service (sync HTTP).
- `pending → accepted` hoặc `pending → rejected`.
- Event: `contribution.reviewed` → Communication notify donor.

---

## 4. Moderator kiểm tra từng món (bước duyệt chi tiết, có ảnh)

Đây là bước moderator thực sự kiểm tra từng món đồ: xem ảnh, đánh giá tình trạng thực tế, ghi chú.

```
PUT /api/donation/contributions/{id}/items/{item_id}/check
Auth: JWT (moderator/owner)
```

**Chấp nhận món:**
```json
{
  "action": "accepted",
  "condition_actual": "good",
  "check_note": "Đạt yêu cầu, đồ còn mới",
  "images": [
    {"image_url": "https://cdn/actual_check/photo1.jpg", "type": "actual_check"}
  ]
}
```

**Từ chối món:**
```json
{
  "action": "rejected",
  "condition_actual": "worn",
  "check_note": "Áo rách vai",
  "reject_reason": "Đồ hỏng không dùng được",
  "images": []
}
```

**Logic chạy trong 1 transaction:**

| Trường hợp | Hành động |
|---|---|
| Món **đạt** | `item.status=accepted` + `campaign_items.received_quantity += quantity` |
| Món **hỏng** | `item.status=rejected` + ghi `reject_reason` |
| **Món đầu** check xong | Contribution tự chuyển `accepted → received` (đang kiểm tra) |
| **Mọi món** check xong | Contribution chuyển `received → completed` (có ít nhất 1 món đạt) hoặc `rejected` (hỏng hết) |

**Event:** `contribution.completed` → Communication notify donor: *"3/4 món đã đạt, 1 món bị từ chối vì..."*

---

## 5. Xem tiến độ (minh bạch cho donor)

```
GET /api/donation/campaigns/{id}/progress
Auth: tùy chọn (public)
```

**Response:**
```json
{
  "data": {
    "campaign_id": "uuid",
    "code": "CP-2026-00021",
    "title": "Đợt quyên góp vùng lũ",
    "status": "active",
    "total_targets": 2,
    "fulfilled_targets": 0,
    "items": [
      {
        "id": "uuid",
        "name": "Áo khoác",
        "target_quantity": 15,
        "received_quantity": 5,
        "remaining": 10,
        "unit": "chiếc",
        "fulfilled": false
      },
      {
        "id": "uuid",
        "name": "Bao gạo",
        "target_quantity": 20,
        "received_quantity": 10,
        "remaining": 10,
        "unit": "bao",
        "fulfilled": false
      }
    ]
  }
}
```

Donor thấy tiến độ real-time: *"5/15 áo, 10/20 bao gạo"*. Còn thiếu gì thì đóng góp tiếp.

---

## 6. Moderator trao tặng đợt

Khi campaign đủ mục tiêu hoặc hết hạn, moderator trao tặng toàn bộ đồ.

```
POST /api/donation/campaigns/{id}/deliver
Auth: JWT (moderator/owner)
```

```json
{
  "delivery_photo_url": "https://cdn/delivery/photo.jpg",
  "delivery_note": "Đã trao tặng toàn bộ đồ cho bà con vùng lũ"
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "status": "fulfilled",
    "fulfilled_at": "2026-08-02T17:06:22Z"
  }
}
```

**Logic:**
- `active → fulfilled`.
- Event: `campaign.delivered` → Communication notify tất cả donors: *"Đồ quyên góp của bạn đã đến tay người nhận"*.

---

## 7. Đóng campaign sớm (tuỳ chọn)

Khi chưa đủ mục tiêu nhưng cần đóng đợt:

```
PUT /api/donation/campaigns/{id}/close
Auth: JWT (moderator/owner)
```

```json
{"reason": "Hết hạn đợt, chưa đủ mục tiêu"}
```

→ `active → closed`. Event: `campaign.closed` → notify donors.

---

## Tóm tắt chuỗi trạng thái

```text
CAMPAIGN:     active ──deliver──→ fulfilled
              active ──close────→ closed

CONTRIBUTION: pending ──review──→ accepted ──check item đầu──→ received ──check hết──→ completed
              pending ──review──→ rejected
              accepted/received ──cancel──→ cancelled

ITEM:         pending ──check──→ accepted  (→ bump campaign_item.received_quantity)
              pending ──check──→ rejected  (+ reject_reason)
```

---

## API phụ trợ

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/campaigns` | optional | List campaign (filter `group_id`, `status`, `province_code`, `limit`, `offset`) |
| GET | `/campaigns/{id}` | optional | Chi tiết campaign + items |
| PUT | `/campaigns/{id}` | JWT mod | Cập nhật campaign |
| PUT | `/campaigns/{id}/close` | JWT mod | Đóng đợt sớm |
| GET | `/campaigns/{id}/progress` | optional | Tiến độ từng mục tiêu |
| GET | `/categories` | no | Danh mục |
| GET | `/contributions` | JWT | List đóng góp (filter `campaign_id`, `donor_id`, `status`, `mine`) |
| GET | `/contributions/{id}` | JWT | Chi tiết đóng góp + items + ảnh |
| PUT | `/contributions/{id}/cancel` | JWT | Donor hủy (chỉ khi pending/accepted) |

---

## Cross-service

| Loại | Chi tiết |
|---|---|
| **Sync HTTP** | Donation → Community: verify membership, moderator role |
| **Async (RabbitMQ)** | `campaign.created/closed/delivered`, `contribution.created/reviewed/completed` → Communication (notify + email + FCM) |
| **Media** | Donor upload ảnh qua Media presign → gửi `image_url` trong contribution/check_item |

---

## Response envelope

```json
// Thành công
{"data": {...}}

// Lỗi
{
  "statusCode": 400,
  "path": "/api/donation/contributions/uuid/items/uuid/check",
  "error": "Cannot check items in status=pending",
  "timestamp": "2026-08-02T17:00:00Z"
}
```
