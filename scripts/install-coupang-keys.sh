#!/bin/zsh

set -eu

read -s "access_key?쿠팡 파트너스 Access Key: "
printf '\n'
read -s "secret_key?쿠팡 파트너스 Secret Key: "
printf '\n'

if [[ -z "$access_key" || -z "$secret_key" ]]; then
  echo '키가 비어 있어 변경하지 않았습니다.'
  exit 1
fi

/usr/bin/security add-generic-password -a fitloop -s fitloop-coupang-access-key -w "$access_key" -T /usr/bin/security -U >/dev/null
/usr/bin/security add-generic-password -a fitloop -s fitloop-coupang-secret-key -w "$secret_key" -T /usr/bin/security -U >/dev/null

unset access_key secret_key
/bin/launchctl kickstart -k "gui/$(id -u)/ai.openclaw.fitloop-api"
echo '쿠팡 파트너스 키 Keychain 저장과 FitLoop API 재시작이 완료됐습니다.'
