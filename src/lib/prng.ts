/**
 * 시드 고정 PRNG (mulberry32) + 분포 샘플러.
 * 반복 재생 시마다 같은 스토리가 나오도록 모든 난수는 이 모듈을 통해서만 생성한다.
 */

export type Rng = () => number

/** mulberry32 — 32bit 시드 기반 결정적 PRNG */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 표준정규 (Box–Muller) */
export function normal(rng: Rng): number {
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** Gamma(shape, 1) — Marsaglia–Tsang. shape > 0 */
export function gamma(rng: Rng, shape: number): number {
  if (shape < 1) {
    // boost: Gamma(a) = Gamma(a+1) * U^(1/a)
    const u = rng()
    return gamma(rng, shape + 1) * Math.pow(u, 1 / shape)
  }
  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  for (;;) {
    let x: number
    let v: number
    do {
      x = normal(rng)
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = rng()
    if (u < 1 - 0.0331 * x * x * x * x) return d * v
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
  }
}

/** Beta(alpha, beta) — 톰슨 샘플링의 핵심 분포 */
export function betaSample(rng: Rng, alpha: number, beta: number): number {
  const x = gamma(rng, alpha)
  const y = gamma(rng, beta)
  return x / (x + y)
}

/** Binomial(n, p) — n이 크면 정규 근사, 작으면 직접 시행 */
export function binomial(rng: Rng, n: number, p: number): number {
  if (n <= 0 || p <= 0) return 0
  if (p >= 1) return n
  if (n < 50) {
    let k = 0
    for (let i = 0; i < n; i++) if (rng() < p) k++
    return k
  }
  const mean = n * p
  const sd = Math.sqrt(n * p * (1 - p))
  const k = Math.round(mean + sd * normal(rng))
  return Math.max(0, Math.min(n, k))
}
