#!/usr/bin/env bash
# Pull latest images and recreate the production stack.
# Expects to run from the app root with:
#   IMAGE_REGISTRY  e.g. ghcr.io/hieusoft/project4
#   IMAGE_TAG       e.g. full git SHA or "latest"
#   .env            present and filled
#
# Invoked by GitHub Actions CD over SSH, or manually:
#   export IMAGE_REGISTRY=ghcr.io/hieusoft/project4
#   export IMAGE_TAG=latest
#   ./scripts/deploy.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

IMAGE_REGISTRY="${IMAGE_REGISTRY:-ghcr.io/hieusoft/project4}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

if [ ! -f .env ]; then
  echo "ERROR: .env not found in $ROOT_DIR"
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "ERROR: $COMPOSE_FILE not found"
  exit 1
fi

export IMAGE_REGISTRY IMAGE_TAG

echo "==> Deploying $IMAGE_REGISTRY/*:$IMAGE_TAG"
echo "==> Compose file: $COMPOSE_FILE"

docker compose -f "$COMPOSE_FILE" pull
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans --wait || \
  docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

# Kong cache ban ghi DNS cua upstream theo TEN service. Sau khi recreate, Docker
# co the cap lai IP cua container vua xoa cho mot container KHAC -> Kong goi cheo
# service (vd: goi media nhung tra ve IP cua identity) hoac "connect() failed
# (111: Connection refused)" -> 502 cho moi request du app hoan toan khoe.
# Da kiem chung: ha KONG_DNS_STALE_TTL khong du; phai reload de xoa cache.
# "kong reload" nhe hon restart container (khong mat ket noi dang mo).
echo "==> Reload Kong (xoa cache DNS upstream)"
if ! docker compose -f "$COMPOSE_FILE" exec -T kong kong reload 2>&1 | tail -2; then
  echo "    kong reload that bai, restart container"
  docker compose -f "$COMPOSE_FILE" restart kong
fi

echo "==> Cho Kong san sang"
for i in $(seq 1 45); do
  if docker compose -f "$COMPOSE_FILE" exec -T kong kong health >/dev/null 2>&1; then
    echo "    Kong san sang sau ${i}s"
    break
  fi
  sleep 1
done

echo "==> Kiem tra gateway -> upstream"
KONG_PORT="${KONG_PROXY_PORT:-8000}"
failed=0
for svc in identity community donation communication media; do
  code=""
  for attempt in 1 2 3 4 5; do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 \
      "http://localhost:${KONG_PORT}/api/${svc}/health" || echo "000")
    [ "$code" = "200" ] && break
    # Van loi -> co the cache DNS chua sach, restart hard roi thu lai
    if [ "$attempt" = "3" ]; then
      echo "    $svc van loi ($code), restart Kong"
      docker compose -f "$COMPOSE_FILE" restart kong >/dev/null 2>&1
      sleep 12
    else
      sleep 3
    fi
  done
  if [ "$code" = "200" ]; then
    printf "    OK   %-16s %s\n" "$svc" "$code"
  else
    printf "    FAIL %-16s %s\n" "$svc" "$code"
    failed=$((failed + 1))
  fi
done

if [ "$failed" -gt 0 ]; then
  echo "ERROR: $failed service khong tra loi qua gateway."
  echo "       Kiem tra: docker compose -f $COMPOSE_FILE logs --tail 50 kong"
  exit 1
fi

echo "==> Running containers:"
docker compose -f "$COMPOSE_FILE" ps

echo "==> Prune dangling images"
docker image prune -f >/dev/null || true

echo "==> Deploy finished at $(date -Is)"
