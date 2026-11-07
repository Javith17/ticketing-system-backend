#!/usr/bin/env bash
# One-time bootstrap for the Hostinger Ubuntu VPS (22.04 / 24.04).
# Installs Docker + Compose, Jenkins (Java 21), host nginx and the UFW
# firewall, and prepares /opt/ticketing for the two Jenkins pipelines.
#
# Usage (as root on the VPS):
#   curl -fsSL https://raw.githubusercontent.com/Javith17/ticketing-system-backend/development/deploy/setup-vps.sh -o setup-vps.sh
#   bash setup-vps.sh
#
# Safe to re-run: every step checks before changing anything.
set -euo pipefail

APP_DIR=/opt/ticketing
REPO_RAW=https://raw.githubusercontent.com/Javith17/ticketing-system-backend/development
PUBLIC_IP=$(curl -fsS https://api.ipify.org || hostname -I | awk '{print $1}')

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }
export DEBIAN_FRONTEND=noninteractive

log "Base packages"
apt-get update -y
apt-get install -y ca-certificates curl gnupg git ufw nginx fontconfig openjdk-21-jre-headless

log "Swap (2G, only if none) - npm/vite builds can run out of memory on small plans"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

log "Docker Engine + Compose plugin"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

log "Jenkins (LTS)"
if ! dpkg -s jenkins >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2026.key -o /etc/apt/keyrings/jenkins-keyring.asc
  echo "deb [signed-by=/etc/apt/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/" \
    > /etc/apt/sources.list.d/jenkins.list
  apt-get update -y
  apt-get install -y jenkins
fi
usermod -aG docker jenkins
systemctl enable jenkins
systemctl restart jenkins   # picks up the docker group

log "App directories in $APP_DIR"
mkdir -p "$APP_DIR"/{uploads,backups,secrets}
chown 1001:1001 "$APP_DIR/uploads"            # matches appuser UID in the backend image
chown jenkins:jenkins "$APP_DIR/backups"
chmod 755 "$APP_DIR/secrets"

if [ ! -f "$APP_DIR/backend.env" ]; then
  log "Creating $APP_DIR/backend.env with generated secrets"
  curl -fsSL "$REPO_RAW/deploy/backend.env.example" -o "$APP_DIR/backend.env"
  sed -i \
    -e "s#^ALLOWED_ORIGINS=.*#ALLOWED_ORIGINS=http://${PUBLIC_IP}#" \
    -e "s#^JWT_SECRET=.*#JWT_SECRET=$(openssl rand -hex 48)#" \
    -e "s#^PG_PASSWORD=.*#PG_PASSWORD=$(openssl rand -hex 24)#" \
    -e "s#^EMAIL_ENCRYPTION_KEY=.*#EMAIL_ENCRYPTION_KEY=$(openssl rand -hex 32)#" \
    "$APP_DIR/backend.env"
  echo "!! Edit $APP_DIR/backend.env and set EXTERNAL_API_TOKEN (and Firebase if used)."
fi
chown root:jenkins "$APP_DIR/backend.env"
chmod 640 "$APP_DIR/backend.env"

log "Host nginx reverse proxy"
curl -fsSL "$REPO_RAW/deploy/nginx/ticketing.conf" -o /etc/nginx/sites-available/ticketing
ln -sf /etc/nginx/sites-available/ticketing /etc/nginx/sites-enabled/ticketing
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

log "Firewall (22, 80, 443, 8080)"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8080/tcp     # Jenkins UI + GitHub webhook
ufw --force enable
# Note: Docker publishes ports through iptables, bypassing UFW - that is why
# docker-compose.prod.yml binds every container port to 127.0.0.1.

log "Done"
echo "Jenkins:  http://${PUBLIC_IP}:8080"
echo "Initial admin password:"
cat /var/lib/jenkins/secrets/initialAdminPassword 2>/dev/null || echo "(Jenkins still starting - run: cat /var/lib/jenkins/secrets/initialAdminPassword)"
