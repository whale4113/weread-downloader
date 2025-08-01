import { test, expect } from 'vitest'
import { Cache } from '../src/utils/cache'
import { SECOND } from '../src/utils/datetime'

test('Cache', async () => {
  const cache = new Cache('cache-test')

  expect(await cache.set('count', null)).toBe(null)

  expect(await cache.get('count')).toBe(null)

  expect(await cache.set('count', 1)).toBe(1)

  expect(await cache.get('count')).toBe(1)
})

test('Cache max age', async () => {
  const cache = new Cache('cache-test', { maxAge: SECOND })

  expect(await cache.set('foo', 1)).toBe(1)

  expect(await cache.get('foo')).toBe(1)

  await new Promise<null>(resolve =>
    setTimeout(() => {
      resolve(null)
    }, SECOND)
  )

  expect(await cache.get('foo')).toBe(null)
})
