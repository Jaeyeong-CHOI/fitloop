import { useEffect, useRef, useState } from 'react'
import CreativeVisual from '../components/CreativeVisual.tsx'
import { generateCopies, generateCreative } from '../lib/api.ts'
import {
  applyCreativeCopies,
  CREATIVES,
  posePrompt,
  type Creative,
} from '../lib/creatives.ts'
import type { BackendHealth, GeneratedCreative, ProductRecord } from '../lib/types.ts'

const PARALLEL_GENERATION_COUNT = 12

interface Props {
  product: ProductRecord
  health: BackendHealth | null
  generated: Record<string, GeneratedCreative>
  autoGenerate: boolean
  onAutoGenerateStarted: () => void
  onGenerated: (creative: GeneratedCreative) => void
  onNext: () => void
}

export default function Step2Creatives({
  product,
  health,
  generated,
  autoGenerate,
  onAutoGenerateStarted,
  onGenerated,
  onNext,
}: Props) {
  const [revealed, setRevealed] = useState(0)
  const [working, setWorking] = useState<Set<string>>(new Set())
  const [batchProgress, setBatchProgress] = useState<{ completed: number; total: number } | null>(null)
  const [copying, setCopying] = useState(false)
  const [error, setError] = useState('')
  const autoGenerationStarted = useRef(false)
  const batchRunning = useRef(false)
  const workingIds = useRef(new Set<string>())
  const createAllRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    if (revealed >= CREATIVES.length) return
    const timer = window.setTimeout(() => setRevealed((count) => count + 2), 70)
    return () => window.clearTimeout(timer)
  }, [revealed])

  const canGenerate = product.id !== 'demo' && Boolean(health?.geminiConfigured)

  const createOne = async (creative: Creative, showError = true) => {
    if (!canGenerate || workingIds.current.has(creative.id)) return false
    workingIds.current.add(creative.id)
    setWorking((current) => new Set(current).add(creative.id))
    if (showError) setError('')
    try {
      const result = await generateCreative({
        productId: product.id,
        creativeId: creative.id,
        productName: product.name,
        modelLabel: creative.model.label,
        poseLabel: posePrompt(creative),
        backgroundLabel: creative.background.label,
        copyText: creative.copy.text,
      })
      onGenerated(result)
      return true
    } catch (reason) {
      if (showError) setError(reason instanceof Error ? reason.message : '이미지를 생성하지 못했습니다.')
      return false
    } finally {
      workingIds.current.delete(creative.id)
      setWorking((current) => {
        const next = new Set(current)
        next.delete(creative.id)
        return next
      })
    }
  }

  const createAll = async () => {
    if (batchRunning.current) return
    const remaining = CREATIVES.filter((creative) => !generated[creative.id])
    if (!remaining.length) return
    batchRunning.current = true
    setError('')
    setBatchProgress({ completed: 0, total: remaining.length })
    setCopying(true)
    const copyPromise = generateCopies({
      productId: product.id,
      productName: product.name,
      combinations: CREATIVES.map((creative) => ({
        creativeId: creative.id,
        modelLabel: creative.model.label,
        poseLabel: posePrompt(creative),
        backgroundLabel: creative.background.label,
      })),
    })
      .then((result) => {
        applyCreativeCopies(
          Object.fromEntries(result.copies.map((copy) => [copy.creativeId, copy.text])),
        )
      })
      .catch(() => {
        setError('AI 카피 연결이 지연되어 기본 카피로 이미지를 생성합니다.')
      })
      .finally(() => {
        setCopying(false)
      })
    let nextIndex = 0
    let completed = 0
    let failed = 0
    const worker = async () => {
      while (nextIndex < remaining.length) {
        const creative = remaining[nextIndex++]
        if (!(await createOne(creative, false))) failed++
        completed++
        setBatchProgress({ completed, total: remaining.length })
      }
    }
    const workerCount = Math.min(PARALLEL_GENERATION_COUNT, remaining.length)
    try {
      await Promise.all([
        copyPromise,
        ...Array.from({ length: workerCount }, () => worker()),
      ])
    } finally {
      batchRunning.current = false
      setBatchProgress(null)
    }
    if (failed) setError(`${failed}개 시안 생성에 실패했습니다. 버튼을 눌러 실패한 시안만 다시 생성해 주세요.`)
  }
  createAllRef.current = createAll

  useEffect(() => {
    if (!autoGenerate || !canGenerate || autoGenerationStarted.current) return
    autoGenerationStarted.current = true
    onAutoGenerateStarted()
    void createAllRef.current()
  }, [autoGenerate, canGenerate, onAutoGenerateStarted])

  const generatedCount = Object.keys(generated).length
  const allGenerated = generatedCount >= CREATIVES.length

  return (
    <div className="animate-fade-in mx-auto max-w-6xl pt-8 pb-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {batchProgress ? (
              <>착용샷 시안을 <span className="text-brand">병렬 생성</span>하고 있어요</>
            ) : allGenerated ? (
              <>AI가 광고 시안 <span className="text-brand">{CREATIVES.length}종</span>을 생성했습니다</>
            ) : (
              <>광고 시안 <span className="text-brand">{CREATIVES.length}종 전체</span>를 AI로 생성합니다</>
            )}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed break-keep text-sub">
            포즈 4종 × 배경 3종을 조합하고, 상품에 맞는 광고 카피도 AI가 자동 작성합니다.
            이미지 {CREATIVES.length}개는 동시에 초고속 병렬 생성됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void createAll()}
          disabled={!canGenerate || batchProgress !== null || working.size > 0 || allGenerated}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-ink px-5 py-3 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-default disabled:bg-gray-200 disabled:text-faint"
        >
          {batchProgress ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : '✦'}
          {batchProgress
            ? `${batchProgress.completed}/${batchProgress.total} 생성 중${copying ? ' · 카피 동시 작성' : ''}`
            : generatedCount
              ? allGenerated
                ? `${CREATIVES.length}종 생성 완료`
                : `남은 ${Math.max(0, CREATIVES.length - generatedCount)}종 AI 생성`
              : `광고 시안 ${CREATIVES.length}종 전체 생성`}
        </button>
      </div>

      {!canGenerate && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {product.id === 'demo'
            ? '샘플 상품에서는 준비된 데모 이미지를 사용합니다. 실제 이미지를 업로드하면 Gemini 생성을 사용할 수 있어요.'
            : health?.deployment === 'static'
              ? 'GitHub Pages 정적 데모에서는 비밀키를 안전하게 보관할 수 없어 준비된 광고 시안을 사용합니다.'
              : 'Gemini API 키가 서버에 설정되면 실제 이미지 생성 버튼이 활성화됩니다. 현재는 준비된 데모 시안으로 전체 흐름을 볼 수 있어요.'}
        </div>
      )}
      {error && <p role="alert" className="mb-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {CREATIVES.map((creative, index) => {
          const generatedCreative = generated[creative.id]
          const isWorking = working.has(creative.id)
          return (
            <div
              key={creative.id}
              className="group overflow-hidden rounded-2xl border border-line bg-white shadow-soft transition-all duration-500"
              style={{ opacity: index < revealed ? 1 : 0, transform: index < revealed ? 'translateY(0)' : 'translateY(14px)' }}
            >
              <div className="relative aspect-[3/4] overflow-hidden">
                {batchProgress && !generatedCreative ? (
                  <div className="fl-skeleton h-full w-full" aria-label={`${creative.id} 생성 대기 중`} />
                ) : (
                  <div className="h-full transition-transform duration-300 group-hover:scale-[1.02]">
                    <CreativeVisual creative={creative} size="lg" imageUrl={generatedCreative?.imageUrl} productName={product.name} />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void createOne(creative)}
                  disabled={!canGenerate || isWorking || batchProgress !== null}
                  className="absolute right-2 bottom-2 cursor-pointer rounded-full bg-white/90 px-2.5 py-1.5 text-[10px] font-semibold text-ink opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100 focus:opacity-100 disabled:hidden"
                >
                  {isWorking ? '생성 중…' : generatedCreative ? '다시 생성' : 'AI 생성'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-9 flex flex-col items-center gap-3 pb-4">
        <p className="text-xs text-faint">
          {health?.deployment === 'static'
            ? '캠페인 설정은 이 브라우저에만 임시 저장됩니다.'
            : '생성된 시안과 캠페인 설정은 서버에 저장됩니다.'}
        </p>
        <button type="button" onClick={onNext} disabled={revealed < CREATIVES.length || batchProgress !== null} className="cursor-pointer rounded-full bg-brand px-8 py-3.5 text-[15px] font-semibold text-white shadow-soft transition-all hover:bg-brand-deep disabled:cursor-default disabled:opacity-40">
          이 시안으로 광고 시작하기 →
        </button>
      </div>
    </div>
  )
}
