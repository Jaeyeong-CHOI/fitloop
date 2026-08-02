import type {
  BackendHealth,
  CampaignRecord,
  GeneratedCopy,
  GeneratedCopyBatch,
  GeneratedCreative,
  ProductRecord,
} from './types.ts'
import { DEMO_PRODUCT } from './types.ts'

interface ApiErrorBody {
  error?: string
  message?: string
}

interface InlineImage {
  mime: string
  data: string
}

const STATIC_DEPLOYMENT = import.meta.env?.VITE_STATIC_DEPLOYMENT === 'true'
const API_BASE_URL = STATIC_DEPLOYMENT
  ? ''
  : String(import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '')
const STATIC_FALLBACK = STATIC_DEPLOYMENT
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'
const GEMINI_MODEL_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image'
const IMAGE_MODEL = 'gemini-3.1-flash-image'
const COPY_MODEL = 'gemini-3.1-flash-lite'
const imageCache = new Map<string, Promise<InlineImage>>()

class GeminiClientError extends Error {}

function localId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function persistLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage may be disabled or full; the in-memory flow can still continue.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  return [...value]
    .filter((character) => {
      const point = character.codePointAt(0) || 0
      return point > 31 && point !== 127
    })
    .join('')
    .trim()
    .slice(0, maxLength)
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

function geminiErrorMessage(status: number, payload: unknown): string {
  const error = isRecord(payload) && isRecord(payload.error) ? payload.error : null
  const detail = cleanText(error?.message || (isRecord(payload) ? payload.message : ''), 300)
  if (status === 400 || status === 401 || status === 403) {
    return 'Gemini API 키가 유효하지 않거나 이 도메인에서 사용할 수 없습니다. 키와 HTTP 리퍼러 제한을 확인해 주세요.'
  }
  if (status === 429 && /prepayment|credit|billing/i.test(detail)) {
    return 'Gemini 프로젝트의 결제 크레딧이 부족합니다. Google AI Studio 결제 설정을 확인해 주세요.'
  }
  if (status === 429) return 'Gemini 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.'
  return `Google Gemini 요청에 실패했습니다 (${status}).`
}

async function geminiRequest(apiKey: string, body: unknown, timeoutMs: number): Promise<unknown> {
  try {
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const payload: unknown = await response.json().catch(() => ({}))
    if (!response.ok) throw new GeminiClientError(geminiErrorMessage(response.status, payload))
    return payload
  } catch (reason) {
    if (reason instanceof GeminiClientError) throw reason
    if (reason instanceof DOMException && reason.name === 'TimeoutError') {
      throw new Error('Gemini 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.')
    }
    throw new Error('브라우저에서 Google Gemini API에 연결하지 못했습니다.')
  }
}

export async function validateGeminiApiKey(apiKey: string): Promise<void> {
  try {
    const response = await fetch(GEMINI_MODEL_URL, {
      headers: { 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(15_000),
    })
    const payload: unknown = await response.json().catch(() => ({}))
    if (!response.ok) throw new GeminiClientError(geminiErrorMessage(response.status, payload))
  } catch (reason) {
    if (reason instanceof GeminiClientError) throw reason
    throw new Error('브라우저에서 Gemini API 키를 확인하지 못했습니다.')
  }
}

export function getHealth(apiKey = ''): Promise<BackendHealth> {
  if (apiKey || STATIC_FALLBACK) {
    return Promise.resolve({
      ok: true,
      geminiConfigured: Boolean(apiKey),
      imageModel: apiKey ? IMAGE_MODEL : 'static-demo-assets',
      copyModel: apiKey ? COPY_MODEL : undefined,
      generationLimit: null,
      persistence: false,
      deployment: apiKey ? 'browser' : 'static',
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
      ...DEMO_PRODUCT,
      id: localId('product'),
      name: input.name || (input.sourceUrl ? DEMO_PRODUCT.name : '업로드한 상품'),
      price: input.price || DEMO_PRODUCT.price,
      category: input.category || DEMO_PRODUCT.category,
      color: input.color || DEMO_PRODUCT.color,
      fit: input.fit || DEMO_PRODUCT.fit,
      imageUrl: input.imageDataUrl || DEMO_PRODUCT.imageUrl,
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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

async function imageSource(source: string): Promise<InlineImage> {
  const dataUrl = source.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i)
  if (dataUrl) return { mime: dataUrl[1].toLowerCase(), data: dataUrl[2] }

  const response = await fetch(source)
  if (!response.ok) throw new Error('상품 이미지를 읽지 못했습니다.')
  const mime = (response.headers.get('content-type') || '').split(';')[0].toLowerCase()
  if (!mime.startsWith('image/')) throw new Error('상품 이미지 형식을 확인하지 못했습니다.')
  return { mime, data: arrayBufferToBase64(await response.arrayBuffer()) }
}

function cachedImageSource(source: string): Promise<InlineImage> {
  const cached = imageCache.get(source)
  if (cached) return cached
  const pending = imageSource(source).catch((reason) => {
    imageCache.delete(source)
    throw reason
  })
  imageCache.set(source, pending)
  return pending
}

function findImage(value: unknown, seen = new Set<object>()): InlineImage | null {
  if (!value || typeof value !== 'object' || seen.has(value)) return null
  seen.add(value)
  const record = isRecord(value) ? value : null
  const mime = record?.mime_type || record?.mimeType
  if (typeof record?.data === 'string' && typeof mime === 'string' && mime.startsWith('image/')) {
    return { data: record.data, mime }
  }
  if (isRecord(record?.output_image) && typeof record.output_image.data === 'string') {
    return {
      data: record.output_image.data,
      mime:
        typeof record.output_image.mime_type === 'string'
          ? record.output_image.mime_type
          : 'image/jpeg',
    }
  }
  const children = Array.isArray(value) ? value : Object.values(record || {})
  for (const child of children) {
    const image = findImage(child, seen)
    if (image) return image
  }
  return null
}

function findTextOutput(value: unknown): string {
  if (!isRecord(value)) return ''
  if (typeof value.output_text === 'string') return value.output_text
  for (const field of ['outputs', 'steps', 'output']) {
    const pool = value[field]
    const items = Array.isArray(pool) ? [...pool].reverse() : pool ? [pool] : []
    for (const item of items) {
      if (!isRecord(item)) continue
      if (typeof item.text === 'string') return item.text
      if (!Array.isArray(item.content)) continue
      const text = item.content.find(
        (part) => isRecord(part) && part.type === 'text' && typeof part.text === 'string',
      )
      if (isRecord(text) && typeof text.text === 'string') return text.text
    }
  }
  return ''
}

function buildCreativePrompt(input: {
  productName: string
  modelLabel: string
  poseLabel: string
  backgroundLabel: string
}): string {
  const product = cleanText(input.productName, 80) || 'fashion garment'
  const model = cleanText(input.modelLabel, 60) || 'adult fashion model'
  const pose = cleanText(input.poseLabel, 60) || 'natural full-body pose'
  const background = cleanText(input.backgroundLabel, 60) || 'studio'
  return [
    `Create a premium Korean social-commerce fashion advertisement for ${product}.`,
    `Use an adult ${model} model in a ${pose}, photographed in a ${background} setting.`,
    'The uploaded product is the exact garment reference. Preserve its silhouette, fabric texture, color, buttons, seams, neckline, sleeve length, and proportions faithfully.',
    'Make the garment the visual focus, with realistic anatomy, believable fabric drape, natural hands, clean lighting, and a polished editorial look.',
    'Vertical 3:4 composition. Leave calm negative space near the bottom for a web overlay.',
    'Do not add logos, watermarks, UI, captions, prices, or any rendered text. Do not change the garment design.',
  ].join(' ')
}

export async function generateCreative(
  input: {
    productId: string
    productImageUrl: string
    creativeId: string
    productName: string
    modelLabel: string
    poseLabel: string
    backgroundLabel: string
    copyText: string
  },
  apiKey = '',
): Promise<GeneratedCreative> {
  if (apiKey) {
    const image = await cachedImageSource(input.productImageUrl)
    const payload = await geminiRequest(
      apiKey,
      {
        model: IMAGE_MODEL,
        input: [
          { type: 'text', text: buildCreativePrompt(input) },
          { type: 'image', mime_type: image.mime, data: image.data },
        ],
        response_format: {
          type: 'image',
          mime_type: 'image/jpeg',
          aspect_ratio: '3:4',
          image_size: '1K',
        },
      },
      120_000,
    )
    const output = findImage(payload)
    if (!output?.data) throw new Error('Gemini 응답에서 생성 이미지를 찾지 못했습니다.')
    return {
      id: localId('creative'),
      creativeId: input.creativeId,
      imageUrl: `data:${output.mime};base64,${output.data}`,
      model: IMAGE_MODEL,
      copyText: cleanText(input.copyText, 40),
      createdAt: new Date().toISOString(),
    }
  }
  if (STATIC_FALLBACK) {
    return Promise.reject(new Error('브라우저에서 Gemini API 키를 먼저 연결해 주세요.'))
  }
  return request<GeneratedCreative>('/api/creatives/generate', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then(absoluteImageUrl)
}

export async function generateCopies(
  input: {
    productId: string
    productName: string
    category?: string
    color?: string
    fit?: string
    combinations: Array<{
      creativeId: string
      modelLabel: string
      poseLabel: string
      backgroundLabel: string
    }>
  },
  apiKey = '',
): Promise<GeneratedCopyBatch> {
  if (apiKey) {
    const combinations = input.combinations.slice(0, 12)
    const prompt = [
      `상품명: ${cleanText(input.productName, 80) || '패션 상품'}`,
      `카테고리: ${cleanText(input.category, 60) || '패션'}`,
      `색상: ${cleanText(input.color, 40) || '대표 색상'}`,
      `핏: ${cleanText(input.fit, 40) || '기본 핏'}`,
      '',
      '아래 광고 시안 조합 각각에 어울리는 한국어 패션 광고 카피를 한 개씩 작성하세요.',
      '각 카피는 12~26자, 한 문장, 서로 다른 표현이어야 합니다.',
      '과장된 효능, 최저가, 1위, 무료, 보장 같은 검증 불가능한 표현과 해시태그는 사용하지 마세요.',
      ...combinations.map(
        (item) =>
          `${item.creativeId}: ${item.modelLabel} / ${item.poseLabel} / ${item.backgroundLabel}`,
      ),
    ].join('\n')
    const payload = await geminiRequest(
      apiKey,
      {
        model: COPY_MODEL,
        input: prompt,
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: {
            type: 'object',
            properties: {
              copies: {
                type: 'array',
                minItems: combinations.length,
                maxItems: combinations.length,
                items: {
                  type: 'object',
                  properties: {
                    creativeId: {
                      type: 'string',
                      enum: combinations.map((item) => item.creativeId),
                    },
                    text: { type: 'string' },
                  },
                  required: ['creativeId', 'text'],
                },
              },
            },
            required: ['copies'],
          },
        },
      },
      30_000,
    )
    let parsed: unknown = {}
    try {
      parsed = JSON.parse(findTextOutput(payload) || '{}')
    } catch {
      throw new Error('Gemini 카피 응답을 읽지 못했습니다.')
    }
    const copies = isRecord(parsed) && Array.isArray(parsed.copies) ? parsed.copies : []
    const normalized: GeneratedCopy[] = copies
      .filter(isRecord)
      .map((copy) => ({
        creativeId: cleanText(copy.creativeId, 80),
        text: cleanText(copy.text, 40).replace(/^["'“”‘’]+|["'“”‘’]+$/g, ''),
      }))
      .filter((copy) => copy.creativeId && copy.text)
    if (!normalized.length) throw new Error('Gemini 응답에서 광고 카피를 찾지 못했습니다.')
    return { copies: normalized, model: COPY_MODEL, source: 'gemini' }
  }
  if (STATIC_FALLBACK) {
    return Promise.reject(new Error('브라우저에서 Gemini API 키를 먼저 연결해 주세요.'))
  }
  return request<GeneratedCopyBatch>('/api/copies/generate', {
    method: 'POST',
    body: JSON.stringify(input),
  })
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
