import { useEffect, useState } from 'react'
import { MODELS, BACKGROUNDS, type Creative } from '../lib/creatives.ts'
import { PRODUCT } from '../lib/creatives.ts'

/**
 * 소재 비주얼.
 * /public/creatives/c01.jpg ~ c24.jpg 파일이 존재하면 그 이미지를 우선 사용하고
 * (추후 Fliption 실제 생성 이미지로 교체), 없으면 듀오톤 배경 + 실루엣 플레이스홀더를 그린다.
 * 파생 소재(v1~v3)는 부모 소재의 이미지를 공유한다.
 */

interface Props {
  creative: Creative
  size?: 'lg' | 'sm'
  imageUrl?: string
  productName?: string
}

/** 모델 포즈별 실루엣 — 120×160 뷰박스, 스트로크 기반의 스타일라이즈드 마네킹 */
function Silhouette({ pose, color }: { pose: Creative['model']['pose']; color: string }) {
  const stroke = { stroke: color, strokeLinecap: 'round' as const, fill: 'none' }
  return (
    <svg viewBox="0 0 120 160" className="h-full w-auto" aria-hidden>
      {pose === 'casual' && (
        <g>
          <circle cx="60" cy="24" r="11" fill={color} />
          <path d="M60 35 v6" strokeWidth="7" {...stroke} />
          <path d="M44 49 Q60 42 76 49 L80 98 Q60 106 40 98 Z" fill={color} />
          <path d="M45 52 C39 68 37 82 39 95" strokeWidth="8" {...stroke} />
          <path d="M75 52 C81 68 83 82 81 95" strokeWidth="8" {...stroke} />
          <path d="M52 102 L50 150" strokeWidth="10" {...stroke} />
          <path d="M68 102 L70 150" strokeWidth="10" {...stroke} />
        </g>
      )}
      {pose === 'street' && (
        <g>
          <circle cx="60" cy="26" r="11" fill={color} />
          <path d="M49 19 Q60 11 71 19" strokeWidth="6" {...stroke} />
          <path d="M69 17 L79 21" strokeWidth="3.5" {...stroke} />
          <path d="M60 37 v5" strokeWidth="7" {...stroke} />
          <path d="M42 50 Q60 42 78 50 L84 100 Q60 110 36 100 Z" fill={color} />
          <path d="M43 54 C34 66 32 78 40 88 L50 92" strokeWidth="8" {...stroke} />
          <path d="M77 54 C86 68 88 84 84 96" strokeWidth="8" {...stroke} />
          <path d="M50 104 L42 150" strokeWidth="10" {...stroke} />
          <path d="M70 104 L78 150" strokeWidth="10" {...stroke} />
        </g>
      )}
      {pose === 'office' && (
        <g>
          <circle cx="60" cy="24" r="10.5" fill={color} />
          <circle cx="60" cy="12" r="4.5" fill={color} />
          <path d="M60 34 v6" strokeWidth="7" {...stroke} />
          <path d="M46 48 Q60 42 74 48 L76 88 Q60 94 44 88 Z" fill={color} />
          <path d="M44 90 L40 116 Q60 122 80 116 L76 90" fill={color} />
          <path d="M47 51 C42 64 41 76 44 86" strokeWidth="7.5" {...stroke} />
          <path d="M73 51 C78 64 79 76 76 86" strokeWidth="7.5" {...stroke} />
          <path d="M80 84 l0 18" strokeWidth="3" {...stroke} />
          <rect x="74" y="100" width="13" height="15" rx="3" fill={color} />
          <path d="M55 120 L54 150" strokeWidth="9" {...stroke} />
          <path d="M65 120 L66 150" strokeWidth="9" {...stroke} />
        </g>
      )}
      {pose === 'plus' && (
        <g>
          <circle cx="60" cy="23" r="11" fill={color} />
          <path d="M60 34 v6" strokeWidth="8" {...stroke} />
          <path d="M40 50 Q60 42 80 50 L86 100 Q60 111 34 100 Z" fill={color} />
          <path d="M40 54 C31 68 29 84 34 96" strokeWidth="9" {...stroke} />
          <path d="M80 54 C89 68 91 84 86 96" strokeWidth="9" {...stroke} />
          <path d="M51 105 L48 150" strokeWidth="11" {...stroke} />
          <path d="M69 105 L72 150" strokeWidth="11" {...stroke} />
        </g>
      )}
    </svg>
  )
}

export default function CreativeVisual({ creative, size = 'lg', imageUrl, productName = PRODUCT.name }: Props) {
  const [imgOk, setImgOk] = useState(true)
  const [imgLoaded, setImgLoaded] = useState(false)
  const imgId = creative.parentId ?? creative.id
  const source = imageUrl || `/creatives/${imgId}.jpg`

  useEffect(() => {
    setImgOk(true)
    setImgLoaded(false)
  }, [source])

  // 배경 톤 (배경 종류 기반) + 모델별 미세 색조 변화 → 진짜 소재 매트릭스처럼 카드마다 조금씩 다르게
  const mIdx = MODELS.findIndex((m) => m.id === creative.model.id)
  const bIdx = BACKGROUNDS.findIndex((b) => b.id === creative.background.id)
  const [h, s, l] = creative.background.tone
  const hue = h + mIdx * 8 - 8 + (creative.variantNo ?? 0) * 4
  const lift = creative.copy.id === 'A' ? 1.5 : -1.5
  const top = `hsl(${hue} ${s}% ${Math.min(96, l + 4 + lift)}%)`
  const bottom = `hsl(${hue} ${s + 6}% ${l - 5 + lift}%)`
  const figure = `hsl(${hue} ${Math.min(22, s + 2)}% ${44 + bIdx * 3}%)`

  const lg = size === 'lg'

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: `linear-gradient(165deg, ${top} 0%, ${bottom} 100%)` }}
    >
      {/* 무대 바닥의 은은한 타원 그림자 */}
      <div
        className="absolute bottom-[4%] left-1/2 h-[7%] w-[62%] -translate-x-1/2 rounded-[50%]"
        style={{ background: `hsl(${hue} ${s}% ${l - 14}% / 0.35)`, filter: 'blur(6px)' }}
      />
      <div className="absolute inset-x-0 bottom-[3%] flex h-[78%] items-end justify-center">
        <Silhouette pose={creative.model.pose} color={figure} />
      </div>

      {/* 실제 생성 이미지(/creatives/cXX.jpg)가 있으면 플레이스홀더 위에 우선 표시 */}
      {imgOk && (
        <img
          src={source}
          alt=""
          loading="lazy"
          onError={() => setImgOk(false)}
          onLoad={() => setImgLoaded(true)}
          className={
            imgLoaded ? 'absolute inset-0 h-full w-full object-cover' : 'absolute h-0 w-0 opacity-0'
          }
        />
      )}

      {lg && (
        <>
          <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1">
            <span className="rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-medium text-ink backdrop-blur">
              {creative.model.label}
            </span>
            <span className="rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-medium text-ink backdrop-blur">
              {creative.background.label}
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 via-black/15 to-transparent px-3 pt-7 pb-2.5 text-white">
            <p className="text-[11px] leading-snug font-semibold">“{creative.copy.text}”</p>
            <p className="mt-0.5 text-[10px] text-white/70">
              {productName} · {creative.copy.label}
            </p>
          </div>
        </>
      )}

      {creative.variantNo && (
        <span
          className={`absolute rounded-full bg-brand px-1.5 py-px font-semibold text-white ${
            lg ? 'top-2.5 right-2.5 text-[10px]' : 'top-1 right-1 text-[8px]'
          }`}
        >
          v{creative.variantNo}
        </span>
      )}

    </div>
  )
}
