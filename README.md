# 🎁 Nền tảng Kết nối Quyên góp Thiện nguyện

Nền tảng kết nối người quyên góp với hội nhóm thiện nguyện theo mô hình **Gian hàng 0 đồng**.

## Kiến trúc

- Root repo chỉ giữ file Docker, README và env.
- Các app/service nằm trong `apps/*`; có thể có Node.js/TypeScript, Next.js, Python hoặc stack khác khi cần.
- Shared libraries hiện tại nằm trong `libs/*`.
- Kong Gateway, PostgreSQL, Redis, RabbitMQ trong `infra/*`.
- Biến môi trường lưu trong `.env` và mẫu tham chiếu ở `.env.example`.

## Chạy local một service

```bash
npm install --prefix apps/identity-service
npm run build --prefix apps/identity-service
npm run start:dev --prefix apps/identity-service
curl http://localhost:3001/health
```

Chạy infra:

```bash
docker compose -f docker-compose.infra.yml up -d
```

Chạy full stack qua Docker:

```bash
docker compose up -d --build
curl http://localhost:8000/api/identity/health
```

## Tài liệu

- `docs/architecture.md`
- `docs/flows.md`
- `docs/database.md`
- `docs/structure.md`
- `docs/deploy.md` — CI/CD & deploy production
