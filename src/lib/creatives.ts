/**
 * 광고 시안 매트릭스 정의: 모델 4종 × 배경 3종 × 카피 2종 = 24개 조합.
 * trueCtr 은 시뮬레이션이 사용하는 "숨은 실제 성과"다 — 소수 승자 구조(0.3%~2.8%).
 */

export interface ModelDef {
  id: string
  label: string
  short: string
  pose: 'casual' | 'street' | 'office' | 'plus'
}

export interface BackgroundDef {
  id: string
  label: string
  /** 플레이스홀더 듀오톤 배경 [hue, saturation%, lightness%] */
  tone: [number, number, number]
}

export interface CopyDef {
  id: 'A' | 'B'
  label: string
  text: string
}

export interface Creative {
  id: string // c01 ~ c24
  index: number // 0-based
  model: ModelDef
  background: BackgroundDef
  copy: CopyDef
  /** 숨은 실제 CTR (%) — 시뮬레이션 전용, UI에는 관측치만 노출 */
  trueCtr: number
  /** 숨은 실제 CVR (%) */
  trueCvr: number
  /** 파생 시안인 경우 부모 id */
  parentId?: string
  variantNo?: number
}

export const MODELS: ModelDef[] = [
  { id: 'm1', label: '20대 캐주얼', short: '캐주얼', pose: 'casual' },
  { id: 'm2', label: '20대 스트릿', short: '스트릿', pose: 'street' },
  { id: 'm3', label: '30대 오피스', short: '오피스', pose: 'office' },
  { id: 'm4', label: '플러스사이즈', short: '플러스', pose: 'plus' },
]

export const BACKGROUNDS: BackgroundDef[] = [
  { id: 'b1', label: '스튜디오', tone: [30, 10, 92] },
  { id: 'b2', label: '카페', tone: [28, 34, 87] },
  { id: 'b3', label: '스트릿', tone: [216, 16, 87] },
]

export const COPIES: CopyDef[] = [
  { id: 'A', label: '카피A', text: '포근함은 기본, 핏은 덤이에요' },
  { id: 'B', label: '카피B', text: '출근부터 주말까지, 이 한 장이면' },
]

/**
 * trueCtr(%) 테이블 — [모델][배경][카피] 순.
 * 승자: 스트릿×카페×B(2.8), 스트릿×스트릿×B(2.3), 캐주얼×스튜디오×B(1.6)
 */
const CTR_TABLE: number[][][] = [
  // 20대 캐주얼      스튜디오        카페           스트릿
  [
    [0.9, 1.6],
    [0.7, 1.1],
    [0.5, 0.8],
  ],
  // 20대 스트릿
  [
    [0.8, 1.3],
    [1.5, 2.8],
    [1.0, 2.3],
  ],
  // 30대 오피스
  [
    [0.6, 0.9],
    [1.2, 1.4],
    [0.4, 0.5],
  ],
  // 플러스사이즈
  [
    [0.5, 0.7],
    [0.6, 1.0],
    [0.3, 0.4],
  ],
]

/** CVR은 CTR과 약하게 상관 — 잘 팔리는 시안이 전환도 좋다 */
export function cvrOf(ctr: number): number {
  return 1.4 + 0.28 * ctr
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

export const CREATIVES: Creative[] = (() => {
  const list: Creative[] = []
  let i = 0
  for (let m = 0; m < MODELS.length; m++) {
    for (let b = 0; b < BACKGROUNDS.length; b++) {
      for (let c = 0; c < COPIES.length; c++) {
        const ctr = CTR_TABLE[m][b][c]
        list.push({
          id: `c${pad2(i + 1)}`,
          index: i,
          model: MODELS[m],
          background: BACKGROUNDS[b],
          copy: COPIES[c],
          trueCtr: ctr,
          trueCvr: cvrOf(ctr),
        })
        i++
      }
    }
  }
  return list
})()

/** "스트릿 · 카페 · B" 형태의 짧은 라벨 */
export function shortLabel(cr: Creative): string {
  const base = `${cr.model.short}·${cr.background.label}·${cr.copy.id}`
  return cr.variantNo ? `${base} v${cr.variantNo}` : base
}

export const PRODUCT = {
  name: '데일리 크롭 니트 가디건',
  price: 32900,
  category: '여성 니트',
}
