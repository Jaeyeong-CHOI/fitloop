import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'

const appPort = 55203
const pixel =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XwLzWQAAAABJRU5ErkJggg=='

let activeGeminiRequests = 0
let maxActiveGeminiRequests = 0
let app
let appErrors = ''
let dataDir
let geminiServer
let geminiPort

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'fitloop-parallel-'))
  geminiServer = createServer(async (req, res) => {
    activeGeminiRequests++
    maxActiveGeminiRequests = Math.max(maxActiveGeminiRequests, activeGeminiRequests)
    try {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const request = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      await new Promise((resolve) => setTimeout(resolve, 40))
      const ids =
        request.response_format?.schema?.properties?.copies?.items?.properties?.creativeId?.enum
      const body = JSON.stringify(
        request.response_format?.type === 'text'
          ? {
              output_text: JSON.stringify({
                copies: ids.map((creativeId, index) => ({
                  creativeId,
                  text: `테스트 자동 카피 ${index + 1}`,
                })),
              }),
            }
          : { output: { type: 'image', mime_type: 'image/png', data: pixel } },
      )
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      })
      res.end(body)
    } finally {
      activeGeminiRequests--
    }
  })
  await new Promise((resolve) => geminiServer.listen(0, '127.0.0.1', resolve))
  geminiPort = geminiServer.address().port

  app = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: {
      ...process.env,
      PORT: String(appPort),
      GEMINI_API_KEY: 'test-key',
      GEMINI_API_URL: `http://127.0.0.1:${geminiPort}`,
      FITLOOP_DATA_DIR: dataDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  app.stderr.on('data', (chunk) => {
    appErrors += chunk
  })
  await waitForHealth()
})

after(async () => {
  app?.kill('SIGTERM')
  if (geminiServer) await new Promise((resolve) => geminiServer.close(resolve))
  if (dataDir) await rm(dataDir, { recursive: true, force: true })
})

test('generates 12 structured ad copies in one Gemini request', async () => {
  const productResponse = await fetch(`http://127.0.0.1:${appPort}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl: `data:image/png;base64,${pixel}` }),
  })
  const product = await productResponse.json()
  const combinations = Array.from({ length: 12 }, (_, index) => ({
    creativeId: `c${String(index + 1).padStart(2, '0')}`,
    modelLabel: `남성 모델 ${index % 4}`,
    poseLabel: `포즈 ${index % 4}`,
    backgroundLabel: `배경 ${index % 3}`,
  }))
  const response = await fetch(`http://127.0.0.1:${appPort}/api/copies/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId: product.id,
      productName: product.name,
      combinations,
    }),
  })
  const body = await response.json()

  assert.equal(response.status, 201, appErrors)
  assert.equal(body.source, 'gemini')
  assert.equal(body.copies.length, 12)
  assert.equal(new Set(body.copies.map((copy) => copy.text)).size, 12)
})

test('12 concurrent generation requests are persisted without a daily limit', async () => {
  const healthResponse = await fetch(`http://127.0.0.1:${appPort}/api/health`)
  const health = await healthResponse.json()
  assert.equal(health.generationLimit, null)

  const productResponse = await fetch(`http://127.0.0.1:${appPort}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl: `data:image/png;base64,${pixel}` }),
  })
  assert.equal(productResponse.status, 201)
  const product = await productResponse.json()

  const responses = await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      fetch(`http://127.0.0.1:${appPort}/api/creatives/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          creativeId: `c${String(index + 1).padStart(2, '0')}`,
          productName: product.name,
        }),
      }),
    ),
  )
  assert.deepEqual(
    responses.map((response) => response.status),
    Array(12).fill(201),
    appErrors,
  )
  assert.ok(maxActiveGeminiRequests > 1, 'Gemini requests were not handled concurrently')

  const generated = JSON.parse(await readFile(join(dataDir, 'generated.json'), 'utf8'))
  assert.equal(generated.length, 12)
  assert.equal(new Set(generated.map((item) => item.id)).size, 12)
  assert.equal(new Set(generated.map((item) => item.creativeId)).size, 12)
})

async function waitForHealth() {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${appPort}/api/health`)
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`server did not start: ${appErrors}`)
}
