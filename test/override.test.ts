import { expect, test } from 'vitest'
import { DECRYPTION, INITIAL_STATE_REF } from '../src/override'
import { overrideDocument, overrideUtils } from '../src/override'
import { Cache } from '../src/utils/cache'
import { DAY } from '../src/utils/datetime'

const cache = new Cache('override-test', { maxAge: DAY })

test('overrideDocument()', async () => {
  const chapterUrl =
    'https://weread.qq.com/web/reader/d0b32590813ab9600g014ac7#outline?noScroll=1'

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
    'https://cdn.weread.qq.com/web/wrwebnjlogic/js/utils.0f849774.js'

  const scriptContent = await cache.getOrElse('utils-script', async () => {
    const response = await fetch(scriptUrl)
    const text = await response.text()

    return await cache.set('utils-script', text)
  })

  const js = overrideUtils(scriptUrl, scriptContent)
  expect(js.indexOf(DECRYPTION)).not.eq(-1)
})
