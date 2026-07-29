export interface ProductRecord {
  id: string
  name: string
  price: number
  category: string
  color: string
  fit: string
  imageUrl: string | null
  sourceUrl?: string
  createdAt?: string
}

export interface BackendHealth {
  ok: boolean
  geminiConfigured: boolean
  imageModel: string
  generationLimit?: number | null
  persistence: boolean
  deployment?: 'server' | 'static'
}

export interface GeneratedCreative {
  id: string
  creativeId: string
  imageUrl: string
  model: string
  createdAt: string
}

export interface CampaignRecord {
  id: string
  productId: string
  settings: unknown
  generatedCreativeIds: string[]
  status: 'active'
  createdAt: string
}

export const DEMO_PRODUCT: ProductRecord = {
  id: 'demo',
  name: '데일리 크롭 니트 가디건',
  price: 32900,
  category: '여성 니트',
  color: '크림 베이지',
  fit: '크롭 핏',
  imageUrl: null,
}
