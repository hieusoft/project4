# 🎁 Nền tảng Kết nối Quyên góp Thiện nguyện

> Nền tảng kết nối **người quyên góp** với các **hội nhóm thiện nguyện** — nơi hội nhóm
> đóng vai trò trung gian tiếp nhận, kiểm tra và phân phối đồ dùng đến
> những người thực sự cần hỗ trợ thông qua **cuộc quyên góp (campaign)** theo đợt.

## 📌 Bài toán

Đồ quyên góp tự phát thường không đến đúng người cần, không được kiểm tra chất lượng,
và người cho không bao giờ biết món đồ của mình đi về đâu. Nền tảng này giải quyết bằng
mô hình hội nhóm trung gian có quy trình rõ ràng:

```
Người quyên góp → Chọn hội nhóm → Nhóm tạo cuộc quyên góp (campaign) với mục tiêu cụ thể
→ Donor đóng góp vào đợt → Nhóm kiểm tra từng món → Trao tặng cả đợt ✅
```

Điểm khác biệt: **minh bạch hành trình món đồ** — người quyên góp theo dõi được món đồ
của mình từ lúc đóng góp đến lúc thực sự đến tay người nhận.

## 👥 Vai trò trong hệ thống

| Vai trò | Mô tả |
|---|---|
| **Người quyên góp** | Chọn nhóm, đăng ký quyên góp, theo dõi hành trình món đồ. Không cần tham gia nhóm. |
| **Hội nhóm thiện nguyện** | Duyệt thành viên, tạo cuộc quyên góp, tiếp nhận & kiểm tra đồ, trao tặng đợt. |
| **Người cần hỗ trợ** | Tham gia nhóm (được duyệt), xem các đợt quyên góp đang mở, đóng góp, đánh giá. |
| **Quản trị viên** | Duyệt hội nhóm, xử lý báo cáo vi phạm, thống kê toàn hệ thống. |

## ✨ Tính năng chính

- 🔐 Đăng ký / đăng nhập, phân quyền theo vai trò (JWT)
- 👥 Hội nhóm: bài viết, bình luận, thành viên
- 📦 Cuộc quyên góp (campaign): nhóm tạo đợt với mục tiêu cụ thể (vd: 15 áo, 15 bao gạo), donor đóng góp vào đợt
- 📋 Quy trình đóng góp: tạo → duyệt → kiểm tra từng món → hoàn tất
- 🎁 Trao tặng đợt: khi đủ mục tiêu hoặc hết hạn, nhóm xác nhận trao tặng cả đợt
- 🔍 Tiến độ minh bạch: donor theo dõi "5/15 áo, 3/15 bao gạo" real-time
- 💬 Chat realtime giữa user và hội nhóm (shared inbox cho moderator)
- 🔔 Thông báo in-app + push (FCM), nhắc lịch hẹn tự động
- ⭐ Đánh giá & điểm uy tín, báo cáo vi phạm
- 🤖 AI: nhận diện loại đồ từ ảnh, gợi ý nhóm phù hợp, kiểm duyệt nội dung
- 📊 Dashboard thống kê theo nhóm / toàn hệ thống

## 🏗 Kiến trúc

Hệ thống theo mô hình **Microservices** với các service độc lập. Root repo chỉ giữ
các file Docker, README và env; không chứa cấu hình package/build của riêng stack nào.
Các app/service trong `apps/*` có thể dùng Node.js/TypeScript, Next.js, Python hoặc
stack chuyên biệt khác khi cần.

> **Chi tiết mục đích + luồng từng service:** [docs/services/README.md](./services/README.md)

```
Web / Mobile App
       │
   Kong Gateway :8000  (routing, strip /api/<service>)
       │
┌──────┼──────────────────────────────────────────────┐
│ Identity      │ Auth, hồ sơ, điểm uy tín            │
│ Community     │ Nhóm, thành viên, bài viết,          │
│               │ đánh giá, báo cáo                    │
│ Donation      │ Cuộc quyên góp (campaign), đóng góp,│
│               │ kiểm tra, trao tặng đợt              │
│ Communication │ Chat (Socket.IO), FCM, email (Brevo) │
│ Media         │ Upload ảnh lên SeaweedFS (S3)        │
│ AI            │ Tích hợp LLM                         │
└──────────────────────────────────────────────────────┘
       │
PostgreSQL (db-per-service) · Redis · RabbitMQ · SeaweedFS
```

## 🛠 Tech Stack

| Thành phần | Công nghệ |
|---|---|
| Root repo | Docker, README và env |
| App/service hiện tại | Node.js/TypeScript service |
| Mở rộng sau này | Next.js app, Python service hoặc stack khác khi cần |
| Package manager | Theo từng app/service |
| API Gateway | Kong (DB-less, declarative config) |
| Database | PostgreSQL 16 (mỗi service 1 database) |
| Cache / Presence | Redis 7 |
| Message Broker | RabbitMQ |
| Realtime | Socket.IO (python-socketio, communication-service) |
| Lưu trữ file | SeaweedFS (S3-compatible, self-hosted, presigned URL) |
| Email | Brevo transactional API (communication-service) |
| Push notification | Firebase FCM (communication-service) |
| Identity / Media / Communication | Python FastAPI |
| AI | LLM API (vision + text) |
| Triển khai | Docker Compose, GitLab CI/CD |

## 📂 Cấu trúc repo

```
├── apps/                  # các application/service
├── libs/
│   ├── common/            # guards, decorators, DTO, enums dùng chung
│   ├── events/            # tên event + payload contracts (RabbitMQ)
│   └── clients/           # HTTP clients gọi sync giữa các service
├── infra/
│   ├── kong/kong.yml      # cấu hình gateway
│   ├── postgres/init/     # script tạo database
│   └── rabbitmq/
├── docs/                  # kiến trúc, ERD, OpenAPI
├── .env                   # biến môi trường local
├── .env.example           # mẫu biến môi trường
└── docker-compose.yml
```

## 🚀 Chạy dự án

```bash
# 1. Chuẩn bị env
# File .env đã được tạo; chỉnh JWT_SECRET, SEAWEED_*, LLM key... theo môi trường.

# 2. Chạy toàn bộ hệ thống qua Docker
docker compose up -d

# 4. Truy cập
# API:       http://localhost:8000/api
# RabbitMQ:  http://localhost:15672
# Swagger:   http://localhost:300x/docs (từng service)
```

Dev một service riêng lẻ:

```bash
docker compose -f docker-compose.infra.yml up -d   # chỉ infra
npm install --prefix apps/identity-service
npm run start:dev --prefix apps/identity-service
```

## 📖 Tài liệu

- [Kiến trúc & luồng nghiệp vụ](docs/architecture.md)
- [ERD từng service](docs/erd/)
- [OpenAPI spec](docs/api/)
