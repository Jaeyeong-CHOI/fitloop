import { CREATIVES } from '../lib/creatives.ts'

export interface CampaignSettings {
  dailyBudget: number
  gender: string
  ages: string[]
  channels: Record<string, boolean>
}

interface Props {
  settings: CampaignSettings
  onChange: (s: CampaignSettings) => void
  onNext: () => void
}

const GENDERS = ['여성', '남성', '전체']
const AGES = ['18–24', '25–34', '35–44', '45+']

const CHANNELS: { key: string; name: string; sub: string; disabled?: boolean }[] = [
  { key: 'instagram', name: 'Instagram', sub: '릴스 · 피드' },
  { key: 'facebook', name: 'Facebook', sub: '피드' },
  { key: 'naver', name: '네이버 GFA', sub: '스마트채널 · 배너' },
  { key: 'google', name: 'Google Ads', sub: '로드맵', disabled: true },
]

function Toggle({ on, disabled }: { on: boolean; disabled?: boolean }) {
  return (
    <span
      className={`relative inline-block h-6 w-10 shrink-0 rounded-full transition-colors ${
        disabled ? 'bg-gray-200' : on ? 'bg-brand' : 'bg-gray-300'
      }`}
      aria-hidden
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
          on && !disabled ? 'left-[18px]' : 'left-0.5'
        }`}
      />
    </span>
  )
}

export default function Step3Campaign({ settings, onChange, onNext }: Props) {
  const { dailyBudget, gender, ages, channels } = settings
  const perCreative = Math.round(dailyBudget / CREATIVES.length / 10) * 10
  const fillPct = ((dailyBudget - 10000) / 40000) * 100

  const toggleAge = (a: string) => {
    const next = ages.includes(a) ? ages.filter((x) => x !== a) : [...ages, a]
    if (next.length > 0) onChange({ ...settings, ages: next })
  }

  return (
    <div className="animate-fade-up mx-auto max-w-2xl pt-8 pb-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">얼마로, 누구에게 보여줄까요?</h2>
        <p className="mt-2 text-sm leading-relaxed break-keep text-sub">
          예산과 광고 타겟을 먼저 정한 뒤, 다음 단계에서 고객이 공감할 가상 모델을 선택합니다.
          생성된 24종 중 성과가 좋은 조합에 예산을 자동으로 몰아줍니다.
        </p>
      </div>

      <div className="space-y-4">
        {/* 예산 */}
        <section className="rounded-card border border-line bg-white p-6 shadow-soft sm:p-7">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">일 예산</h3>
            <p className="text-xl font-bold tracking-tight text-brand-deep">
              {dailyBudget.toLocaleString('ko-KR')}
              <span className="ml-0.5 text-sm font-medium text-sub">원/일</span>
            </p>
          </div>
          <input
            type="range"
            min={10000}
            max={50000}
            step={5000}
            value={dailyBudget}
            onChange={(e) => onChange({ ...settings, dailyBudget: Number(e.target.value) })}
            className="fl-range mt-5 w-full"
            style={{ ['--fill' as string]: `${fillPct}%` }}
            aria-label="일 예산"
          />
          <div className="mt-2 flex justify-between text-[11px] text-faint">
            <span>1만 원</span>
            <span>3만 원</span>
            <span>5만 원</span>
          </div>
        </section>

        {/* 타겟 */}
        <section className="rounded-card border border-line bg-white p-6 shadow-soft sm:p-7">
          <h3 className="text-sm font-semibold">타겟</h3>
          <div className="mt-4 space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium text-faint">성별</p>
              <div className="flex flex-wrap gap-2">
                {GENDERS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => onChange({ ...settings, gender: g })}
                    className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      gender === g
                        ? 'bg-ink text-white'
                        : 'border border-line bg-white text-sub hover:border-gray-300'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-faint">연령 (복수 선택)</p>
              <div className="flex flex-wrap gap-2">
                {AGES.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAge(a)}
                    className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      ages.includes(a)
                        ? 'bg-ink text-white'
                        : 'border border-line bg-white text-sub hover:border-gray-300'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 채널 */}
        <section className="rounded-card border border-line bg-white p-6 shadow-soft sm:p-7">
          <h3 className="text-sm font-semibold">채널</h3>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {CHANNELS.map((ch) => {
              const on = channels[ch.key]
              return (
                <div key={ch.key} className="group/ch relative">
                  <button
                    type="button"
                    disabled={ch.disabled}
                    onClick={() =>
                      !ch.disabled &&
                      onChange({ ...settings, channels: { ...channels, [ch.key]: !on } })
                    }
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                      ch.disabled
                        ? 'cursor-default border-line bg-gray-50/70'
                        : on
                          ? 'cursor-pointer border-brand-mid bg-brand-soft/60'
                          : 'cursor-pointer border-line bg-white hover:border-gray-300'
                    }`}
                  >
                    <span>
                      <span
                        className={`block text-sm font-semibold ${ch.disabled ? 'text-faint' : 'text-ink'}`}
                      >
                        {ch.name}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-faint">{ch.sub}</span>
                    </span>
                    <Toggle on={on} disabled={ch.disabled} />
                  </button>
                  {ch.disabled && (
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 w-52 -translate-x-1/2 rounded-xl bg-ink px-3 py-2 text-center text-[11px] leading-relaxed text-white opacity-0 shadow-lift transition-opacity duration-150 group-hover/ch:opacity-100"
                    >
                      로드맵에 있어요 — 검색·쇼핑 광고는 다음 분기에 열립니다.
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* 요약 + CTA */}
      <div className="mt-8 rounded-card border border-line bg-gray-50/80 px-6 py-5 text-center">
        <p className="text-sm break-keep text-sub">
          다음 단계에서 모델을 고르면 <span className="font-semibold text-ink">{CREATIVES.length}개 시안</span>에
          예산을 자동 분산합니다 · 시안당 하루 약{' '}
          <span className="font-semibold text-ink">{perCreative.toLocaleString('ko-KR')}원</span>
        </p>
        <p className="mt-1 text-xs text-faint">성과에 따라 배분은 매일 자동으로 달라져요.</p>
      </div>
      <div className="mt-6 flex justify-center pb-4">
        <button
          type="button"
          onClick={onNext}
          className="cursor-pointer rounded-full bg-brand px-10 py-4 text-[15px] font-semibold text-white shadow-soft transition-all hover:bg-brand-deep"
        >
          모델 고르러 가기 →
        </button>
      </div>
    </div>
  )
}
