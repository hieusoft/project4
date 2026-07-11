# CI/CD & Deploy (GitHub Actions → VPS Linux)

> Checklist từng bước (Bước 2 chi tiết): **[server-setup-step-by-step.md](./server-setup-step-by-step.md)**  
> Server hỗ trợ: **Ubuntu/Debian** và **AlmaLinux/Rocky/CentOS/RHEL** (script `server-setup.sh`).

## Luồng

```text
Push / merge → main
       │
       ▼
GitHub Actions (CD)
  1. Build 5 service images
  2. Push → ghcr.io/<owner>/project4/<service>:<sha> + :latest
  3. SSH vào VPS
  4. git pull + docker compose -f docker-compose.prod.yml pull && up -d
```

PR / push cũng chạy workflow **CI** (build image, không push, không deploy).

## Service được build

| Image | Dockerfile |
|---|---|
| `identity-service` | `apps/identity-service/Dockerfile` |
| `media-service` | `apps/media-service/Dockerfile` |
| `community-service` | root `Dockerfile` + `SERVICE_PATH` |
| `communication-service` | root `Dockerfile` + `SERVICE_PATH` |
| `ai-service` | root `Dockerfile` + `SERVICE_PATH` |

> `donation-service` và `marketplace-service` chưa có code — chưa build/deploy. Route Kong vẫn khai báo sẵn (sẽ 502 cho đến khi service có).

---

## 1. Chuẩn bị server (một lần)

SSH vào Ubuntu:

```bash
# Clone tạm để lấy script (hoặc scp scripts/server-setup.sh lên)
git clone https://github.com/hieusoft/project4.git /tmp/project4-bootstrap
bash /tmp/project4-bootstrap/scripts/server-setup.sh
```

Script sẽ:

- Cài Docker Engine + Compose plugin
- Clone repo vào `/opt/charity-platform`
- Tạo `.env` từ `.env.example` (nếu chưa có)
- Mở UFW: SSH + port `8000` (Kong)

Sau đó **bắt buộc** chỉnh secrets:

```bash
nano /opt/charity-platform/.env
```

Tối thiểu nên đổi:

- `JWT_SECRET`
- `POSTGRES_PASSWORD`
- `RABBITMQ_PASSWORD` / `RABBITMQ_URL` (khớp nhau)
- các key SEAWEED_* / LLM / FCM nếu dùng

### SSH key cho GitHub Actions

Trên máy local (hoặc server):

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ./ga_deploy -N ""
```

- **Public key** (`ga_deploy.pub`) → thêm vào `~/.ssh/authorized_keys` của user deploy trên server
- **Private key** (`ga_deploy`) → GitHub Secret `SSH_PRIVATE_KEY`

Thử:

```bash
ssh -i ga_deploy deploy@YOUR_SERVER_IP
```

### PAT kéo image từ GHCR

1. GitHub → Settings → Developer settings → Personal access tokens  
   - Classic: scope `read:packages`  
   - hoặc Fine-grained: permission **Packages: Read**
2. Trên server (tuỳ chọn, để test tay):

```bash
echo YOUR_PAT | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

3. Cùng PAT → GitHub Actions secret `GHCR_PULL_TOKEN`

Nếu package private, server **phải** login mới `docker pull` được.

---

## 2. GitHub Secrets

Repo → **Settings → Secrets and variables → Actions**:

| Secret | Ví dụ | Bắt buộc |
|---|---|---|
| `SSH_HOST` | `203.0.113.10` hoặc domain | Có |
| `SSH_USER` | `ubuntu` / `deploy` | Có |
| `SSH_PRIVATE_KEY` | Nội dung file private key (PEM) | Có |
| `SSH_PORT` | `22` | Không (mặc định 22) |
| `DEPLOY_PATH` | `/opt/charity-platform` | Không (mặc định path đó) |
| `GHCR_PULL_TOKEN` | PAT `read:packages` | Có |

Tạo **Environment** tên `production` (Settings → Environments) để khớp job deploy trong `cd.yml`. Có thể bật required reviewers nếu muốn duyệt trước khi deploy.

`GITHUB_TOKEN` dùng push image lên GHCR — **không** cần tạo tay (workflow đã có `packages: write`).

---

## 3. Quyền package GHCR

Sau lần push image đầu tiên:

1. GitHub → profile/org → **Packages**
2. Mở từng package (`identity-service`, …)
3. Package settings → nếu repo private, giữ private; đảm bảo PAT có quyền đọc
4. Nên link package với repo (label `org.opencontainers.image.source` đã set trong workflow)

Image name:

```text
ghcr.io/hieusoft/project4/identity-service:<git-sha>
ghcr.io/hieusoft/project4/identity-service:latest
```

---

## 4. Chạy deploy

### Tự động

Merge / push lên `main` → workflow **CD** chạy.

### Thủ công

Actions → **CD** → **Run workflow** (có thể truyền `image_tag`).

### Trên server (khẩn cấp)

```bash
cd /opt/charity-platform
git pull
export IMAGE_REGISTRY=ghcr.io/hieusoft/project4
export IMAGE_TAG=latest   # hoặc full commit SHA
./scripts/deploy.sh
```

---

## 5. Kiểm tra

```bash
# Trên server
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f --tail=100 identity-service

# Từ máy bạn
curl http://SERVER_IP:8000/api/identity/health
curl http://SERVER_IP:8000/api/media/health
```

Kong proxy mặc định: **port 8000**.

---

## 6. Cấu trúc file liên quan

```text
.github/workflows/ci.yml      # PR/main: build only
.github/workflows/cd.yml      # main: build + push + SSH deploy
docker-compose.prod.yml       # stack production (image GHCR)
scripts/server-setup.sh       # bootstrap Ubuntu
scripts/deploy.sh             # pull + up
docs/deploy.md                # tài liệu này
```

---

## 7. Lưu ý bảo mật

- **Không** commit file `.env`
- Không expose Postgres / Redis / RabbitMQ ra internet nếu không cần (prod compose đang map port cho dễ debug; production thật nên bỏ `ports` public hoặc bind `127.0.0.1`)
- Đổi toàn bộ password mặc định (`charity` / `guest`)
- Nên thêm reverse proxy (Caddy/Nginx) + HTTPS trước domain thật
- Hạn chế `SSH_PRIVATE_KEY` chỉ dùng cho user deploy, không dùng root nếu tránh được

---

## 8. Troubleshooting

| Triệu chứng | Cách xử lý |
|---|---|
| CD fail ở SSH | Kiểm tra `SSH_HOST`, key, firewall port 22, user trong group `docker` (logout/login lại sau `usermod`) |
| `docker pull` denied | PAT thiếu `read:packages`, hoặc package visibility; chạy `docker login ghcr.io` trên server |
| `.env is missing` | Tạo `.env` trên server trước lần deploy đầu |
| Container restart loop | `docker compose -f docker-compose.prod.yml logs <service>` — thường sai `POSTGRES_*` / RabbitMQ URL |
| Kong 502 | Service downstream chưa healthy; xem `depends_on` + logs service |
| Build NestJS fail | Xem log job matrix tương ứng; thường thiếu deps trong `libs/*` |

---

## 9. Khi thêm donation / marketplace

1. Tạo code + Dockerfile (hoặc dùng root `Dockerfile`)
2. Thêm entry vào matrix trong `ci.yml` / `cd.yml`
3. Thêm service vào `docker-compose.prod.yml` và `docker-compose.yml`
4. Bổ sung `depends_on` cho Kong nếu cần
