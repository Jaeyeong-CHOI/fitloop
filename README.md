# FitLoop (핏루프) — 1인 셀러를 위한 AI 마케터 · GRAFFITI 2026 데모

옷 사진 한 장을 받으면 ① 가상 피팅으로 착용샷 광고 시안을 대량 생성하고 ② 인스타/네이버에
소액 분산 집행한 뒤 ③ 성과 좋은 시안은 변형 증식, 나쁜 시안은 자동 오프하며 예산을
재배분하는 루프를 자동화하는 서비스의 발표용 데모 웹앱입니다.

현재 프로덕션 프론트엔드는 GitHub Pages에서 제공하고, 업로드·캠페인 저장·Gemini 생성 API는
맥미니의 `fitloop-api.jaeyeong2026.com` 백엔드가 담당합니다. Gemini 키는 macOS Keychain에서
런타임에만 읽으며 GitHub 저장소나 브라우저 번들에는 포함하지 않습니다.
**예산 배분 알고리즘(톰슨 샘플링)은 실제로 계산**됩니다. Powered by Fliption Virtual Try-on.

프로덕션: <https://fitloop.jaeyeong2026.com>

## 실행법

```bash
npm install
npm run dev:server # 백엔드: http://127.0.0.1:5202
npm run dev        # 프론트: http://localhost:5173
```

프로덕션 빌드 확인:

```bash
npm run build
npm start          # 빌드 결과와 API를 함께 제공
npm run test:api
npm run qa:ui
```

## 서버 환경변수

`.env.example`을 `.env`로 복사하고 값을 채웁니다. API 키는 브라우저 번들이나 API 응답에
노출되지 않습니다.

```bash
GEMINI_API_KEY=...
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
FITLOOP_DAILY_GENERATION_LIMIT=30
COUPANG_PARTNERS_ACCESS_KEY=...
COUPANG_PARTNERS_SECRET_KEY=...
```

키가 없을 때는 업로드·캠페인 저장·데모 흐름은 정상 동작하고, Gemini 생성 버튼만 비활성화됩니다.

## GitHub Pages 배포

`main` 브랜치에 push하면 `.github/workflows/pages.yml`이 GitHub Pages용 프론트엔드를
빌드하고 배포합니다. 빌드에는 비밀값이 아닌 API 주소만 포함되며, Gemini 키는 맥미니
Keychain에만 저장됩니다. API가 일시적으로 연결되지 않으면 사용자에게 오류를 표시합니다.

새 Gemini 키는 채팅이나 파일에 붙여넣지 않고 맥미니 터미널에서 다음 스크립트로 숨김 입력합니다.

```bash
./scripts/install-gemini-key.sh
```

스크립트는 키를 `fitloop-gemini-api-key`라는 macOS Keychain 항목으로 저장하고 API 서비스를
재시작합니다. 공개된 적이 있는 키는 먼저 Google AI Studio에서 폐기한 뒤 새 키를 사용합니다.

쿠팡 링크 지원은 쿠팡의 서버 자동 접근 차단 때문에 공식 파트너스 API를 사용합니다. 파트너스에서
발급한 Access Key와 Secret Key는 채팅에 올리지 말고 맥미니에서 아래 스크립트로 저장합니다.

```bash
./scripts/install-coupang-keys.sh
```

## 백엔드 API

- `GET /api/health` — 서버 및 Gemini 설정 상태
- `POST /api/products` — 파일 업로드 또는 공개 URL의 상품 이미지 저장
- `POST /api/creatives/generate` — Gemini 착용 시안 생성 및 저장
- `POST /api/campaigns` — 캠페인 설정과 생성 시안 연결

저장 데이터는 `data/` 아래에 기록되며 Git에는 포함되지 않습니다. 구매 페이지 URL을 넣으면
Open Graph, Product JSON-LD, Twitter Card, 동적 스크립트, 대표/지연 로딩 이미지, CSS 배경
순으로 후보를 찾아 첫 번째 유효한 JPG·PNG·WebP 이미지와 상품명·가격을 저장합니다. 쿠팡 상품 및 단축 링크는
공식 파트너스 API 검색 결과에서 URL의 상품 번호와 정확히 일치하는 상품만 선택합니다. 모든 리다이렉트 단계에서 사설 IP 접근을 다시
차단하고, 업로드 및 원격 이미지는 8MB로 제한합니다. 로그인·캡차가 필요하거나 브라우저에서
자바스크립트를 실행해야만 이미지가 나타나는 쇼핑몰은 가져오기가 제한될 수 있습니다.

### 발표 리허설 팁

- `?step=4` 처럼 URL 파라미터로 특정 단계로 바로 진입할 수 있습니다 (1~4).
- `?step=4&day=7` 로 대시보드의 특정 일자를 바로 볼 수 있습니다 (1~7).

## 화면 구성 (4단계 위저드)

1. **상품 입력** — 스마트스토어 URL 또는 이미지 드롭 → 1.5초 분석 연출 → 상품 카드
   ("데일리 크롭 니트 가디건", 32,900원)
2. **광고 시안 생성** — 모델 4종 × 배경 3종 × 카피 2종 = 24개 시안 그리드 (순차 페이드인)
3. **집행 설정** — 일 예산 슬라이더(1~5만 원) · 타겟 칩 · 채널 토글
4. **성과 대시보드** — 7일 타임랩스 재생: KPI 타일 / ROAS 추이 차트 / 시안별 예산 배분 /
   시안 현황 미니뷰 / 이번 주 성적표

## 광고 시안 이미지 교체법 (Fliption 실제 생성 이미지로)

`/public/creatives/` 폴더에 `c01.jpg` ~ `c24.jpg` 파일을 넣으면 플레이스홀더 대신
**해당 이미지가 자동으로 우선 사용**됩니다. 파일이 없으면 듀오톤 배경 + 실루엣
플레이스홀더가 그려집니다.

- 번호 규칙: 모델(캐주얼→스트릿→오피스→플러스) × 배경(스튜디오→카페→스트릿) × 카피(A→B)
  순서. 즉 `c01`=캐주얼·스튜디오·A, `c02`=캐주얼·스튜디오·B, … `c10`=스트릿·카페·B, …
  `c24`=플러스·스트릿·B
- 권장 비율 3:4 (세로형). 파생 시안(v1~v3)은 부모 시안의 이미지를 공유합니다.

## 시뮬레이션 로직 요약 (`src/lib/simulate.ts`)

"시뮬레이션이지만 알고리즘은 실제"가 포인트입니다.

- **숨은 실제 성과**: 24개 시안에 true CTR 0.3%~2.8%를 하드코딩 (소수 승자 구조,
  `src/lib/creatives.ts`의 `CTR_TABLE`). CVR은 CTR과 약한 양의 상관.
- **톰슨 샘플링**: 시안별 클릭 성과를 Beta(1+클릭, 1+노출−클릭) 사후분포로 유지하고,
  매일 500회 샘플 대결의 승률로 예산 점유율을 결정 (활성 시안당 최소 점유율 보장으로
  탐색 유지).
- **판정 규칙**: Day 1은 균등 분산(탐색) → Day 3 종료 시 관측 CTR 하위 30% 자동 오프 →
  Day 4부터 관측 ROAS 기반 추가 오프 + 상위 시안의 **변형 3종 증식** (Day 4·5, 부모의
  관측 성과를 축소해 사전분포로 상속).
- **광고 피로도**: 한 시안에 예산이 몰릴수록 효과 CTR이 감쇠 — 승자 독식 폭주를 막는
  현실적 장치이자 밴딧이 균형점을 찾게 하는 메커니즘.
- **재현성**: 모든 난수는 시드 고정 mulberry32(`src/lib/prng.ts`). 기본 시드 137은
  "Day 1 ROAS ≈ 0.8x → Day 7 ≈ 2.1x 단조 상승, 베스트 시안 = 스트릿×카페×카피B 계열"
  조건을 예산 1~5만 원 전 구간에서 만족하도록 시드 스캔으로 선정했습니다.
- 매출은 기대 전환 기반(+소폭 노이즈)으로 계산해, 소액 집행에서 정수 전환의 산탄
  노이즈를 걷어내고 예산 재배분 역학이 그래프에 그대로 드러나게 했습니다.

## 스택

Vite · React 19 · TypeScript · Tailwind CSS v4 · Recharts

디자인 토큰은 fliption.co.kr 기준: 텍스트 `#030712`, 보더 `#e5e7eb`, 액센트 `#f97316`,
Inter Tight + Pretendard.
