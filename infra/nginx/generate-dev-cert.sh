#!/bin/sh
# Генерирует самоподписанный TLS-сертификат для локального dev-nginx
# (infra/nginx/nginx.conf, https://localhost/). Приватный ключ намеренно
# никогда не коммитится (см. .gitignore/sync-to-veloxdesk.sh) — этот
# скрипт и есть способ получить пару заново на новой машине/после
# чистого клонирования, вместо того чтобы полагаться на файлы, которых
# в репозитории просто нет.
set -e
cd "$(dirname "$0")"

if [ -f certs/localhost.crt ] && [ -f certs/localhost.key ]; then
  echo "certs/localhost.crt и certs/localhost.key уже существуют — ничего не делаю."
  exit 0
fi

mkdir -p certs

openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout certs/localhost.key \
  -out certs/localhost.crt \
  -days 365 \
  -subj "/C=US/ST=Dev/L=Local/O=VeloxDesk/OU=Dev/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

echo "Готово: certs/localhost.crt + certs/localhost.key (самоподписанный, действителен 365 дней)."
