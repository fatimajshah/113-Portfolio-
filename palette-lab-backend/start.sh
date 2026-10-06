#!/bin/sh
set -eu

# One process keeps the existing rate and concurrency counters shared.
exec gunicorn app:app --bind "0.0.0.0:${PORT:?PORT must be set}" \
  --workers 1 --worker-class gthread --threads 4 \
  --timeout 180 --graceful-timeout 180
