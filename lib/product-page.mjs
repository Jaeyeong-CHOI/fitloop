const IMAGE_KEYS = ['contentUrl', 'url']

export function extractProductImageCandidates(html, pageUrl) {
  const candidates = []
  let sequence = 0

  const add = (value, score, source) => {
    for (const rawValue of expandCandidateValue(value)) {
      const url = resolveImageUrl(rawValue, pageUrl)
      if (!url) continue
      candidates.push({ url, score, source, sequence: sequence++ })
    }
  }

  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attributes = parseAttributes(tag)
    const key = (attributes.property || attributes.name || attributes.itemprop || '').toLowerCase()
    const content = attributes.content
    if (!content) continue
    if (key === 'og:image:secure_url') add(content, 120, key)
    else if (key === 'og:image') add(content, 115, key)
    else if (key === 'twitter:image' || key === 'twitter:image:src') add(content, 105, key)
    else if (key === 'image' || key === 'thumbnailurl') add(content, 92, key)
  }

  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    const attributes = parseAttributes(tag)
    const rel = (attributes.rel || '').toLowerCase().split(/\s+/)
    if (rel.includes('image_src')) add(attributes.href, 100, 'link:image_src')
    if (rel.includes('preload') && (attributes.as || '').toLowerCase() === 'image') {
      add(attributes.imagesrcset || attributes.href, 82, 'link:preload')
    }
  }

  const jsonLdPattern = /<script\b[^>]*type\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json'|application\/ld\+json)[^>]*>([\s\S]*?)<\/script\s*>/gi
  for (const match of html.matchAll(jsonLdPattern)) {
    const parsed = parseJsonLd(match[1])
    if (parsed === undefined) continue
    collectJsonLdImages(parsed, add)
  }

  for (const tag of html.match(/<img\b[^>]*>/gi) || []) {
    const attributes = parseAttributes(tag)
    const identity = `${attributes.id || ''} ${attributes.class || ''} ${attributes.itemprop || ''}`.toLowerCase()
    const productLike = /product|goods|detail|main|primary|featured|zoom|gallery/.test(identity)
    const itemProp = (attributes.itemprop || '').toLowerCase() === 'image'
    const baseScore = itemProp ? 90 : productLike ? 70 : 35
    add(attributes['data-zoom-image'], baseScore + 12, 'img:data-zoom-image')
    add(attributes['data-origin'] || attributes['data-original'], baseScore + 10, 'img:data-original')
    add(attributes['data-src'] || attributes['data-lazy-src'], baseScore + 8, 'img:data-src')
    add(attributes.srcset || attributes['data-srcset'], baseScore + 5, 'img:srcset')
    add(attributes.src, baseScore, 'img:src')
  }

  const bestByUrl = new Map()
  for (const candidate of candidates) {
    const previous = bestByUrl.get(candidate.url)
    if (!previous || candidate.score > previous.score) bestByUrl.set(candidate.url, candidate)
  }
  return [...bestByUrl.values()]
    .sort((left, right) => right.score - left.score || left.sequence - right.sequence)
    .map(({ url, source }) => ({ url, source }))
}

export function extractProductTitle(html) {
  const preferredKeys = ['og:title', 'twitter:title']
  const metadata = new Map()
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attributes = parseAttributes(tag)
    const key = (attributes.property || attributes.name || '').toLowerCase()
    if (key && attributes.content) metadata.set(key, decodeHtmlEntities(attributes.content).trim())
  }
  for (const key of preferredKeys) {
    if (metadata.get(key)) return metadata.get(key)
  }
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1]
  return title ? decodeHtmlEntities(title.replace(/<[^>]+>/g, '')).trim() : ''
}

export function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&#(\d+);?/g, (entity, number) => decodeNumericEntity(entity, number, 10))
    .replace(/&#x([\da-f]+);?/gi, (entity, number) => decodeNumericEntity(entity, number, 16))
    .replace(/&(?:amp|#38);/gi, '&')
    .replace(/&(?:quot|#34);/gi, '"')
    .replace(/&(?:apos|#39);/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
}

function parseAttributes(tag) {
  const attributes = {}
  const pattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let match
  while ((match = pattern.exec(tag))) {
    const key = match[1].toLowerCase()
    if (key.startsWith('<') || key === 'meta' || key === 'link' || key === 'img') continue
    attributes[key] = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? '')
  }
  return attributes
}

function expandCandidateValue(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.flatMap(expandCandidateValue)
  if (typeof value === 'object') return IMAGE_KEYS.flatMap((key) => expandCandidateValue(value[key]))
  const text = decodeHtmlEntities(value).trim()
  if (!text || /^(?:data|blob|javascript):/i.test(text)) return []
  if (!/\s\d+(?:\.\d+)?[wx](?:\s*,|\s*$)/i.test(text)) return [text]
  return text
    .split(',')
    .map((entry) => entry.trim().split(/\s+\d+(?:\.\d+)?[wx]\s*$/i)[0])
    .reverse()
}

function decodeNumericEntity(entity, number, radix) {
  const codePoint = Number.parseInt(number, radix)
  try {
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity
  } catch {
    return entity
  }
}

function resolveImageUrl(value, pageUrl) {
  try {
    const text = String(value || '').trim()
    if (!text || /^(?:data|blob|javascript):/i.test(text)) return null
    const url = new URL(text, pageUrl)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

function parseJsonLd(value) {
  const text = decodeHtmlEntities(value)
    .replace(/^\s*<!--|-->\s*$/g, '')
    .trim()
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function collectJsonLdImages(value, add, seen = new Set(), productContext = false) {
  if (!value || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  if (Array.isArray(value)) {
    for (const item of value) collectJsonLdImages(item, add, seen, productContext)
    return
  }

  const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']]
  const isProduct = productContext || types.some((type) => String(type).toLowerCase() === 'product')
  if (value.image) add(value.image, isProduct ? 112 : 76, isProduct ? 'jsonld:product' : 'jsonld:image')
  if (isProduct && value.thumbnailUrl) add(value.thumbnailUrl, 96, 'jsonld:thumbnail')

  for (const [key, child] of Object.entries(value)) {
    if (key === 'image' || key === 'thumbnailUrl') continue
    collectJsonLdImages(child, add, seen, isProduct)
  }
}
