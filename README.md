# Nền tảng Kết nối Quyên góp Thiện nguyện

Nền tảng kết nối **người quyên góp** với **hội nhóm thiện nguyện** theo mô hình **Gian hàng 0 đồng**.

```text
Người quyên góp → Chọn nhóm → Tiếp nhận & kiểm tra → Nhập kho
→ Gian hàng 0 đồng → Đăng ký nhận → Xét duyệt → Trao tặng
```

| Mục nhanh | Link |
|---|---|
| [Setup trên server (AlmaLinux)](#setup-trên-server-almalinux-810) | Lệnh cài Docker + app |
| [Chạy local](#chạy-local) | Dev máy bạn |
| [CI/CD](#cicd--deploy) | GitHub Actions + Secrets |
| [Tài liệu](#tài-liệu) | architecture, flows, deploy |

---

## Setup trên server (AlmaLinux 8.10)

> SSH vào server với quyền **root** (hoặc user có `sudo`).  
> OS đã xác nhận: `AlmaLinux 8.10` — dùng `dnf`, **không** dùng `apt-get`.

### Bước 1 — Cài Docker + Compose

```bash
dnf -y install dnf-plugins-core git curl ca-certificates yum-utils
dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

docker --version
docker compose version
```

Nếu `dnf config-manager` lỗi:

```bash
yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
```

### Bước 2 — Clone project + tạo `.env`

```bash
mkdir -p /opt
rm -rf /opt/charity-platform
git clone https://github.com/hieusoft/project4.git /opt/charity-platform

cp /opt/charity-platform/.env.example /opt/charity-platform/.env
sed -i 's/^NODE_ENV=.*/NODE_ENV=production/' /opt/charity-platform/.env
chmod +x /opt/charity-platform/scripts/*.sh
```

### Bước 3 — Sửa secret trong `.env`

```bash
# Tạo giá trị ngẫu nhiên
openssl rand -hex 32          # → dán vào JWT_SECRET
openssl rand -base64 18       # → dán vào password DB / RabbitMQ

vi /opt/charity-platform/.env
# hoặc: nano /opt/charity-platform/.env
```

**Bắt buộc đổi** (ví dụ):

```env
NODE_ENV=production
JWT_SECRET=<chuỗi openssl rand -hex 32>
POSTGRES_PASSWORD=<password mạnh>
POSTGRES_HOST=postgres
REDIS_HOST=redis
RABBITMQ_USER=charity
RABBITMQ_PASSWORD=<password mạnh>
RABBITMQ_URL=amqp://charity:<cùng_password>@rabbitmq:5672
```

> `RABBITMQ_URL` phải **khớp** user/password với `RABBITMQ_USER` / `RABBITMQ_PASSWORD`.

### Bước 4 — Firewall

```bash
systemctl enable --now firewalld
firewall-cmd --permanent --add-service=ssh
firewall-cmd --permanent --add-port=8000/tcp
firewall-cmd --reload
firewall-cmd --list-all
```

### Bước 5 — Kiểm tra setup xong

```bash
docker ps
ls /opt/charity-platform
grep -E '^(NODE_ENV|JWT_SECRET|POSTGRES_|RABBITMQ_)' /opt/charity-platform/.env
```

### Bước 6 — GitHub Secrets (để CD tự deploy)

Repo → **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `SSH_HOST` | IP public server |
| `SSH_USER` | `root` |
| `SSH_PRIVATE_KEY` | Toàn bộ private key SSH |
| `DEPLOY_PATH` | `/opt/charity-platform` |
| `GHCR_PULL_TOKEN` | PAT classic, chỉ tick **`read:packages`** |
| `SSH_PORT` | `22` (tuỳ chọn) |

Tạo Environment tên: **`production`**.

### Bước 7 — Deploy

- Push/merge `main`, hoặc **Actions → CD → Run workflow**
- Kiểm tra:

```bash
curl http://IP_SERVER:8000/api/identity/health
cd /opt/charity-platform
docker compose -f docker-compose.prod.yml ps
```

### Deploy tay (khi image đã có trên GHCR)

```bash
cd /opt/charity-platform
git pull origin main
export IMAGE_REGISTRY=ghcr.io/hieusoft/project4
export IMAGE_TAG=latest
echo YOUR_PAT | docker login ghcr.io -u hieusoft --password-stdin
./scripts/deploy.sh
```

### Script tự động (tuỳ chọn)

```bash
git clone https://github.com/hieusoft/project4.git /tmp/project4-bootstrap
bash /tmp/project4-bootstrap/scripts/server-setup.sh
```

> Script hỗ trợ `apt` (Ubuntu) và `dnf`/`yum` (Alma/RHEL). Cần đã push bản script mới lên `main`.

Chi tiết đầy đủ: [docs/server-setup-step-by-step.md](docs/server-setup-step-by-step.md)

---

## Kiến trúc

```text
Web / Mobile
     │
Kong Gateway :8000
     │
 Identity · Community · Donation · Marketplace · Communication · Media · AI
     │
PostgreSQL · Redis · RabbitMQ
```

| Thành phần | Công nghệ |
|---|---|
| Gateway | Kong |
| Identity, Media, Communication, Community | Python / FastAPI |
| AI | Node.js / NestJS (scaffold) |
| DB / Cache / MQ | PostgreSQL 16, Redis 7, RabbitMQ |
| Storage | SeaweedFS (S3 self-hosted) |
| CI/CD | GitHub Actions → GHCR → SSH + Compose |

### Cấu trúc repo

```text
apps/          identity, media, community, communication, ai
libs/          common, events, clients (TypeScript)
infra/         kong, docs-portal, postgres init, rabbitmq
scripts/       server-setup.sh, deploy.sh
docs/
docker-compose.yml
docker-compose.infra.yml
docker-compose.prod.yml
.github/workflows/
```

### Trạng thái service

| Service | Port | Stack | Code |
|---|---|---|---|
| identity-service | 3001 | FastAPI | Có nghiệp vụ |
| media-service | 3006 | FastAPI | Có nghiệp vụ |
| community-service | 3002 | FastAPI | Groups, members, posts, comments |
| communication-service | 3005 | FastAPI (Python) | Brevo email, FCM, Socket.IO chat, notifications |
| ai-service | 3007 | NestJS | Scaffold |
| docs-portal | 8080 (internal) | nginx + Swagger UI | Hub multi-spec tại `/docs` |
| donation / marketplace | 3003 / 3004 | — | Chưa có code |

---

## Chạy local

```bash
cp .env.example .env

# Chỉ infra
docker compose -f docker-compose.infra.yml up -d

# Full stack
docker compose up -d --build
curl http://localhost:8000/api/identity/health
```

| URL | Mô tả |
|---|---|
| http://localhost:8000/api | Kong |
| http://localhost:8000/docs | **Swagger hub** (tất cả service) |
| http://localhost:8000/api/identity/openapi.json | OpenAPI Identity |
| http://localhost:8000/api/media/openapi.json | OpenAPI Media |
| http://localhost:15672 | RabbitMQ UI |
| http://localhost:3001/docs | Swagger identity (direct) |
| http://localhost:3005/docs | Swagger communication (direct) |
| http://localhost:3006/docs | Swagger media (direct) |

Identity (Python) riêng:

```bash
cd apps/identity-service
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 3001
```

---

## CI/CD & deploy

```text
Push main
  → Build 6 image (5 apps + docs-portal)
  → Push ghcr.io/hieusoft/project4/<service>:<sha>
  → SSH server → compose pull && up -d
```

- Workflow: `.github/workflows/ci.yml`, `.github/workflows/cd.yml`
- Production compose: `docker-compose.prod.yml`
- Hướng dẫn: [docs/deploy.md](docs/deploy.md)

---

## Tài liệu

| File | Nội dung |
|---|---|
| **[docs/services/README.md](docs/services/README.md)** | **Mục đích + luồng chi tiết từng service** |
| [docs/README.md](docs/README.md) | Mục lục toàn bộ docs |
| [docs/server-setup-step-by-step.md](docs/server-setup-step-by-step.md) | Checklist setup server từng bước |
| [docs/deploy.md](docs/deploy.md) | CI/CD, GHCR, secrets |
| [docs/architecture.md](docs/architecture.md) | Bài toán, vai trò |
| [docs/flows.md](docs/flows.md) | Sequence diagram cross-service |
| [docs/database.md](docs/database.md) | Schema DB |
| [docs/structure.md](docs/structure.md) | Cấu trúc thư mục |

---

## Lưu ý

- Không commit file `.env`
- Đổi hết password mặc định trên production
- Image: `ghcr.io/hieusoft/project4/<service>`
- `donation-service` / `marketplace-service` chưa có code — route Kong có thể 502
