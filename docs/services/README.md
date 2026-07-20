# Tài liệu theo service

Tài liệu này mô tả **mục đích**, **trách nhiệm**, **API**, **sự kiện** và **luồng nghiệp vụ** của từng service trong nền tảng quyên góp thiện nguyện.

## Bản đồ hệ thống

```text
Client (Web / Mobile)
        │
        ▼
 Kong Gateway :8000
   /api/identity      → identity-service      :3001
   /api/community     → community-service     :3002
    /api/donation      → donation-service      :3003
   /api/marketplace   → marketplace-service   :3004
   /api/communication → communication-service :3005
   /api/media         → media-service         :3006
   /api/ai            → ai-service            :3007  (scaffold)
   /docs              → docs-portal
        │
        ├── PostgreSQL (1 database / service)
        ├── Redis
        └── RabbitMQ  (exchange: charity.events)
```

## Mục đích từng service (tóm tắt)

| Service | Port | Mục đích chính | Trạng thái code |
|---|---|---|---|
| [Identity](./identity.md) | 3001 | Định danh: đăng ký, đăng nhập, JWT, hồ sơ, 2FA | ✅ Đã có |
| [Community](./community.md) | 3002 | Hội nhóm, thành viên, bài viết, tương tác | ✅ Đã có |
| [Donation](./donation.md) | 3003 | Quyên góp, kiểm tra đồ, kho, hành trình món đồ | ✅ Đã có |
| [Marketplace](./marketplace.md) | 3004 | Gian hàng 0 đồng, yêu cầu nhận, trao tặng | ✅ Đã có |
| [Communication](./communication.md) | 3005 | Email, push, chat realtime, thông báo in-app | ✅ Đã có |
| [Media](./media.md) | 3006 | Upload ảnh (presigned SeaweedFS), lifecycle media | ✅ Đã có |
| [AI](./ai.md) | 3007 | LLM: nhận diện đồ, gợi ý nhóm, kiểm duyệt | 🔶 Scaffold |
| [Gateway & Infra](./gateway-infra.md) | 8000… | Kong, Postgres, Redis, RabbitMQ, Docs | ✅ |

## Nguyên tắc chung

1. **API Gateway (Kong)** là cổng duy nhất từ client; strip prefix `/api/<service>`.
2. **JWT** do Identity ký (`iss=charity-auth`); service khác **verify** cùng `JWT_SECRET`.
3. **DB-per-service**: mỗi service một database Postgres, không join chéo DB.
4. **Đồng bộ**: HTTP nội bộ khi cần dữ liệu ngay (ví dụ Donation gọi Community kiểm tra group).
5. **Bất đồng bộ**: RabbitMQ topic `charity.events` cho thông báo, email, side-effect.
6. **Response envelope**: thành công `{ "data": ... }`; lỗi `{ statusCode, path, error, timestamp }`.

## Luồng end-to-end (toàn nền tảng)

```text
Đăng ký/Login (Identity)
    → Upload ảnh (Media + SeaweedFS)
    → Tạo / tham gia nhóm (Community)
    → Quyên góp đồ (Donation) ← chưa code
    → Nhập kho → đăng gian hàng (Marketplace)
    → Người cần đăng ký nhận → duyệt → trao tặng
    → Chat / email / push (Communication)
    → AI hỗ trợ gợi ý / kiểm duyệt (AI)
```

Chi tiết cross-service sequence: xem thêm [flows.md](../flows.md).

## Swagger

- Hub: `http://<host>:8000/docs`
- Từng service: `http://<host>:8000/api/<service>/openapi.json`
