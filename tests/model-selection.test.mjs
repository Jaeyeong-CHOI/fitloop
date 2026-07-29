import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_SELECTION,
  MODEL_LIBRARY,
  reconcileModelIds,
} from '../src/lib/models.ts'

test('replaces stale female selections when the filter changes to male', () => {
  const selection = { ...DEFAULT_SELECTION, genders: ['남성'] }
  const selected = reconcileModelIds(selection, ['f1', 'f2', 'f3', 'f4'])

  assert.equal(selected.length, 4)
  assert.ok(
    selected.every(
      (id) => MODEL_LIBRARY.find((model) => model.id === id)?.gender === '남성',
    ),
  )
})

test('keeps eligible selections while removing models hidden by other filters', () => {
  const selection = {
    ...DEFAULT_SELECTION,
    genders: ['남성'],
    ages: ['30대'],
  }
  const selected = reconcileModelIds(selection, ['m1', 'm3', 'm4', 'f1'])

  assert.deepEqual(selected, ['m3', 'm4'])
})
