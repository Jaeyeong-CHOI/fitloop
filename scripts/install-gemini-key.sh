#!/bin/zsh

set -eu

read -s "key?새 Gemini API 키: "
printf '\n'

if [[ -z "$key" ]]; then
  echo '키가 비어 있어 변경하지 않았습니다.'
  exit 1
fi

/usr/bin/security add-generic-password \
  -a fitloop \
  -s fitloop-gemini-api-key \
  -w "$key" \
  -T /usr/bin/security \
  -U >/dev/null

unset key
/bin/launchctl kickstart -k "gui/$(id -u)/ai.openclaw.fitloop-api"
echo 'Keychain 저장과 FitLoop API 재시작이 완료됐습니다.'
