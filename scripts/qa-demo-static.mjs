import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'

const baseUrl = process.env.FITLOOP_DEMO_URL || 'https://fitloop.jaeyeong2026.com'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})

try {
  const response = await page.goto(baseUrl, { waitUntil: 'networkidle' })
  assert.equal(response?.status(), 200)
  await page.getByRole('heading', { name: /광고 이미지를 만들고/ }).waitFor()
  await page.getByRole('button', { name: '데모 체험' }).click()
  await page.getByRole('heading', { name: /옷 사진 한 장이면/ }).waitFor()
  await page.getByPlaceholder(/상품 URL/).fill('https://www.musinsa.com/products/4672509')
  await page.getByRole('button', { name: '가져오기' }).click()
  await page.getByText('상품 분석 완료').waitFor()
  await page.getByRole('button', { name: /예산과 타겟 정하러 가기/ }).click()
  await page.getByRole('button', { name: /모델 고르러 가기/ }).click()
  await page.getByText('4/4명 선택됨').waitFor()
  await page.getByRole('button', { name: /예시 시안 12종 보기/ }).click()
  await page.getByRole('heading', { name: /예시 광고 시안 12종/ }).waitFor()
  assert.equal(await page.locator('img[src*="/creatives/"]').count(), 12)
  await page.getByRole('button', { name: /이 시안으로 광고 시작하기/ }).click()
  await page.getByRole('heading', { name: '성과 대시보드' }).waitFor()
  await page.getByRole('button', { name: '7일 재생' }).click()
  await page.getByText('Day 2', { exact: true }).waitFor({ timeout: 3_500 })
  assert.deepEqual(errors, [])
  console.log(`No-key fallback demo QA passed: ${baseUrl}`)
} finally {
  await page.close()
  await browser.close()
}
