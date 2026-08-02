import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const baseUrl = process.env.FITLOOP_QA_URL || 'http://127.0.0.1:5202'
const outputDir = process.env.FITLOOP_QA_OUTPUT || '/tmp/fitloop-qa'
await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const errors = []
const unexpectedApiRequests = []
const blockedThirdPartyScripts = []

function captureConsoleError(message, label) {
  const text = message.text()
  if (
    text.includes('static.cloudflareinsights.com/beacon.min.js') &&
    text.includes('violates the following Content Security Policy')
  ) {
    blockedThirdPartyScripts.push(`${label}: Cloudflare Insights blocked by CSP`)
    return
  }
  errors.push(`${label}: ${text}`)
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  assert.ok(overflow <= 1, `${label} horizontal overflow: ${overflow}px`)
}

try {
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport })
    page.on('pageerror', (error) => errors.push(`${viewport.name}: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error') captureConsoleError(message, viewport.name)
    })
    page.on('request', (request) => {
      const url = request.url()
      if (
        url.includes('fitloop-api.jaeyeong2026.com') ||
        url.includes('generativelanguage.googleapis.com') ||
        /\/api\//.test(url)
      ) {
        unexpectedApiRequests.push(`${viewport.name}: ${url}`)
      }
    })

    const response = await page.goto(baseUrl, { waitUntil: 'networkidle' })
    assert.equal(response?.status(), 200)
    await page.getByRole('heading', { name: /광고 이미지를 만들고/ }).waitFor()
    await page.getByRole('heading', { name: '발표 자료' }).waitFor()
    assert.equal(await page.locator('a[href="/presentations/fitloop-presentation.pdf"]').count(), 1)
    assert.equal(await page.locator('a[href="/presentations/fitloop-a2-poster.pdf"]').count(), 1)
    assert.equal(await page.locator('img[src*="/presentations/"]').count(), 2)
    for (const asset of [
      '/presentations/fitloop-presentation.pdf',
      '/presentations/fitloop-a2-poster.pdf',
    ]) {
      const pdfResponse = await page.request.get(new URL(asset, baseUrl).href)
      assert.equal(pdfResponse.status(), 200)
      assert.match(pdfResponse.headers()['content-type'] || '', /application\/pdf/)
    }
    await assertNoHorizontalOverflow(page, `${viewport.name} portfolio`)
    await page.screenshot({ path: `${outputDir}/${viewport.name}-portfolio.png`, fullPage: true })

    await page.getByRole('button', { name: '데모 체험' }).click()
    await page.getByRole('heading', { name: /옷 사진 한 장이면/ }).waitFor()
    await page.getByText(/API 키를 연결하지 않으면/).waitFor()
    await assertNoHorizontalOverflow(page, `${viewport.name} demo home`)
    if (viewport.name === 'mobile') {
      await page.getByRole('button', { name: 'API 키 연결' }).first().click()
      await page.getByRole('dialog', { name: 'Gemini API 연결' }).waitFor()
      await assertNoHorizontalOverflow(page, 'mobile API key dialog')
      await page.screenshot({ path: `${outputDir}/mobile-api-key-dialog.png`, fullPage: true })
      await page.getByRole('button', { name: '닫기' }).click()
    }

    await page.getByPlaceholder(/상품 URL/).fill('https://www.musinsa.com/products/4672509')
    await page.getByRole('button', { name: '가져오기' }).click()
    await page.getByText('상품 분석 완료').waitFor()
    await page.getByRole('button', { name: /예산과 타겟 정하러 가기/ }).click()
    await page.getByRole('heading', { name: /얼마로, 누구에게/ }).waitFor()
    await assertNoHorizontalOverflow(page, `${viewport.name} campaign`)

    await page.getByRole('button', { name: /모델 고르러 가기/ }).click()
    await page.getByRole('heading', { name: /어떤 모델이 입어볼까요/ }).waitFor()
    await page.getByText('4/4명 선택됨').waitFor()
    await assertNoHorizontalOverflow(page, `${viewport.name} models`)

    await page.getByRole('button', { name: /예시 시안 12종 보기/ }).click()
    await page.getByRole('heading', { name: /예시 광고 시안 12종/ }).waitFor()
    await page.getByText(/Gemini API 키를 연결하면/).waitFor()
    await page.waitForTimeout(600)
    assert.equal(await page.locator('img[src*="/creatives/"]').count(), 12)
    await assertNoHorizontalOverflow(page, `${viewport.name} creatives`)
    await page.screenshot({ path: `${outputDir}/${viewport.name}-creatives.png`, fullPage: true })

    await page.getByRole('button', { name: /이 시안으로 광고 시작하기/ }).click()
    await page.getByRole('heading', { name: '성과 대시보드' }).waitFor()
    await assertNoHorizontalOverflow(page, `${viewport.name} dashboard`)
    await page.screenshot({ path: `${outputDir}/${viewport.name}-dashboard.png`, fullPage: true })
    await page.close()
  }

  assert.deepEqual(
    unexpectedApiRequests,
    [],
    `no-key portfolio made API requests:\n${unexpectedApiRequests.join('\n')}`,
  )

  const byokPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const byokKey = 'test-browser-only-key-1234567890'
  const requestKeys = []
  const requestBodies = []
  let validationRequests = 0
  let copyRequests = 0
  let imageRequests = 0
  let activeImages = 0
  let maxActiveImages = 0
  const nonGoogleKeyLeaks = []
  const origin = new URL(baseUrl).origin
  const corsHeaders = {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,x-goog-api-key',
  }
  const pixel =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XwLzWQAAAABJRU5ErkJggg=='

  await byokPage.route('https://generativelanguage.googleapis.com/**', async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders })
      return
    }
    requestKeys.push(request.headers()['x-goog-api-key'] || '')
    if (request.method() === 'GET' && request.url().includes('/models/')) {
      validationRequests++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({ name: 'models/gemini-3.1-flash-image' }),
      })
      return
    }

    const body = request.postDataJSON()
    requestBodies.push(body)
    if (body.model === 'gemini-3.1-flash-lite') {
      copyRequests++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({
          outputs: [
            {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    copies: body.response_format.schema.properties.copies.items.properties.creativeId.enum.map(
                      (creativeId, index) => ({ creativeId, text: `브라우저 카피 ${index + 1}` }),
                    ),
                  }),
                },
              ],
            },
          ],
        }),
      })
      return
    }

    imageRequests++
    activeImages++
    maxActiveImages = Math.max(maxActiveImages, activeImages)
    await new Promise((resolve) => setTimeout(resolve, 40))
    activeImages--
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({ output_image: { data: pixel, mime_type: 'image/png' } }),
    })
  })

  byokPage.on('pageerror', (error) => errors.push(`byok: ${error.message}`))
  byokPage.on('console', (message) => {
    if (message.type() === 'error') captureConsoleError(message, 'byok')
  })
  byokPage.on('request', (request) => {
    if (request.url().includes('generativelanguage.googleapis.com')) return
    if (
      request.url().includes(byokKey) ||
      Object.values(request.headers()).includes(byokKey) ||
      request.postData()?.includes(byokKey)
    ) {
      nonGoogleKeyLeaks.push(request.url())
    }
  })

  await byokPage.goto(baseUrl, { waitUntil: 'networkidle' })
  await byokPage.getByRole('button', { name: 'API 키 연결' }).first().click()
  await byokPage.screenshot({ path: `${outputDir}/desktop-api-key-dialog.png`, fullPage: true })
  await byokPage.getByPlaceholder('Gemini API 키 붙여넣기').fill(byokKey)
  await byokPage.getByRole('button', { name: '검증하고 연결' }).click()
  await byokPage.getByRole('button', { name: 'API 연결됨' }).waitFor()
  assert.equal(validationRequests, 1)
  assert.equal(
    await byokPage.evaluate(() => localStorage.getItem('fitloop:gemini-api-key')),
    byokKey,
  )

  await byokPage.getByRole('button', { name: '데모 체험' }).click()
  await byokPage.getByText(/Nano Banana 2가 연결됐습니다/).waitFor()
  await byokPage.getByPlaceholder(/상품 URL/).fill('https://example.com/product')
  await byokPage.getByRole('button', { name: '가져오기' }).click()
  await byokPage.getByText('상품 분석 완료').waitFor()
  await byokPage.getByRole('button', { name: /예산과 타겟 정하러 가기/ }).click()
  await byokPage.getByRole('button', { name: /모델 고르러 가기/ }).click()
  byokPage.once('dialog', (dialog) => dialog.accept())
  await byokPage.getByRole('button', { name: /Nano Banana로 시안 12종 생성/ }).click()
  await byokPage.getByRole('heading', { name: /병렬 생성/ }).waitFor()
  await byokPage.getByRole('button', { name: '12종 생성 완료' }).waitFor({ timeout: 10_000 })
  await byokPage.waitForFunction(() =>
    [...document.querySelectorAll('img[src^="data:image/png;base64,"]')].every(
      (image) => image.complete && image.naturalWidth > 0,
    ),
  )
  await byokPage.screenshot({ path: `${outputDir}/desktop-byok-creatives.png`, fullPage: true })

  assert.equal(copyRequests, 1)
  assert.equal(imageRequests, 12)
  assert.equal(maxActiveImages, 4)
  assert.ok(requestKeys.every((key) => key === byokKey))
  assert.ok(requestBodies.every((body) => !JSON.stringify(body).includes(byokKey)))
  assert.deepEqual(nonGoogleKeyLeaks, [])
  assert.equal(await byokPage.locator('img[src^="data:image/png;base64,"]').count(), 12)
  assert.ok(!byokPage.url().includes(byokKey))

  await byokPage.reload({ waitUntil: 'networkidle' })
  await byokPage.getByRole('button', { name: /Nano Banana 연결됨/ }).click()
  assert.ok(!(await byokPage.locator('body').textContent()).includes(byokKey))
  assert.equal(await byokPage.getByPlaceholder('Gemini API 키 붙여넣기').inputValue(), '')
  await byokPage.getByRole('button', { name: '키 삭제' }).click()
  assert.equal(
    await byokPage.evaluate(() => localStorage.getItem('fitloop:gemini-api-key')),
    null,
  )
  await byokPage.getByRole('button', { name: '닫기' }).click()
  await byokPage.getByRole('button', { name: 'API 키 연결' }).first().waitFor()
  await byokPage.close()

  assert.deepEqual(errors, [])
  console.log(`Portfolio fallback QA passed: ${baseUrl}`)
  console.log(`Browser BYOK QA passed: 1 validation, 1 copy, 12 images, max concurrency ${maxActiveImages}`)
  console.log(`No API requests observed without a browser key`)
  if (blockedThirdPartyScripts.length) {
    console.log(`CSP blocked ${blockedThirdPartyScripts.length} Cloudflare Insights script injection(s)`)
  }
  console.log(`Screenshots: ${outputDir}`)
} finally {
  await browser.close()
}
