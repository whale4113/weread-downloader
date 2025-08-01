import puppeteerVanilla from 'puppeteer'
import { addExtra } from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import prompts from 'prompts'
import { chunk } from 'es-toolkit'
import url from 'node:url'
import { SECOND } from './utils/datetime'
import { ConfigImpl } from './config'
import { Config } from '~config/config_schema'
import { downloadBook } from './book'
import { WEREAD_URL } from './constants'

// @ts-ignore
const puppeteer = addExtra(puppeteerVanilla).use(StealthPlugin())

const main = async () => {
  const config = await new ConfigImpl({
    configSchema: Config,
    configFilePath: url.fileURLToPath(
      new URL('../config/config.json', import.meta.url)
    ),
  }).read()

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 0, height: 0 },
    executablePath:
      config.puppeteer.launch.executablePath ??
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    userDataDir: './data/user-data',
    args: ['--disable-features=MacAppCodeSignClone'],
    timeout: 10 * SECOND,
  })

  if (config.weread.books.length > 0) {
    for (const chunkItem of chunk(config.weread.books, 4)) {
      await Promise.all(
        chunkItem.map(book =>
          book.chapters && book.chapters.length > 0 && book.id
            ? downloadBook(
                browser,
                {
                  chapters: book.chapters,
                  detail: `${WEREAD_URL}web/bookDetail/${book.id}`,
                  combine: book.combine ?? false,
                },
                {
                  enableCache: config.weread.enableCache,
                }
              )
            : undefined
        )
      )
    }
  } else {
    await downloadBook(browser)
  }

  const answers = await prompts({
    type: 'confirm',
    name: 'close',
    message: 'Close page?',
  })

  if (answers.close) {
    await browser.close()
  }
}

main()
