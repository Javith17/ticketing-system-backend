#!/usr/bin/env bash
# Switches the VPS from host nginx to Traefik (load balancer + HTTPS + domains).
# Run as root on the VPS. First run creates /opt/ticketing/traefik/.env and
# stops so you can fill it in; the second run does the switch.
#
#   curl -fsSL https://raw.githubusercontent.com/Javith17/ticketing-system-backend/development/deploy/traefik/install-traefik.sh -o install-traefik.sh
#   bash install-traefik.sh
#
# Safe to re-run (e.g. after changing a domain in .env).
set -euo pipefail

APP=/opt/ticketing
DIR=$APP/traefik
RAW=https://raw.githubusercontent.com/Javith17/ticketing-system-backend/development/deploy/traefik

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
[ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }

log "Fetching Traefik files into $DIR"
mkdir -p "$DIR/letsencrypt" "$DIR/dynamic" "$DIR/logs" "$DIR/manager/config" "$DIR/manager/backups"
curl -fsSL "$RAW/docker-compose.yml" -o "$DIR/docker-compose.yml"
curl -fsSL "$RAW/dynamic/jenkins.yml.template" -o "$DIR/jenkins.yml.template"

if [ ! -f "$DIR/.env" ]; then
  curl -fsSL "$RAW/traefik.env.example" -o "$DIR/.env"
  chmod 600 "$DIR/.env"
  echo
  echo "Created $DIR/.env - fill in your domains and email:"
  echo "  nano $DIR/.env"
  echo "then run this script again."
  exit 0
fi

# .env files created before Traefik Manager was added: append the new keys
grep -qE '^TM_DOMAIN=' "$DIR/.env" || printf '\n# Traefik Manager web UI\nTM_DOMAIN=traefik.tickets.example.com\n' >> "$DIR/.env"
for k in TRAEFIK_API_USER TRAEFIK_API_PASSWORD TRAEFIK_API_AUTH; do
  grep -qE "^$k=" "$DIR/.env" || echo "$k=" >> "$DIR/.env"
done

set -a; . "$DIR/.env"; set +a

# Credentials Traefik Manager uses for the Traefik API (generated once)
if [ -z "${TRAEFIK_API_PASSWORD:-}" ] || [ -z "${TRAEFIK_API_AUTH:-}" ]; then
  log "Generating Traefik API credentials for Traefik Manager"
  TRAEFIK_API_USER=${TRAEFIK_API_USER:-tm}
  TRAEFIK_API_PASSWORD=$(openssl rand -hex 24)
  TRAEFIK_API_AUTH="$TRAEFIK_API_USER:$(openssl passwd -apr1 "$TRAEFIK_API_PASSWORD")"
  sed -i \
    -e "s#^TRAEFIK_API_USER=.*#TRAEFIK_API_USER=$TRAEFIK_API_USER#" \
    -e "s#^TRAEFIK_API_PASSWORD=.*#TRAEFIK_API_PASSWORD=$TRAEFIK_API_PASSWORD#" \
    -e "s#^TRAEFIK_API_AUTH=.*#TRAEFIK_API_AUTH='$TRAEFIK_API_AUTH'#" \
    "$DIR/.env"
fi

for v in ACME_EMAIL APP_DOMAIN CI_DOMAIN TM_DOMAIN; do
  val="${!v:-}"
  if [ -z "$val" ] || echo "$val" | grep -qE 'example\.com|CHANGE'; then
    echo "Set $v in $DIR/.env (still empty or a placeholder)"; exit 1
  fi
done

log "Checking DNS (each name must resolve to this server)"
MY_IP=$(curl -fsS https://api.ipify.org)
for h in "$APP_DOMAIN" "$CI_DOMAIN" "$TM_DOMAIN"; do
  ip=$(getent ahostsv4 "$h" | awk 'NR==1{print $1}' || true)
  if [ "$ip" = "$MY_IP" ]; then echo "  ok   $h -> $ip"
  else echo "  WARN $h -> ${ip:-no record} (expected $MY_IP) - its certificate will fail until DNS is fixed"; fi
done

log "Let's Encrypt storage, access log, Jenkins route"
touch "$DIR/letsencrypt/acme.json" && chmod 600 "$DIR/letsencrypt/acme.json"
touch "$DIR/logs/access.log" && chmod 644 "$DIR/logs/access.log"
# Written once only: after that, edit the Jenkins route in Traefik Manager.
# (To regenerate it from CI_DOMAIN, delete dynamic/jenkins.yml and re-run.)
[ -f "$DIR/dynamic/jenkins.yml" ] || \
  sed "s/__CI_DOMAIN__/$CI_DOMAIN/" "$DIR/jenkins.yml.template" > "$DIR/dynamic/jenkins.yml"

# Traefik Manager runs as UID 1002: it writes routes + backups and reads the
# certificates (Traefik itself runs as root, so it keeps full access).
chown -R 1002:1002 "$DIR/dynamic" "$DIR/manager" "$DIR/letsencrypt"
chmod 700 "$DIR/manager"

cat > /etc/logrotate.d/traefik <<EOF
$DIR/logs/access.log {
  daily
  rotate 14
  compress
  delaycompress
  missingok
  notifempty
  copytruncate
}
EOF

log "App env files: APP_DOMAIN + ALLOWED_ORIGINS"
set_kv() { # file key value
  if grep -qE "^$2=" "$1"; then sed -i "s#^$2=.*#$2=$3#" "$1"; else echo "$2=$3" >> "$1"; fi
}
set_kv "$APP/backend.env" APP_DOMAIN "$APP_DOMAIN"
grep -qE '^BACKEND_REPLICAS=' "$APP/backend.env" || echo "BACKEND_REPLICAS=2" >> "$APP/backend.env"
origins=$(grep -E '^ALLOWED_ORIGINS=' "$APP/backend.env" | cut -d= -f2- || true)
case ",$origins," in
  *",https://$APP_DOMAIN,"*) ;;
  *) set_kv "$APP/backend.env" ALLOWED_ORIGINS "${origins:+$origins,}https://$APP_DOMAIN" ;;
esac
[ -f "$APP/frontend.env" ] || printf 'APP_DOMAIN=\nFRONTEND_REPLICAS=2\n' > "$APP/frontend.env"
set_kv "$APP/frontend.env" APP_DOMAIN "$APP_DOMAIN"
chown root:jenkins "$APP/backend.env" "$APP/frontend.env"
chmod 640 "$APP/backend.env" "$APP/frontend.env"

log "Shared Docker network 'traefik'"
docker network inspect traefik >/dev/null 2>&1 || docker network create traefik

log "Stopping host nginx (Traefik takes ports 80/443)"
if systemctl is-active --quiet nginx; then systemctl disable --now nginx; fi

log "Starting Traefik"
docker compose -p traefik -f "$DIR/docker-compose.yml" --env-file "$DIR/.env" up -d --wait

log "Jenkins: reachable from Traefik, closed to the internet"
ufw allow from 172.16.0.0/12 to any port 8080 proto tcp >/dev/null
echo "  Port 8080 is still open publicly. Once https://$CI_DOMAIN works and the"
echo "  GitHub webhooks point there, close it with:  ufw delete allow 8080/tcp"

log "Done"
cat <<EOF
Next:
  1. Re-run the ticketing-backend and ticketing-frontend Jenkins jobs
     (they now register with Traefik instead of publishing ports).
  2. Open https://$APP_DOMAIN   https://$CI_DOMAIN
     Traefik Manager: https://$TM_DOMAIN  - first-login password:
       docker logs traefik-manager 2>&1 | grep -i password
  3. Jenkins > Manage Jenkins > System > Jenkins URL = https://$CI_DOMAIN/
  4. GitHub webhooks -> https://$CI_DOMAIN/github-webhook/
Logs: docker logs -f traefik
EOF
