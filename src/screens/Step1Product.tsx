import { useRef, useState } from 'react'
import type { DragEvent, FormEvent } from 'react'
import { saveProduct } from '../lib/api.ts'
import { DEMO_PRODUCT, type ProductRecord } from '../lib/types.ts'

interface Props {
  product: ProductRecord | null
  onProduct: (product: ProductRecord) => void
  onNext: () => void
}

type Phase = 'idle' | 'analyzing' | 'done'

export default function Step1Product({ product, onProduct, onNext }: Props) {
  const [phase, setPhase] = useState<Phase>(product ? 'done' : 'idle')
  const [url, setUrl] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const importProduct = async (input: { imageDataUrl?: string; sourceUrl?: string }) => {
    setPhase('analyzing')
    setError('')
    try {
      const saved = await saveProduct(input)
      onProduct(saved)
      setPhase('done')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '상품을 가져오지 못했습니다.')
      setPhase('idle')
    }
  }

  const handleUrlSubmit = (event: FormEvent) => {
    event.preventDefault()
    const sourceUrl = url.match(/https?:\/\/[^\s]+/i)?.[0]?.replace(/[),.;]+$/, '') || ''
    if (!sourceUrl) {
      setError('공개 상품 URL을 입력해 주세요.')
      return
    }
    setUrl(sourceUrl)
    void importProduct({ sourceUrl })
  }

  const handleFile = (file?: File) => {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('JPG, PNG, WebP 이미지만 사용할 수 있습니다.')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('이미지는 8MB 이하여야 합니다.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => void importProduct({ imageDataUrl: String(reader.result) })
    reader.onerror = () => setError('이미지 파일을 읽지 못했습니다.')
    reader.readAsDataURL(file)
  }

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragOver(false)
    handleFile(event.dataTransfer.files[0])
  }

  const useDemo = () => {
    onProduct(DEMO_PRODUCT)
    setPhase('done')
    setError('')
  }

  return (
    <div className="animate-fade-up mx-auto max-w-3xl">
      <div className="pt-10 pb-10 text-center sm:pt-16">
        <span className="mb-5 inline-block rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-medium text-sub">
          촬영도, 모델 섭외도, 광고 운영도 없이
        </span>
        <h1 className="text-[34px] leading-[1.15] font-bold tracking-tight break-keep sm:text-5xl">
          옷 사진 한 장이면,
          <br />
          AI 마케터가 <span className="text-brand">알아서 광고</span>를 돌립니다
        </h1>
        <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed break-keep text-sub">
          상품 이미지를 선택하고 준비된 광고 시안을 조합한 뒤, 성과가 좋은 조합에 예산을
          자동 배분하는 흐름을 체험할 수 있습니다.
        </p>
      </div>

      <div className="rounded-card border border-line bg-white p-6 shadow-soft sm:p-8">
        {phase !== 'done' && (
          <>
            <form onSubmit={handleUrlSubmit} className="flex gap-2">
              <input
                type="text"
                inputMode="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                disabled={phase === 'analyzing'}
                placeholder="쿠팡·무신사·스마트스토어 상품 URL"
                className="h-12 min-w-0 flex-1 rounded-full border border-line bg-white px-5 text-sm outline-none placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15"
              />
              <button
                type="submit"
                disabled={phase === 'analyzing'}
                className="h-12 shrink-0 cursor-pointer rounded-full bg-ink px-6 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-default disabled:opacity-40"
              >
                가져오기
              </button>
            </form>
            <p className="mt-2 px-2 text-left text-[11px] text-faint">
              링크를 붙여넣으면 대표 이미지·상품명·가격을 자동으로 가져옵니다.
            </p>

            <div className="my-5 flex items-center gap-3 text-xs text-faint">
              <div className="h-px flex-1 bg-line" />또는<div className="h-px flex-1 bg-line" />
            </div>

            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(event) => {
                event.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              disabled={phase === 'analyzing'}
              className={`flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 transition-colors ${
                dragOver
                  ? 'border-brand bg-brand-soft'
                  : 'border-line bg-gray-50/60 hover:border-brand-mid hover:bg-brand-soft/50'
              }`}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-faint" aria-hidden>
                <path d="M12 16V4m0 0 4 4m-4-4L8 8M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-sm font-medium text-ink">옷 사진을 끌어다 놓거나 선택하세요</span>
              <span className="text-xs text-faint">JPG, PNG, WebP · 최대 8MB</span>
            </button>

            <button type="button" onClick={useDemo} className="mx-auto mt-4 block cursor-pointer text-xs font-medium text-sub underline decoration-line underline-offset-4 hover:text-ink">
              업로드 없이 샘플 상품으로 둘러보기
            </button>
          </>
        )}

        {phase === 'analyzing' && (
          <div className="animate-fade-in py-6">
            <div className="flex items-center justify-center gap-2.5">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              <span className="text-sm font-medium text-ink">상품을 준비하는 중...</span>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {phase === 'done' && product && (
          <div className="animate-fade-up">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">✓</span>
                {product.id === 'demo' ? '샘플 상품 준비 완료' : '상품 준비 완료'}
              </span>
              <button type="button" onClick={() => setPhase('idle')} className="cursor-pointer text-xs text-faint hover:text-ink">
                다른 상품 선택
              </button>
            </div>
            <div className="flex items-center gap-5">
              <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-[hsl(24_36%_90%)]">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-4xl" aria-hidden>🧶</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold tracking-tight">{product.name}</p>
                <p className="mt-0.5 text-[15px] font-medium text-ink">
                  {product.price.toLocaleString('ko-KR')}<span className="text-sm font-normal text-sub">원</span>
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {[product.category, product.color, product.fit].map((label) => (
                    <span key={label} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-sub">{label}</span>
                  ))}
                </div>
                {product.sourceUrl && (
                  <a
                    href={product.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-3 inline-flex text-xs font-medium text-brand hover:text-brand-deep"
                  >
                    원본 상품 페이지 열기 ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-center pb-6">
        <button type="button" disabled={phase !== 'done'} onClick={onNext} className="cursor-pointer rounded-full bg-brand px-8 py-3.5 text-[15px] font-semibold text-white shadow-soft transition-all hover:bg-brand-deep disabled:cursor-default disabled:bg-gray-200 disabled:text-faint disabled:shadow-none">
          착용샷 시안 만들기 →
        </button>
      </div>
    </div>
  )
}
