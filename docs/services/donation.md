# Donation Service

| | |
|---|---|
| **Mục đích** | Quản lý cuộc quyên góp (campaign) theo đợt: nhóm tạo đợt với mục tiêu, donor đóng góp, nhóm kiểm tra, trao tặng |
| **Stack** | Python 3.12 · FastAPI · asyncpg · aio-pika · httpx |
| **Port** | `3003` |
| **Gateway** | `/api/donation` |
| **Database** | `donation_db` |
| **Code** | `apps/donation-service/` |
| **Schema** | `infra/postgres/init/05-donation-schema.sql` |

---

## Service này làm gì?

Donation là **luồng nghiệp vụ lõi** của nền tảng — thay thế cả donation + marketplace cũ.

| Có trách nhiệm | Không làm |
|---|---|
| Tạo cuộc quyên góp (campaign) + mục tiêu (target items) | Auth (Identity) |
| Donor tạo đóng góp (contribution) vào campaign | Upload file (Media) |
| Moderator duyệt / hẹn lịch / kiểm tra từng món | Chat (Communication qua event) |
| Cập nhật tiến độ campaign (received_quantity) | |
| Trao tặng đợt (campaign delivery) | |
| Daily stats (analytics trực tiếp) | |

---

## Trạng thái

```text
CAMPAIGN:     active → fulfilled | closed | cancelled
CONTRIBUTION: pending → accepted → received → completed
                       ↘ rejected | cancelled
ITEM:         pending → accepted | rejected  (accepted → bump received_quantity)
```

---

## API (sau strip `/api/donation`)

### Campaigns

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| POST | `/campaigns` | JWT mod | Tạo đợt + mục tiêu |
| GET | `/campaigns` | optional | List (`group_id`, `status`, `province_code`) |
| GET | `/campaigns/{id}` | optional | Chi tiết + items |
| PUT | `/campaigns/{id}` | JWT mod | Cập nhật |
| PUT | `/campaigns/{id}/close` | JWT mod | Đóng đợt |
| POST | `/campaigns/{id}/deliver` | JWT mod | Xác nhận trao tặng |
| GET | `/campaigns/{id}/progress` | optional | Tiến độ từng mục tiêu |

### Contributions

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| POST | `/contributions` | JWT | Donor đóng góp vào campaign |
| GET | `/contributions` | JWT | List (`campaign_id`, `donor_id`, `status`, `mine`) |
| GET | `/contributions/{id}` | JWT | Chi tiết + items |
| PUT | `/contributions/{id}/review` | JWT mod | Duyệt / từ chối |
| PUT | `/contributions/{id}/cancel` | JWT | Donor hủy |
| PUT | `/contributions/{id}/items/{itemId}/check` | JWT mod | Kiểm tra món + bump tiến độ |

### Categories

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/categories` | no | Danh mục |

---

## Events

| Event | Khi |
|---|---|
| `campaign.created` | Tạo đợt |
| `campaign.closed` | Đóng đợt |
| `campaign.delivered` | Trao tặng thành công |
| `contribution.created` | Donor đóng góp |
| `contribution.reviewed` | Duyệt / từ chối đóng góp |
| `contribution.completed` | Mọi item đã check |

---

## Env

```env
PORT=3003
OPENAPI_SERVER_URL=/api/donation
DONATION_DB_NAME=donation_db
JWT_SECRET=...
JWT_ISSUER=charity-auth
RABBITMQ_URL=amqp://...
COMMUNITY_SERVICE_URL=http://community-service:3002
IDENTITY_SERVICE_URL=http://identity-service:3001
COMMUNITY_CHECK_SOFT=false
```
