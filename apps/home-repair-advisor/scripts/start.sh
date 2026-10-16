#!/bin/sh
set -eu
# Optional owner convenience; npm start itself uses environment variables only.
if [ -n "${PERSONA_KEYS_FILE:-}" ]; then
  . "$PERSONA_KEYS_FILE"
elif [ -z "${OPENAI_API_KEY:-}" ] && [ -f "$HOME/.api-keys" ]; then
  . "$HOME/.api-keys"
fi
exec node "$(dirname "$0")/../src/server.mjs"
