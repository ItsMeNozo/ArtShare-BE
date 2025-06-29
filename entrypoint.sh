#!/bin/sh

# Exit immediately if a command exits with a non-zero status.
set -e

# Set up transformers cache directories with fallbacks
export TRANSFORMERS_CACHE=${TRANSFORMERS_CACHE:-/app/.transformers-cache}
export HF_HOME=${HF_HOME:-/app/.transformers-cache}
export HF_DATASETS_CACHE=${HF_DATASETS_CACHE:-/app/.transformers-cache}

# Ensure cache directories exist and are writable
mkdir -p "${TRANSFORMERS_CACHE}" "${HF_HOME}" "${HF_DATASETS_CACHE}"

# Log the values being used for easier debugging.
echo "[entrypoint.sh] Using TRANSFORMERS_CACHE: ${TRANSFORMERS_CACHE}"
echo "[entrypoint.sh] Using HF_HOME: ${HF_HOME}"

# --- Run Prisma migrations before starting the app ---
echo "[entrypoint.sh] Running database migrations..."
npx prisma migrate deploy
echo "[entrypoint.sh] Migrations complete."

# Execute the command passed to the script (e.g., the Dockerfile's CMD)
# The 'exec' command replaces the shell process with the new process,
# which is important for signal handling (like SIGTERM/SIGINT).
echo "[entrypoint.sh] Starting application..."
exec "$@"