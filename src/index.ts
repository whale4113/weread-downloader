import puppeteerVanilla, { type Cookie, type Browser } from 'puppeteer'
import { addExtra } from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import prompts from 'prompts'
import fs from 'node:fs'
import path from 'path'
import {
  DECRYPTION,
  INITIAL_STATE_REF,
  OUTPUT_DIR,
  WEREAD_URL,
  isUtilsScriptUrl,
} from './common'
import { overrideDocument, overrideUtils } from './override'
import { Cache } from './cache'

// @ts-ignore
const puppeteer = addExtra(puppeteerVanilla).use(StealthPlugin())

const cache = new Cache('weread')

interface State {
  reader: {
    bookId: string
    chapterContentState: 'DONE' | string
    chapterContentHtml: { value: string }[]
    currentChapter: {
      chapterUid: number
    }
    currentSectionIdx: number
  }
}

interface Decryption {
  (
    currentSection: string,
    bookId: string,
    chapterUid: number,
    currentSectionIdx: number
  ): string
}

const isChromeHeadless = async (browser: Browser) => {
  const page = await browser.newPage()

  await page.goto('https://arh.antoinevastel.com/bots/areyouheadless')

  const textSelector = await page.waitForSelector('#res')
  const fullTitle = await textSelector?.evaluate(el => el.textContent)

  await page.close()

  return fullTitle !== 'You are not Chrome headless'
}

const main = async () => {
  const browser = await puppeteer.launch({
    defaultViewport: { width: 1440, height: 768 },
    executablePath: '/usr/bin/chromium',
    headless: false,
  })

  const areYouChromeHeadless = await isChromeHeadless(browser)
  if (areYouChromeHeadless) {
    console.log('You are Chrome headless.')
  }

  const page = await browser.newPage()

  const cookies = await cache.get<Cookie[]>('cookies')
  if (cookies) {
    await page.setCookie(...cookies)
  }

  const client = await page.createCDPSession()

  await client.send('Fetch.enable', {
    patterns: [{ requestStage: 'Response' }],
  })

  client.on('Fetch.requestPaused', async (event): Promise<void> => {
    const {
      requestId,
      request,
      responseErrorReason,
      responseStatusCode,
      resourceType,
    } = event

    const isDocument =
      resourceType === 'Document' && request.url.startsWith(WEREAD_URL)
    const isUtilsScript =
      resourceType === 'Script' && isUtilsScriptUrl(request.url)

    const interceptResponse = isDocument || isUtilsScript

    if (responseErrorReason !== undefined || responseStatusCode !== undefined) {
      const isRedirect =
        responseStatusCode === 301 || responseStatusCode === 302

      if (!isRedirect && interceptResponse) {
        const responseBody = await client.send('Fetch.getResponseBody', {
          requestId,
        })
        const body = responseBody.base64Encoded
          ? Buffer.from(responseBody.body, 'base64').toString('utf8')
          : responseBody.body

        let newBody = body
        if (isDocument) {
          newBody = await overrideDocument(request.url, body)
        } else if (isUtilsScript) {
          newBody = overrideUtils(request.url, body)
        }

        await client.send('Fetch.fulfillRequest', {
          requestId,
          responseCode: responseStatusCode ?? 200,
          responseHeaders: event.responseHeaders,
          body: responseBody.base64Encoded
            ? Buffer.from(newBody).toString('base64')
            : newBody,
        })
      } else {
        await client.send('Fetch.continueResponse', {
          requestId,
        })
      }

      return
    }

    await client.send('Fetch.continueRequest', {
      requestId,
      interceptResponse,
    })
  })

  await page.goto(
    'https://weread.qq.com/web/reader/e6f320e0813ab8b1bg019924k37632cd021737693cfc7149'
  )

  const { login } = await prompts({
    type: 'confirm',
    name: 'login',
    message: 'Please login.',
  })

  if (login) {
    const cookies = await page.cookies(WEREAD_URL)

    cache.set('cookies', cookies)

    const isReady = await page.waitForFunction(
      `window.${INITIAL_STATE_REF}.reader.chapterContentState === "DONE"`,
      {
        timeout: 4000,
      }
    )
    if (!isReady) {
      console.log('Chapter content state not ready.')

      return
    }

    const currentSectionHtml = await page.evaluate(
      (INITIAL_STATE_REF, DECRYPTION) => {
        // @ts-ignore
        const stateRef = window[INITIAL_STATE_REF] as State
        // @ts-ignore
        const decryption = window[DECRYPTION] as Decryption

        const {
          chapterContentHtml,
          bookId,
          currentChapter,
          currentSectionIdx,
        } = stateRef.reader
        const currentSection = chapterContentHtml.at(currentSectionIdx)

        if (!currentSection) {
          return
        }

        const currentSectionHtml = decryption(
          currentSection.value,
          bookId,
          currentChapter.chapterUid,
          currentSectionIdx
        )

        return currentSectionHtml
      },
      INITIAL_STATE_REF,
      DECRYPTION
    )

    if (!currentSectionHtml) {
      console.log('Current section html does not exist.')

      return
    }

    const state = (await page.evaluate(`window.${INITIAL_STATE_REF}`)) as State

    await fs.promises.writeFile(
      path.join(
        OUTPUT_DIR,
        String(state.reader.currentChapter.chapterUid) + '.html'
      ),
      currentSectionHtml,
      {
        encoding: 'utf8',
      }
    )

    await browser.close()
  }
}

main()
