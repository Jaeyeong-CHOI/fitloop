import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const baseUrl = process.env.FITLOOP_QA_URL || 'http://127.0.0.1:5202'
const outputDir = process.env.FITLOOP_QA_OUTPUT || '/tmp/fitloop-qa'
await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const errors = []

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

    const response = await page.goto(baseUrl, { waitUntil: 'networkidle' })
    assert.equal(response?.status(), 200)
    await page.getByRole('heading', { name: /옷 사진 한 장이면/ }).waitFor()

    await assertNoHorizontalOverflow(page, `${viewport.name} home`)
    await page.screenshot({ path: `${outputDir}/${viewport.name}-home.png`, fullPage: true })

    await page.getByRole('button', { name: /샘플 상품으로 둘러보기/ }).click()
    await page.getByText('샘플 상품 준비 완료').waitFor()
    await page.getByRole('button', { name: /예산과 타겟 정하러 가기/ }).click()
    await page.getByRole('heading', { name: /얼마로, 누구에게/ }).waitFor()
    await page.waitForTimeout(600)
    await assertNoHorizontalOverflow(page, `${viewport.name} campaign`)
    await page.screenshot({ path: `${outputDir}/${viewport.name}-campaign.png`, fullPage: true })

    await page.getByRole('button', { name: /모델 고르러 가기/ }).click()
    await page.getByRole('heading', { name: /어떤 모델이 입어볼까요/ }).waitFor()
    await page.getByText('4/4명 선택됨').waitFor()
    await page.waitForTimeout(600)
    await assertNoHorizontalOverflow(page, `${viewport.name} models`)
    await page.screenshot({ path: `${outputDir}/${viewport.name}-models.png`, fullPage: true })

    await page.getByRole('button', { name: /이 모델 4명으로 시안 24종 만들기/ }).click()
    await page.getByRole('heading', { name: /광고 시안/ }).waitFor()
    await page.getByText(/샘플 상품에서는 준비된 데모 이미지/).waitFor()
    await page.waitForTimeout(1_000)
    await assertNoHorizontalOverflow(page, `${viewport.name} creatives`)
    await page.screenshot({ path: `${outputDir}/${viewport.name}-creatives.png`, fullPage: true })

    await page.getByRole('button', { name: /이 시안으로 광고 시작하기/ }).click()
    await page.getByRole('heading', { name: '성과 대시보드' }).waitFor()
    await assertNoHorizontalOverflow(page, `${viewport.name} dashboard`)
    await page.screenshot({ path: `${outputDir}/${viewport.name}-dashboard.png`, fullPage: true })
    await page.close()
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  let activeGenerations = 0
  let completedGenerations = 0
  let maxActiveGenerations = 0
  const generatedModelLabels = new Set()
  let savedCampaign = null
  const pixel =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XwLzWQAAAABJRU5ErkJggg=='

  await page.route('**/api/health', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        geminiConfigured: true,
        imageModel: 'qa-image-model',
        generationLimit: null,
        persistence: true,
        deployment: 'server',
      }),
    }),
  )
  await page.route('**/api/products', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'qa-product',
        name: '병렬 생성 테스트 상품',
        price: 32900,
        category: '패션',
        color: '블랙',
        fit: '기본 핏',
        imageUrl: pixel,
        sourceUrl: 'https://example.com/product',
        createdAt: new Date().toISOString(),
      }),
    }),
  )
  await page.route('**/api/creatives/generate', async (route) => {
    const input = route.request().postDataJSON()
    generatedModelLabels.add(input.modelLabel)
    activeGenerations++
    maxActiveGenerations = Math.max(maxActiveGenerations, activeGenerations)
    await new Promise((resolve) => setTimeout(resolve, 60))
    completedGenerations++
    activeGenerations--
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: `generated-${input.creativeId}`,
        creativeId: input.creativeId,
        imageUrl: pixel,
        model: 'qa-image-model',
        createdAt: new Date().toISOString(),
      }),
    })
  })
  await page.route('**/api/campaigns', async (route) => {
    savedCampaign = route.request().postDataJSON()
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'qa-campaign',
        productId: savedCampaign.productId,
        settings: savedCampaign.settings,
        generatedCreativeIds: savedCampaign.generatedCreativeIds,
        status: 'active',
        createdAt: new Date().toISOString(),
      }),
    })
  })

  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.getByPlaceholder(/상품 URL/).fill('https://example.com/product')
  await page.getByRole('button', { name: '가져오기' }).click()
  await page.getByText(/상품 준비 완료/).waitFor()
  await page.getByRole('button', { name: /예산과 타겟 정하러 가기/ }).click()
  await page.getByRole('button', { name: /모델 고르러 가기/ }).click()
  await page.getByRole('button', { name: /이 모델 4명으로 시안 24종 만들기/ }).click()
  await page.getByRole('heading', { name: /병렬 생성/ }).waitFor()
  assert.ok(await page.locator('[aria-label$="생성 대기 중"]').count())
  await page.getByRole('button', { name: '24종 생성 완료' }).waitFor({ timeout: 10_000 })

  assert.equal(completedGenerations, 24)
  assert.equal(maxActiveGenerations, 4)
  assert.equal(generatedModelLabels.size, 4)
  await page.getByRole('button', { name: /이 시안으로 광고 시작하기/ }).click()
  await page.getByRole('heading', { name: '성과 대시보드' }).waitFor()
  assert.ok(
    (await page.locator('img[src^="data:image/png"]').count()) > 0,
    'dashboard should reuse images generated in the creative step',
  )
  assert.equal(savedCampaign.settings.modelIds.length, 4)
  assert.equal(savedCampaign.generatedCreativeIds.length, 24)
  await page.close()

  assert.deepEqual(errors, [])
  console.log(`UI QA passed: ${baseUrl}`)
  console.log(`Parallel generation QA passed: 24 requests, max concurrency ${maxActiveGenerations}`)
  console.log(`Screenshots: ${outputDir}`)
} finally {
  await browser.close()
}
