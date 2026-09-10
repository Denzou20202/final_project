#!/bin/sh
# Обертка для docker-compose.prod.yml — всегда явно передает --env-file.
#
# Без --env-file команда `docker compose -f docker-compose.prod.yml ...` тихо
# откатывается к .env файлу в корне репозитория (файл для ЛОКАЛЬНОЙ РАЗРАБОТКИ, 
# со слабыми секретами) для интерполяции ${VAR} внутри самого YAML файла compose — 
# директива env_file: внутри сервиса влияет только на runtime-окружение контейнера, 
# но не на подстановку переменных самим compose. Это подтверждается `docker compose config`: 
# без этой обертки POSTGRES_PASSWORD/MINIO_ROOT_PASSWORD принимают значения из 
# dev-файла, даже при запуске "prod" файла.
#
# Использование: ./infra/prod-compose.sh up -d --build
#              ./infra/prod-compose.sh logs -f ticket-service
#              ./infra/prod-compose.sh down

set -e
cd "$(dirname "$0")/.."
exec docker compose --env-file .env.production -f docker-compose.prod.yml "$@"
