# Tài liệu Charity Platform

## Bắt đầu từ đây

| Tài liệu | Nội dung |
|---|---|
| **[services/README.md](./services/README.md)** | **Mục đích + luồng chi tiết từng service** |
| [architecture.md](./architecture.md) | Bài toán, vai trò user, kiến trúc tổng |
| [flows.md](./flows.md) | Sequence diagram cross-service (mermaid) |
| [database.md](./database.md) | Schema SQL từng DB |
| [communication.md](./communication.md) | Ghi chú Communication (chi tiết xem [services/communication.md](./services/communication.md)) |
| [structure.md](./structure.md) | Cấu trúc thư mục repo |
| [deploy.md](./deploy.md) | CI/CD, GHCR, production |
| [server-setup-step-by-step.md](./server-setup-step-by-step.md) | Checklist cài server |

## Service docs (chi tiết)

| File | Service |
|---|---|
| [services/identity.md](./services/identity.md) | Auth, JWT, profile, OTP |
| [services/community.md](./services/community.md) | Nhóm, member, post |
| [services/media.md](./services/media.md) | Presign R2, link media |
| [services/communication.md](./services/communication.md) | Email, FCM, chat, notify |
| [services/donation.md](./services/donation.md) | Quyên góp (thiết kế) |
| [services/marketplace.md](./services/marketplace.md) | Gian hàng 0 đồng (thiết kế) |
| [services/ai.md](./services/ai.md) | LLM hỗ trợ (scaffold) |
| [services/gateway-infra.md](./services/gateway-infra.md) | Kong, Postgres, Redis, RabbitMQ |
