import { useCallback, useEffect, useState } from 'react'
import ApiKeyDialog from './components/ApiKeyDialog.tsx'
import StepIndicator from './components/StepIndicator.tsx'
import Step1Product from './screens/Step1Product.tsx'
import Step2Creatives from './screens/Step2Creatives.tsx'
import Step3Campaign, { type CampaignSettings } from './screens/Step3Campaign.tsx'
import Step3Models from './screens/Step3Models.tsx'
import Step4Dashboard from './screens/Step4Dashboard.tsx'
import Home from './screens/Home.tsx'
import { getHealth, saveCampaign } from './lib/api.ts'
import {
  clearBrowserApiKey,
  readBrowserApiKey,
  saveBrowserApiKey,
} from './lib/browser-key.ts'
import {
  applyModelProfiles,
  CREATIVES,
  creativeCopyMap,
  resetCreativeCopies,
} from './lib/creatives.ts'
import {
  DEFAULT_MODEL_IDS,
  DEFAULT_SELECTION,
  MODEL_LIBRARY,
  reconcileModelIds,
  slotLabels,
  type ModelSelection,
} from './lib/models.ts'
import { DEMO_PRODUCT, type BackendHealth, type GeneratedCreative, type ProductRecord } from './lib/types.ts'

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`${compact ? 'text-[19px]' : 'text-[20px]'} font-bold tracking-tight`}>
      FitL<span className="text-brand">oo</span>p
    </span>
  )
}

// 발표 리허설용: ?step=5 처럼 특정 단계로 바로 진입 가능
const initialQuery = new URLSearchParams(window.location.search)
const initialStep = (() => {
  const n = Number(initialQuery.get('step'))
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : 1
})()
const initialPage = initialQuery.has('demo') || initialQuery.has('step') ? 'demo' : 'home'

function productGender(product: ProductRecord): '여성' | '남성' | null {
  const text = `${product.name} ${product.category}`.toLowerCase()
  if (/남성|남자|맨즈|men'?s/.test(text)) return '남성'
  if (/여성|여자|우먼|women'?s/.test(text)) return '여성'
  return null
}

export default function App() {
  const [page, setPage] = useState<'home' | 'demo'>(initialPage)
  const [apiKey, setApiKey] = useState(readBrowserApiKey)
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false)
  const [step, setStep] = useState(initialStep)
  const [maxReached, setMaxReached] = useState(initialStep)
  const [product, setProduct] = useState<ProductRecord | null>(() =>
    initialStep > 1 || !readBrowserApiKey() ? DEMO_PRODUCT : null,
  )
  const [health, setHealth] = useState<BackendHealth | null>(null)
  const [generated, setGenerated] = useState<Record<string, GeneratedCreative>>({})
  const [autoGenerateCreatives, setAutoGenerateCreatives] = useState(false)
  const [notice, setNotice] = useState('')
  const [modelSelection, setModelSelection] = useState<ModelSelection>(DEFAULT_SELECTION)
  const [modelIds, setModelIds] = useState<string[]>(DEFAULT_MODEL_IDS)
  const [settings, setSettings] = useState<CampaignSettings>({
    dailyBudget: 20000,
    gender: '여성',
    ages: ['18–24', '25–34'],
    channels: { instagram: true, facebook: true, naver: true, google: false },
  })

  const go = (next: number) => {
    setPage('demo')
    setStep(next)
    setMaxReached((m) => Math.max(m, next))
    window.history.replaceState(null, '', `?demo=1&step=${next}`)
    window.scrollTo({ top: 0 })
  }

  const startDemo = () => {
    if (!apiKey) setProduct(DEMO_PRODUCT)
    else if (product?.id === DEMO_PRODUCT.id) setProduct(null)
    setPage('demo')
    setStep(1)
    setMaxReached(1)
    window.history.replaceState(null, '', '?demo=1')
    window.scrollTo({ top: 0 })
  }

  const showHome = () => {
    setPage('home')
    window.history.replaceState(null, '', window.location.pathname)
    window.scrollTo({ top: 0 })
  }

  useEffect(() => {
    getHealth(apiKey).then(setHealth).catch(() => setHealth(null))
  }, [apiKey])

  const closeApiKeyDialog = useCallback(() => setApiKeyDialogOpen(false), [])

  const handleApiKeySave = (key: string) => {
    setApiKey(saveBrowserApiKey(key))
    if (step === 1 && product?.id === DEMO_PRODUCT.id) setProduct(null)
    setGenerated({})
  }

  const handleApiKeyClear = () => {
    clearBrowserApiKey()
    setApiKey('')
    setProduct(DEMO_PRODUCT)
    setGenerated({})
    setAutoGenerateCreatives(false)
    resetCreativeCopies()
  }

  const handleGenerated = (creative: GeneratedCreative) => {
    setGenerated((current) => ({ ...current, [creative.creativeId]: creative }))
  }

  const handleProduct = (nextProduct: ProductRecord) => {
    const inferredGender = productGender(nextProduct) || '여성'
    setProduct(nextProduct)
    setGenerated({})
    setNotice('')
    setAutoGenerateCreatives(false)
    resetCreativeCopies()
    const matchingModels = MODEL_LIBRARY.filter((model) => model.gender === inferredGender)
    setSettings((current) => ({ ...current, gender: inferredGender }))
    setModelSelection({ ...DEFAULT_SELECTION, genders: [inferredGender] })
    setModelIds(matchingModels.slice(0, 4).map((model) => model.id))
  }

  const continueToModels = () => {
    const genders = settings.gender === '전체' ? ['여성', '남성'] : [settings.gender]
    const nextSelection = { ...modelSelection, genders }
    setModelSelection(nextSelection)
    setModelIds((current) => reconcileModelIds(nextSelection, current))
    go(3)
  }

  const startCreativeGeneration = () => {
    if (
      apiKey &&
      !window.confirm(
        `Gemini API로 이미지 ${CREATIVES.length}장을 생성합니다. 사용 중인 Google 프로젝트에 API 비용이 청구될 수 있습니다. 계속할까요?`,
      )
    ) {
      return
    }
    applyModelProfiles(slotLabels(modelIds))
    resetCreativeCopies()
    setGenerated({})
    setAutoGenerateCreatives(true)
    go(4)
  }

  const launchCampaign = async () => {
    if (product) {
      try {
        const campaign = await saveCampaign({
          productId: product.id,
          settings: { ...settings, modelIds, creativeCopies: creativeCopyMap() },
          generatedCreativeIds: Object.values(generated).map((creative) => creative.id),
        })
        setNotice(
          health?.deployment === 'server'
            ? `캠페인 ${campaign.id.slice(0, 8)}가 서버에 저장됐습니다.`
            : '캠페인 설정이 이 브라우저에 저장됐습니다. 7일 성과 예측을 확인하세요.',
        )
      } catch {
        setNotice('캠페인 저장을 완료하지 못했습니다. 성과 예측 화면은 계속 확인할 수 있습니다.')
      }
    }
    go(5)
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* 헤더 */}
      <header className="sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur-md">
        <div className={`mx-auto flex h-16 items-center justify-between gap-4 px-5 ${page === 'home' ? 'max-w-7xl' : 'max-w-6xl'}`}>
          <button type="button" onClick={showHome} className="flex cursor-pointer items-center gap-2.5 text-left" aria-label="FitLoop 홈">
            <Logo compact={page === 'demo'} />
            <span className="hidden rounded-full border border-line bg-gray-50 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-sub sm:inline-flex">
              {page === 'home' ? 'PROJECT PORTFOLIO' : 'INTERACTIVE DEMO'}
            </span>
          </button>
          {page === 'home' ? (
            <nav className="flex items-center gap-1 text-xs font-medium sm:gap-5 sm:text-sm" aria-label="메인 탐색">
              <a href="#project" className="hidden text-sub transition-colors hover:text-ink sm:inline">프로젝트</a>
              <a href="#presentations" className="hidden text-sub transition-colors hover:text-ink sm:inline">발표자료</a>
              <button type="button" onClick={() => setApiKeyDialogOpen(true)} className={`hidden cursor-pointer rounded-full border px-4 py-2.5 font-semibold transition-colors sm:inline-flex ${apiKey ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' : 'border-line bg-white text-sub hover:border-gray-300 hover:text-ink'}`}>
                {apiKey ? 'API 연결됨' : 'API 키 연결'}
              </button>
              <button type="button" onClick={startDemo} className="cursor-pointer rounded-full bg-ink px-4 py-2.5 font-semibold text-white transition-colors hover:bg-gray-800">
                데모 체험
              </button>
            </nav>
          ) : (
            <>
              <StepIndicator current={step} maxReached={maxReached} onSelect={go} />
              <button type="button" onClick={() => setApiKeyDialogOpen(true)} className={`hidden w-[154px] cursor-pointer justify-end text-right text-xs md:flex`}>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${apiKey ? 'bg-emerald-50 text-emerald-800' : 'bg-blue-50 text-blue-800'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${apiKey ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                  {apiKey ? 'Nano Banana 연결됨' : '예시 데모 모드'}
                </span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* 본문 */}
      <main className="w-full flex-1">
        {page === 'home' ? (
          <Home onStartDemo={startDemo} />
        ) : (
          <div className="mx-auto w-full max-w-7xl px-5">
            <div className={`mx-auto mt-5 flex max-w-3xl flex-col gap-3 rounded-2xl border px-4 py-3 text-xs leading-5 sm:flex-row sm:items-center sm:justify-between ${apiKey ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-blue-100 bg-blue-50/80 text-blue-900'}`}>
              <span className="flex items-start gap-2 sm:items-center">
                <span className="mt-0.5 shrink-0 sm:mt-0">{apiKey ? '✓' : 'ⓘ'}</span>
                <span>
                  {apiKey
                    ? 'Nano Banana 2가 연결됐습니다. 요청은 이 브라우저에서 Google Gemini API로 직접 전송됩니다.'
                    : 'API 키를 연결하지 않으면 미리 준비된 예시 이미지로 전체 흐름을 체험할 수 있습니다.'}
                </span>
              </span>
              <button type="button" onClick={() => setApiKeyDialogOpen(true)} className={`shrink-0 cursor-pointer self-start rounded-full px-4 py-2 font-semibold text-white sm:self-auto ${apiKey ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-blue-800 hover:bg-blue-900'}`}>
                {apiKey ? '키 관리' : 'API 키 연결'}
              </button>
            </div>
            {step === 1 && (
              <Step1Product
                key={apiKey ? 'byok-product' : 'demo-product'}
                product={product}
                apiEnabled={Boolean(apiKey)}
                onProduct={handleProduct}
                onNext={() => go(2)}
              />
            )}
            {step === 2 && product && (
              <Step3Campaign settings={settings} onChange={setSettings} onNext={continueToModels} />
            )}
            {step === 3 && product && (
              <Step3Models
                selection={modelSelection}
                onChange={setModelSelection}
                selectedIds={modelIds}
                onSelect={setModelIds}
                onNext={startCreativeGeneration}
                apiEnabled={Boolean(apiKey)}
              />
            )}
            {step === 4 && product && (
              <Step2Creatives
                product={product}
                health={health}
                generated={generated}
                autoGenerate={autoGenerateCreatives}
                apiKey={apiKey}
                onAutoGenerateStarted={() => setAutoGenerateCreatives(false)}
                onGenerated={handleGenerated}
                onNext={() => void launchCampaign()}
                onRequestApiKey={() => setApiKeyDialogOpen(true)}
              />
            )}
            {step === 5 && (
              <>
                {notice && <p className="mx-auto mt-5 max-w-3xl rounded-2xl bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-800">{notice}</p>}
                <Step4Dashboard dailyBudget={settings.dailyBudget} generated={generated} />
              </>
            )}
          </div>
        )}
      </main>

      {/* 푸터 */}
      <footer className="mt-8 border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-7 sm:flex-row">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="text-xs text-faint">사진 한 장에서 성과 검증까지, 루프를 돌립니다.</span>
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
            <span className="font-medium">ICISTS GRAFFITI 2026 · Team 13</span>
          </div>
        </div>
      </footer>
      <ApiKeyDialog
        open={apiKeyDialogOpen}
        currentKey={apiKey}
        onClose={closeApiKeyDialog}
        onSave={handleApiKeySave}
        onClear={handleApiKeyClear}
      />
    </div>
  )
}
