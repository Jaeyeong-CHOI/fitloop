import { useEffect, useState } from 'react'
import { maskApiKey, normalizeApiKey } from '../lib/browser-key.ts'
import { validateGeminiApiKey } from '../lib/api.ts'

interface Props {
  open: boolean
  currentKey: string
  onClose: () => void
  onSave: (key: string) => void
  onClear: () => void
}

export default function ApiKeyDialog({ open, currentKey, onClose, onSave, onClear }: Props) {
  const [value, setValue] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setValue('')
    setShowKey(false)
    setChecking(false)
    setError('')
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  if (!open) return null

  const connect = async () => {
    setError('')
    let key = ''
    try {
      key = normalizeApiKey(value)
      setChecking(true)
      await validateGeminiApiKey(key)
      onSave(key)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'API 키를 확인하지 못했습니다.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-key-title"
        className="w-full max-w-lg rounded-[1.75rem] border border-white/20 bg-white p-6 shadow-[0_30px_100px_rgba(3,7,18,0.32)] sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.16em] text-brand">BRING YOUR OWN KEY</p>
            <h2 id="api-key-title" className="mt-2 text-2xl font-bold tracking-tight">Gemini API 연결</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-gray-100 text-lg text-sub hover:bg-gray-200 hover:text-ink">×</button>
        </div>

        <p className="mt-4 text-sm leading-6 break-keep text-sub">
          입력한 키는 이 브라우저의 <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-ink">localStorage</code>에만 저장되고,
          이미지·카피 생성 시 Google Gemini API로 직접 전송됩니다. FitLoop 서버와 GitHub에는 전송하거나 저장하지 않습니다.
        </p>

        {currentKey && (
          <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-emerald-800">현재 브라우저에 연결됨</p>
              <p className="mt-0.5 text-xs text-emerald-700">{maskApiKey(currentKey)}</p>
            </div>
            <button type="button" onClick={onClear} className="cursor-pointer rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">
              키 삭제
            </button>
          </div>
        )}

        <label htmlFor="gemini-api-key" className="mt-5 block text-xs font-semibold text-ink">새 API 키</label>
        <div className="mt-2 flex rounded-2xl border border-line bg-white focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
          <input
            id="gemini-api-key"
            type={showKey ? 'text' : 'password'}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !checking) void connect()
            }}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Gemini API 키 붙여넣기"
            className="h-12 min-w-0 flex-1 rounded-l-2xl bg-transparent px-4 text-sm outline-none placeholder:text-faint"
          />
          <button type="button" onClick={() => setShowKey((shown) => !shown)} className="cursor-pointer px-4 text-xs font-medium text-sub hover:text-ink">
            {showKey ? '숨기기' : '보기'}
          </button>
        </div>

        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 break-keep text-amber-900">
          브라우저 저장 키는 이 기기를 사용하는 사람과 같은 출처의 스크립트가 읽을 수 있습니다. 개인 기기에서만 사용하고,
          Google Cloud에서 <strong>HTTP 리퍼러 제한·사용량 알림</strong>을 설정하세요. 이미지 12장 생성에는 API 비용이 발생합니다.
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer noopener" className="text-center text-xs font-medium text-sub underline decoration-line underline-offset-4 hover:text-ink">
            Google AI Studio에서 키 만들기 ↗
          </a>
          <button
            type="button"
            onClick={() => void connect()}
            disabled={checking || !value.trim()}
            className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-default disabled:bg-gray-200 disabled:text-faint"
          >
            {checking && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
            {checking ? '키 확인 중…' : '검증하고 연결'}
          </button>
        </div>
      </section>
    </div>
  )
}
