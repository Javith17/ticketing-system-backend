# Deployment (EC2 / generic Docker host)

This app is packaged as a single Docker image (`Dockerfile`) plus a
`docker-compose.yml` for orchestration. There are two supported layouts:

## Option A - self-contained (app + Postgres on the same EC2 instance)

1. Provision an EC2 instance (Amazon Linux 2023 or Ubuntu), open inbound port
   `22` (SSH) and whichever port you expose the API on (default `3000`, or
   `80`/`443` if fronted by nginx/ALB) in its security group.
2. Install Docker + the Compose plugin:
   ```bash
   sudo yum install -y docker            # Amazon Linux
   # or: sudo apt-get install -y docker.io docker-compose-plugin   # Ubuntu
   sudo systemctl enable --now docker
   sudo usermod -aG docker $USER   # re-login after this
   ```
3. Pull the repo onto the instance (git clone, or ship a tarball/CI artifact).
4. Create `.env` from `.env.example` on the instance. Set a strong `JWT_SECRET`
   and set `ALLOWED_ORIGINS` to your real frontend origin(s).
5. Start it:
   ```bash
   docker compose up -d --build
   ```
   `postgres` and `app` both start; the app container runs
   `scripts/migrate.js` (applying `db/script.sql`) before booting the API, so
   the schema is always up to date on every restart/redeploy.
6. Verify: `curl http://localhost:3000/auth/healthCheck`.

Redeploying a new version: pull the new code, `docker compose up -d --build app`.
Since `db/script.sql` is idempotent, re-running it is safe and any new schema
changes appended to it get applied automatically.

## Option B - app on EC2, database on RDS

Use this when you want a managed, backed-up Postgres instance instead of a
containerized one.

1. Provision an RDS PostgreSQL instance. Note its endpoint, and put the EC2
   instance's security group in the RDS security group's inbound rules
   (port 5432).
2. On the EC2 instance, set in `.env`:
   ```
   PG_HOST=<your-rds-endpoint>
   PG_PORT=5432
   PG_USERNAME=<rds-username>
   PG_PASSWORD=<rds-password>
   PG_DB=ticketing_system
   PG_SSL=true
   ```
3. Start only the app service (skip the bundled `postgres` container):
   ```bash
   docker compose up -d --build app
   ```
4. Same as Option A, `docker-entrypoint.sh` applies `db/script.sql` against the
   RDS database before the app starts, on every deploy.

## Reverse proxy / TLS

For a production domain, put nginx (or an ALB) in front of the app container
and terminate TLS there, proxying to `127.0.0.1:3000` (or the container's
mapped port). This app itself listens on plain HTTP on `0.0.0.0:$PORT`.

## Environment variables

See `.env.example` for the full list. At minimum for production, set:

- `JWT_SECRET` - a long random value, different from the dev default.
- `PG_*` - pointing at your database (containerized or RDS).
- `ALLOWED_ORIGINS` - comma-separated list of allowed frontend origins for CORS.
- `PG_SSL=true` when connecting to RDS (or any Postgres requiring SSL).
