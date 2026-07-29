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

coupang_access_key=$(/usr/bin/security find-generic-password \
  -a fitloop \
  -s fitloop-coupang-access-key \
  -w 2>/dev/null || true)
coupang_secret_key=$(/usr/bin/security find-generic-password \
  -a fitloop \
  -s fitloop-coupang-secret-key \
  -w 2>/dev/null || true)

if [[ -n "$coupang_access_key" && -n "$coupang_secret_key" ]]; then
  export COUPANG_PARTNERS_ACCESS_KEY="$coupang_access_key"
  export COUPANG_PARTNERS_SECRET_KEY="$coupang_secret_key"
fi

unset coupang_access_key coupang_secret_key
exec /opt/homebrew/bin/node server.mjs
