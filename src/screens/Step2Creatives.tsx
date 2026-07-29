import { useEffect, useMemo, useState } from 'react'
import CreativeVisual from '../components/CreativeVisual.tsx'
import { generateCreative } from '../lib/api.ts'
import { CREATIVES, type Creative } from '../lib/creatives.ts'
import type { BackendHealth, GeneratedCreative, ProductRecord } from '../lib/types.ts'

interface Props {
  product: ProductRecord
  health: BackendHealth | null
  generated: Record<string, GeneratedCreative>
  onGenerated: (creative: GeneratedCreative) => void
  onNext: () => void
}

const FEATURED_IDS = new Set(['c02', 'c10', 'c16', 'c22'])

export default function Step2Creatives({ product, health, generated, onGenerated, onNext }: Props) {
  const [revealed, setRevealed] = useState(0)
  const [working, setWorking] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')

  useEffect(() => {
    if (revealed >= CREATIVES.length) return
    const timer = window.setTimeout(() => setRevealed((count) => count + 2), 70)
    return () => window.clearTimeout(timer)
  }, [revealed])

  const featured = useMemo(() => CREATIVES.filter((creative) => FEATURED_IDS.has(creative.id)), [])
  const canGenerate = product.id !== 'demo' && Boolean(health?.geminiConfigured)

  const createOne = async (creative: Creative) => {
    if (!canGenerate || working.has(creative.id)) return
    setWorking((current) => new Set(current).add(creative.id))
    setError('')
    try {
      const result = await generateCreative({
        productId: product.id,
        creativeId: creative.id,
        productName: product.name,
        modelLabel: creative.model.label,
        backgroundLabel: creative.background.label,
        copyText: creative.copy.text,
      })
      onGenerated(result)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '이미지를 생성하지 못했습니다.')
    } finally {
      setWorking((current) => {
        const next = new Set(current)
        next.delete(creative.id)
        return next
      })
    }
  }

  const createFeatured = async () => {
    for (const creative of featured) {
      if (!generated[creative.id]) await createOne(creative)
    }
  }

  return (
    <div className="animate-fade-in mx-auto max-w-6xl pt-8 pb-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            광고 시안 <span className="text-brand">24종</span>을 준비했습니다
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed break-keep text-sub">
            모델 4종 × 배경 3종 × 카피 2종을 테스트합니다. 각 카드의 AI 생성 버튼으로 실제
            상품을 입힌 광고 이미지를 만들 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void createFeatured()}
          disabled={!canGenerate || working.size > 0}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-ink px-5 py-3 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-default disabled:bg-gray-200 disabled:text-faint"
        >
          {working.size > 0 ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : '✦'}
          대표 시안 4종 AI 생성
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
                <div className="h-full transition-transform duration-300 group-hover:scale-[1.02]">
                  <CreativeVisual creative={creative} size="lg" imageUrl={generatedCreative?.imageUrl} productName={product.name} />
                </div>
                <button
                  type="button"
                  onClick={() => void createOne(creative)}
                  disabled={!canGenerate || isWorking}
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
        <button type="button" onClick={onNext} disabled={revealed < CREATIVES.length} className="cursor-pointer rounded-full bg-brand px-8 py-3.5 text-[15px] font-semibold text-white shadow-soft transition-all hover:bg-brand-deep disabled:cursor-default disabled:opacity-40">
          이 시안으로 집행 설정하기 →
        </button>
      </div>
    </div>
  )
}
