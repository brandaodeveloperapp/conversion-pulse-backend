#!/usr/bin/env bash
#
# Manual production deploy for conversion-pulse.
#
# Cross-builds a linux/amd64 image locally, ships it to the k3s VPS over SSH,
# imports it straight into containerd, applies the production overlay and waits
# for the rollout. No registry is involved: the image never leaves the two
# machines that need it.
#
# Usage:
#   ./deploy.sh                      # builds + deploys current HEAD
#   VPS=user@host ./deploy.sh        # override the SSH target
#
set -euo pipefail

VPS="${VPS:-rainhadoatacado-prod}"
IMAGE="conversion-pulse/api"
SHA="$(git rev-parse --short HEAD)"
TAR="/tmp/conversion-pulse-api.tar.gz"
REMOTE_DIR="/opt/conversion-pulse"
NODE_PORT="30983"
SMOKE_URL="http://localhost:${NODE_PORT}/health"

if [ -n "$(git status --porcelain)" ]; then
  echo "!! working tree is dirty — commit or stash before deploying" >&2
  exit 1
fi

echo "==> Building ${IMAGE}:${SHA} (linux/amd64)"
docker buildx build --platform linux/amd64 --load -t "${IMAGE}:${SHA}" .

echo "==> Saving + compressing image"
docker save "${IMAGE}:${SHA}" | gzip > "${TAR}"

echo "==> Uploading image + manifests to ${VPS}"
ssh "${VPS}" "mkdir -p ${REMOTE_DIR}/images ${REMOTE_DIR}/infra/k8s ${REMOTE_DIR}/db"
scp -q "${TAR}" "${VPS}:${REMOTE_DIR}/images/conversion-pulse-api.tar.gz"
rsync -az --delete infra/k8s/ "${VPS}:${REMOTE_DIR}/infra/k8s/"
# The repo is private and the server holds no git credential, so the schema and
# post-load scripts travel over the same channel as the manifests.
rsync -az --delete db/ "${VPS}:${REMOTE_DIR}/db/"
rm -f "${TAR}"

echo "==> Deploying on k3s"
ssh -o ServerAliveInterval=30 -o ServerAliveCountMax=20 "${VPS}" "GIT_SHA='${SHA}' bash -s" <<'EOF'
set -euo pipefail
previous="$(kubectl -n conversion-pulse get deploy cpulse-api -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || true)"

gunzip -c /opt/conversion-pulse/images/conversion-pulse-api.tar.gz | k3s ctr images import -
rm -f /opt/conversion-pulse/images/conversion-pulse-api.tar.gz

cd /opt/conversion-pulse
sed -i -E "s|newTag: \"[^\"]+\"|newTag: \"${GIT_SHA}\"|" infra/k8s/overlays/production/kustomization.yaml
kubectl apply -k infra/k8s/overlays/production/
kubectl -n conversion-pulse rollout status deployment/cpulse-api --timeout=300s
kubectl -n conversion-pulse rollout status deployment/cpulse-worker --timeout=300s

# Drop the image the previous release ran on, keeping containerd from growing
# one image per deploy forever.
if [ -n "${previous}" ] && [ "${previous}" != "conversion-pulse/api:${GIT_SHA}" ]; then
  k3s ctr images rm "docker.io/${previous}" >/dev/null 2>&1 || true
fi
EOF

echo "==> Smoke test ${SMOKE_URL}"
for i in 1 2 3 4 5 6; do
  STATUS="$(ssh "${VPS}" "curl -s -o /dev/null -w '%{http_code}' ${SMOKE_URL}" || true)"
  echo "    attempt ${i}: HTTP ${STATUS}"
  if [ "${STATUS}" = "200" ]; then
    echo "==> Deploy OK (${IMAGE}:${SHA})"
    exit 0
  fi
  sleep 10
done

echo "!! Smoke test failed — rolling back" >&2
ssh "${VPS}" bash -s <<'ROLLBACK'
set -e
kubectl -n conversion-pulse rollout undo deployment/cpulse-api
kubectl -n conversion-pulse rollout undo deployment/cpulse-worker
kubectl -n conversion-pulse rollout status deployment/cpulse-api --timeout=180s
ROLLBACK
exit 1
