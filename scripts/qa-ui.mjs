import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const baseUrl = process.env.FITLOOP_QA_URL || 'http://127.0.0.1:5202'
const outputDir = process.env.FITLOOP_QA_OUTPUT || '/tmp/fitloop-qa'
await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const errors = []
const apiRequests = []

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
      if (message.type() === 'error') errors.push(`${viewport.name}: ${message.text()}`)
    })
    page.on('request', (request) => {
      const url = request.url()
      if (url.includes('fitloop-api.jaeyeong2026.com') || /\/api\//.test(url)) {
        apiRequests.push(`${viewport.name}: ${url}`)
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
    await page.getByText(/외부 이미지 생성 API 없이/).waitFor()
    await assertNoHorizontalOverflow(page, `${viewport.name} demo home`)

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

    await page.getByRole('button', { name: /이 모델 4명으로 시안 12종 만들기/ }).click()
    await page.getByRole('heading', { name: /예시 광고 시안 12종/ }).waitFor()
    await page.getByText(/미리 준비된 예시 광고 시안 12종/).waitFor()
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

  assert.deepEqual(apiRequests, [], `static portfolio made API requests:\n${apiRequests.join('\n')}`)
  assert.deepEqual(errors, [])
  console.log(`Static portfolio QA passed: ${baseUrl}`)
  console.log(`No API requests observed across desktop and mobile flows`)
  console.log(`Screenshots: ${outputDir}`)
} finally {
  await browser.close()
}
