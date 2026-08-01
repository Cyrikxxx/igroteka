#!/usr/bin/env bash
# Деплой на VPS. Запускать из корня репозитория:
#
#   ./deploy.sh
#
# Предполагается, что рядом лежит заполненный .env (chmod 600) и
# установлены docker + docker compose.

set -euo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml"

if [[ ! -f .env ]]; then
  echo "Нет .env рядом с docker-compose.prod.yml — скопируй .env.example и заполни." >&2
  exit 1
fi

echo "==> Забираем изменения"
git pull --ff-only

echo "==> Собираем образы"
$COMPOSE build

echo "==> Применяем миграции"
$COMPOSE run --rm migrate

echo "==> Перезапускаем сервисы"
$COMPOSE up -d

echo "==> Убираем старые образы"
docker image prune -f

echo "==> Готово. Состояние:"
$COMPOSE ps
