// Backend CI/CD for the Hostinger VPS.
// Jenkins runs on the same VPS, so it builds and deploys with the local Docker
// engine - no SSH hop needed. The branch that deploys is set in the Jenkins job
// ("Branch Specifier": */development today, */main later); nothing here changes.

pipeline {
  agent any

  options {
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '15'))
    timeout(time: 30, unit: 'MINUTES')
  }

  // Fires on GitHub webhook pushes (needs the GitHub plugin). Registered after
  // the first manual run of the job.
  triggers {
    githubPush()
  }

  environment {
    ENV_FILE     = '/opt/ticketing/backend.env'
    BACKUP_DIR   = '/opt/ticketing/backups'
    COMPOSE      = "docker compose -p ticketing-backend -f docker-compose.prod.yml --env-file /opt/ticketing/backend.env"
    SERVICE      = 'app'
    REPLICAS_VAR = 'BACKEND_REPLICAS'   // replica count, set in backend.env
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        sh 'git log -1 --format="Deploying %h - %s (%an)"'
      }
    }

    stage('Preflight') {
      steps {
        sh '''
          test -f "$ENV_FILE" || { echo "Missing $ENV_FILE on the server - see DEPLOYMENT.md"; exit 1; }
          grep -qE '^APP_DOMAIN=.+' "$ENV_FILE" || { echo "APP_DOMAIN missing in $ENV_FILE - run deploy/traefik/install-traefik.sh"; exit 1; }
          docker network inspect traefik >/dev/null || { echo "Docker network 'traefik' missing - run deploy/traefik/install-traefik.sh"; exit 1; }
          docker version --format 'Docker {{.Server.Version}}'
          $COMPOSE config --quiet
        '''
      }
    }

    stage('Build image') {
      steps {
        sh '$COMPOSE build --pull app'
      }
    }

    stage('Backup database') {
      // db/script.sql runs on every deploy (and contains DROP statements), so
      // take a dump first. Skipped on the very first deploy when no DB exists.
      steps {
        sh '''
          if [ -n "$(docker ps -q -f name=^ticketing-postgres$)" ]; then
            env_val() { grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '"\\r'; }
            PG_USERNAME=$(env_val PG_USERNAME)
            PG_DB=$(env_val PG_DB)
            mkdir -p "$BACKUP_DIR"
            FILE="$BACKUP_DIR/${PG_DB:-ticketing_system}_$(date +%Y%m%d_%H%M%S)_build${BUILD_NUMBER}.sql.gz"
            # dump to a plain file first so a pg_dump failure fails the build
            docker exec ticketing-postgres pg_dump -U "$PG_USERNAME" -d "${PG_DB:-ticketing_system}" > "${FILE%.gz}"
            gzip "${FILE%.gz}"
            echo "Backup written: $FILE"
            # keep the 20 most recent dumps
            ls -1t "$BACKUP_DIR"/*.sql.gz | tail -n +21 | xargs -r rm -f
          else
            echo "Postgres container not running yet - skipping backup (first deploy)."
          fi
        '''
      }
    }

    stage('Deploy (rolling)') {
      // Zero-downtime: start a new set of replicas next to the old ones, wait
      // until Docker reports them healthy (Traefik then routes to them), and
      // only then stop the old set. If the new set never gets healthy it is
      // removed and the old version keeps serving.
      // The app container runs scripts/migrate.js (db/script.sql) before it starts.
      steps {
        sh '''
          $COMPOSE up -d --wait postgres
          OLD=$($COMPOSE ps -q "$SERVICE")
          if [ -z "$OLD" ]; then
            echo "No running replicas - starting fresh."
            $COMPOSE up -d --wait --wait-timeout 240 "$SERVICE"
            exit 0
          fi
          N=$(echo "$OLD" | wc -l)
          R=$(grep -E "^$REPLICAS_VAR=" "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -dc '0-9')
          R=${R:-2}
          echo "Replacing $N running replica(s) with $R new one(s)..."
          $COMPOSE up -d --no-deps --no-recreate --scale "$SERVICE=$((N + R))" "$SERVICE"
          NEW=$($COMPOSE ps -q "$SERVICE" | grep -vxF "$OLD" || true)
          [ -n "$NEW" ] || { echo "No new containers were created"; exit 1; }

          ok=0
          for i in $(seq 1 80); do
            ok=1
            for c in $NEW; do
              st=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$c")
              if [ "$st" = unhealthy ]; then
                echo "New container $c is unhealthy:"; docker logs --tail 100 "$c"
                docker rm -f $NEW >/dev/null; exit 1
              fi
              [ "$st" = healthy ] || ok=0
            done
            [ "$ok" = 1 ] && break
            sleep 3
          done
          if [ "$ok" != 1 ]; then
            echo "New containers did not become healthy in time; keeping the old version."
            for c in $NEW; do docker logs --tail 60 "$c"; done
            docker rm -f $NEW >/dev/null; exit 1
          fi

          echo "New replicas healthy. Waiting for Traefik to pick them up, then retiring the old ones."
          sleep 5
          docker stop -t 20 $OLD >/dev/null && docker rm $OLD >/dev/null
          $COMPOSE ps "$SERVICE"
        '''
      }
    }

    stage('Smoke test via Traefik') {
      steps {
        sh '''
          APP_DOMAIN=$(grep -E '^APP_DOMAIN=' "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '"\\r')
          # -k: also passes while the first Let's Encrypt certificate is being issued
          curl -fsSk --retry 10 --retry-delay 3 --retry-all-errors \\
            --resolve "$APP_DOMAIN:443:127.0.0.1" "https://$APP_DOMAIN/api/auth/healthCheck"
          echo
          echo "Live at https://$APP_DOMAIN/api/"
        '''
      }
    }
  }

  post {
    failure {
      sh '$COMPOSE ps || true'
      sh '$COMPOSE logs --tail=150 "$SERVICE" || true'
    }
    always {
      sh 'docker image prune -f >/dev/null || true'
    }
  }
}
