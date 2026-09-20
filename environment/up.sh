#!/usr/bin/env bash
# Build the pinned image and start the isolated stack. Bound to 127.0.0.1 only.
set -euo pipefail
cd "$(dirname "$0")"

: "${GITHUB_TOKEN:?set GITHUB_TOKEN with read access to the WeConnect backend repositories}"

# frappe_docker supplies the build context and the custom Containerfile. It is upstream code, not
# ours, so it is not vendored into this repository — it is cloned here at a pinned commit so the
# build is reproducible. Without this step the docker build below has no Containerfile.
FRAPPE_DOCKER_REF=c74f28db98fde650612d02a5353177a9c2df4f34
if [ ! -d frappe_docker ]; then
  echo "Cloning frappe_docker at ${FRAPPE_DOCKER_REF}..."
  git clone --quiet https://github.com/frappe/frappe_docker.git frappe_docker
fi
git -C frappe_docker fetch --quiet origin "${FRAPPE_DOCKER_REF}" 2>/dev/null || git -C frappe_docker fetch --quiet origin
git -C frappe_docker checkout --quiet "${FRAPPE_DOCKER_REF}"

# apps.json is built from apps.example.json with the token injected for the private repositories.
python3 - "$GITHUB_TOKEN" <<'PY'
import json, sys
token = sys.argv[1]
apps = json.load(open("apps.example.json"))
for a in apps:
    if "<org>" in a["url"]:
        a["url"] = a["url"].replace("https://github.com/", f"https://x-access-token:{token}@github.com/").replace("<org>", "Lighthouse-Communities-Foundation")
json.dump(apps, open("apps.json", "w"))
PY

docker build \
  --build-arg PYTHON_VERSION=3.11 --build-arg NODE_VERSION=22 --build-arg DEBIAN_BASE=bookworm \
  --build-arg FRAPPE_BRANCH=v15.113.2 --build-arg FRAPPE_PATH=https://github.com/frappe/frappe \
  --secret id=apps_json,src=apps.json \
  --tag weconnect-qa:15 --file frappe_docker/images/custom/Containerfile \
  frappe_docker

docker compose up -d db redis-cache redis-queue
until [ "$(docker compose ps db --format '{{.Health}}')" = "healthy" ]; do sleep 3; done
docker compose up -d backend
docker compose up configurator
docker compose exec -T backend bench new-site qa.localhost \
  --mariadb-root-password qa_only_local --admin-password qa_admin_local --mariadb-user-host-login-scope='%'
for app in erpnext insights authentication youth_skilling centre_head \
           facilitator_and_counsellor outreach batch_management youth_placement event_management; do
  docker compose exec -T backend bench --site qa.localhost install-app "$app"
done
docker compose up -d
echo "Isolated stack ready at http://127.0.0.1:8080 (Host: qa.localhost)."
