#!/bin/zsh

set -eu

key=$(/usr/bin/security find-generic-password \
  -a fitloop \
  -s fitloop-gemini-api-key \
  -w 2>/dev/null || true)

if [[ -n "$key" ]]; then
  export GEMINI_API_KEY="$key"
fi

unset key
exec /opt/homebrew/bin/node server.mjs
