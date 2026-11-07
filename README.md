# Ticketing System Backend

NestJS + PostgreSQL backend for the ticketing system.

## Project structure

```
src/
  model/        DB entities (TypeORM), all extend BaseEntity (id uuid, is_active, created_at, updated_at)
  dto/          Request DTOs, validated via class-validator (ValidationPipe is global)
  auth/         JWT auth: guard, soft-decode interceptor, current-user decorator
  users/        Controller + service + module
  roles/        Controller + service + module
  features/     Controller + service + module
  sources/      Controller + service + module
  categories/   Controller + service + module
  assets/       Controller + service + module
  public-qr/    Controller + service + module (unauthenticated public guest endpoints)
db/
  script.sql    All schema DDL + seed data. Executed on every deploy - see below.
scripts/
  migrate.js    Runs db/script.sql against Postgres (no psql binary required)
```

## Database strategy

TypeORM `synchronize` is **disabled**. There are no TypeORM migrations either -
**all schema changes go through `db/script.sql`**, which is written idempotently
(`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `ON
CONFLICT ... DO NOTHING`), so it's safe to re-run on every deployment. When you
need to change the schema:

1. Add your entity/column changes in `src/model/`.
2. Append the equivalent idempotent SQL to `db/script.sql`.
3. It will be applied automatically on the next deploy (or run `npm run db:migrate` locally).

## Getting started (local dev)

```bash
cp .env.example .env   # adjust PG_* / JWT_SECRET as needed
npm install
npm run db:migrate     # applies db/script.sql to your local Postgres
npm run start:dev
```

Seeded admin login (local/dev only - change after first login):

```
email:    admin@example.com
password: admin123
```

## Running with Docker (local)

```bash
cp .env.example .env
docker compose up -d --build
```

This starts Postgres + the API. `docker-entrypoint.sh` runs `scripts/migrate.js`
(applying `db/script.sql`) every time the app container starts, before booting
the server.

## Scripts

```bash
npm run start:dev     # watch mode
npm run build          # compile to dist/
npm run start:prod      # run compiled build
npm run db:migrate       # apply db/script.sql
npm run lint
npm run test / test:e2e
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for EC2/Docker deployment instructions.
