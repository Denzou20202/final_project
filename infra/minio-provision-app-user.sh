#!/bin/sh
# Создаёт (если ещё не существует) в живом MinIO ограниченного пользователя
# для приложения — вместо root-кредов, которыми ticket-service/knowledge-service
# исторически ходили в S3 (MINIO_ROOT_USER/MINIO_ROOT_PASSWORD == S3_ACCESS_KEY/
# S3_SECRET_KEY). Новый пользователь получает ровно то, что реально вызывают оба
# S3Service: s3:GetObject/PutObject/DeleteObject на объектах бакета + s3:ListBucket
# на самом бакете (нужно для HeadBucket при старте сервиса). НЕ получает
# s3:CreateBucket — бакет в проде уже существует, HeadBucket пройдёт успешно,
# до CreateBucket дело не дойдёт (см. onModuleInit в обоих S3Service — при
# ошибке он просто логирует и продолжает работу, не падает).
#
# Секреты сам НЕ генерирует — ожидает, что S3_APP_ACCESS_KEY/S3_APP_SECRET_KEY
# уже вписаны в .env.production (см. .env.production.example).
#
# Идемпотентен: policy create — upsert (безопасно перезапускать), user add —
# только если пользователя ещё нет (повторный запуск не сбрасывает секрет).
#
# Порядок использования (полностью — см. CHECKLIST.md / память сессии):
#   1. Вписать S3_APP_ACCESS_KEY/S3_APP_SECRET_KEY в VeloxDesk/.env.production
#   2. ./infra/minio-provision-app-user.sh   (этот скрипт — только говорит с
#      уже работающим контейнером minio через docker exec, ничего не рестартует)
#   3. Убедиться mc-командами, что новый пользователь реально НЕ root
#   4. Только теперь — ./infra/prod-compose.sh up -d --build ticket-service knowledge-service
#
# Использование: ./infra/minio-provision-app-user.sh
set -e
cd "$(dirname "$0")/.."

if [ ! -f .env.production ]; then
  echo "ERROR: .env.production не найден в $(pwd) — запускайте из VeloxDesk/" >&2
  exit 1
fi

set -a
. ./.env.production
set +a

missing=""
[ -z "$S3_APP_ACCESS_KEY" ] && missing="$missing S3_APP_ACCESS_KEY"
[ -z "$S3_APP_SECRET_KEY" ] && missing="$missing S3_APP_SECRET_KEY"
[ -z "$S3_BUCKET" ] && missing="$missing S3_BUCKET"
if [ -n "$missing" ]; then
  echo "ERROR: не заданы в .env.production:$missing" >&2
  echo "Скрипт сам секреты не генерирует — впишите их вручную (см. .env.production.example)." >&2
  exit 1
fi

MINIO_CID=$(./infra/prod-compose.sh ps -q minio)
if [ -z "$MINIO_CID" ]; then
  echo "ERROR: сервис minio не запущен" >&2
  exit 1
fi

POLICY_NAME="${S3_BUCKET}-app-rw"

echo "Бакет: $S3_BUCKET, политика: $POLICY_NAME"

# Алиас настраивается root-кредами, которые уже лежат в окружении САМОГО
# контейнера minio (MINIO_ROOT_USER/MINIO_ROOT_PASSWORD) — наружу, в этот
# скрипт, root-секрет не попадает вообще.
docker exec "$MINIO_CID" sh -c 'mc alias set local http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"' >/dev/null

docker exec -i "$MINIO_CID" sh -c "cat > /tmp/${POLICY_NAME}.json" <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": ["arn:aws:s3:::${S3_BUCKET}"] },
    { "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], "Resource": ["arn:aws:s3:::${S3_BUCKET}/*"] }
  ]
}
POLICY

docker exec "$MINIO_CID" mc admin policy create local "$POLICY_NAME" "/tmp/${POLICY_NAME}.json"
docker exec "$MINIO_CID" rm -f "/tmp/${POLICY_NAME}.json"

if docker exec "$MINIO_CID" mc admin user info local "$S3_APP_ACCESS_KEY" >/dev/null 2>&1; then
  echo "Пользователь $S3_APP_ACCESS_KEY уже существует — секрет не трогаю."
else
  docker exec "$MINIO_CID" mc admin user add local "$S3_APP_ACCESS_KEY" "$S3_APP_SECRET_KEY"
  echo "Создан пользователь $S3_APP_ACCESS_KEY."
fi

docker exec "$MINIO_CID" mc admin policy attach local "$POLICY_NAME" --user "$S3_APP_ACCESS_KEY"

echo "---"
docker exec "$MINIO_CID" mc admin user info local "$S3_APP_ACCESS_KEY"
echo "---"
echo "Готово. Дальше: проверить права mc-командами (см. header-комментарий), затем"
echo "  ./infra/prod-compose.sh up -d --build ticket-service knowledge-service"
