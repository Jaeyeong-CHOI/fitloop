import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearBrowserApiKey,
  GEMINI_KEY_STORAGE,
  maskApiKey,
  normalizeApiKey,
  readBrowserApiKey,
  saveBrowserApiKey,
} from '../src/lib/browser-key.ts'

function fakeStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values,
  }
}

test('stores a normalized Gemini key only under the browser key slot', () => {
  const storage = fakeStorage()
  const key = saveBrowserApiKey('  test-browser-only-key-1234567890  ', storage)
  assert.equal(key, 'test-browser-only-key-1234567890')
  assert.equal(readBrowserApiKey(storage), key)
  assert.deepEqual([...storage.values.keys()], [GEMINI_KEY_STORAGE])
})

test('masks and deletes a browser key', () => {
  const storage = fakeStorage()
  saveBrowserApiKey('test-browser-only-key-1234567890', storage)
  assert.equal(maskApiKey(readBrowserApiKey(storage)), '•••• 7890')
  clearBrowserApiKey(storage)
  assert.equal(readBrowserApiKey(storage), '')
})

test('rejects short or whitespace-containing keys', () => {
  assert.throws(() => normalizeApiKey('short'), /올바른 Gemini API 키/)
  assert.throws(() => normalizeApiKey('test key with spaces 1234567890'), /올바른 Gemini API 키/)
})
