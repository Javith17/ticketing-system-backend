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
    HEALTH_URL   = 'http://127.0.0.1:3000/auth/healthCheck'
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

    stage('Deploy') {
      steps {
        // The app container runs scripts/migrate.js (db/script.sql) before it starts.
        sh '$COMPOSE up -d --remove-orphans'
      }
    }

    stage('Health check') {
      steps {
        sh '''
          for i in $(seq 1 30); do
            if curl -fsS "$HEALTH_URL" >/dev/null; then
              echo "Backend is healthy."
              exit 0
            fi
            echo "Waiting for backend ($i/30)..."
            sleep 3
          done
          echo "Backend did not become healthy in time."
          exit 1
        '''
      }
    }
  }

  post {
    failure {
      sh '$COMPOSE ps || true'
      sh '$COMPOSE logs --tail=150 app || true'
    }
    always {
      sh 'docker image prune -f >/dev/null || true'
    }
  }
}
