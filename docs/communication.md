# Communication Service (Python / FastAPI)

> Tài liệu đầy đủ (mục đích, API, luồng, events):  
> **[services/communication.md](./services/communication.md)**

Service chịu **email (Brevo)**, **push (Firebase FCM)** và **chat realtime (Socket.IO)**.

| | |
|---|---|
| Stack | **Python 3.12 + FastAPI + uvicorn** |
| Port | `3005` |
| Gateway | `http://<host>:8000/api/communication` |
| Swagger | `http://<host>:8000/docs` → Communication |
| OpenAPI | `/api/communication/openapi.json` |
| Socket.IO | path `/socket.io` (qua Kong: `/api/communication/socket.io`) |
| DB | `communication_db` |

---

## Stack đã chốt

| Kênh | Công nghệ | Ghi chú |
|---|---|---|
| Email | **Brevo** Transactional API | Dry-run log nếu thiếu `BREVO_API_KEY` |
| Push | **Firebase FCM** (`firebase-admin`) | Dry-run log nếu thiếu FCM credentials |
| Chat | **python-socketio** (ASGI) | Cùng process với FastAPI |
| Events | **aio-pika** / RabbitMQ | Queue `communication.events` |
| DB | **asyncpg** | Schema: `infra/postgres/init/02-communication-schema.sql` |

---

## Cấu trúc code

```text
apps/communication-service/
  Dockerfile
  requirements.txt
  app/
    main.py              # FastAPI + socketio.ASGIApp → asgi_app
    core/                # config, database, security, deps, exceptions
    routers/             # health, notifications, devices, conversations
    services/            # email, push, notifications, chat, reminders
    repositories/        # asyncpg queries
    events/              # RabbitMQ consumer
    realtime/            # Socket.IO handlers
```

Uvicorn:

```bash
uvicorn app.main:asgi_app --host 0.0.0.0 --port 3005
```

---

## Biến môi trường

```env
PORT=3005
OPENAPI_SERVER_URL=/api/communication
JWT_SECRET=
JWT_ISSUER=charity-auth

POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=charity
POSTGRES_PASSWORD=
COMMUNICATION_DB_NAME=communication_db

RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672
RABBITMQ_EXCHANGE=charity.events
COMMUNICATION_EVENTS_QUEUE=communication.events
FRONTEND_BASE_URL=http://localhost:3000

# Brevo
BREVO_API_KEY=
BREVO_SENDER_EMAIL=noreply@example.com
BREVO_SENDER_NAME=Charity Platform

# Firebase FCM (service account)
FCM_PROJECT_ID=
FCM_CLIENT_EMAIL=
FCM_PRIVATE_KEY=   # \n escaped trong .env

REMINDER_LEAD_HOURS=2
REMINDER_INTERVAL_SECONDS=300
```

---

## REST API

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/health` | no | Health |
| GET | `/notifications` | Bearer | `?unreadOnly=&limit=&offset=` |
| PATCH | `/notifications/{id}/read` | Bearer | Đánh dấu đã đọc |
| POST | `/notifications/read-all` | Bearer | Đọc hết |
| POST | `/devices/tokens` | Bearer | `{ "fcmToken", "platform" }` |
| DELETE | `/devices/tokens` | Bearer | `{ "fcmToken" }` |
| GET | `/conversations` | Bearer | `?groupId=` |
| GET | `/conversations/{id}/messages` | Bearer | Lịch sử |
| POST | `/conversations/{id}/messages` | Bearer | Gửi tin (REST) |
| POST | `/conversations/{id}/read` | Bearer | Đánh dấu đã đọc |

---

## Socket.IO

```js
// Qua Kong
const socket = io("http://localhost:8000", {
  path: "/api/communication/socket.io",
  auth: { token: accessToken },
});

// Direct
const socket = io("http://localhost:3005", {
  path: "/socket.io",
  auth: { token: accessToken },
});
```

| Client → server | Payload |
|---|---|
| `join_conversation` | `{ conversationId }` |
| `leave_conversation` | `{ conversationId }` |
| `send_message` | `{ conversationId, content, type?, asGroup? }` |
| `mark_read` | `{ conversationId }` |

| Server → client | Payload |
|---|---|
| `new_message` | message row |

---

## Event RabbitMQ

| Event | Hành vi |
|---|---|
| `email.verification_requested` | Brevo mã OTP 6 số (`code`) |
| `password.reset_requested` | Brevo mã OTP đặt lại mật khẩu |
| `password.reset_completed` | Brevo thông báo đổi mật khẩu thành công |
| `password.reset_requested` | Brevo reset link |
| `donation.created` | Conversation `donor_group` + notify `notifyUserIds` |
| `donation.reviewed` / `scheduled` / `completed` | Notify (+ reminder) |
| `request.created` / `approved` / `scheduled` / `completed` | Notify + conversation khi approved |
| `group.approved` / `join_requested` / `member_approved` | Notify |
| `listing.created` | Notify members (`notifyUserIds`) |
| `message.sent` | FCM recipients |

---

## Schema DB

Apply (volume Postgres đã có):

```bash
# bỏ dòng \connect nếu đã -d communication_db
docker exec -i <postgres> psql -U charity -d communication_db \
  < infra/postgres/init/02-communication-schema.sql
```

Chi tiết cột: `docs/database.md` § communication_db.

---

## Production checklist

- [ ] `BREVO_API_KEY` + sender domain verified
- [ ] FCM service account đúng project app
- [ ] `JWT_SECRET` khớp Identity
- [ ] Schema `communication_db` đã apply
- [ ] Kong WebSocket upgrade cho Socket.IO (route `/api/communication`)
