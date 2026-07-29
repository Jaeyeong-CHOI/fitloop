import { createServer } from 'node:http'
import { createHash, randomUUID } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractProductImageCandidates, extractProductPrice, extractProductTitle } from './lib/product-page.mjs'
import {
  createCoupangAuthorization,
  extractCoupangProductId,
  isCoupangUrl,
  selectCoupangProduct,
} from './lib/coupang-partners.mjs'

const ROOT = fileURLToPath(new URL('.', import.meta.url))
await loadEnv(join(ROOT, '.env'))

const DIST_DIR = join(ROOT, 'dist')
const DATA_DIR = resolve(process.env.FITLOOP_DATA_DIR || join(ROOT, 'data'))
const UPLOAD_DIR = join(DATA_DIR, 'uploads')
const GENERATED_DIR = join(DATA_DIR, 'generated')
const PORT = Number(process.env.PORT || 5202)

await Promise.all([mkdir(UPLOAD_DIR, { recursive: true }), mkdir(GENERATED_DIR, { recursive: true })])

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image'
const COPY_MODEL = process.env.GEMINI_COPY_MODEL || 'gemini-3.1-flash-lite'
const GEMINI_API_URL =
  process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/interactions'
const METADATA_FALLBACK_URL = process.env.FITLOOP_METADATA_FALLBACK_URL || ''
const ALLOWED_ORIGINS = new Set(
  (process.env.FITLOOP_ALLOWED_ORIGINS ||
    'https://fitloop.jaeyeong2026.com,http://127.0.0.1:5173,http://localhost:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
)

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webp': 'image/webp',
}

let storeQueue = Promise.resolve()

const server = createServer(async (req, res) => {
  try {
    setSecurityHeaders(res)
    if (!isOriginAllowed(req)) return json(res, 403, { error: 'ORIGIN_NOT_ALLOWED' })
    setCorsHeaders(req, res)
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      return res.end()
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    if (url.pathname.startsWith('/api/')) {
      return await handleApi(req, res, url)
    }
    if (url.pathname.startsWith('/generated/')) {
      return await serveAsset(res, GENERATED_DIR, url.pathname.slice('/generated/'.length), true)
    }
    if (url.pathname.startsWith('/uploads/')) {
      return await serveAsset(res, UPLOAD_DIR, url.pathname.slice('/uploads/'.length), true)
    }
    return await serveFrontend(res, url.pathname)
  } catch (error) {
    const status = Number(error?.status) || 500
    if (status >= 500) console.error('[fitloop]', error)
    return json(res, status, {
      error: error?.code || 'INTERNAL_ERROR',
      message: status >= 500 && !error?.code ? '서버 처리 중 오류가 발생했습니다.' : error.message,
    })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`FitLoop server listening on http://127.0.0.1:${PORT}`)
})

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/health') {
    return json(res, 200, {
      ok: true,
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      coupangConfigured: Boolean(
        process.env.COUPANG_PARTNERS_ACCESS_KEY && process.env.COUPANG_PARTNERS_SECRET_KEY,
      ),
      imageModel: IMAGE_MODEL,
      copyModel: COPY_MODEL,
      generationLimit: null,
      persistence: true,
      deployment: 'server',
    })
  }

  if (req.method === 'POST' && url.pathname === '/api/products') {
    rateLimit(req, 'product', 30, 60 * 60 * 1000)
    const body = await readJson(req, 15 * 1024 * 1024)
    const product = await createProduct(body)
    await appendStore('products.json', product)
    return json(res, 201, product)
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/products/')) {
    const id = safeId(url.pathname.slice('/api/products/'.length))
    const products = await readStore('products.json')
    const product = products.find((item) => item.id === id)
    return product ? json(res, 200, product) : json(res, 404, { error: 'PRODUCT_NOT_FOUND' })
  }

  if (req.method === 'POST' && url.pathname === '/api/creatives/generate') {
    if (!process.env.GEMINI_API_KEY) {
      return json(res, 503, {
        error: 'IMAGE_GENERATION_NOT_CONFIGURED',
        message: 'Gemini API 키가 아직 서버에 설정되지 않았습니다.',
      })
    }
    const body = await readJson(req, 128 * 1024)
    const generated = await createCreative(body)
    await appendStore('generated.json', generated)
    return json(res, 201, generated)
  }

  if (req.method === 'POST' && url.pathname === '/api/copies/generate') {
    if (!process.env.GEMINI_API_KEY) {
      return json(res, 503, {
        error: 'COPY_GENERATION_NOT_CONFIGURED',
        message: 'Gemini API 키가 아직 서버에 설정되지 않았습니다.',
      })
    }
    const body = await readJson(req, 128 * 1024)
    return json(res, 201, await createCreativeCopies(body))
  }

  if (req.method === 'POST' && url.pathname === '/api/campaigns') {
    rateLimit(req, 'campaign', 30, 60 * 60 * 1000)
    const body = await readJson(req, 256 * 1024)
    if (!body.productId || typeof body.settings !== 'object') {
      return json(res, 400, { error: 'INVALID_CAMPAIGN' })
    }
    const campaign = {
      id: randomUUID(),
      productId: safeId(String(body.productId)),
      settings: body.settings,
      generatedCreativeIds: Array.isArray(body.generatedCreativeIds)
        ? body.generatedCreativeIds.slice(0, 12).map((id) => safeId(String(id)))
        : [],
      status: 'active',
      createdAt: new Date().toISOString(),
    }
    await appendStore('campaigns.json', campaign)
    return json(res, 201, campaign)
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/campaigns/')) {
    const id = safeId(url.pathname.slice('/api/campaigns/'.length))
    const campaigns = await readStore('campaigns.json')
    const campaign = campaigns.find((item) => item.id === id)
    return campaign ? json(res, 200, campaign) : json(res, 404, { error: 'CAMPAIGN_NOT_FOUND' })
  }

  return json(res, 404, { error: 'NOT_FOUND' })
}

async function createProduct(body) {
  const id = randomUUID()
  let image = null
  let sourceUrl
  let importedTitle = ''
  let importedPrice = null

  if (typeof body.imageDataUrl === 'string' && body.imageDataUrl) {
    image = decodeDataUrl(body.imageDataUrl)
  } else if (typeof body.sourceUrl === 'string' && body.sourceUrl) {
    sourceUrl = body.sourceUrl.slice(0, 2048)
    const imported = await importImageFromUrl(sourceUrl)
    image = imported.image
    importedTitle = imported.title
    importedPrice = imported.price
  } else {
    throw clientError(400, 'PRODUCT_IMAGE_REQUIRED', '상품 이미지나 공개 상품 URL이 필요합니다.')
  }

  const extension = extensionForMime(image.mime)
  const filename = `${id}${extension}`
  await writeFile(join(UPLOAD_DIR, filename), image.buffer, { flag: 'wx' })

  return {
    id,
    name: cleanText(body.name, 80) || cleanText(importedTitle, 80) || '새 패션 상품',
    price: productPrice(body.price) ?? importedPrice ?? 32900,
    category: cleanText(body.category, 60) || '패션',
    color: cleanText(body.color, 40) || '대표 컬러',
    fit: cleanText(body.fit, 40) || '기본 핏',
    imageUrl: `/uploads/${filename}`,
    ...(sourceUrl ? { sourceUrl } : {}),
    createdAt: new Date().toISOString(),
  }
}

async function createCreative(body) {
  const creativeId = safeId(String(body.creativeId || ''))
  const productId = safeId(String(body.productId || ''))
  if (!creativeId || !productId) {
    throw clientError(400, 'INVALID_GENERATION_REQUEST', '상품과 시안 ID가 필요합니다.')
  }

  const products = await readStore('products.json')
  const product = products.find((item) => item.id === productId)
  if (!product?.imageUrl) throw clientError(404, 'PRODUCT_NOT_FOUND', '저장된 상품을 찾지 못했습니다.')

  const imagePath = join(DATA_DIR, product.imageUrl.replace(/^\//, ''))
  const imageBuffer = await readFile(imagePath)
  const inputMime = MIME[extname(imagePath).toLowerCase()] || 'image/jpeg'
  const prompt = buildCreativePrompt({ ...body, productName: body.productName || product.name })

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      input: [
        { type: 'text', text: prompt },
        { type: 'image', mime_type: inputMime, data: imageBuffer.toString('base64') },
      ],
      response_format: {
        type: 'image',
        mime_type: 'image/jpeg',
        aspect_ratio: '3:4',
      },
    }),
    signal: AbortSignal.timeout(120_000),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = summarizeGeminiError(payload)
    console.error('[fitloop] Gemini error', response.status, detail)
    if (response.status === 429 && /prepayment credits|billing/i.test(detail)) {
      throw clientError(
        402,
        'GEMINI_BILLING_REQUIRED',
        'Gemini 프로젝트의 결제 크레딧이 부족합니다. AI Studio 결제 설정을 확인해 주세요.',
      )
    }
    if (response.status === 429) {
      throw clientError(
        429,
        'GEMINI_RATE_LIMITED',
        'Gemini 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.',
      )
    }
    throw clientError(502, 'GEMINI_REQUEST_FAILED', 'Gemini 이미지 생성 요청에 실패했습니다.')
  }

  const output = findImage(payload)
  if (!output?.data) throw clientError(502, 'GEMINI_IMAGE_MISSING', 'Gemini 응답에 이미지가 없습니다.')

  const id = randomUUID()
  const extension = extensionForMime(output.mime || 'image/jpeg')
  const filename = `${id}${extension}`
  await writeFile(join(GENERATED_DIR, filename), Buffer.from(output.data, 'base64'), { flag: 'wx' })

  return {
    id,
    creativeId,
    productId,
    imageUrl: `/generated/${filename}`,
    model: IMAGE_MODEL,
    copyText: cleanText(body.copyText, 40),
    promptVersion: 1,
    createdAt: new Date().toISOString(),
  }
}

async function createCreativeCopies(body) {
  const productId = safeId(String(body.productId || ''))
  const products = await readStore('products.json')
  const product = products.find((item) => item.id === productId)
  if (!product) throw clientError(404, 'PRODUCT_NOT_FOUND', '저장된 상품을 찾지 못했습니다.')

  const combinations = Array.isArray(body.combinations)
    ? body.combinations
        .slice(0, 12)
        .map((item) => ({
          creativeId: safeId(String(item?.creativeId || '')),
          modelLabel: cleanText(item?.modelLabel, 60),
          poseLabel: cleanText(item?.poseLabel, 40),
          backgroundLabel: cleanText(item?.backgroundLabel, 40),
        }))
        .filter((item) => item.creativeId)
    : []
  if (!combinations.length) {
    throw clientError(400, 'INVALID_COPY_REQUEST', '카피를 만들 시안 조합이 필요합니다.')
  }

  const fallbacks = fallbackCreativeCopies(product, combinations)
  const prompt = [
    `상품명: ${cleanText(body.productName, 80) || product.name}`,
    `카테고리: ${product.category}`,
    `색상: ${product.color}`,
    `핏: ${product.fit}`,
    '',
    '아래 광고 시안 조합 각각에 어울리는 한국어 패션 광고 카피를 한 개씩 작성하세요.',
    '각 카피는 12~26자, 한 문장, 서로 다른 표현이어야 합니다.',
    '과장된 효능, 최저가, 1위, 무료, 보장 같은 검증 불가능한 표현과 해시태그는 사용하지 마세요.',
    '상품명 자체를 반복하지 말고 착용 장면, 분위기, 핏의 매력을 자연스럽게 표현하세요.',
    ...combinations.map(
      (item) =>
        `${item.creativeId}: ${item.modelLabel || '성인 모델'} / ${item.poseLabel || '자연스러운 포즈'} / ${item.backgroundLabel || '스튜디오'}`,
    ),
  ].join('\n')

  try {
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
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
                    text: {
                      type: 'string',
                      description: '12~26자의 자연스러운 한국어 패션 광고 카피',
                    },
                  },
                  required: ['creativeId', 'text'],
                },
              },
            },
            required: ['copies'],
          },
        },
      }),
      signal: AbortSignal.timeout(30_000),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(summarizeGeminiError(payload))
    const parsed = JSON.parse(findTextOutput(payload) || '{}')
    const received = new Map(
      (Array.isArray(parsed.copies) ? parsed.copies : [])
        .map((item) => [safeId(String(item?.creativeId || '')), normalizeCopy(item?.text)])
        .filter(([creativeId, text]) => creativeId && text),
    )
    return {
      copies: fallbacks.map((fallback) => ({
        ...fallback,
        text: received.get(fallback.creativeId) || fallback.text,
      })),
      model: COPY_MODEL,
      source: received.size ? 'gemini' : 'fallback',
    }
  } catch (error) {
    console.error('[fitloop] Gemini copy error', cleanText(error?.message, 300))
    return { copies: fallbacks, model: COPY_MODEL, source: 'fallback' }
  }
}

function fallbackCreativeCopies(product, combinations) {
  const moods = [
    '오늘 입고, 매일 손이 가는 핏',
    '편안한 순간에도 선명한 실루엣',
    '자연스럽게 완성되는 데일리 룩',
    '움직일수록 살아나는 편안한 핏',
    '가볍게 입어도 분위기는 또렷하게',
    '일상에 자연스럽게 스며드는 스타일',
    '단정한 핏으로 시작하는 하루',
    '꾸민 듯 편안한 데일리 밸런스',
    '어디서나 시선이 머무는 실루엣',
    '내 움직임에 맞춘 자연스러운 핏',
    '오늘의 분위기를 바꾸는 한 벌',
    '평범한 거리도 화보처럼',
  ]
  const detail = cleanText(product.fit, 16)
  return combinations.map((item, index) => ({
    creativeId: item.creativeId,
    text: index === 0 && detail ? `${detail}, 매일 손이 가는 이유` : moods[index % moods.length],
  }))
}

function normalizeCopy(value) {
  return cleanText(value, 40).replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim()
}

function findTextOutput(payload) {
  if (typeof payload?.output_text === 'string') return payload.output_text
  const pools = [payload?.outputs, payload?.steps, payload?.output]
  for (const pool of pools) {
    const items = Array.isArray(pool) ? [...pool].reverse() : pool ? [pool] : []
    for (const item of items) {
      if (typeof item?.text === 'string') return item.text
      const content = Array.isArray(item?.content) ? item.content : []
      const text = content.find((part) => part?.type === 'text' && typeof part.text === 'string')
      if (text) return text.text
    }
  }
  return ''
}

function buildCreativePrompt(input) {
  const product = cleanText(input.productName, 80) || 'fashion garment'
  const model = cleanText(input.modelLabel, 60) || 'adult fashion model'
  const pose = cleanText(input.poseLabel, 40) || 'natural full-body pose'
  const background = cleanText(input.backgroundLabel, 60) || 'studio'
  return [
    `Create a premium Korean social-commerce fashion advertisement for ${product}.`,
    `Use an adult ${model} model in a ${pose}, photographed in a ${background} setting.`,
    'The uploaded product is the exact garment reference. Preserve its silhouette, knit or fabric texture, color, buttons, seams, neckline, sleeve length, and proportions faithfully.',
    'Make the garment the visual focus, with realistic anatomy, believable fabric drape, natural hands, clean lighting, and a polished editorial look.',
    'Vertical 3:4 composition. Leave calm negative space near the bottom for a web overlay.',
    'Do not add logos, watermarks, UI, captions, prices, or any rendered text. Do not change the garment design.',
  ].join(' ')
}

async function importImageFromUrl(rawUrl) {
  const pageUrl = await assertPublicUrl(rawUrl)
  const response = await fetchPublicResource(pageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FitLoop/1.0; +https://fitloop.jaeyeong2026.com)',
      Accept: 'text/html,application/xhtml+xml,image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.7',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.7',
    },
  })
  if (!response.ok) {
    const finalUrl = response.url || pageUrl.toString()
    if (isCoupangUrl(finalUrl) || isCoupangUrl(pageUrl)) return importCoupangProduct(finalUrl)
    const fallback = await importViaMetadataService(pageUrl)
    if (fallback) return fallback
    throw clientError(422, 'SOURCE_FETCH_FAILED', '상품 URL을 불러오지 못했습니다.')
  }

  const contentType = (response.headers.get('content-type') || '').split(';')[0].toLowerCase()
  if (contentType.startsWith('image/')) {
    return { image: await responseToImage(response, contentType), title: '', price: null }
  }

  const html = await readLimitedResponse(response, 3 * 1024 * 1024, '상품 페이지가 너무 큽니다.')
  const text = html.toString('utf8')
  const finalPageUrl = response.url || pageUrl.toString()
  const candidates = extractProductImageCandidates(text, finalPageUrl).slice(0, 16)
  for (const candidate of candidates) {
    try {
      const imageResponse = await fetchPublicResource(candidate.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FitLoop/1.0; +https://fitloop.jaeyeong2026.com)',
          Accept: 'image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.5',
          Referer: finalPageUrl,
        },
      })
      if (!imageResponse.ok) continue
      const imageType = (imageResponse.headers.get('content-type') || '').split(';')[0].toLowerCase()
      const image = await responseToImage(imageResponse, imageType)
      return { image, title: extractProductTitle(text), price: extractProductPrice(text) }
    } catch (error) {
      if (error?.code === 'REMOTE_FILE_TOO_LARGE') throw error
    }
  }
  if (isCoupangUrl(finalPageUrl)) return importCoupangProduct(finalPageUrl)
  const fallback = await importViaMetadataService(finalPageUrl)
  if (fallback) return fallback
  throw clientError(422, 'PRODUCT_IMAGE_NOT_FOUND', '상품 페이지에서 사용할 수 있는 대표 이미지를 찾지 못했습니다.')
}

async function importCoupangProduct(rawUrl) {
  const productId = extractCoupangProductId(rawUrl)
  if (!productId) {
    throw clientError(422, 'COUPANG_PRODUCT_ID_NOT_FOUND', '쿠팡 상품 번호를 URL에서 확인하지 못했습니다.')
  }

  const accessKey = process.env.COUPANG_PARTNERS_ACCESS_KEY
  const secretKey = process.env.COUPANG_PARTNERS_SECRET_KEY
  if (!accessKey || !secretKey) {
    throw clientError(
      503,
      'COUPANG_PARTNERS_NOT_CONFIGURED',
      '쿠팡 페이지는 자동 접근을 차단합니다. 서버에 쿠팡 파트너스 API 키를 설정해 주세요.',
    )
  }

  const path = '/v2/providers/affiliate_open_api/apis/openapi/v1/products/search'
  const query = `keyword=${encodeURIComponent(productId)}&limit=10`
  const authorization = createCoupangAuthorization({ accessKey, secretKey, method: 'GET', path, query })
  let response
  try {
    response = await fetch(`https://api-gateway.coupang.com${path}?${query}`, {
      headers: { Authorization: authorization, 'User-Agent': 'FitLoop/1.0' },
      signal: AbortSignal.timeout(12_000),
    })
  } catch {
    throw clientError(502, 'COUPANG_PARTNERS_FAILED', '쿠팡 상품 정보를 불러오지 못했습니다.')
  }

  const rawPayload = await readLimitedResponse(response, 1024 * 1024, '쿠팡 응답이 너무 큽니다.')
  const payload = JSON.parse(rawPayload.toString('utf8') || '{}')
  if (!response.ok || payload?.rCode !== '0') {
    console.error('[fitloop] Coupang Partners error', response.status, cleanText(payload?.rMessage, 200))
    throw clientError(502, 'COUPANG_PARTNERS_FAILED', '쿠팡 파트너스 API 요청에 실패했습니다.')
  }

  const products = Array.isArray(payload?.data?.productData)
    ? payload.data.productData
    : Array.isArray(payload?.data)
      ? payload.data
      : []
  const product = selectCoupangProduct(products, productId)
  if (!product?.productImage) {
    throw clientError(422, 'COUPANG_PRODUCT_NOT_FOUND', '쿠팡에서 동일한 상품의 대표 이미지를 찾지 못했습니다.')
  }

  const imageResponse = await fetchPublicResource(product.productImage, {
    headers: { Accept: 'image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.5' },
  })
  if (!imageResponse.ok) throw clientError(422, 'PRODUCT_IMAGE_NOT_FOUND', '쿠팡 상품 이미지를 불러오지 못했습니다.')
  const imageType = (imageResponse.headers.get('content-type') || '').split(';')[0].toLowerCase()
  return {
    image: await responseToImage(imageResponse, imageType),
    title: cleanText(product.productName, 160),
    price: productPrice(product.productPrice),
  }
}

async function importViaMetadataService(rawUrl) {
  if (!METADATA_FALLBACK_URL) return null
  try {
    const endpoint = new URL(METADATA_FALLBACK_URL)
    endpoint.searchParams.set('url', String(rawUrl))
    endpoint.searchParams.set('meta', 'true')
    const response = await fetchPublicResource(endpoint)
    if (!response.ok) return null
    const rawPayload = await readLimitedResponse(response, 1024 * 1024, '메타데이터 응답이 너무 큽니다.')
    const payload = JSON.parse(rawPayload.toString('utf8') || '{}')
    const data = payload?.data
    const title = cleanText(data?.title, 160)
    const description = cleanText(data?.description, 240)
    if (!data || /access denied|forbidden|captcha|robot check/i.test(`${title} ${description}`)) return null
    const imageUrl = typeof data.image === 'string' ? data.image : data.image?.url
    if (!imageUrl) return null
    const imageResponse = await fetchPublicResource(imageUrl, {
      headers: { Accept: 'image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.5', Referer: String(rawUrl) },
    })
    if (!imageResponse.ok) return null
    const imageType = (imageResponse.headers.get('content-type') || '').split(';')[0].toLowerCase()
    return { image: await responseToImage(imageResponse, imageType), title, price: productPrice(data?.price) }
  } catch (error) {
    if (error?.code === 'REMOTE_FILE_TOO_LARGE') throw error
    return null
  }
}

async function fetchPublicResource(rawUrl, options = {}, redirectsRemaining = 5) {
  const url = await assertPublicUrl(rawUrl)
  let response
  try {
    response = await fetch(url, {
      ...options,
      redirect: 'manual',
      signal: AbortSignal.timeout(12_000),
    })
  } catch (error) {
    if (error?.status) throw error
    throw clientError(422, 'SOURCE_FETCH_FAILED', '원격 페이지 또는 이미지를 불러오지 못했습니다.')
  }
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    if (redirectsRemaining <= 0) throw clientError(422, 'TOO_MANY_REDIRECTS', '리다이렉트가 너무 많습니다.')
    const location = response.headers.get('location')
    if (!location) throw clientError(422, 'SOURCE_FETCH_FAILED', '리다이렉트 주소가 올바르지 않습니다.')
    return fetchPublicResource(new URL(location, url).toString(), options, redirectsRemaining - 1)
  }
  return response
}

async function responseToImage(response, mime) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    throw clientError(415, 'UNSUPPORTED_IMAGE', 'JPG, PNG, WebP 이미지만 사용할 수 있습니다.')
  }
  return { mime, buffer: await readLimitedResponse(response, 8 * 1024 * 1024) }
}

function decodeDataUrl(value) {
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/)
  if (!match) throw clientError(415, 'UNSUPPORTED_IMAGE', 'JPG, PNG, WebP 이미지만 사용할 수 있습니다.')
  const buffer = Buffer.from(match[2], 'base64')
  if (!buffer.length || buffer.length > 8 * 1024 * 1024) {
    throw clientError(413, 'IMAGE_TOO_LARGE', '이미지는 8MB 이하여야 합니다.')
  }
  return { mime: match[1], buffer }
}

async function assertPublicUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw clientError(400, 'INVALID_URL', '올바른 http 또는 https URL이 필요합니다.')
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw clientError(400, 'INVALID_URL', '올바른 http 또는 https URL이 필요합니다.')
  }
  const addresses = await lookup(url.hostname, { all: true })
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw clientError(400, 'PRIVATE_URL_BLOCKED', '내부 네트워크 주소는 가져올 수 없습니다.')
  }
  return url
}

function isPrivateAddress(address) {
  const normalizedAddress = address.replace(/^::ffff:/, '')
  if (normalizedAddress === '::' || normalizedAddress === '::1' || normalizedAddress === '0:0:0:0:0:0:0:1') return true
  if (normalizedAddress.includes(':')) return /^(?:fc|fd|fe8|fe9|fea|feb|ff|2001:db8)/i.test(normalizedAddress)
  const parts = normalizedAddress.split('.').map(Number)
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && (parts[1] === 0 || parts[1] === 168)) ||
    (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19 || parts[1] === 51)) ||
    (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) ||
    parts[0] === 0 ||
    parts[0] >= 224
  )
}

function findImage(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return null
  seen.add(value)
  const mime = value.mime_type || value.mimeType
  if (typeof value.data === 'string' && typeof mime === 'string' && mime.startsWith('image/')) {
    return { data: value.data, mime }
  }
  if (value.output_image?.data) {
    return { data: value.output_image.data, mime: value.output_image.mime_type || 'image/jpeg' }
  }
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    const result = findImage(child, seen)
    if (result) return result
  }
  return null
}

const transientLimits = new Map()
function rateLimit(req, bucket, limit, windowMs) {
  const key = `${bucket}:${clientFingerprint(req)}`
  const now = Date.now()
  const current = transientLimits.get(key)
  if (!current || current.resetAt <= now) {
    transientLimits.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  if (current.count >= limit) throw clientError(429, 'RATE_LIMITED', '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.')
  current.count++
}

function clientFingerprint(req) {
  const ip = String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
    .split(',')[0]
    .trim()
  return createHash('sha256').update(`fitloop:${ip}`).digest('hex').slice(0, 24)
}

async function readStore(filename) {
  try {
    const contents = await readFile(join(DATA_DIR, filename), 'utf8')
    const parsed = JSON.parse(contents)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

async function appendStore(filename, item) {
  return mutateStore(filename, (items) => [...items, item])
}

async function mutateStore(filename, mutate) {
  let result
  const operation = storeQueue.catch(() => {}).then(async () => {
    const items = await readStore(filename)
    result = mutate(items)
    const destination = join(DATA_DIR, filename)
    const temporary = `${destination}.${process.pid}.tmp`
    await writeFile(temporary, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 })
    await rename(temporary, destination)
  })
  storeQueue = operation.catch(() => {})
  await operation
  return result
}

async function serveFrontend(res, pathname) {
  const clean = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '')
  const candidate = safeJoin(DIST_DIR, clean)
  if (candidate && (await isFile(candidate))) return serveFile(res, candidate, false)
  return serveFile(res, join(DIST_DIR, 'index.html'), false)
}

async function serveAsset(res, base, filename, privateCache) {
  const candidate = safeJoin(base, filename)
  if (!candidate || !(await isFile(candidate))) return json(res, 404, { error: 'NOT_FOUND' })
  return serveFile(res, candidate, privateCache)
}

async function serveFile(res, filepath, privateCache) {
  const content = await readFile(filepath)
  res.writeHead(200, {
    'Content-Type': MIME[extname(filepath).toLowerCase()] || 'application/octet-stream',
    'Content-Length': content.length,
    'Cache-Control': privateCache ? 'private, max-age=86400' : filepath.endsWith('index.html') ? 'no-cache' : 'public, max-age=604800',
  })
  res.end(content)
}

function safeJoin(base, filename) {
  const destination = resolve(base, normalize(filename))
  return destination === resolve(base) || destination.startsWith(`${resolve(base)}/`) ? destination : null
}

async function isFile(filepath) {
  try {
    return (await stat(filepath)).isFile()
  } catch {
    return false
  }
}

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; script-src 'self' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  )
}

function isOriginAllowed(req) {
  const origin = req.headers.origin
  if (!origin) return true
  const protocol = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim()
  const requestOrigin = `${protocol}://${req.headers.host}`
  return origin === requestOrigin || ALLOWED_ORIGINS.has(origin)
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin
  if (!origin || !isOriginAllowed(req)) return
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '86400')
  res.setHeader('Vary', 'Origin')
}

async function readJson(req, maxBytes) {
  const chunks = []
  let bytes = 0
  for await (const chunk of req) {
    bytes += chunk.length
    if (bytes > maxBytes) throw clientError(413, 'PAYLOAD_TOO_LARGE', '요청 데이터가 너무 큽니다.')
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
  } catch {
    throw clientError(400, 'INVALID_JSON', '올바른 JSON 요청이 아닙니다.')
  }
}

async function readLimitedResponse(response, maxBytes, tooLargeMessage = '원격 이미지가 너무 큽니다.') {
  const reader = response.body?.getReader()
  if (!reader) return Buffer.alloc(0)
  const chunks = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      throw clientError(413, 'REMOTE_FILE_TOO_LARGE', tooLargeMessage)
    }
    chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks)
}

function json(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

function clientError(status, code, message) {
  const error = new Error(message)
  error.status = status
  error.code = code
  return error
}

function safeId(value) {
  return /^[A-Za-z0-9_-]{1,80}$/.test(value) ? value : ''
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return ''
  return [...value]
    .filter((character) => {
      const codePoint = character.codePointAt(0) || 0
      return codePoint > 31 && codePoint !== 127
    })
    .join('')
    .trim()
    .slice(0, maxLength)
}

function productPrice(value) {
  if (value === null || value === undefined || value === '') return null
  const normalized = typeof value === 'string' ? value.replace(/[^\d.]/g, '') : value
  const number = Number(normalized)
  return Number.isFinite(number) ? Math.min(100_000_000, Math.max(0, Math.round(number))) : null
}

function extensionForMime(mime) {
  return mime === 'image/png' ? '.png' : mime === 'image/webp' ? '.webp' : '.jpg'
}

function summarizeGeminiError(payload) {
  return cleanText(payload?.error?.message || payload?.message || 'unknown', 300)
}

async function loadEnv(filepath) {
  try {
    const text = await readFile(filepath, 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
      if (!match || process.env[match[1]] !== undefined) continue
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}
