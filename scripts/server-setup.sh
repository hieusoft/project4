#!/usr/bin/env bash
# Bootstrap an Ubuntu server for charity-platform CI/CD deploys.
# Run once as a user with sudo (or root):
#   curl -fsSL ... | bash
#   — or —
#   bash scripts/server-setup.sh
#
# After this script:
#   1. Put your deploy SSH public key in ~/.ssh/authorized_keys (if needed)
#   2. Create /opt/charity-platform/.env from .env.example
#   3. Add GitHub Actions secrets (see docs/deploy.md)

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/charity-platform}"
REPO_URL="${REPO_URL:-https://github.com/hieusoft/project4.git}"
DEPLOY_USER="${DEPLOY_USER:-$USER}"

echo "==> [1/5] Install Docker Engine + Compose plugin"
if ! command -v docker >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y ca-certificates curl gnupg git ufw
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
  echo "    Docker already installed: $(docker --version)"
fi

echo "==> [2/5] Allow deploy user to run Docker"
sudo usermod -aG docker "$DEPLOY_USER" || true

echo "==> [3/5] Clone (or update) app directory → $APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  sudo git -C "$APP_DIR" fetch origin
  sudo git -C "$APP_DIR" checkout main
  sudo git -C "$APP_DIR" pull --ff-only origin main
else
  sudo mkdir -p "$(dirname "$APP_DIR")"
  sudo git clone "$REPO_URL" "$APP_DIR"
fi
sudo chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"

echo "==> [4/5] Prepare .env if missing"
if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  # Safer defaults for a public VPS — change passwords immediately
  sed -i 's/^NODE_ENV=.*/NODE_ENV=production/' "$APP_DIR/.env" || true
  echo "    Created $APP_DIR/.env — EDIT THIS FILE before first deploy:"
  echo "      - JWT_SECRET, POSTGRES_PASSWORD, RABBITMQ_PASSWORD"
  echo "      - R2_*, LLM_*, FCM_* if used"
else
  echo "    .env already exists, left unchanged"
fi

echo "==> [5/5] Firewall (UFW): SSH + Kong proxy"
if command -v ufw >/dev/null 2>&1; then
  sudo ufw allow OpenSSH
  sudo ufw allow 8000/tcp comment 'Kong proxy'
  # Uncomment if you terminate TLS on this host:
  # sudo ufw allow 80/tcp
  # sudo ufw allow 443/tcp
  sudo ufw --force enable || true
  sudo ufw status || true
fi

chmod +x "$APP_DIR/scripts/"*.sh 2>/dev/null || true

cat <<EOF

========================================
 Server bootstrap complete
========================================
App dir:     $APP_DIR
Deploy user: $DEPLOY_USER

Next steps:
  1) Edit secrets:
       nano $APP_DIR/.env

  2) Create a GitHub PAT (read:packages) for pulling images, then on this server:
       echo YOUR_PAT | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin

  3) In GitHub → Settings → Secrets and variables → Actions, add:
       SSH_HOST          = public IP or domain of this server
       SSH_USER          = $DEPLOY_USER
       SSH_PRIVATE_KEY   = private key that can SSH as SSH_USER
       SSH_PORT          = 22   (optional)
       DEPLOY_PATH       = $APP_DIR
       GHCR_PULL_TOKEN   = same PAT with read:packages

  4) Create environment "production" (Settings → Environments) if you want
     protection rules / required reviewers.

  5) Push to main (or run workflow_dispatch) to trigger first deploy.

  6) Health check:
       curl http://SERVER_IP:8000/api/identity/health
========================================
EOF
