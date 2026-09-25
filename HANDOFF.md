# Запуск проекта локально + восстановление чистой БД

Инструкция для ревью проекта: полный локальный запуск и восстановление базы данных с одним готовым аккаунтом администратора.

## 1. Предварительные требования

- Node.js >= 24, npm
- Docker Desktop (или Docker Engine + Compose plugin)

## 2. Установка зависимостей и настройка окружения

```bash
npm install
cp .env.example .env
cp frontend/client-portal/.env.example frontend/client-portal/.env
cp frontend/operator-app/.env.example frontend/operator-app/.env
```

Значения по умолчанию в `.env` уже настроены на локальные dev-контейнеры — менять ничего не нужно для локального запуска. `CORS_ORIGINS` уже включает `https://localhost` и порты разработки.

## 3. TLS-сертификат для nginx (один раз)

Приватный ключ намеренно не хранится в репозитории — сгенерируйте свою пару перед первым запуском:

```bash
./infra/nginx/generate-dev-cert.sh
```

Создаст `infra/nginx/certs/localhost.crt` + `localhost.key` (самоподписанный, 365 дней). Без этого шага контейнер nginx ниже не запустится.

## 4. Инфраструктура (БД, Redis, поиск, файловое хранилище)

```bash
docker compose -f docker-compose.yml up -d
```

Поднимет: Postgres, Redis, Elasticsearch, MinIO, тестовый SMTP/IMAP (Greenmail), nginx (с сертификатом из шага 3) для `https://localhost:8443/`.

> **Примечание:** Если на вашей машине порт `5432` уже занят сторонним сервисом (или другим инстансом PostgreSQL), задайте свободный порт в `.env` (например, `DB_PORT=5433`).

## 5. Бакет для вложений (один раз)

```bash
docker exec veloxdesk-dev-minio-1 sh -c "
  mc alias set local http://localhost:9000 veloxdesk veloxdesk-secret
  mc mb local/veloxdesk-attachments 2>/dev/null || true
"
```

Без этого шага загрузка вложений к тикетам не будет работать (сам бакет автоматически не создаётся). Если бакет уже существует, команда безопасно завершится без ошибки.

## 6. Восстановление чистой БД (1 админ, без данных)

В репозитории лежит готовый дамп `backup/veloxdesk-clean-1admin.sql` — чистая база со всеми 101 миграциями, ровно одним пользователем-администратором, счётчиком номеров тикетов с 1 и базовыми записями справочников.

```bash
docker exec -i veloxdesk-dev-postgres-1 psql -U veloxdesk -d veloxdesk < backup/veloxdesk-clean-1admin.sql
npm run migration:run
```

Команда `npm run migration:run` проверяет актуальность схемы и синхронизирует последовательности базы данных (скрипты миграций кроссплатформенны и поддерживают macOS, Linux и Windows).

## 7. Запуск приложения

```bash
npx nx run-many -t serve --all --parallel=9
```

Запустит все 7 backend-сервисов и оба frontend'а (`client-portal`, `operator-app`) параллельно в одном терминале.

Откройте:

| Что | Адрес |
|---|---|
| Клиентский портал | `https://localhost:8443/` |
| Панель оператора | `https://localhost:8443/staff/` |

Браузер предупредит о небезопасном соединении (самоподписанный сертификат для локальной проверки) — это ожидаемо, нажмите "Продолжить" / "Advanced → Proceed".

## 8. Вход администратором

Логин и пароль администратора переданы отдельно (не в этом репозитории).

## Важно

- Файл `.env.production` (реальные production-секреты) в этот репозиторий **не входит** и не должен передаваться — исключён через `.gitignore`.
- Это независимая копия базы данных для локального ревью — она никак не связана с работающим production-инстансом проекта.
