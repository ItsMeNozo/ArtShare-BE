#!/bin/sh

# Exit immediately if a command exits with a non-zero status.
set -e

# Check if TRANSFORMERS_CACHE is set. If not, set it to the default /app/.cache
# This is the core logic. It uses the value of the variable if it exists,
# otherwise it uses the value after `:-`.
export TRANSFORMERS_CACHE=${TRANSFORMERS_CACHE:-/app/.cache}

# Log the value being used for easier debugging.
echo "[entrypoint.sh] Using TRANSFORMERS_CACHE: ${TRANSFORMERS_CACHE}"

# --- Run Prisma migrations before starting the app ---
echo "[entrypoint.sh] Running database migrations..."
npx prisma migrate deploy
echo "[entrypoint.sh] Migrations complete."

# Execute the command passed to the script (e.g., the Dockerfile's CMD)
# The 'exec' command replaces the shell process with the new process,
# which is important for signal handling (like SIGTERM/SIGINT).
echo "[entrypoint.sh] Starting application..."
exec "$@"