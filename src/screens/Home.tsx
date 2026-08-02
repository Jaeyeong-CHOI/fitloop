interface Props {
  onStartDemo: () => void
}

const DECK_URL = '/presentations/fitloop-presentation.pdf'
const POSTER_URL = '/presentations/fitloop-a2-poster.pdf'

const proofPoints = [
  {
    index: '01',
    title: '현장에서 타깃을 좁혔습니다',
    description:
      '모든 패션 셀러가 아니라, 룩북과 전담 마케터가 없는 1~5인 셀러의 문제에 집중했습니다.',
  },
  {
    index: '02',
    title: '생성보다 성과를 팔기로 했습니다',
    description:
      '이미지 생성량이 아니라 CTR·전환·ROAS를 읽고 다음 행동을 추천하는 제품으로 방향을 바꿨습니다.',
  },
  {
    index: '03',
    title: '소비자 선택으로 루프를 검증했습니다',
    description:
      '171회의 응답에서 저성과 시안을 승자 변형으로 교체했고, 교체 슬롯의 순수 상승 효과를 확인했습니다.',
  },
]

const loopSteps = [
  ['01', '상품 입력', '사진 한 장 또는 상품 URL'],
  ['02', '브랜드 설정', '모델 · 타깃 · 배경 선택'],
  ['03', '시안 구성', '예시 착용샷 12종 비교'],
  ['04', '성과 판정', '승자 증식 · 패자 중단'],
]

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 8h10m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ExternalIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M6 3H3.8A.8.8 0 0 0 3 3.8v8.4a.8.8 0 0 0 .8.8h8.4a.8.8 0 0 0 .8-.8V10M9 3h4v4m0-4L7.5 8.5" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Home({ onStartDemo }: Props) {
  return (
    <div className="overflow-hidden">
      <section className="relative border-b border-line">
        <div className="portfolio-grid absolute inset-0 opacity-70" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:py-24">
          <div className="animate-fade-up">
            <div className="mb-7 flex flex-wrap items-center gap-3 text-[11px] font-semibold tracking-[0.18em] text-sub">
              <span className="text-brand">GRAFFITI 2026</span>
              <span className="h-3 w-px bg-line" />
              <span>TEAM 13 · PRODUCT CASE STUDY</span>
            </div>
            <h1 className="max-w-3xl text-[45px] leading-[0.98] font-bold tracking-[-0.045em] break-keep text-ink sm:text-6xl lg:text-[72px]">
              광고 이미지를 만들고,
              <br />
              <span className="text-brand">반응으로 다시 고릅니다.</span>
            </h1>
            <p className="mt-7 max-w-xl text-[16px] leading-7 break-keep text-sub sm:text-lg">
              FitLoop는 제품 사진 한 장에서 광고 시안 12종을 구성하고, 성과가 좋은 조합에
              예산을 옮기는 1~5인 패션 셀러용 마케팅 루프입니다.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onStartDemo}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-gray-800"
              >
                프로토타입 체험 <ArrowIcon />
              </button>
              <a
                href="#presentations"
                className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-6 py-3.5 text-sm font-semibold text-ink transition-all hover:border-gray-300 hover:bg-gray-50"
              >
                발표자료 보기 ↓
              </a>
            </div>

            <dl className="mt-12 grid max-w-2xl grid-cols-3 border-y border-line py-5">
              <div>
                <dt className="text-[10px] font-semibold tracking-[0.16em] text-faint">CREATIVES</dt>
                <dd className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">12종</dd>
              </div>
              <div className="border-l border-line pl-5 sm:pl-8">
                <dt className="text-[10px] font-semibold tracking-[0.16em] text-faint">AUTO LOOP</dt>
                <dd className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">7일</dd>
              </div>
              <div className="border-l border-line pl-5 sm:pl-8">
                <dt className="text-[10px] font-semibold tracking-[0.16em] text-faint">SWAP EFFECT</dt>
                <dd className="mt-1 text-2xl font-bold tracking-tight text-brand sm:text-3xl">+17.8%p</dd>
              </div>
            </dl>
          </div>

          <div className="animate-fade-in relative mx-auto w-full max-w-xl lg:max-w-none">
            <div className="absolute -top-5 -right-4 z-10 rounded-full bg-blue-900 px-4 py-2 text-[10px] font-semibold tracking-[0.13em] text-white shadow-lift sm:right-5">
              CONSUMER-TESTED
            </div>
            <div className="rotate-[1.4deg] rounded-[2rem] bg-[#111827] p-3 shadow-[0_30px_80px_rgba(3,7,18,0.18)] sm:p-4">
              <div className="grid grid-cols-4 gap-2 overflow-hidden rounded-[1.3rem] bg-white p-2 sm:gap-3 sm:p-3">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((number) => (
                  <img
                    key={number}
                    src={`/creatives/c${String(number).padStart(2, '0')}.jpg`}
                    alt={number === 1 ? 'FitLoop 예시 광고 시안 모음' : ''}
                    width="240"
                    height="320"
                    loading="eager"
                    decoding="async"
                    className="aspect-[3/4] w-full rounded-lg object-cover"
                  />
                ))}
              </div>
              <div className="flex items-center justify-between px-2 pt-3 pb-1 text-[10px] font-medium tracking-wide text-gray-300 sm:text-xs">
                <span>MODEL × POSE × BACKGROUND</span>
                <span className="text-orange-400">12 VARIATIONS</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="project" className="mx-auto max-w-7xl px-5 py-20 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-brand">WHY FITLOOP</p>
            <h2 className="mt-4 text-3xl leading-tight font-bold tracking-tight break-keep sm:text-5xl">
              생성에서 끝내지 않고,
              <br />검증으로 닫았습니다.
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-7 break-keep text-sub">
              처음의 아이디어는 ‘AI 착용샷 생성기’였습니다. 현장 인터뷰와 소비자 반응 조사를
              거치며, 광고 성과를 학습해 다음 소재를 고르는 루프로 제품을 다시 설계했습니다.
            </p>
          </div>
          <div className="divide-y divide-line border-y border-line">
            {proofPoints.map((point) => (
              <article key={point.index} className="grid gap-3 py-7 sm:grid-cols-[48px_0.8fr_1.2fr] sm:items-start sm:gap-6">
                <span className="text-xs font-semibold text-brand">{point.index}</span>
                <h3 className="text-lg font-semibold tracking-tight break-keep">{point.title}</h3>
                <p className="text-sm leading-6 break-keep text-sub">{point.description}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-20 rounded-[2rem] bg-[#0d1b36] p-7 text-white sm:p-10 lg:p-12">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-orange-400">AUTOMATED LOOP</p>
              <h3 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">사람은 승인만, 나머지는 도는 구조</h3>
            </div>
            <span className="text-xs text-blue-200">예시 데모 또는 브라우저 BYOK 실생성으로 체험 가능</span>
          </div>
          <ol className="mt-9 grid gap-px overflow-hidden rounded-2xl bg-white/15 sm:grid-cols-2 lg:grid-cols-4">
            {loopSteps.map(([number, title, description], index) => (
              <li key={number} className="relative bg-[#0d1b36] p-6">
                <span className="text-xs font-semibold text-orange-400">{number}</span>
                <p className="mt-7 text-base font-semibold">{title}</p>
                <p className="mt-1 text-xs leading-5 text-blue-200">{description}</p>
                {index < loopSteps.length - 1 && (
                  <span className="absolute top-6 right-5 hidden text-white/30 lg:block" aria-hidden>→</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="presentations" className="border-y border-line bg-[#f7f7f5]">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:py-28">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold tracking-[0.16em] text-brand">PROJECT ARCHIVE</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">발표 자료</h2>
            </div>
            <p className="max-w-md text-sm leading-6 break-keep text-sub">
              문제 정의부터 현장 검증, 제품 구조와 소비자 반응 조사까지 프로젝트의 전체 과정을 담았습니다.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
            <a
              href={DECK_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="group overflow-hidden rounded-[1.75rem] border border-line bg-white shadow-soft transition-all hover:-translate-y-1 hover:shadow-lift"
            >
              <div className="overflow-hidden border-b border-line bg-[#f4f1ec]">
                <img
                  src="/presentations/fitloop-deck-cover.webp"
                  alt="FitLoop 발표 덱 표지"
                  width="1200"
                  height="675"
                  loading="lazy"
                  decoding="async"
                  className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-[1.015]"
                />
              </div>
              <div className="flex items-end justify-between gap-5 p-6 sm:p-7">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.16em] text-brand">PRESENTATION DECK · 15 PAGES</p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">소비자 선택 기반 이미지 자동화 증명</h3>
                  <p className="mt-2 text-sm text-sub">가설 · 현장 인터뷰 · 제품 피벗 · 반응 조사 · 사업 모델</p>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-ink transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-white">
                  <ExternalIcon />
                </span>
              </div>
            </a>

            <a
              href={POSTER_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="group overflow-hidden rounded-[1.75rem] border border-line bg-white shadow-soft transition-all hover:-translate-y-1 hover:shadow-lift"
            >
              <div className="h-[340px] overflow-hidden border-b border-line bg-white sm:h-[430px] lg:h-[360px]">
                <img
                  src="/presentations/fitloop-poster-cover.webp"
                  alt="FitLoop A2 부스 포스터"
                  width="1324"
                  height="1873"
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.015]"
                />
              </div>
              <div className="flex items-end justify-between gap-4 p-6 sm:p-7">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.16em] text-brand">EXHIBITION POSTER · A2</p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight">FitLoop 부스 포스터</h3>
                  <p className="mt-2 text-sm text-sub">한 장으로 보는 제품과 검증 결과</p>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-ink transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-white">
                  <ExternalIcon />
                </span>
              </div>
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:py-28">
        <div className="grid gap-10 rounded-[2rem] border border-line bg-white p-8 shadow-soft sm:p-12 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-brand">INTERACTIVE PROTOTYPE</p>
            <h2 className="mt-4 max-w-2xl text-3xl leading-tight font-bold tracking-tight break-keep sm:text-5xl">
              제품 사진부터 7일 성과 리포트까지 직접 확인해 보세요.
            </h2>
            <p className="mt-5 text-sm text-sub">API 키 없이 예시 이미지로 둘러보거나, 개인 Gemini 키를 브라우저에 연결해 실제 시안을 생성할 수 있습니다.</p>
          </div>
          <button
            type="button"
            onClick={onStartDemo}
            className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-full bg-brand px-7 py-4 text-sm font-semibold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:bg-brand-deep"
          >
            데모 시작하기 <ArrowIcon />
          </button>
        </div>
        <div className="mt-8 flex flex-col justify-between gap-3 text-xs text-faint sm:flex-row">
          <span>TEAM 13 · 문경란 · 양병준 · 박상원 · 지현우 · 최재영</span>
          <span>ICISTS GRAFFITI 2026: TECH STARTUP</span>
        </div>
      </section>
    </div>
  )
}
