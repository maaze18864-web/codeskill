#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${PROJECT_DOCKER_CONTEXT:?Set the dedicated project Docker context}"
docker --context "$PROJECT_DOCKER_CONTEXT" info >/dev/null
docker --context "$PROJECT_DOCKER_CONTEXT" build --pull -t "${PROJECT_RUNTIME_IMAGE:-codeskill-project-runtime:local}" deployment/projects/runtime
