import type {
  BackendHealth,
  CampaignRecord,
  GeneratedCreative,
  ProductRecord,
} from './types.ts'

interface ApiErrorBody {
  error?: string
  message?: string
}

const STATIC_DEPLOYMENT = import.meta.env.VITE_STATIC_DEPLOYMENT === 'true'
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const STATIC_FALLBACK = STATIC_DEPLOYMENT && !API_BASE_URL

function localId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function persistLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage may be disabled; the in-memory flow can still continue.
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  const body = (await response.json().catch(() => ({}))) as T & ApiErrorBody
  if (!response.ok) {
    throw new Error(body.message || body.error || `요청에 실패했습니다 (${response.status})`)
  }
  return body
}

function absoluteImageUrl<T extends { imageUrl: string | null }>(record: T): T {
  if (!record.imageUrl || !API_BASE_URL || /^https?:\/\//.test(record.imageUrl)) return record
  return { ...record, imageUrl: `${API_BASE_URL}${record.imageUrl}` }
}

export function getHealth(): Promise<BackendHealth> {
  if (STATIC_FALLBACK) {
    return Promise.resolve({
      ok: true,
      geminiConfigured: false,
      imageModel: 'static-demo-assets',
      persistence: false,
      deployment: 'static',
    })
  }
  return request<BackendHealth>('/api/health')
}

export function saveProduct(input: {
  imageDataUrl?: string
  sourceUrl?: string
  name?: string
  price?: number
  category?: string
  color?: string
  fit?: string
}): Promise<ProductRecord> {
  if (STATIC_FALLBACK) {
    const product: ProductRecord = {
      id: localId('product'),
      name: input.name || (input.sourceUrl ? '가져온 상품 데모' : '업로드한 상품'),
      price: input.price || 32900,
      category: input.category || '패션 의류',
      color: input.color || '이미지 기반',
      fit: input.fit || '기본 핏',
      imageUrl: input.imageDataUrl || null,
      sourceUrl: input.sourceUrl,
      createdAt: new Date().toISOString(),
    }
    persistLocal('fitloop:last-product', product)
    return Promise.resolve(product)
  }
  return request<ProductRecord>('/api/products', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then(absoluteImageUrl)
}

export function generateCreative(input: {
  productId: string
  creativeId: string
  productName: string
  modelLabel: string
  backgroundLabel: string
  copyText: string
}): Promise<GeneratedCreative> {
  if (STATIC_FALLBACK) {
    return Promise.reject(new Error('GitHub Pages 정적 버전에서는 Gemini 생성을 사용할 수 없습니다.'))
  }
  return request<GeneratedCreative>('/api/creatives/generate', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then(absoluteImageUrl)
}

export function saveCampaign(input: {
  productId: string
  settings: unknown
  generatedCreativeIds: string[]
}): Promise<CampaignRecord> {
  if (STATIC_FALLBACK) {
    const campaign: CampaignRecord = {
      id: localId('campaign'),
      productId: input.productId,
      settings: input.settings,
      generatedCreativeIds: input.generatedCreativeIds,
      status: 'active',
      createdAt: new Date().toISOString(),
    }
    persistLocal('fitloop:last-campaign', campaign)
    return Promise.resolve(campaign)
  }
  return request<CampaignRecord>('/api/campaigns', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
