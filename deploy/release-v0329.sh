#!/bin/sh
# Run only for the explicitly authorized v0.3.29 release on the existing host.
set -eu
umask 077
cd /opt/dingdong/releases/dingdong-v0.3.29
expected_commit=${1:?pass committed release source}
python3 - "$expected_commit" <<'PY'
import json, sys
from pathlib import Path
marker = json.loads(Path('RELEASE.json').read_text())
assert marker['version'] == '0.3.29' and marker['commit'] == sys.argv[1]
print('Release source', marker['commit'])
PY
export APP_VERSION=0.3.29
compose() {
  docker compose -p dingdong-prod-trial \
    --env-file /opt/dingdong/releases/dingdong-v0.3.10/deploy/.env \
    --env-file /opt/dingdong/shared/aliyun-sms-v0.3.13.env \
    --env-file /opt/dingdong/shared/dingdong-push-v0.3.14.env \
    --env-file /opt/dingdong/shared/dingdong-prototype-v0.3.15.env \
    -f deploy/compose.yml "$@"
}
# Print only identities/start times, never container environment or private data.
printf 'UNCHANGED_BEFORE\n'
docker inspect --format '{{.Name}}|{{.Id}}|{{.State.StartedAt}}' \
  dingdong-prod-trial-postgres-1 dingdong-prod-trial-redis-1 remote-desktop-commander
mkdir -p /opt/dingdong/backups
backup=/opt/dingdong/backups/pre-v0.3.29-20261002.dump
if [ ! -f "$backup" ]; then
  docker exec dingdong-prod-trial-postgres-1 pg_dump -U dingdong -d dingdong -Fc > "$backup.partial"
  docker exec -i dingdong-prod-trial-postgres-1 pg_restore --list < "$backup.partial" > /dev/null
  mv "$backup.partial" "$backup"
fi
chmod 600 "$backup"
docker exec -i dingdong-prod-trial-postgres-1 pg_restore --list < "$backup" > /dev/null
stat -c 'BACKUP %n bytes=%s mode=%a' "$backup"
sha256sum "$backup"
# Preserve previous rollback and both verified old images; no dependency downloads.
docker image inspect --format '{{.RepoTags}}|{{.Id}}' dingdong-backend:0.3.28 dingdong-web:0.3.28
if [ ! -f /opt/dingdong/releases/rollback-before-v0.3.29.sh ]; then
  cp -p /opt/dingdong/releases/rollback.sh /opt/dingdong/releases/rollback-before-v0.3.29.sh
fi
cat > /opt/dingdong/releases/rollback.sh <<'ROLLBACK'
#!/bin/sh
set -eu
umask 077
# Old authentication code cannot compare NULL: preserve grants and revocation.
# Keep the permissive schema; no DB restore, reverse migration, seed or volume deletion.
# Stop every new-code writer first so no refresh/login can create NULL after the UPDATE.
docker stop --time 30 dingdong-prod-trial-web-1 dingdong-prod-trial-api-1 \
  dingdong-prod-trial-worker-1 dingdong-prod-trial-beat-1
docker exec dingdong-prod-trial-postgres-1 psql -U dingdong -d dingdong -v ON_ERROR_STOP=1 \
  -c "UPDATE login_grant SET expires_at = CURRENT_TIMESTAMP + INTERVAL '400 days' WHERE expires_at IS NULL;"
cd /opt/dingdong/releases/dingdong-v0.3.28
export APP_VERSION=0.3.28
docker compose -p dingdong-prod-trial \
  --env-file /opt/dingdong/releases/dingdong-v0.3.10/deploy/.env \
  --env-file /opt/dingdong/shared/aliyun-sms-v0.3.13.env \
  --env-file /opt/dingdong/shared/dingdong-push-v0.3.14.env \
  --env-file /opt/dingdong/shared/dingdong-prototype-v0.3.15.env \
  -f deploy/compose.yml up -d --no-build --no-deps --force-recreate --wait --wait-timeout 90 api worker beat web
printf 'APPLICATION_ROLLBACK_0328_DONE_SCHEMA_RETAINED\n'
ROLLBACK
chmod 700 /opt/dingdong/releases/rollback.sh
sh -n /opt/dingdong/releases/rollback.sh
DOCKER_BUILDKIT=0 docker build -f deploy/Dockerfile.backend.from-v0320 -t dingdong-backend:0.3.29 .
DOCKER_BUILDKIT=0 docker build -f deploy/Dockerfile.web.from-v0320 -t dingdong-web:0.3.29 .
# Exactly one additive migration, via the new app; never use the seed/init service.
compose run --rm --no-deps api python manage.py migrate core 0018 --noinput
compose up -d --no-build --no-deps --force-recreate --wait --wait-timeout 90 api worker beat web
printf 'APPLICATION_AFTER\n'
docker inspect --format '{{.Name}}|{{.Config.Image}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}|{{.State.StartedAt}}' \
  dingdong-prod-trial-api-1 dingdong-prod-trial-worker-1 dingdong-prod-trial-beat-1 dingdong-prod-trial-web-1
printf 'UNCHANGED_AFTER\n'
docker inspect --format '{{.Name}}|{{.Id}}|{{.State.StartedAt}}' \
  dingdong-prod-trial-postgres-1 dingdong-prod-trial-redis-1 remote-desktop-commander
printf 'MIGRATION_AFTER\n'
docker exec dingdong-prod-trial-api-1 python manage.py showmigrations core --plan | tail -3
printf 'RELEASE_0329_COMPLETE_NO_PRODUCTION_FUNCTIONAL_TESTS\n'
