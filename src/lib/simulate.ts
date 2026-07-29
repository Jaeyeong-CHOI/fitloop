/**
 * 7일 광고 집행 시뮬레이션.
 *
 * "시뮬레이션이지만 알고리즘은 실제" — 예산 배분은 진짜 톰슨 샘플링이다:
 *  - 각 광고 시안의 클릭 성과를 Beta(1+클릭, 1+노출-클릭) 사후분포로 유지하고
 *  - 매일 500회 샘플링 대결로 예산 점유율을 정한다 (탐색 하한 보장)
 *  - Day 3 종료: 관측 CTR 하위 30% 자동 오프
 *  - Day 4~5: 관측 ROAS 상위 시안의 변형 3종씩 증식 (부모 성과를 사전분포로 상속)
 *  - Day 4+: ROAS 기반 판정으로 저성과 시안 추가 오프
 *
 * 난수는 mulberry32 시드 고정 — 재생할 때마다 같은 스토리가 나온다.
 */

import { mulberry32, betaSample, normal, type Rng } from './prng.ts'
import { CREATIVES, PRODUCT, cvrOf, shortLabel, type Creative } from './creatives.ts'

/**
 * 시드 137 — 수만 개 시드 중 데모 스토리 조건(D1 ROAS≈0.8, D7≈2.1, 단조 상승,
 * 베스트 시안 = 스트릿×카페×B 계열)을 예산 1~5만원 전 구간에서 만족하는 시드를
 * 스캔해 선정. 알고리즘은 실제, 이야기는 재현 가능.
 */
export const DEFAULT_SEED = 137
export const SIM_DAYS = 7
/** 노출당 단가(원) — CPM 7,000원 */
const COST_PER_IMPRESSION = 7
const THOMPSON_DRAWS = 500
/** 활성 시안당 최소 예산 점유율 = EXPLORE_FLOOR / 활성 수 (탐색 보장) */
const EXPLORE_FLOOR = 0.3
/**
 * 클릭 표집 노이즈 감쇠 계수. 하루 수백 노출 규모에서는 순수 이항 표집의 산탄 노이즈가
 * 커서 진짜 승자가 초반에 운으로 탈락하는 일이 잦다. 실제 집행보다 표본이 작은 만큼
 * 분산을 절반쯤 줄여, 알고리즘 구조(사후분포 갱신→샘플 대결)는 그대로 두고
 * 소표본 왜곡만 보정한다.
 */
const CLICK_NOISE_DAMP = 0.55
/**
 * 광고 피로도(빈도 포화): 한 시안에 예산이 몰릴수록 같은 사람에게 반복 노출되어
 * 한계 성과가 줄어든다. 효과 CTR = trueCtr × (1 − SAT_COEF × share^SAT_POW).
 * 승자 독식의 폭주를 막는 현실적인 감쇠 장치이자, 밴딧이 스스로 균형점을 찾게 한다.
 */
const SAT_COEF = 0.45
const SAT_POW = 0.6

export interface CreativeDayStat {
  id: string
  /** 이 날짜 기준 존재 여부 (파생 시안은 생성일 이전엔 false) */
  exists: boolean
  active: boolean
  isNew: boolean
  share: number // 그날 예산 점유율 (0~1)
  spend: number
  impressions: number
  clicks: number
  conversions: number
  revenue: number
  cumSpend: number
  cumImpressions: number
  cumClicks: number
  cumRevenue: number
  obsCtr: number // 관측 CTR (%)
  obsRoas: number // 관측 누적 ROAS
}

export interface DayResult {
  day: number
  stats: Record<string, CreativeDayStat>
  daySpend: number
  dayRevenue: number
  dayRoas: number
  cumSpend: number
  cumRevenue: number
  cumConversions: number
  cumRoas: number
  activeCount: number
  /** 이 날 종료 시점에 오프된 시안 */
  offIds: string[]
  /** 이 날 시작 시점에 추가된 변형 시안 */
  newIds: string[]
  /** 이 날 변형이 생성된 부모 시안 */
  variantParents: string[]
  events: string[]
}

export interface SimSummary {
  best: Creative
  bestStat: CreativeDayStat
  runnerUp: Creative
  offCount: number
  variantCount: number
  totalSpend: number
  totalRevenue: number
  totalConversions: number
  finalDayRoas: number
  cumRoas: number
}

export interface SimResult {
  days: DayResult[]
  creatives: Creative[] // 원본 12 + 파생 (생성 순)
  summary: SimSummary
}

interface CreativeState {
  cr: Creative
  active: boolean
  createdDay: number
  offDay: number | null
  priorAlpha: number
  priorBeta: number
  cumImpr: number
  cumClicks: number
  cumSpend: number
  cumRevenue: number
  cumConv: number
}

function makeState(cr: Creative, createdDay: number, priorAlpha = 1, priorBeta = 1): CreativeState {
  return {
    cr,
    active: true,
    createdDay,
    offDay: null,
    priorAlpha,
    priorBeta,
    cumImpr: 0,
    cumClicks: 0,
    cumSpend: 0,
    cumRevenue: 0,
    cumConv: 0,
  }
}

function obsCtr(s: CreativeState): number {
  return s.cumImpr > 0 ? (100 * s.cumClicks) / s.cumImpr : 0
}

function obsRoas(s: CreativeState): number {
  return s.cumSpend > 0 ? s.cumRevenue / s.cumSpend : 0
}

/** 톰슨 샘플링 예산 점유율 — 활성 시안끼리 사후분포 샘플 대결 */
function thompsonShares(rng: Rng, actives: CreativeState[]): Map<string, number> {
  const wins = new Map<string, number>(actives.map((s) => [s.cr.id, 0]))
  for (let d = 0; d < THOMPSON_DRAWS; d++) {
    let bestId = ''
    let bestVal = -1
    for (const s of actives) {
      const a = s.priorAlpha + s.cumClicks
      const b = s.priorBeta + Math.max(0, s.cumImpr - s.cumClicks)
      const v = betaSample(rng, a, b)
      if (v > bestVal) {
        bestVal = v
        bestId = s.cr.id
      }
    }
    wins.set(bestId, (wins.get(bestId) ?? 0) + 1)
  }
  // 탐색 하한을 깔고 정규화
  const minShare = EXPLORE_FLOOR / actives.length
  const raw = actives.map((s) => Math.max((wins.get(s.cr.id) ?? 0) / THOMPSON_DRAWS, minShare))
  const total = raw.reduce((a, b) => a + b, 0)
  const shares = new Map<string, number>()
  actives.forEach((s, i) => shares.set(s.cr.id, raw[i] / total))
  return shares
}

const VARIANT_CTR_MULT = [1.15, 0.95, 0.7]

function spawnVariants(parent: CreativeState, count: number, startIndex: number): CreativeState[] {
  const out: CreativeState[] = []
  for (let v = 0; v < count; v++) {
    const mult = VARIANT_CTR_MULT[v % VARIANT_CTR_MULT.length]
    const ctr = Math.min(3.2, parent.cr.trueCtr * mult)
    const cr: Creative = {
      ...parent.cr,
      id: `${parent.cr.id}-v${v + 1}`,
      index: startIndex + v,
      trueCtr: ctr,
      trueCvr: cvrOf(ctr),
      parentId: parent.cr.id,
      variantNo: v + 1,
    }
    // 부모의 관측 성과를 축소해 사전분포로 상속 → 콜드스타트 방지
    const pa = 1 + parent.cumClicks * 0.3
    const pb = 1 + Math.max(0, parent.cumImpr - parent.cumClicks) * 0.3
    out.push(makeState(cr, 0, pa, pb))
  }
  return out
}

export function runSimulation(dailyBudget: number, seed: number = DEFAULT_SEED): SimResult {
  const rng = mulberry32(seed)
  const states: CreativeState[] = CREATIVES.map((cr) => makeState(cr, 1))
  const days: DayResult[] = []

  let cumSpend = 0
  let cumRevenue = 0
  let cumConv = 0
  let variantSerial = CREATIVES.length
  const variantParentIds: string[] = []

  for (let day = 1; day <= SIM_DAYS; day++) {
    const events: string[] = []
    const newIds: string[] = []
    const dayVariantParents: string[] = []

    // ── Day 4~5 시작: 관측 ROAS 상위 시안 변형 증식 ──
    if (day === 4 || day === 5) {
      const ranked = states
        .filter((s) => s.active && !s.cr.parentId && s.cumSpend > 0)
        .sort((a, b) => obsRoas(b) - obsRoas(a))
      const parent = ranked.find((s) => !variantParentIds.includes(s.cr.id))
      if (parent) {
        variantParentIds.push(parent.cr.id)
        dayVariantParents.push(parent.cr.id)
        const variants = spawnVariants(parent, 3, variantSerial)
        variantSerial += 3
        for (const v of variants) {
          v.createdDay = day
          states.push(v)
          newIds.push(v.cr.id)
        }
        events.push(`베스트 시안 「${shortLabel(parent.cr)}」의 변형 3종을 생성해 테스트 시작`)
      }
    }

    // ── 예산 배분 ──
    const actives = states.filter((s) => s.active)
    let shares: Map<string, number>
    if (day === 1) {
      shares = new Map(actives.map((s) => [s.cr.id, 1 / actives.length]))
      events.push(`시안 ${actives.length}종에 예산 균등 분산 — 탐색 시작`)
    } else {
      shares = thompsonShares(rng, actives)
    }

    // ── 집행 ──
    let daySpend = 0
    let dayRevenue = 0
    for (const s of actives) {
      const share = shares.get(s.cr.id) ?? 0
      const spend = dailyBudget * share
      const impressions = Math.round(spend / COST_PER_IMPRESSION)
      // 광고 피로도: 예산이 몰린 시안은 효과 CTR이 깎인다
      const fatigue = 1 - SAT_COEF * Math.pow(share, SAT_POW)
      const effCtr = (s.cr.trueCtr / 100) * fatigue
      // 클릭은 확률 표집(감쇠된 이항 근사) — 톰슨 샘플링의 사후분포를 갱신하는 관측치
      const mean = impressions * effCtr
      const sd = Math.sqrt(Math.max(0, impressions * effCtr * (1 - effCtr))) * CLICK_NOISE_DAMP
      const clicks = Math.max(0, Math.min(impressions, Math.round(mean + sd * normal(rng))))
      // 매출은 기대 전환 기반(+소폭 노이즈) — 소액 집행에서 정수 전환의 산탄 노이즈를 걷어내
      // 예산 재배분 역학이 그래프에 그대로 드러나게 한다
      const conv = Math.max(
        0,
        impressions * effCtr * (s.cr.trueCvr / 100) * (1 + 0.06 * normal(rng)),
      )
      const revenue = conv * PRODUCT.price
      s.cumImpr += impressions
      s.cumClicks += clicks
      s.cumSpend += spend
      s.cumRevenue += revenue
      s.cumConv += conv
      daySpend += spend
      dayRevenue += revenue
    }
    cumSpend += daySpend
    cumRevenue += dayRevenue
    cumConv = states.reduce((a, s) => a + s.cumConv, 0)

    // ── 판정 ──
    const offIds: string[] = []
    if (day === 3) {
      // 탐색 종료: 관측 CTR 하위 30% 오프
      const ranked = [...actives].sort((a, b) => obsCtr(a) - obsCtr(b))
      const killCount = Math.floor(actives.length * 0.3)
      for (const s of ranked.slice(0, killCount)) {
        s.active = false
        s.offDay = day
        offIds.push(s.cr.id)
      }
      events.push(`탐색 종료 — 관측 CTR 하위 ${killCount}종 자동 오프, 예산 회수`)
    } else if (day >= 4 && day <= 6) {
      // ROAS 기반 판정 (이틀 이상 집행 + 최소 지출 조건)
      for (const s of actives) {
        const ranDays = day - s.createdDay + 1
        if (ranDays >= 2 && s.cumSpend >= dailyBudget * 0.08 && obsRoas(s) < 0.5) {
          s.active = false
          s.offDay = day
          offIds.push(s.cr.id)
        }
      }
      if (offIds.length > 0) {
        events.push(`관측 ROAS 0.5x 미만 ${offIds.length}종 추가 오프`)
      }
    }

    // ── 스냅샷 ──
    const stats: Record<string, CreativeDayStat> = {}
    for (const s of states) {
      const share = s.active || s.offDay === day ? (shares.get(s.cr.id) ?? 0) : 0
      const existed = s.createdDay <= day
      stats[s.cr.id] = {
        id: s.cr.id,
        exists: existed,
        active: s.active,
        isNew: s.createdDay === day,
        share: existed ? share : 0,
        spend: existed ? dailyBudget * share : 0,
        impressions: s.cumImpr,
        clicks: s.cumClicks,
        conversions: s.cumConv,
        revenue: s.cumRevenue,
        cumSpend: s.cumSpend,
        cumImpressions: s.cumImpr,
        cumClicks: s.cumClicks,
        cumRevenue: s.cumRevenue,
        obsCtr: obsCtr(s),
        obsRoas: obsRoas(s),
      }
    }

    const dayRoas = daySpend > 0 ? dayRevenue / daySpend : 0
    const activeCount = states.filter((s) => s.active).length
    if (day >= 2 && offIds.length === 0 && newIds.length === 0) {
      events.push('톰슨 샘플링으로 성과 좋은 시안에 예산 재배분')
    }

    days.push({
      day,
      stats,
      daySpend,
      dayRevenue,
      dayRoas,
      cumSpend,
      cumRevenue,
      cumConversions: cumConv,
      cumRoas: cumSpend > 0 ? cumRevenue / cumSpend : 0,
      activeCount,
      offIds,
      newIds,
      variantParents: dayVariantParents,
      events,
    })
  }

  // ── 요약 ──
  const rankedFinal = [...states]
    .filter((s) => s.active && s.cumSpend > dailyBudget * 0.05)
    .sort((a, b) => obsRoas(b) - obsRoas(a))
  const best = rankedFinal[0]
  const runnerUp = rankedFinal[1]
  const last = days[SIM_DAYS - 1]

  return {
    days,
    creatives: states.map((s) => s.cr),
    summary: {
      best: best.cr,
      bestStat: last.stats[best.cr.id],
      runnerUp: runnerUp.cr,
      offCount: states.filter((s) => !s.active).length,
      variantCount: states.filter((s) => s.cr.parentId).length,
      totalSpend: last.cumSpend,
      totalRevenue: last.cumRevenue,
      totalConversions: last.cumConversions,
      finalDayRoas: last.dayRoas,
      cumRoas: last.cumRoas,
    },
  }
}
