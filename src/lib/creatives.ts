/**
 * 광고 시안 매트릭스 정의: 포즈/모델 4슬롯 × 배경 3종 = 12개 조합.
 * 카피는 각 조합마다 Gemini가 자동 생성하고, API 실패 시 기본 카피를 사용한다.
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
  id: 'AI'
  label: string
  text: string
}

export interface Creative {
  id: string // c01 ~ c12
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
  { id: 'm1', label: '여성·20대·아시아·밝은 톤·슬림', short: '모델1', pose: 'casual' },
  { id: 'm2', label: '여성·30대·아시아·중간 톤·스탠다드', short: '모델2', pose: 'street' },
  { id: 'm3', label: '여성·30대·아시아·밝은 톤·플러스사이즈', short: '모델3', pose: 'office' },
  { id: 'm4', label: '여성·20대·아시아·중간 톤·슬림', short: '모델4', pose: 'plus' },
]

export function applyModelProfiles(labels: string[]): void {
  labels.forEach((label, index) => {
    if (!MODELS[index]) return
    MODELS[index].label = label
    MODELS[index].short = `포즈${index + 1}`
  })
}

export const BACKGROUNDS: BackgroundDef[] = [
  { id: 'b1', label: '스튜디오', tone: [30, 10, 92] },
  { id: 'b2', label: '카페', tone: [28, 34, 87] },
  { id: 'b3', label: '스트릿', tone: [216, 16, 87] },
]

const FALLBACK_COPIES = [
  '오늘 입고, 매일 손이 가는 핏',
  '카페에서도 자연스럽게 완성되는 룩',
  '거리 위에서 더 살아나는 실루엣',
  '편안한 순간에도 핏은 선명하게',
  '일상에 가볍게 더하는 새로운 무드',
  '걷는 순간까지 자연스러운 스타일',
  '단정한 핏으로 시작하는 하루',
  '꾸민 듯 편안한 데일리 밸런스',
  '어디서나 시선이 머무는 실루엣',
  '내 움직임에 맞춘 편안한 핏',
  '오늘의 분위기를 바꾸는 한 벌',
  '평범한 거리도 화보처럼',
]

const POSE_PROMPTS: Record<ModelDef['pose'], string> = {
  casual: 'relaxed front-facing standing pose',
  street: 'dynamic walking pose with natural movement',
  office: 'polished three-quarter pose with a confident posture',
  plus: 'confident side-angle pose with one hand naturally placed',
}

export function posePrompt(creative: Creative): string {
  return POSE_PROMPTS[creative.model.pose]
}

/**
 * trueCtr(%) 테이블 — [포즈/모델][배경] 순.
 * 승자: 포즈2×카페(2.8), 포즈2×스트릿(2.3), 포즈1×스튜디오(1.6)
 */
const CTR_TABLE: number[][] = [
  [1.6, 1.1, 0.8],
  [1.3, 2.8, 2.3],
  [0.9, 1.4, 0.5],
  [0.7, 1.0, 0.4],
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
      const ctr = CTR_TABLE[m][b]
      list.push({
        id: `c${pad2(i + 1)}`,
        index: i,
        model: MODELS[m],
        background: BACKGROUNDS[b],
        copy: { id: 'AI', label: 'AI 카피', text: FALLBACK_COPIES[i] },
        trueCtr: ctr,
        trueCvr: cvrOf(ctr),
      })
      i++
    }
  }
  return list
})()

export function applyCreativeCopies(copies: Record<string, string>): void {
  CREATIVES.forEach((creative) => {
    const text = copies[creative.id]?.trim()
    if (text) creative.copy.text = text
  })
}

export function resetCreativeCopies(): void {
  CREATIVES.forEach((creative, index) => {
    creative.copy.text = FALLBACK_COPIES[index]
  })
}

export function creativeCopyMap(): Record<string, string> {
  return Object.fromEntries(CREATIVES.map((creative) => [creative.id, creative.copy.text]))
}

/** "포즈2 · 카페" 형태의 짧은 라벨 */
export function shortLabel(cr: Creative): string {
  const base = `${cr.model.short}·${cr.background.label}`
  return cr.variantNo ? `${base} v${cr.variantNo}` : base
}

export const PRODUCT = {
  name: '데일리 크롭 니트 가디건',
  price: 32900,
  category: '여성 니트',
}
