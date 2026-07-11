#!/usr/bin/env bash
# Bootstrap a Linux server for charity-platform CI/CD deploys.
# Supports: Ubuntu/Debian (apt) and RHEL/CentOS/Rocky/Alma/Fedora/Amazon (dnf|yum).
#
# Run once as root or a user with sudo:
#   bash scripts/server-setup.sh
#
# After this script:
#   1. Edit /opt/charity-platform/.env
#   2. Add GitHub Actions secrets (see docs/deploy.md)

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/charity-platform}"
REPO_URL="${REPO_URL:-https://github.com/hieusoft/project4.git}"
DEPLOY_USER="${DEPLOY_USER:-${SUDO_USER:-$USER}}"

# --- privilege helper (works as root without sudo) ---
run() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

detect_family() {
  if [ -f /etc/os-release ]; then
    # shellcheck source=/dev/null
    . /etc/os-release
    echo "    OS: ${PRETTY_NAME:-$ID}"
    case "${ID_LIKE:-} ${ID:-}" in
      *debian*|*ubuntu*) echo "debian" ;;
      *rhel*|*fedora*|*centos*|*rocky*|*alma*|*amzn*|*ol*) echo "rhel" ;;
      *)
        if command -v apt-get >/dev/null 2>&1; then echo "debian"
        elif command -v dnf >/dev/null 2>&1 || command -v yum >/dev/null 2>&1; then echo "rhel"
        else echo "unknown"
        fi
        ;;
    esac
  elif command -v apt-get >/dev/null 2>&1; then
    echo "debian"
  elif command -v dnf >/dev/null 2>&1 || command -v yum >/dev/null 2>&1; then
    echo "rhel"
  else
    echo "unknown"
  fi
}

pkg_install() {
  if command -v dnf >/dev/null 2>&1; then
    run dnf install -y "$@"
  elif command -v yum >/dev/null 2>&1; then
    run yum install -y "$@"
  elif command -v apt-get >/dev/null 2>&1; then
    run apt-get install -y "$@"
  else
    echo "ERROR: no apt-get/dnf/yum found"
    exit 1
  fi
}

install_docker_debian() {
  run apt-get update -y
  run apt-get install -y ca-certificates curl gnupg git
  # ufw optional
  run apt-get install -y ufw 2>/dev/null || true

  run install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | run gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  run chmod a+r /etc/apt/keyrings/docker.gpg

  # Prefer ubuntu repo; on pure debian use debian repo
  # shellcheck source=/dev/null
  . /etc/os-release
  local docker_os="ubuntu"
  local codename="${VERSION_CODENAME:-jammy}"
  if [ "${ID:-}" = "debian" ]; then
    docker_os="debian"
  fi

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${docker_os} \
    ${codename} stable" | run tee /etc/apt/sources.list.d/docker.list > /dev/null

  run apt-get update -y
  run apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  run systemctl enable --now docker
}

install_docker_rhel() {
  # Base tools
  pkg_install curl git ca-certificates || true

  # shellcheck source=/dev/null
  . /etc/os-release

  # Amazon Linux: package name is often just "docker"
  if [ "${ID:-}" = "amzn" ]; then
    pkg_install docker || true
    # Compose plugin may come from amazon-linux-extras / dnf
    if ! docker compose version >/dev/null 2>&1; then
      pkg_install docker-compose-plugin 2>/dev/null || \
        pkg_install docker-compose 2>/dev/null || true
    fi
  else
    # RHEL / CentOS / Rocky / Alma / Fedora — official Docker CE repo
    if command -v dnf >/dev/null 2>&1; then
      run dnf -y install dnf-plugins-core
      run dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo 2>/dev/null || \
        run dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo 2>/dev/null || true
      # Fedora uses its own path
      if [ "${ID:-}" = "fedora" ]; then
        run dnf -y install dnf-plugins-core
        run dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
      fi
      run dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    else
      run yum install -y yum-utils
      run yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
      run yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    fi
  fi

  run systemctl enable --now docker
}

configure_firewall() {
  echo "==> [5/5] Firewall: SSH + Kong proxy (:8000)"
  if command -v ufw >/dev/null 2>&1; then
    run ufw allow OpenSSH || run ufw allow 22/tcp || true
    run ufw allow 8000/tcp || true
    run ufw --force enable || true
    run ufw status || true
  elif command -v firewall-cmd >/dev/null 2>&1; then
    run systemctl enable --now firewalld 2>/dev/null || true
    run firewall-cmd --permanent --add-service=ssh || run firewall-cmd --permanent --add-port=22/tcp || true
    run firewall-cmd --permanent --add-port=8000/tcp || true
    run firewall-cmd --reload || true
    run firewall-cmd --list-all || true
  else
    echo "    No ufw/firewalld found — open port 22 and 8000 in your cloud panel if needed."
  fi
}

# ---------- main ----------
echo "==> Detecting OS"
FAMILY="$(detect_family | tail -n1)"
echo "    Package family: $FAMILY"

echo "==> [1/5] Install Docker Engine + Compose plugin"
if command -v docker >/dev/null 2>&1; then
  echo "    Docker already installed: $(docker --version)"
  run systemctl enable --now docker 2>/dev/null || true
else
  case "$FAMILY" in
    debian) install_docker_debian ;;
    rhel)   install_docker_rhel ;;
    *)
      echo "ERROR: Unsupported OS (need apt-get or dnf/yum)."
      echo "       Run: cat /etc/os-release"
      echo "       Then install Docker manually: https://docs.docker.com/engine/install/"
      exit 1
      ;;
  esac
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "WARNING: 'docker compose' plugin not found. Trying package install..."
  pkg_install docker-compose-plugin 2>/dev/null || pkg_install docker-compose-plugin 2>/dev/null || true
fi

echo "    $(docker --version 2>/dev/null || echo 'docker missing')"
docker compose version 2>/dev/null || echo "WARNING: docker compose still missing — install docker-compose-plugin"

echo "==> [2/5] Allow deploy user to run Docker"
if id "$DEPLOY_USER" >/dev/null 2>&1; then
  run usermod -aG docker "$DEPLOY_USER" || true
else
  echo "    User $DEPLOY_USER not found, skip usermod"
fi

echo "==> [3/5] Clone (or update) app directory → $APP_DIR"
if ! command -v git >/dev/null 2>&1; then
  pkg_install git
fi

if [ -d "$APP_DIR/.git" ]; then
  run git -C "$APP_DIR" fetch origin
  run git -C "$APP_DIR" checkout main
  run git -C "$APP_DIR" pull --ff-only origin main
else
  run mkdir -p "$(dirname "$APP_DIR")"
  if [ -d "$APP_DIR" ] && [ -z "$(ls -A "$APP_DIR" 2>/dev/null || true)" ]; then
    run rmdir "$APP_DIR" 2>/dev/null || true
  fi
  run git clone "$REPO_URL" "$APP_DIR"
fi

if id "$DEPLOY_USER" >/dev/null 2>&1; then
  run chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
fi

echo "==> [4/5] Prepare .env if missing"
if [ ! -f "$APP_DIR/.env" ]; then
  if [ "$(id -u)" -eq 0 ]; then
    cp "$APP_DIR/.env.example" "$APP_DIR/.env"
    sed -i 's/^NODE_ENV=.*/NODE_ENV=production/' "$APP_DIR/.env" || true
  else
    cp "$APP_DIR/.env.example" "$APP_DIR/.env"
    sed -i 's/^NODE_ENV=.*/NODE_ENV=production/' "$APP_DIR/.env" || true
  fi
  echo "    Created $APP_DIR/.env — EDIT THIS FILE before first deploy:"
  echo "      - JWT_SECRET, POSTGRES_PASSWORD, RABBITMQ_PASSWORD"
  echo "      - SEAWEED_*, LLM_*, FCM_* if used"
else
  echo "    .env already exists, left unchanged"
fi

configure_firewall

run chmod +x "$APP_DIR/scripts/"*.sh 2>/dev/null || chmod +x "$APP_DIR/scripts/"*.sh 2>/dev/null || true

cat <<EOF

========================================
 Server bootstrap complete
========================================
App dir:     $APP_DIR
Deploy user: $DEPLOY_USER
OS family:   $FAMILY

Next steps:
  1) Edit secrets:
       nano $APP_DIR/.env
       # or: vi $APP_DIR/.env

  2) Create a GitHub PAT (read:packages) for pulling images, then on this server:
       echo YOUR_PAT | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin

  3) In GitHub → Settings → Secrets and variables → Actions, add:
       SSH_HOST          = public IP or domain of this server
       SSH_USER          = $DEPLOY_USER
       SSH_PRIVATE_KEY   = private key that can SSH as SSH_USER
       SSH_PORT          = 22   (optional)
       DEPLOY_PATH       = $APP_DIR
       GHCR_PULL_TOKEN   = same PAT with read:packages

  4) Create environment "production" (Settings → Environments).

  5) Push to main (or Run workflow CD) to deploy.

  6) Health check:
       curl http://SERVER_IP:8000/api/identity/health
========================================
EOF
