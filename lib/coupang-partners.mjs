import { createHmac } from 'node:crypto'

export function isCoupangUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'coupang.com' || hostname.endsWith('.coupang.com') || hostname === 'coupa.ng'
  } catch {
    return false
  }
}

export function extractCoupangProductId(value) {
  try {
    const url = new URL(value)
    const pathMatch = url.pathname.match(/\/products\/(\d+)/i)
    if (pathMatch) return pathMatch[1]
    for (const key of ['productId', 'pageValue']) {
      const candidate = url.searchParams.get(key)
      if (/^\d+$/.test(candidate || '')) return candidate
    }
  } catch {
    // Invalid URLs are validated by the caller.
  }
  return ''
}

export function createCoupangAuthorization({ accessKey, secretKey, method, path, query, date = new Date() }) {
  const signedDate = formatCoupangDate(date)
  const message = `${signedDate}${method.toUpperCase()}${path}${query}`
  const signature = createHmac('sha256', secretKey).update(message).digest('hex')
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${signedDate}, signature=${signature}`
}

export function selectCoupangProduct(products, productId) {
  if (!Array.isArray(products) || !productId) return null
  return (
    products.find((product) => String(product?.productId || '') === productId) ||
    products.find((product) => extractCoupangProductId(product?.productUrl || '') === productId) ||
    null
  )
}

function formatCoupangDate(value) {
  const date = value instanceof Date ? value : new Date(value)
  const compact = date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  return compact.slice(2)
}
