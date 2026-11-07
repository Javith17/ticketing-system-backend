# Deployment - Hostinger VPS + Jenkins

Everything (Jenkins, Postgres, backend, frontend, nginx) runs on one Ubuntu VPS.
A push to the deploy branch (`development` for now) triggers a GitHub webhook,
Jenkins builds the Docker image on the same VPS and restarts the containers.

```
GitHub push ──webhook──▶ Jenkins :8080 (VPS)
                              │ docker compose build/up
                              ▼
 Browser ──▶ nginx :80 ──/api/──▶ ticketing-backend  127.0.0.1:3000 ──▶ ticketing-postgres 127.0.0.1:5432
                       └──/────▶ ticketing-frontend 127.0.0.1:4001
```

| Piece | Where |
|---|---|
| Backend pipeline | `Jenkinsfile` (this repo) |
| Frontend pipeline | `Jenkinsfile` (frontend repo) |
| Backend + DB stack | `docker-compose.prod.yml` |
| Server env (secrets) | `/opt/ticketing/backend.env` (not in git) |
| Uploaded images | `/opt/ticketing/uploads` |
| DB backups (before every deploy) | `/opt/ticketing/backups` |
| Host nginx | `deploy/nginx/ticketing.conf` → `/etc/nginx/sites-available/ticketing` |

## 1. One-time server setup

Push these changes to `development` first (the script downloads files from it), then on the VPS as root:

```bash
curl -fsSL https://raw.githubusercontent.com/Javith17/ticketing-system-backend/development/deploy/setup-vps.sh -o setup-vps.sh
bash setup-vps.sh
```

It installs Docker + Compose, Jenkins (Java 21), nginx and UFW, adds 2 GB swap if
there is none, creates `/opt/ticketing/*`, and writes `/opt/ticketing/backend.env`
with generated `JWT_SECRET`, `PG_PASSWORD` and `EMAIL_ENCRYPTION_KEY`.

Then edit `/opt/ticketing/backend.env` and set `EXTERNAL_API_TOKEN` (and Firebase, if used).
Don't change `PG_USERNAME` / `PG_PASSWORD` after the first deploy - Postgres only reads them when it creates the database volume.

## 2. Jenkins setup

1. Open `http://<VPS-IP>:8080`, paste the initial admin password the script printed,
   choose **Install suggested plugins** (includes Git, Pipeline, GitHub), create an admin user.
2. **New Item → `ticketing-backend` → Pipeline**
   - Build Triggers: tick **GitHub hook trigger for GITScm polling**
   - Pipeline: *Pipeline script from SCM* → Git →
     `https://github.com/Javith17/ticketing-system-backend.git`,
     Branch Specifier `*/development`, Script Path `Jenkinsfile`
   - (Repos are public, so no credentials are needed. If you make them private, add a GitHub PAT as a *Username with password* credential and select it here.)
3. Same for **`ticketing-frontend`** with `https://github.com/Javith17/ticketing-system-frontend.git`.
4. Click **Build Now** on the backend job first (it creates the database), then the frontend job.

## 3. GitHub webhooks (auto-deploy on push)

In **each** repo: Settings → Webhooks → Add webhook

- Payload URL: `http://<VPS-IP>:8080/github-webhook/` (trailing slash required)
- Content type: `application/json`
- Events: *Just the push event*

A push to `development` now builds and deploys that repo automatically.
Pushes to other branches reach Jenkins too but are ignored, because the job only builds `*/development`.

## 4. Moving to `main` later

Change Branch Specifier to `*/main` in both Jenkins jobs. Nothing in the code changes.
(Optional: add a second job per repo, e.g. a `main` → production and `development` → staging, on different ports.)

## 5. Database

- The schema comes from `db/script.sql`, applied by `scripts/migrate.js` every time the
  backend container starts. Keep all schema changes idempotent in that file.
- The first deploy creates an empty `ticketing_system` DB plus the seed roles/admin user from the script.
- **Bringing over existing data** from your current Postgres:
  ```bash
  # on the machine with the existing DB
  pg_dump -U postgres -d ticketing_system --no-owner --no-privileges > ticketing_system.sql
  scp ticketing_system.sql root@<VPS-IP>:/opt/ticketing/backups/
  # on the VPS (after the first backend deploy)
  docker exec -i ticketing-postgres psql -U ticketing -d ticketing_system < /opt/ticketing/backups/ticketing_system.sql
  ```
  For a clean restore, stop the app, drop and recreate the DB first, restore, then start the app again.
  Copy existing upload images into `/opt/ticketing/uploads/` and run `chown -R 1001:1001 /opt/ticketing/uploads`.
- Connect a DB client through an SSH tunnel (port 5432 is not public):
  `ssh -L 5432:127.0.0.1:5432 root@<VPS-IP>` and connect to `localhost:5432`.
- Restore a pre-deploy backup:
  `gunzip -c /opt/ticketing/backups/<file>.sql.gz | docker exec -i ticketing-postgres psql -U ticketing -d ticketing_system`

## 6. Day-to-day

```bash
docker ps                                  # what's running
docker logs -f ticketing-backend           # API logs
docker logs -f ticketing-frontend
curl http://127.0.0.1:3000/auth/healthCheck
```

Swagger: `http://<VPS-IP>/api/api/docs`.

## 7. Domain + HTTPS (when ready)

1. Point an A record at the VPS IP.
2. Set `server_name your.domain;` in `/etc/nginx/sites-available/ticketing`, `nginx -t && systemctl reload nginx`.
3. `apt install -y certbot python3-certbot-nginx && certbot --nginx -d your.domain`
4. Add `https://your.domain` to `ALLOWED_ORIGINS` in `/opt/ticketing/backend.env`, rebuild the backend job.
5. Optionally put Jenkins behind nginx too and close port 8080 to the world (GitHub webhooks then go to `https://your.domain/jenkins/github-webhook/`).

## Hardening checklist

- Log in with an SSH key and disable password login for root (`PasswordAuthentication no`).
- Keep Jenkins updated (Manage Jenkins → Plugins) and don't enable sign-up.
- Uploaded images under `/uploads/` are served without authentication (the `<img>` tags can't send a token) - same as before.
