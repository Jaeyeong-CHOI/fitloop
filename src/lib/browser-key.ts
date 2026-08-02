export const GEMINI_KEY_STORAGE = 'fitloop:gemini-api-key'

export interface KeyStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function defaultStorage(): KeyStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function normalizeApiKey(value: string): string {
  const key = value.trim()
  if (key.length < 20 || /\s/.test(key)) {
    throw new Error('올바른 Gemini API 키를 입력해 주세요.')
  }
  return key
}

export function readBrowserApiKey(storage: KeyStorage | null = defaultStorage()): string {
  if (!storage) return ''
  try {
    return storage.getItem(GEMINI_KEY_STORAGE)?.trim() || ''
  } catch {
    return ''
  }
}

export function saveBrowserApiKey(
  value: string,
  storage: KeyStorage | null = defaultStorage(),
): string {
  const key = normalizeApiKey(value)
  if (!storage) throw new Error('이 브라우저에서는 로컬 저장소를 사용할 수 없습니다.')
  storage.setItem(GEMINI_KEY_STORAGE, key)
  return key
}

export function clearBrowserApiKey(storage: KeyStorage | null = defaultStorage()): void {
  try {
    storage?.removeItem(GEMINI_KEY_STORAGE)
  } catch {
    // The in-memory key can still be cleared even if browser storage is blocked.
  }
}

export function maskApiKey(value: string): string {
  const key = value.trim()
  return key ? `•••• ${key.slice(-4)}` : ''
}
