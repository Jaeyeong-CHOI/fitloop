import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { after, before, test } from 'node:test'

const port = 55202
let child

before(async () => {
  child = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port), GEMINI_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  await waitForHealth()
})

after(() => child?.kill('SIGTERM'))

test('health does not expose secrets', async () => {
  const response = await fetch(`http://127.0.0.1:${port}/api/health`)
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.geminiConfigured, false)
  assert.equal('apiKey' in body, false)
})

test('generation is disabled without a server key', async () => {
  const response = await fetch(`http://127.0.0.1:${port}/api/creatives/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'demo', creativeId: 'c01' }),
  })
  const body = await response.json()
  assert.equal(response.status, 503)
  assert.equal(body.error, 'IMAGE_GENERATION_NOT_CONFIGURED')
})

test('private URL imports are blocked', async () => {
  const response = await fetch(`http://127.0.0.1:${port}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceUrl: 'http://127.0.0.1/private.png' }),
  })
  const body = await response.json()
  assert.equal(response.status, 400)
  assert.equal(body.error, 'PRIVATE_URL_BLOCKED')
})

async function waitForHealth() {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`)
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('server did not start')
}
