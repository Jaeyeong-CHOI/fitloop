import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createCoupangAuthorization,
  extractCoupangProductId,
  isCoupangUrl,
  selectCoupangProduct,
} from '../lib/coupang-partners.mjs'

test('recognizes Coupang hosts and extracts product ids', () => {
  assert.equal(isCoupangUrl('https://www.coupang.com/vp/products/9528995387'), true)
  assert.equal(isCoupangUrl('https://link.coupang.com/a/abc'), true)
  assert.equal(isCoupangUrl('https://example.com/products/9528995387'), false)
  assert.equal(extractCoupangProductId('https://www.coupang.com/vp/products/9528995387?itemId=1'), '9528995387')
  assert.equal(extractCoupangProductId('https://www.coupang.com/np/search?pageValue=7227689858'), '7227689858')
})

test('selects only the exact Coupang product', () => {
  const products = [
    { productId: 11, productName: 'wrong', productUrl: 'https://www.coupang.com/vp/products/11' },
    { productId: 22, productName: 'right', productUrl: 'https://www.coupang.com/vp/products/22' },
  ]
  assert.equal(selectCoupangProduct(products, '22')?.productName, 'right')
  assert.equal(selectCoupangProduct(products, '33'), null)
})

test('creates deterministic Coupang HMAC authorization', () => {
  const authorization = createCoupangAuthorization({
    accessKey: 'access',
    secretKey: 'secret',
    method: 'GET',
    path: '/v2/example',
    query: 'keyword=123&limit=10',
    date: new Date('2026-07-29T01:02:03.000Z'),
  })
  assert.match(authorization, /^CEA algorithm=HmacSHA256, access-key=access, signed-date=260729T010203Z, signature=[a-f0-9]{64}$/)
})
