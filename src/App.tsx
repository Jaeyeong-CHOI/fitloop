import { useEffect, useState } from 'react'
import StepIndicator from './components/StepIndicator.tsx'
import Step1Product from './screens/Step1Product.tsx'
import Step2Creatives from './screens/Step2Creatives.tsx'
import Step3Campaign, { type CampaignSettings } from './screens/Step3Campaign.tsx'
import Step4Dashboard from './screens/Step4Dashboard.tsx'
import { getHealth, saveCampaign } from './lib/api.ts'
import { DEMO_PRODUCT, type BackendHealth, type GeneratedCreative, type ProductRecord } from './lib/types.ts'

function Logo() {
  return (
    <span className="text-[19px] font-bold tracking-tight">
      FitL<span className="text-brand">oo</span>p
    </span>
  )
}

// 발표 리허설용: ?step=4 처럼 특정 단계로 바로 진입 가능
const initialStep = (() => {
  const n = Number(new URLSearchParams(window.location.search).get('step'))
  return Number.isInteger(n) && n >= 1 && n <= 4 ? n : 1
})()

export default function App() {
  const [step, setStep] = useState(initialStep)
  const [maxReached, setMaxReached] = useState(initialStep)
  const [product, setProduct] = useState<ProductRecord | null>(initialStep > 1 ? DEMO_PRODUCT : null)
  const [health, setHealth] = useState<BackendHealth | null>(null)
  const [generated, setGenerated] = useState<Record<string, GeneratedCreative>>({})
  const [notice, setNotice] = useState('')
  const [settings, setSettings] = useState<CampaignSettings>({
    dailyBudget: 20000,
    gender: '여성',
    ages: ['18–24', '25–34'],
    channels: { instagram: true, facebook: true, naver: true, google: false },
  })

  const go = (next: number) => {
    setStep(next)
    setMaxReached((m) => Math.max(m, next))
    window.scrollTo({ top: 0 })
  }

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth(null))
  }, [])

  const handleGenerated = (creative: GeneratedCreative) => {
    setGenerated((current) => ({ ...current, [creative.creativeId]: creative }))
  }

  const launchCampaign = async () => {
    if (product) {
      try {
        const campaign = await saveCampaign({
          productId: product.id,
          settings,
          generatedCreativeIds: Object.values(generated).map((creative) => creative.id),
        })
        setNotice(
          health?.deployment === 'static'
            ? `캠페인 ${campaign.id.slice(0, 8)}가 이 브라우저에 준비됐습니다.`
            : `캠페인 ${campaign.id.slice(0, 8)}가 서버에 저장됐습니다.`,
        )
      } catch {
        setNotice('캠페인 저장은 실패했지만 데모 성과 화면은 계속 볼 수 있습니다.')
      }
    }
    go(4)
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* 헤더 */}
      <header className="sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="hidden rounded-full border border-line bg-gray-50 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-sub sm:inline-flex">
              GRAFFITI 2026 데모
            </span>
          </div>
          <StepIndicator current={step} maxReached={maxReached} onSelect={go} />
          <span className="hidden w-[154px] text-right text-xs md:block">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${health ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-faint'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${health ? 'bg-emerald-500' : 'bg-gray-300'}`} />
              {health
                ? health.deployment === 'static'
                  ? 'GitHub 정적 데모'
                  : health.geminiConfigured
                    ? '서버 · Gemini 준비'
                    : '서버 연결됨'
                : '환경 확인 중'}
            </span>
          </span>
        </div>
      </header>

      {/* 본문 */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-5">
        {step === 1 && (
          <Step1Product
            product={product}
            onProduct={setProduct}
            onNext={() => go(2)}
          />
        )}
        {step === 2 && product && (
          <Step2Creatives product={product} health={health} generated={generated} onGenerated={handleGenerated} onNext={() => go(3)} />
        )}
        {step === 3 && (
          <Step3Campaign settings={settings} onChange={setSettings} onNext={() => void launchCampaign()} />
        )}
        {step === 4 && (
          <>
            {notice && <p className="mx-auto mt-5 max-w-3xl rounded-2xl bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-800">{notice}</p>}
            <Step4Dashboard dailyBudget={settings.dailyBudget} />
          </>
        )}
      </main>

      {/* 푸터 */}
      <footer className="mt-8 border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-7 sm:flex-row">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="text-xs text-faint">사진 한 장에서 매출까지, 루프를 돌립니다.</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-sub">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
              <path
                d="M6.5 1v11M1 6.5h11"
                stroke="#f97316"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <span className="font-medium">Powered by Fliption Virtual Try-on</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
