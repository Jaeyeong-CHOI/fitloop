import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  decodeHtmlEntities,
  extractProductImageCandidates,
  extractProductTitle,
} from '../lib/product-page.mjs'

test('prefers a relative Open Graph product image and decodes entities', () => {
  const html = `
    <html><head>
      <meta content="니트 &amp; 가디건" property="og:title">
      <meta content="/products/cardigan.jpg?width=1200&amp;quality=90" property="og:image">
    </head></html>`
  const candidates = extractProductImageCandidates(html, 'https://shop.example.com/items/123')
  assert.equal(candidates[0].url, 'https://shop.example.com/products/cardigan.jpg?width=1200&quality=90')
  assert.equal(candidates[0].source, 'og:image')
  assert.equal(extractProductTitle(html), '니트 & 가디건')
})

test('extracts a Product image array from JSON-LD before unrelated images', () => {
  const html = `
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [
          {"@type": "Organization", "image": "https://cdn.example.com/logo.jpg"},
          {"@type": "Product", "image": [
            "https://cdn.example.com/product-front.webp",
            {"url": "https://cdn.example.com/product-back.webp"}
          ]}
        ]
      }
    </script>`
  const candidates = extractProductImageCandidates(html, 'https://shop.example.com/product')
  assert.deepEqual(candidates.slice(0, 2).map((candidate) => candidate.url), [
    'https://cdn.example.com/product-front.webp',
    'https://cdn.example.com/product-back.webp',
  ])
})

test('supports Twitter cards, image_src links, lazy images, and srcset', () => {
  const html = `
    <meta name='twitter:image' content='https://cdn.example.com/twitter.jpg'>
    <link rel='image_src' href='https://cdn.example.com/link.jpg'>
    <img class='product-detail-main' data-src='/lazy.webp'
      srcset='/small.jpg 320w, /large.jpg 1280w' src='/placeholder.jpg'>`
  const candidates = extractProductImageCandidates(html, 'https://shop.example.com/products/1')
  assert.equal(candidates[0].url, 'https://cdn.example.com/twitter.jpg')
  assert.ok(candidates.some((candidate) => candidate.url === 'https://shop.example.com/lazy.webp'))
  assert.ok(candidates.some((candidate) => candidate.url === 'https://shop.example.com/large.jpg'))
})

test('removes duplicate and unsafe image candidates', () => {
  const html = `
    <meta property="og:image" content="javascript:alert(1)">
    <img class="product-main" src="data:image/png;base64,AA==">
    <img itemprop="image" src="/same.jpg">
    <meta property="og:image" content="/same.jpg">`
  const candidates = extractProductImageCandidates(html, 'https://shop.example.com/product')
  assert.deepEqual(candidates, [{ url: 'https://shop.example.com/same.jpg', source: 'og:image' }])
})

test('decodes numeric HTML entities', () => {
  assert.equal(decodeHtmlEntities('A&#38;B &#x1F9E5;'), 'A&B 🧥')
})
