# Hướng dẫn setup server & CI/CD (từng bước)

Nền tảng: **GitHub Actions → GHCR → SSH Ubuntu → Docker Compose**.

---

## Tổng quan checklist

| # | Việc | Ở đâu |
|---|---|---|
| 1 | GitHub Secrets + Environment `production` | GitHub |
| 2 | Bootstrap server + sửa `.env` | Server Ubuntu |
| 3 | Push code CI/CD lên `main` | Máy dev |
| 4 | Chạy workflow **CD** | GitHub Actions |
| 5 | Kiểm tra health | Máy dev / server |

---

## Bước 1 — GitHub Secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**

| Name | Value |
|---|---|
| `SSH_HOST` | IP hoặc domain server |
| `SSH_USER` | User SSH (`ubuntu`, `root`, …) |
| `SSH_PRIVATE_KEY` | Toàn bộ private key (`BEGIN` … `END`) |
| `DEPLOY_PATH` | `/opt/charity-platform` |
| `GHCR_PULL_TOKEN` | PAT classic, scope **`read:packages`** |
| `SSH_PORT` | `22` (chỉ cần nếu khác 22) |

**Environment:** Settings → Environments → New → tên đúng: **`production`**.

### PAT classic — tick gì?

Chỉ cần:

- [x] **`read:packages`**

Không tick `write:packages`, `repo`, `workflow`, admin, … trừ khi `docker pull` bị denied với repo private (khi đó có thể thêm `repo`).

---

## Bước 2 — Setup trên server (chi tiết)

SSH vào server trước. Thấy prompt kiểu `ubuntu@xxx:~$` là đúng.

### 2.1. Cập nhật máy (nên làm)

```bash
sudo apt-get update -y
sudo apt-get install -y git curl
```

### 2.2. Chạy script bootstrap

Script hỗ trợ **Ubuntu/Debian (`apt`)** và **RHEL/CentOS/Rocky/Alma/Amazon (`dnf`/`yum`)**.

Sẽ: cài Docker, clone repo vào `/opt/charity-platform`, tạo `.env`, mở firewall port 22 + 8000.

```bash
# Xem OS đang dùng (nếu lỗi apt-get)
cat /etc/os-release

git clone https://github.com/hieusoft/project4.git /tmp/project4-bootstrap
bash /tmp/project4-bootstrap/scripts/server-setup.sh
```

#### Lỗi `apt-get: command not found`

Server **không phải Ubuntu** (thường là CentOS/RHEL/Rocky).  
Cần **script mới** (đã hỗ trợ dnf/yum). Lấy lại script rồi chạy:

```bash
rm -rf /tmp/project4-bootstrap
git clone https://github.com/hieusoft/project4.git /tmp/project4-bootstrap
# Nếu chưa merge script mới lên main, pull nhánh có fix hoặc copy script thủ công
bash /tmp/project4-bootstrap/scripts/server-setup.sh
```

Hoặc cài Docker tay trên RHEL-family:

```bash
# Rocky/Alma/CentOS/RHEL
dnf -y install dnf-plugins-core git curl
dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker --version && docker compose version
```

#### Nếu báo Permission denied / cần sudo

```bash
sudo bash /tmp/project4-bootstrap/scripts/server-setup.sh
```

(Bạn đang `root` thì không cần `sudo`.)

#### Nếu repo private (clone HTTPS fail)

```bash
git clone https://hieusoft:GH_TOKEN_CUA_BAN@github.com/hieusoft/project4.git /tmp/project4-bootstrap
bash /tmp/project4-bootstrap/scripts/server-setup.sh
```

Khi chạy xong, terminal in:

- App dir: `/opt/charity-platform`
- Nhắc sửa `.env`
- Nhắc thêm GitHub Secrets

### 2.3. Kiểm tra thư mục app

```bash
ls -la /opt/charity-platform
```

Phải thấy các file kiểu:

```text
docker-compose.prod.yml
scripts/
apps/
.env
.env.example
docs/
...
```

#### Nếu không có `/opt/charity-platform`

```bash
sudo mkdir -p /opt
sudo git clone https://github.com/hieusoft/project4.git /opt/charity-platform
sudo chown -R $USER:$USER /opt/charity-platform
cp /opt/charity-platform/.env.example /opt/charity-platform/.env
```

### 2.4. Sửa file `.env`

```bash
nano /opt/charity-platform/.env
```

#### Phím nano

| Phím | Việc |
|---|---|
| Mũi tên | Di chuyển |
| Gõ | Sửa text |
| `Ctrl + O` rồi `Enter` | Lưu |
| `Ctrl + X` | Thoát |

#### Các dòng bắt buộc đổi

```env
NODE_ENV=production

# Auth — chuỗi dài, ngẫu nhiên (đừng để change-me)
JWT_SECRET=vi_du_chuoi_rat_dai_va_ngau_nhien_abc123XYZ

# PostgreSQL
POSTGRES_USER=charity
POSTGRES_PASSWORD=MatKhauPostgresCuaBan_123
POSTGRES_DB=charity_root
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# RabbitMQ — PASSWORD phải giống nhau ở 2 chỗ
RABBITMQ_USER=charity
RABBITMQ_PASSWORD=MatKhauRabbitCuaBan_123
RABBITMQ_URL=amqp://charity:MatKhauRabbitCuaBan_123@rabbitmq:5672
```

**Lưu ý:**

1. `RABBITMQ_URL` phải **khớp** user/password với `RABBITMQ_USER` / `RABBITMQ_PASSWORD`.
2. Trong Docker, host DB/Redis/MQ ghi **tên service**, không ghi IP server:
   - `POSTGRES_HOST=postgres`
   - `REDIS_HOST=redis`
   - trong URL: `@rabbitmq:5672`
3. SEAWEED_* dùng default trong `.env.example` (compose tự chạy SeaweedFS). FCM / LLM để trống được nếu chưa dùng.

#### Tạo secret / password nhanh trên server

```bash
# JWT_SECRET
openssl rand -hex 32

# Password DB / RabbitMQ
openssl rand -base64 18
```

#### Ví dụ `.env` tối thiểu (cấu trúc)

```env
NODE_ENV=production

KONG_PROXY_PORT=8000
KONG_ADMIN_PORT=8001

IDENTITY_SERVICE_PORT=3001
COMMUNITY_SERVICE_PORT=3002
DONATION_SERVICE_PORT=3003
MARKETPLACE_SERVICE_PORT=3004
COMMUNICATION_SERVICE_PORT=3005
MEDIA_SERVICE_PORT=3006
AI_SERVICE_PORT=3007

JWT_SECRET=THAY_BANG_OPENSSL_RAND
JWT_ISSUER=charity-auth
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d
TWO_FACTOR_CHALLENGE_TTL=5m
TOTP_ISSUER=charity-auth
EMAIL_VERIFICATION_EXPIRY_HOURS=24
PASSWORD_RESET_EXPIRY_HOURS=1

POSTGRES_USER=charity
POSTGRES_PASSWORD=THAY_PASSWORD_DB
POSTGRES_DB=charity_root
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
IDENTITY_DB_NAME=identity_db
COMMUNITY_DB_NAME=community_db
DONATION_DB_NAME=donation_db
MARKETPLACE_DB_NAME=marketplace_db
COMMUNICATION_DB_NAME=communication_db
MEDIA_DB_NAME=media_db
AI_DB_NAME=ai_db

REDIS_HOST=redis
REDIS_PORT=6379

RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_MANAGEMENT_PORT=15672
RABBITMQ_USER=charity
RABBITMQ_PASSWORD=THAY_PASSWORD_MQ
RABBITMQ_URL=amqp://charity:THAY_PASSWORD_MQ@rabbitmq:5672
RABBITMQ_EXCHANGE=charity.events
COMMUNICATION_EVENTS_QUEUE=communication.events
FRONTEND_BASE_URL=http://localhost:3000

SEAWEED_S3_ENDPOINT=http://seaweedfs:8333
SEAWEED_S3_PUBLIC_ENDPOINT=http://YOUR_SERVER_IP:8333
SEAWEED_ACCESS_KEY_ID=seaweed
SEAWEED_SECRET_ACCESS_KEY=seaweed
SEAWEED_BUCKET=media
SEAWEED_PUBLIC_BASE_URL=http://YOUR_SERVER_IP:8333/media

FCM_PROJECT_ID=
FCM_CLIENT_EMAIL=
FCM_PRIVATE_KEY=

LLM_PROVIDER=
LLM_API_KEY=
LLM_MODEL=
```

Lưu: `Ctrl+O` → `Enter` → `Ctrl+X`.

### 2.5. Quyền Docker cho user hiện tại

```bash
whoami
sudo usermod -aG docker $(whoami)
newgrp docker
docker ps
docker compose version
```

Nếu `docker ps` báo *permission denied*: logout SSH rồi login lại, hoặc `sudo reboot` rồi SSH lại.

### 2.6. Kiểm tra Docker + path deploy

```bash
cd /opt/charity-platform
ls docker-compose.prod.yml scripts/deploy.sh
head -n 5 .env
```

Chưa cần `docker compose up` tay — workflow **CD** sẽ pull image và start.

### 2.7. Firewall (nếu script chưa bật)

```bash
sudo ufw status
sudo ufw allow OpenSSH
sudo ufw allow 8000/tcp
sudo ufw enable
```

- Port **8000** = Kong API  
- Port **22** = SSH (đừng quên)

### 2.8. Checklist Bước 2 xong

| Kiểm tra | Lệnh / việc |
|---|---|
| Có thư mục app | `ls /opt/charity-platform` |
| Có `.env` đã sửa secret | Không còn `change-me` / password mặc định yếu |
| Docker OK | `docker ps` |
| Compose OK | `docker compose version` |
| User đọc được app dir | `ls /opt/charity-platform` không permission denied |

### Lỗi hay gặp (Bước 2)

| Lỗi | Cách xử lý |
|---|---|
| `git: command not found` | `sudo apt-get install -y git` |
| `Could not resolve host` | Server không ra internet / DNS |
| `Repository not found` | Repo private → dùng PAT khi clone |
| `Permission denied` khi ghi `/opt` | Dùng `sudo` + `chown` như trên |
| `docker: command not found` | Chạy lại `server-setup.sh`, xem log `apt` |
| Sai `RABBITMQ_URL` | User/pass trong URL phải khớp biến password |

---

## Bước 3 — Push code CI/CD (máy dev)

```powershell
cd D:\project4
git status
git add .
git commit -m "ci: add GitHub Actions CD to GHCR and Ubuntu VPS"
git push origin main
```

Nếu đã push rồi → bỏ qua.

---

## Bước 4 — Chạy deploy

**Cách A:** GitHub → **Actions** → workflow **CD** → **Run workflow**

**Cách B:**

```powershell
git commit --allow-empty -m "chore: trigger CD"
git push origin main
```

Xem job **Build & push** và **Deploy to server** có xanh không.

### Deploy tay trên server (khẩn cấp, sau khi image đã có trên GHCR)

```bash
cd /opt/charity-platform
git pull
export IMAGE_REGISTRY=ghcr.io/hieusoft/project4
export IMAGE_TAG=latest
echo YOUR_PAT | docker login ghcr.io -u hieusoft --password-stdin
./scripts/deploy.sh
```

---

## Bước 5 — Kiểm tra

```bash
curl http://IP_SERVER:8000/api/identity/health
curl http://IP_SERVER:8000/api/media/health
```

Trên server:

```bash
cd /opt/charity-platform
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f --tail=100 identity-service
```

---

## Tạo / dùng SSH private key (tham khảo)

### Tạo key mới (nếu chưa có)

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/ga_deploy -N ""
cat ~/.ssh/ga_deploy.pub >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys ~/.ssh/ga_deploy
cat ~/.ssh/ga_deploy   # copy vào secret SSH_PRIVATE_KEY
```

### SSH từ máy Windows

```powershell
ssh -i "C:\path\to\private.pem" USER@IP_SERVER
```

---

## File liên quan trong repo

| File | Vai trò |
|---|---|
| `docs/deploy.md` | Tài liệu CI/CD tổng quan |
| `docs/server-setup-step-by-step.md` | Checklist từng bước (file này) |
| `scripts/server-setup.sh` | Bootstrap Ubuntu |
| `scripts/deploy.sh` | Pull image + `compose up` |
| `docker-compose.prod.yml` | Stack production |
| `.github/workflows/ci.yml` | Build trên PR/main |
| `.github/workflows/cd.yml` | Build + push GHCR + SSH deploy |

---

## Bảo mật

- Không commit file `.env`
- Không gửi private key / PAT vào chat hay commit
- Đổi hết password mặc định (`charity`, `guest`, `change-me`)
- Production thật: hạn chế expose Postgres/Redis/RabbitMQ ra internet; nên thêm HTTPS (Caddy/Nginx)
