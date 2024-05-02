import { expect, test } from 'vitest'
import { DECRYPTION, INITIAL_STATE_REF } from '../src/common'
import { overrideDocument, overrideUtils } from '../src/override'
import { Cache } from '../src/cache'
import { DAY } from '../src/datetime'

const cache = new Cache('override-test', { maxAge: DAY })

test('overrideDocument()', async () => {
  const chapterUrl =
    'https://weread.qq.com/web/reader/a0b32400813ab8babg0111cak16732dc0161679091c5aeb1'

  const chapterHtml = await cache.getOrElse('chapter-html', async () => {
    const response = await fetch(chapterUrl)
    const text = await response.text()

    return await cache.set('chapter-html', text)
  })

  const html = await overrideDocument(chapterUrl, chapterHtml)
  expect(html.indexOf(INITIAL_STATE_REF)).not.eq(-1)
})

test('overrideUtils()', async () => {
  const scriptUrl =
    'https://weread-1258476243.file.myqcloud.com/web/wrwebnjlogic/js/utils.b7bf8a23.js'

  const scriptContent = await cache.getOrElse('utils-script', async () => {
    const response = await fetch(scriptUrl)
    const text = await response.text()

    return await cache.set('utils-script', text)
  })

  const js = overrideUtils(scriptUrl, scriptContent)
  expect(js.indexOf(DECRYPTION)).not.eq(-1)
})
