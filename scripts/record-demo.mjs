import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const baseUrl = process.env.FITLOOP_DEMO_URL || 'http://127.0.0.1:4180'
const outputDir = process.env.FITLOOP_DEMO_VIDEO_DIR || '/tmp/fitloop-demo-video'
await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: outputDir,
    size: { width: 1920, height: 1080 },
  },
})
const page = await context.newPage()
const pause = (milliseconds) => page.waitForTimeout(milliseconds)

async function installPresentationLayer() {
  await page.evaluate(() => {
    const style = document.createElement('style')
    style.textContent = `
      #fitloop-demo-cursor {
        position: fixed;
        z-index: 99999;
        left: 0;
        top: 0;
        width: 26px;
        height: 26px;
        border: 3px solid white;
        border-radius: 50%;
        background: #f97316;
        box-shadow: 0 3px 18px rgba(15, 23, 42, .32);
        transform: translate(120px, 120px);
        transition: transform .65s cubic-bezier(.22,.8,.22,1), width .15s, height .15s;
        pointer-events: none;
      }
      #fitloop-demo-caption {
        position: fixed;
        z-index: 99998;
        left: 50%;
        bottom: 46px;
        width: min(1320px, calc(100vw - 120px));
        padding: 22px 34px;
        border: 1px solid rgba(255,255,255,.2);
        border-radius: 18px;
        color: white;
        text-align: center;
        background: rgba(3, 7, 18, .88);
        box-shadow: 0 12px 38px rgba(0,0,0,.2);
        font: 800 38px/1.35 -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif;
        letter-spacing: -.02em;
        backdrop-filter: blur(12px);
        transform: translateX(-50%);
        transition: opacity .25s, transform .25s;
        pointer-events: none;
      }
      #fitloop-demo-outro {
        position: fixed;
        z-index: 100000;
        inset: 0;
        display: none;
        place-items: center;
        color: white;
        text-align: center;
        background: radial-gradient(circle at 50% 40%, #263142 0, #070b12 58%, #020409 100%);
        font-family: -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif;
      }
      #fitloop-demo-outro strong { display:block; font-size: 82px; letter-spacing:-.06em; }
      #fitloop-demo-outro strong i { color:#f97316; font-style:normal; }
      #fitloop-demo-outro p { margin:24px 0 0; font-size:30px; color:#d7dee9; }
      #fitloop-demo-outro small { display:block; margin-top:22px; font-size:21px; color:#98a3b4; }
    `
    document.head.append(style)

    const cursor = document.createElement('div')
    cursor.id = 'fitloop-demo-cursor'
    const caption = document.createElement('div')
    caption.id = 'fitloop-demo-caption'
    const outro = document.createElement('div')
    outro.id = 'fitloop-demo-outro'
    outro.innerHTML =
      '<div><strong>FitL<i>oo</i>p</strong><p>사진 한 장에서 매출까지, 루프를 돌립니다.</p><small>fitloop-demo.jaeyeong2026.com</small></div>'
    document.body.append(cursor, caption, outro)
  })
}

async function caption(text) {
  await page.evaluate((next) => {
    const element = document.querySelector('#fitloop-demo-caption')
    if (element) element.textContent = next
  }, text)
}

async function moveTo(locator) {
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  if (!box) throw new Error('Demo target is not visible')
  await page.evaluate(
    ({ x, y }) => {
      const cursor = document.querySelector('#fitloop-demo-cursor')
      if (cursor instanceof HTMLElement) {
        cursor.style.transform = `translate(${x - 13}px, ${y - 13}px)`
      }
    },
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  )
  await pause(750)
}

async function click(locator, after = 1_100) {
  await moveTo(locator)
  await locator.click()
  await pause(after)
}

await page.goto(baseUrl, { waitUntil: 'networkidle' })
await installPresentationLayer()
await caption('상품 URL이나 사진 한 장으로 광고 제작을 시작합니다.')
await pause(3_500)

const urlInput = page.getByPlaceholder(/상품 URL/)
await moveTo(urlInput)
await urlInput.click()
await page.keyboard.type('https://shop.example.com/products/cream-cardigan', { delay: 42 })
await pause(1_400)
await caption('데모에서는 준비된 상품을 불러와 전체 과정을 빠르게 확인합니다.')
await click(page.getByRole('button', { name: /샘플 상품으로 둘러보기/ }), 2_700)

await caption('상품 정보가 준비되면 예산과 타겟을 정합니다.')
await click(page.getByRole('button', { name: /예산과 타겟 정하러 가기/ }), 1_600)
await pause(2_400)

await caption('성별·연령·채널을 선택하면 모델 후보가 자동으로 좁혀집니다.')
await click(page.getByRole('button', { name: /모델 고르러 가기/ }), 1_500)
await pause(2_400)

await caption('브랜드 타겟에 맞는 가상 모델 네 명을 선택합니다.')
await page.getByText('4/4명 선택됨').waitFor()
await pause(2_800)
await click(page.getByRole('button', { name: /이 모델 4명으로 시안 12종 만들기/ }), 1_500)

await caption('포즈 4종 × 배경 3종, 총 12개 광고 시안을 동시에 만듭니다.')
await page.getByRole('heading', { name: /광고 시안/ }).waitFor()
await pause(5_800)
await caption('자동 카피와 시안이 캠페인·성과 화면까지 그대로 연결됩니다.')
await pause(3_200)
await click(page.getByRole('button', { name: /이 시안으로 광고 시작하기/ }), 1_800)

await page.getByRole('heading', { name: '성과 대시보드' }).waitFor()
await caption('7일 집행을 재생하면 예산이 성과가 좋은 시안으로 이동합니다.')
await pause(2_300)
await click(page.getByRole('button', { name: /7일 재생/ }), 500)
await pause(10_800)

await caption('승자 시안, ROAS, 전환과 다음 사입 방향을 한 화면에서 확인합니다.')
await pause(2_500)
await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }))
await pause(4_600)

await page.evaluate(() => {
  const captionElement = document.querySelector('#fitloop-demo-caption')
  const cursor = document.querySelector('#fitloop-demo-cursor')
  const outro = document.querySelector('#fitloop-demo-outro')
  if (captionElement instanceof HTMLElement) captionElement.style.display = 'none'
  if (cursor instanceof HTMLElement) cursor.style.display = 'none'
  if (outro instanceof HTMLElement) outro.style.display = 'grid'
})
await pause(5_500)

const video = page.video()
await page.close()
const videoPath = await video?.path()
await context.close()
await browser.close()
console.log(videoPath || join(outputDir, 'fitloop-demo.webm'))
