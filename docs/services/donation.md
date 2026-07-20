# Donation Service

| | |
|---|---|
| **Mục đích** | Quy trình quyên góp lõi: donor đăng ký cho đồ → nhóm duyệt → hẹn lịch → kiểm tra thực tế → nhập kho + hành trình món đồ |
| **Stack** | Python 3.12 · FastAPI · asyncpg · aio-pika · httpx |
| **Port** | `3003` |
| **Gateway** | `/api/donation` |
| **Database** | `donation_db` |
| **Code** | `apps/donation-service/` |
| **Schema** | `infra/postgres/init/05-donation-schema.sql` |

---

## Service này làm gì?

Donation là **luồng nghiệp vụ lõi #1** của nền tảng.

| Có trách nhiệm | Không làm |
|---|---|
| Tạo donation + items + ảnh khai báo | Auth (Identity) |
| Moderator duyệt / từ chối / hẹn lịch | Upload file (Media) |
| Kiểm tra thực tế (actual images) | Gian hàng listing (Marketplace) |
| Import kho / inventory | Chat (Communication qua event) |
| Timeline hành trình món đồ | |
| Internal inventory API cho Marketplace | |

**Quy tắc:** Donor **không bắt buộc** là member của nhóm. Verify group `active` qua Community HTTP.

---

## Trạng thái

```text
DONATION: pending → accepted → scheduled → received → completed
                 ↘ rejected | cancelled
ITEM:     pending → accepted | rejected  (accepted → inventory in_stock)
INVENTORY: in_stock → listed → reserved → delivered | discarded
```

---

## API (sau strip `/api/donation`)

### Donations (JWT)

| Method | Path | Mô tả |
|---|---|---|
| POST | `/donations` | Tạo đơn + items + images |
| GET | `/donations` | List (`group_id`, `status`, `mine`) |
| GET | `/donations/{id}` | Chi tiết |
| PUT | `/donations/{id}/review` | `{ action: accepted\|rejected, reason? }` |
| PUT | `/donations/{id}/schedule` | `{ scheduled_at }` |
| PUT | `/donations/{id}/cancel` | Donor hủy |
| PUT | `/donations/{id}/items/{itemId}/check` | Check món + nhập kho nếu accepted |
| GET | `/donations/{id}/timeline` | Hành trình |

### Inventory (JWT)

| Method | Path | Mô tả |
|---|---|---|
| GET | `/categories` | Danh mục |
| GET | `/inventory` | List kho (`group_id`, `status`, `mine`) |
| GET | `/inventory/{id}` | Chi tiết |
| GET | `/inventory/{id}/history` | Timeline món đồ |

### Internal (Marketplace client)

| Method | Path | Mô tả |
|---|---|---|
| GET | `/internal/inventory/{id}` | Lấy item |
| PUT | `/internal/inventory/{id}/status` | `{ status, refType?, refId? }` |

---

## Events

| Event | Khi |
|---|---|
| `donation.created` | Tạo đơn |
| `donation.reviewed` | Duyệt / từ chối |
| `donation.scheduled` | Hẹn lịch |
| `donation.completed` | Mọi item đã check |
| `inventory.imported` | Món accepted → kho |
| `inventory.item_status_changed` | Đổi status kho |

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
COMMUNITY_CHECK_SOFT=false
```
