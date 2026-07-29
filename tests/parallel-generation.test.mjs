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
      for await (const _chunk of req) {
        // Drain the request before returning the mocked image.
      }
      await new Promise((resolve) => setTimeout(resolve, 40))
      const body = JSON.stringify({
        output: { type: 'image', mime_type: 'image/png', data: pixel },
      })
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

test('24 concurrent generation requests are persisted without a daily limit', async () => {
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
    Array.from({ length: 24 }, (_, index) =>
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
    Array(24).fill(201),
    appErrors,
  )
  assert.ok(maxActiveGeminiRequests > 1, 'Gemini requests were not handled concurrently')

  const generated = JSON.parse(await readFile(join(dataDir, 'generated.json'), 'utf8'))
  assert.equal(generated.length, 24)
  assert.equal(new Set(generated.map((item) => item.id)).size, 24)
  assert.equal(new Set(generated.map((item) => item.creativeId)).size, 24)
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
