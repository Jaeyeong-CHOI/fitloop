import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { runSimulation, SIM_DAYS, type DayResult, type SimResult } from '../lib/simulate.ts'
import { shortLabel, type Creative } from '../lib/creatives.ts'
import type { GeneratedCreative } from '../lib/types.ts'
import CreativeVisual from '../components/CreativeVisual.tsx'
import InfoTip from '../components/InfoTip.tsx'

interface Props {
  dailyBudget: number
  generated: Record<string, GeneratedCreative>
}

type GeneratedMap = Record<string, GeneratedCreative>

function generatedImageFor(creative: Creative, generated: GeneratedMap): string | undefined {
  return generated[creative.parentId ?? creative.id]?.imageUrl
}

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`

// ── KPI 스탯 타일 ──────────────────────────────────────────────────────────────
function StatTile({
  label,
  value,
  unit,
  delta,
  deltaGood,
  tip,
}: {
  label: string
  value: string
  unit?: string
  delta?: string
  deltaGood?: boolean
  tip?: string
}) {
  return (
    <div className="rounded-card border border-line bg-white px-5 py-4 shadow-soft">
      <p className="flex items-center gap-1.5 text-xs font-medium text-sub">
        {label}
        {tip && <InfoTip text={tip} />}
      </p>
      <p className="mt-1.5 text-[26px] leading-none font-bold tracking-tight">
        {value}
        {unit && <span className="ml-0.5 text-sm font-medium text-sub">{unit}</span>}
      </p>
      <p
        className={`mt-1.5 h-4 text-xs font-medium ${
          delta ? (deltaGood ? 'text-emerald-700' : 'text-faint') : ''
        }`}
      >
        {delta ?? ''}
      </p>
    </div>
  )
}

// ── ROAS 추이 차트 ─────────────────────────────────────────────────────────────
function RoasChart({ sim, day }: { sim: SimResult; day: number }) {
  const data = sim.days.map((d) => ({
    name: `Day ${d.day}`,
    day: d.day,
    roas: d.day <= day ? Number(d.dayRoas.toFixed(2)) : null,
    spend: d.daySpend,
    revenue: d.dayRevenue,
  }))
  const yMax = Math.max(2.5, ...sim.days.map((d) => Math.ceil(d.dayRoas * 2) / 2))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 24, right: 34, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#f3f4f6" strokeWidth={1} />
        <XAxis
          dataKey="name"
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          axisLine={{ stroke: '#e5e7eb' }}
          tickLine={false}
          interval={0}
        />
        <YAxis
          domain={[0, yMax]}
          ticks={Array.from({ length: yMax * 2 + 1 }, (_, i) => i * 0.5)}
          tickFormatter={(v: number) => `${v.toFixed(1)}x`}
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={42}
        />
        <ReferenceLine
          y={1}
          stroke="#d1d5db"
          strokeWidth={1}
          label={{
            value: '손익분기 1.0x',
            position: 'insideBottomRight',
            fill: '#9ca3af',
            fontSize: 10,
          }}
        />
        <Tooltip
          cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length || payload[0].value == null) return null
            const p = payload[0].payload as (typeof data)[number]
            return (
              <div className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs shadow-lift">
                <p className="font-semibold text-ink">{p.name}</p>
                <p className="mt-1 text-sub">
                  ROAS <span className="font-semibold text-ink">{p.roas?.toFixed(2)}x</span>
                </p>
                <p className="text-sub">
                  지출 {won(p.spend)} → 매출 {won(p.revenue)}
                </p>
              </div>
            )
          }}
        />
        <Line
          type="monotone"
          dataKey="roas"
          stroke="#ea580c"
          strokeWidth={2}
          strokeLinecap="round"
          isAnimationActive
          animationDuration={500}
          dot={{ r: 4, fill: '#ea580c', stroke: '#ffffff', strokeWidth: 2 }}
          activeDot={{ r: 5, fill: '#ea580c', stroke: '#ffffff', strokeWidth: 2 }}
          connectNulls={false}
          label={(props: unknown) => {
            const { index, x, y, value } = props as {
              index?: number
              x?: string | number
              y?: string | number
              value?: number | null
            }
            // 마지막 점에만 직접 라벨 (선택적 직접 라벨 원칙)
            if (index !== day - 1 || value == null) return <g />
            return (
              <text
                x={Number(x ?? 0)}
                y={Number(y ?? 0) - 12}
                textAnchor="middle"
                fill="#030712"
                fontSize={12}
                fontWeight={700}
              >
                {Number(value).toFixed(2)}x
              </text>
            )
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── 시안별 예산 배분 바 ────────────────────────────────────────────────────────
function BudgetBars({
  sim,
  dayResult,
  maxShare,
}: {
  sim: SimResult
  dayResult: DayResult
  maxShare: number
}) {
  // 파생 시안을 부모 바로 뒤에 배치 — 가족 단위로 예산이 몰리는 게 한눈에 보이게
  const ordered = useMemo(() => {
    const originals = sim.creatives.filter((c) => !c.parentId)
    return originals.flatMap((o) => [o, ...sim.creatives.filter((c) => c.parentId === o.id)])
  }, [sim])

  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-1 md:grid-cols-2">
      {ordered.map((cr) => {
        const st = dayResult.stats[cr.id]
        if (!st?.exists) return null
        const pct = st.share * 100
        const width = Math.min(100, (st.share / maxShare) * 100)
        const off = !st.active
        return (
          <div key={cr.id} className="flex h-[21px] items-center gap-2.5">
            <span
              className={`w-[104px] shrink-0 truncate text-[11px] ${
                off ? 'text-faint line-through' : 'text-sub'
              }`}
            >
              {shortLabel(cr)}
            </span>
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${
                  off ? 'bg-gray-300' : st.isNew ? 'bg-brand/70' : 'bg-brand'
                }`}
                style={{ width: `${off ? 0 : width}%` }}
              />
            </div>
            <span
              className={`w-11 shrink-0 text-right text-[11px] font-medium tabular-nums ${
                off ? 'text-faint' : 'text-ink'
              }`}
            >
              {off ? '오프' : `${pct.toFixed(1)}%`}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── 시안 그리드 미니뷰 ─────────────────────────────────────────────────────────
function MiniGrid({
  sim,
  day,
  dayResult,
  topId,
  generated,
}: {
  sim: SimResult
  day: number
  dayResult: DayResult
  topId: string
  generated: GeneratedMap
}) {
  const parentsWithVariants = useMemo(() => {
    const set = new Set<string>()
    sim.days.slice(0, day).forEach((d) => d.variantParents.forEach((p) => set.add(p)))
    return set
  }, [sim, day])

  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-10">
      {sim.creatives.map((cr) => {
        const st = dayResult.stats[cr.id]
        if (!st?.exists) return null
        const off = !st.active
        const isTop = cr.id === topId && !off
        const hasVariants = parentsWithVariants.has(cr.id)
        return (
          <div key={cr.id} className="animate-fade-in">
            <div
              className={`relative aspect-[3/4] overflow-hidden rounded-xl border transition-all duration-500 ${
                off
                  ? 'border-line opacity-40 grayscale'
                  : isTop
                    ? 'border-brand shadow-[0_0_0_3px_#ffedd5]'
                    : hasVariants
                      ? 'border-brand-mid'
                      : 'border-line'
              }`}
            >
              <CreativeVisual
                creative={cr}
                size="sm"
                imageUrl={generatedImageFor(cr, generated)}
              />
              {off && (
                <span className="absolute inset-x-0 bottom-0 bg-gray-900/70 py-0.5 text-center text-[9px] font-medium text-white">
                  자동 오프
                </span>
              )}
              {!off && hasVariants && (
                <span className="absolute inset-x-0 bottom-0 bg-brand/90 py-0.5 text-center text-[9px] font-semibold text-white">
                  변형 3종 생성됨
                </span>
              )}
              {!off && st.isNew && cr.parentId && (
                <span className="absolute inset-x-0 bottom-0 bg-ink/80 py-0.5 text-center text-[9px] font-semibold text-white">
                  NEW
                </span>
              )}
            </div>
            <p
              className={`mt-1 truncate text-center text-[10px] ${off ? 'text-faint' : 'text-sub'}`}
            >
              {shortLabel(cr)}
            </p>
          </div>
        )
      })}
    </div>
  )
}

// ── 이번 주 성적표 ─────────────────────────────────────────────────────────────
function WeeklyReport({ sim, generated }: { sim: SimResult; generated: GeneratedMap }) {
  const { best, bestStat, totalSpend, totalRevenue, totalConversions, offCount, variantCount } =
    sim.summary
  const bestName = `${best.model.label} × ${best.background.label}${
    best.variantNo ? ` (변형 v${best.variantNo})` : ''
  }`
  return (
    <section className="animate-fade-up rounded-card border border-brand-mid bg-brand-soft/50 p-6 shadow-soft sm:p-8">
      <div className="mb-5 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-sm text-white">
          ✓
        </span>
        <h3 className="text-lg font-bold tracking-tight">이번 주 성적표</h3>
      </div>
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="w-28 shrink-0">
          <div className="aspect-[3/4] overflow-hidden rounded-2xl border border-brand-mid shadow-soft">
            <CreativeVisual
              creative={best}
              size="sm"
              imageUrl={generatedImageFor(best, generated)}
            />
          </div>
          <p className="mt-2 text-center text-[11px] font-medium text-brand-deep">베스트 시안</p>
        </div>
        <div className="min-w-0 flex-1 space-y-3 text-sm leading-relaxed break-keep">
          <p>
            <span className="font-bold text-ink">베스트 시안: {bestName}</span>
            <span className="text-sub">
              {' '}
              — 시안 ROAS <span className="font-semibold text-ink">
                {bestStat.obsRoas.toFixed(1)}x
              </span>
              . 다음 사입 때 <span className="font-semibold text-ink">{best.model.short} 무드</span>
              를 참고하세요.
            </span>
          </p>
          <p className="text-sub">
            카피는 <span className="font-medium text-ink">“{best.copy.text}”</span> 톤이 잘
            먹혔어요. 배경은 {best.background.label} 컷 반응이 가장 좋았습니다.
          </p>
          <p className="text-sub">
            성과 낮은 시안 <span className="font-medium text-ink">{offCount}종</span>은 자동으로
            꺼서 예산 낭비를 막았고, 잘 되는 시안의 변형{' '}
            <span className="font-medium text-ink">{variantCount}종</span>을 새로 만들어
            테스트했어요.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1.5 border-t border-brand-mid/60 pt-3 text-xs text-sub">
            <span>
              총 지출 <span className="font-semibold text-ink">{won(totalSpend)}</span>
            </span>
            <span>
              총 매출 <span className="font-semibold text-ink">{won(totalRevenue)}</span>
            </span>
            <span>
              전환 <span className="font-semibold text-ink">{Math.round(totalConversions)}건</span>
            </span>
            <span>
              주간 ROAS{' '}
              <span className="font-semibold text-ink">{sim.summary.cumRoas.toFixed(2)}x</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── 메인 대시보드 ─────────────────────────────────────────────────────────────
export default function Step4Dashboard({ dailyBudget, generated }: Props) {
  const sim = useMemo(() => runSimulation(dailyBudget), [dailyBudget])
  // 발표 리허설용: ?day=7 로 특정 일자 화면 바로 확인 가능
  const [day, setDay] = useState(() => {
    const n = Number(new URLSearchParams(window.location.search).get('day'))
    return Number.isInteger(n) && n >= 1 && n <= SIM_DAYS ? n : 1
  })
  const [playing, setPlaying] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!playing) return
    timerRef.current = window.setInterval(() => {
      setDay((d) => {
        if (d >= SIM_DAYS) {
          setPlaying(false)
          return d
        }
        return d + 1
      })
    }, 1500)
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [playing])

  const dayResult = sim.days[day - 1]
  const prev = day > 1 ? sim.days[day - 2] : null
  const maxShare = useMemo(
    () => Math.max(...sim.days.flatMap((d) => Object.values(d.stats).map((s) => s.share))),
    [sim],
  )
  const topId = useMemo(() => {
    if (day === 1) return '' // 첫날은 균등 분산 — 1위가 없다
    let id = ''
    let max = -1
    for (const s of Object.values(dayResult.stats)) {
      if (s.active && s.share > max) {
        max = s.share
        id = s.id
      }
    }
    return id
  }, [dayResult, day])

  const roasDelta = prev ? dayResult.dayRoas - prev.dayRoas : null

  const handlePlay = () => {
    if (playing) {
      setPlaying(false)
      return
    }
    if (day >= SIM_DAYS) setDay(1)
    setPlaying(true)
  }

  return (
    <div className="animate-fade-in mx-auto max-w-6xl pt-8 pb-6">
      {/* 헤더 + 재생 컨트롤 */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">성과 대시보드</h2>
          <p className="mt-1.5 text-sm break-keep text-sub">
            집행 7일을 타임랩스로 재생해보세요 — 예산이 승자에게 몰리는 과정이 보입니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePlay}
            className="flex cursor-pointer items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-deep"
          >
            {playing ? (
              <>
                <svg width="11" height="12" viewBox="0 0 11 12" fill="currentColor" aria-hidden>
                  <rect x="0" y="0" width="4" height="12" rx="1" />
                  <rect x="7" y="0" width="4" height="12" rx="1" />
                </svg>
                일시정지
              </>
            ) : (
              <>
                <svg width="11" height="12" viewBox="0 0 11 12" fill="currentColor" aria-hidden>
                  <path d="M0 1.2C0 .4.9-.1 1.6.3l8.7 4.8c.7.4.7 1.4 0 1.8L1.6 11.7c-.7.4-1.6-.1-1.6-.9V1.2Z" />
                </svg>
                {day >= SIM_DAYS ? '다시 재생' : '7일 재생'}
              </>
            )}
          </button>
          {/* 날짜 스크러버 */}
          <div className="flex items-center gap-1 rounded-full border border-line bg-white p-1">
            {sim.days.map((d) => (
              <button
                key={d.day}
                type="button"
                onClick={() => {
                  setPlaying(false)
                  setDay(d.day)
                }}
                className={`h-7 w-7 cursor-pointer rounded-full text-[11px] font-semibold transition-colors ${
                  d.day === day
                    ? 'bg-ink text-white'
                    : d.day < day
                      ? 'text-ink hover:bg-gray-100'
                      : 'text-faint hover:bg-gray-100'
                }`}
                aria-label={`Day ${d.day}로 이동`}
              >
                {d.day}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 오늘의 이벤트 */}
      <div className="mb-6 flex items-start gap-2.5 rounded-2xl border border-line bg-gray-50/70 px-4 py-3">
        <span className="mt-1.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-brand" />
        <p className="text-[13px] leading-relaxed break-keep text-sub">
          <span className="mr-2 font-bold text-ink">Day {day}</span>
          {dayResult.events.join(' · ')}
        </p>
      </div>

      {/* KPI 타일 */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="누적 지출"
          value={Math.round(dayResult.cumSpend).toLocaleString('ko-KR')}
          unit="원"
          delta={`오늘 ${won(dayResult.daySpend)} 집행`}
        />
        <StatTile
          label="누적 전환"
          value={String(Math.round(dayResult.cumConversions))}
          unit="건"
          delta={
            Math.round(dayResult.cumConversions) === 0
              ? '탐색 중 — 아직 초반이에요'
              : `매출 ${won(dayResult.cumRevenue)}`
          }
          deltaGood={Math.round(dayResult.cumConversions) > 0}
        />
        <StatTile
          label="일 ROAS"
          value={dayResult.dayRoas.toFixed(2)}
          unit="x"
          tip="ROAS(Return on Ad Spend) = 광고비 대비 매출 배수예요. 1.0x면 본전, 2.0x면 광고비의 2배를 벌었다는 뜻."
          delta={
            roasDelta === null
              ? '첫날 — 탐색 구간'
              : `${roasDelta >= 0 ? '▲' : '▼'} ${Math.abs(roasDelta).toFixed(2)} vs 어제`
          }
          deltaGood={roasDelta !== null && roasDelta >= 0}
        />
        <StatTile
          label="활성 시안"
          value={String(dayResult.activeCount)}
          unit="종"
          delta={
            dayResult.offIds.length > 0
              ? `오늘 ${dayResult.offIds.length}종 자동 오프`
              : dayResult.newIds.length > 0
                ? `변형 ${dayResult.newIds.length}종 추가`
                : '전체 유지'
          }
          deltaGood={dayResult.newIds.length > 0}
        />
      </div>

      {/* 차트 행 */}
      <div className="mb-4 grid gap-4 lg:grid-cols-5">
        <section className="rounded-card border border-line bg-white p-5 shadow-soft lg:col-span-2">
          <h3 className="text-sm font-semibold">
            ROAS 추이 <span className="ml-1 text-xs font-normal text-faint">Day 1–7 · 일별</span>
          </h3>
          <div className="mt-3">
            <RoasChart sim={sim} day={day} />
          </div>
        </section>
        <section className="rounded-card border border-line bg-white p-5 shadow-soft lg:col-span-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">시안별 예산 배분</h3>
            <span className="text-xs text-faint">톰슨 샘플링 · 매일 자동 재배분</span>
          </div>
          <div className="mt-4 max-h-[360px] overflow-y-auto pr-1">
            <BudgetBars sim={sim} dayResult={dayResult} maxShare={maxShare} />
          </div>
        </section>
      </div>

      {/* 시안 미니뷰 */}
      <section className="mb-4 rounded-card border border-line bg-white p-5 shadow-soft">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">시안 현황</h3>
          <div className="flex items-center gap-4 text-[11px] text-faint">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-brand bg-white" /> 오늘의 1위
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-brand" /> 변형 생성
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-gray-300" /> 자동 오프
            </span>
          </div>
        </div>
        <MiniGrid
          sim={sim}
          day={day}
          dayResult={dayResult}
          topId={topId}
          generated={generated}
        />
      </section>

      {/* 성적표 */}
      {day >= SIM_DAYS && <WeeklyReport sim={sim} generated={generated} />}

      <p className="mt-6 pb-4 text-center text-[11px] leading-relaxed break-keep text-faint">
        7일 성과 예측은 시안별 반응 데이터를 기반으로 하며, 예산은 톰슨 샘플링(Beta 사후분포)
        알고리즘으로 자동 배분됩니다.
      </p>
    </div>
  )
}
