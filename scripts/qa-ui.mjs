import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const baseUrl = process.env.FITLOOP_QA_URL || 'http://127.0.0.1:5202'
const outputDir = process.env.FITLOOP_QA_OUTPUT || '/tmp/fitloop-qa'
await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const errors = []

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

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(overflow <= 1, `${viewport.name} horizontal overflow: ${overflow}px`)
    await page.screenshot({ path: `${outputDir}/${viewport.name}-home.png`, fullPage: true })

    await page.getByRole('button', { name: /샘플 상품으로 둘러보기/ }).click()
    await page.getByText('샘플 상품 준비 완료').waitFor()
    await page.getByRole('button', { name: /착용샷 소재 만들기/ }).click()
    await page.getByRole('heading', { name: /소재 조합/ }).waitFor()
    await page.getByText(/샘플 상품에서는 준비된 데모 이미지/).waitFor()
    await page.screenshot({ path: `${outputDir}/${viewport.name}-creatives.png`, fullPage: true })

    await page.getByRole('button', { name: /이 소재로 집행 설정하기/ }).click()
    await page.getByRole('button', { name: /광고 시작하기/ }).click()
    await page.getByRole('heading', { name: '성과 대시보드' }).waitFor()
    await page.screenshot({ path: `${outputDir}/${viewport.name}-dashboard.png`, fullPage: true })
    await page.close()
  }

  assert.deepEqual(errors, [])
  console.log(`UI QA passed: ${baseUrl}`)
  console.log(`Screenshots: ${outputDir}`)
} finally {
  await browser.close()
}
