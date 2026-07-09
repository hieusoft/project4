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

echo "==> Running containers:"
docker compose -f "$COMPOSE_FILE" ps

echo "==> Prune dangling images"
docker image prune -f >/dev/null || true

echo "==> Deploy finished at $(date -Is)"
