import puppeteerVanilla, { type Cookie, Browser, type Page } from 'puppeteer'
import { addExtra } from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { load } from 'cheerio'
import prompts from 'prompts'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'path'
import {
  DECRYPTION,
  INITIAL_STATE_REF,
  OUTPUT_DIR,
  WEREAD_URL,
  isUtilsScriptUrl,
} from './common'
import { overrideDocument, overrideUtils } from './override'
import { sanitizeFileName } from './sanitize'
import { Cache } from './cache'
import { SECOND } from './datetime'

// @ts-ignore
const puppeteer = addExtra(puppeteerVanilla).use(StealthPlugin())

const cache = new Cache('weread')

const timeout = (timeout: number) =>
  new Promise<void>(resolve => {
    setTimeout(() => {
      resolve()
    }, timeout)
  })

interface BookInfo {
  title: string
}

interface ChapterInfo {
  level: number
  title: string
}

interface State {
  reader: {
    bookId: string
    chapterInfos: ChapterInfo[]
    chapterContentState: 'DONE' | string
    chapterContentHtml: { value: string }[]
    currentChapter: {
      chapterUid: number
    }
    currentSectionIdx: number
    bookInfo: BookInfo
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

const isLogin = async (page: Page) => {
  try {
    const el = await page.waitForSelector('.wr_avatar', {
      timeout: 4 * SECOND,
    })
    return el !== null
  } catch {
    return false
  }
}

const createPage = async (browser: Browser) => {
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

  return page
}

const openCatalogue = async (page: Page): Promise<boolean> => {
  const catalogueButton = await page.waitForSelector(
    '.readerControls_item.catalog'
  )
  if (!catalogueButton) {
    console.log('Failed to find catalogue button.')

    return false
  }

  await page.click('.readerControls_item.catalog')

  return true
}

const downloadChapter = async (options: {
  page: Page
  outputFilePath: string
  chapterIndex: number
  chapterTitle: string
  maxTimeout: number
}) => {
  const { page, outputFilePath, chapterIndex, chapterTitle, maxTimeout } =
    options

  if (existsSync(outputFilePath)) {
    console.log(`${chapterTitle} hits cache.`)

    return
  }

  await timeout(Math.floor(Math.random() * maxTimeout))

  const isHorizontalReader = await page.evaluate(() => {
    return (
      document.querySelector('.readerControls_item.isHorizontalReader') !== null
    )
  })
  if (isHorizontalReader) {
    await Promise.all([
      page.waitForNavigation(),
      page.click('.readerControls_item.isHorizontalReader'),
    ])
  }

  const needNavigation = await page.evaluate(_chapterTitle => {
    const list = document.querySelector('.readerCatalog_list')
    if (!list) {
      return null
    }

    const selectedListItem = list.querySelector(
      '.readerCatalog_list_item_selected'
    )

    if (
      selectedListItem?.firstElementChild?.classList.contains(
        'readerCatalog_list_item_level_3'
      ) &&
      selectedListItem.previousSibling?.textContent === _chapterTitle
    ) {
      return false
    }

    return selectedListItem?.textContent !== _chapterTitle
  }, chapterTitle)

  if (needNavigation) {
    const openCatalogueSuccess = await openCatalogue(page)
    if (!openCatalogueSuccess) {
      console.log('Failed to open catalogue.')

      await page.close()

      return
    }

    const position = await page.evaluate(
      (_chapterIndex, _chapterTitle) => {
        const list = document.querySelector('.readerCatalog_list')
        const listItem = Array.from(list?.children ?? []).find(
          item => item.textContent === _chapterTitle
        )
        if (!listItem) {
          return null
        }

        listItem.scrollIntoView({
          behavior: 'smooth',
        })

        listItem.setAttribute('id', `chapter-${_chapterIndex}`)

        const rect = listItem.getBoundingClientRect()

        return { x: rect.x, y: rect.y }
      },
      chapterIndex,
      chapterTitle
    )

    if (!position) {
      console.log('Failed to get chapter list item position.')

      await page.close()

      return
    }

    await Promise.all([
      page.waitForNavigation(),
      page.click(`#chapter-${chapterIndex}`),
    ])

    await timeout(Math.floor(Math.random() * maxTimeout))
  }

  const isReady = await page.waitForFunction(
    `window.${INITIAL_STATE_REF}.reader.chapterContentState === "DONE"`
  )
  if (!isReady) {
    await page.close()

    console.log(`${chapterTitle}'s content state not ready.`)

    return
  }

  await page.evaluate(() => {
    window.scrollTo({
      top: Math.floor(Math.random() * window.innerHeight),
      left: 0,
      behavior: 'smooth',
    })
  })

  const currentSectionHtml = await page.evaluate(
    (INITIAL_STATE_REF, DECRYPTION) => {
      // @ts-ignore
      const stateRef = window[INITIAL_STATE_REF] as State
      // @ts-ignore
      const decryption = window[DECRYPTION] as Decryption

      const { chapterContentHtml, bookId, currentChapter, currentSectionIdx } =
        stateRef.reader
      const currentSection = chapterContentHtml.at(currentSectionIdx)

      if (!currentSection) {
        return `<html><body>${
          document
            .querySelector('meta[name="description"]')
            ?.getAttribute('content') ?? ''
        }</body></html>`
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
    console.log(`${chapterTitle}'s section html does not exist.`)

    await page.close()

    return
  }

  const $ = load(currentSectionHtml)

  const contents = $('body').text()

  await fs.writeFile(outputFilePath, contents, {
    encoding: 'utf8',
  })
}

const beginRead = async (page: Page) => {
  const beginReadSelector = 'text/开始阅读'
  const beginReadButton = await page.waitForSelector(beginReadSelector)
  if (!beginReadButton) {
    console.log('Failed to find begin read button.')

    await page.close()

    return
  }

  await Promise.all([page.waitForNavigation(), page.click(beginReadSelector)])
}

const main = async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 0, height: 0 },
    executablePath:
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    userDataDir: './data/user-data',
    args: ['--disable-features=MacAppCodeSignClone'],
  })

  const { url } = await prompts({
    type: 'text',
    name: 'url',
    message: 'Please input book detail page url.',
  })
  if (typeof url !== 'string' || !url.startsWith(WEREAD_URL)) {
    await browser.close()

    console.log('Url is invalid.')

    return
  }

  const page = await createPage(browser)

  await page.goto(url)

  let login = await isLogin(page)
  if (!login) {
    const answers = await prompts({
      type: 'confirm',
      name: 'login',
      message: 'Please login.',
    })
    login = answers.login

    if (!login) {
      await browser.close()

      return
    }
  }

  await beginRead(page)

  const { bookTitle, chapters } = await page.evaluate(INITIAL_STATE_REF => {
    // @ts-ignore
    const stateRef = window[INITIAL_STATE_REF] as State

    const chapters = stateRef.reader.chapterInfos.map(chapterInfo => ({
      level: chapterInfo.level,
      title: chapterInfo.title,
    }))

    return {
      bookTitle: stateRef.reader.bookInfo.title,
      chapters,
    }
  }, INITIAL_STATE_REF)

  const { selectedChapterIndexes } = await prompts({
    type: 'multiselect',
    name: 'selectedChapterIndexes',
    message: 'Please pick chapters.',
    choices: chapters.map((chapter, index) => ({
      title: new Array(chapter.level - 1).fill(' ').join('') + chapter.title,
      value: index,
    })),
    hint: '- Space to select. Return to submit',
  })

  const sanitizedBookTitle = sanitizeFileName(bookTitle)

  await fs.mkdir(path.join(OUTPUT_DIR, sanitizedBookTitle), {
    recursive: true,
  })

  const outputFilePaths: string[] = []
  let total = selectedChapterIndexes.length
  let downloaded = 0
  let fistChapterTitle: string | null = null

  for await (const chapterIndex of selectedChapterIndexes as number[]) {
    const chapterTitle = chapters.at(chapterIndex)?.title ?? 'unknown'
    const sanitizedChapterTitle = sanitizeFileName(chapterTitle)

    if (fistChapterTitle === null) {
      fistChapterTitle = chapterTitle
    }

    const outputFilePath = path.join(
      OUTPUT_DIR,
      sanitizedBookTitle,
      `${chapterIndex}_${sanitizedChapterTitle}.txt`
    )

    await downloadChapter({
      page,
      outputFilePath,
      chapterIndex,
      chapterTitle,
      maxTimeout: 3 * SECOND,
    })

    outputFilePaths.push(outputFilePath)

    downloaded++

    console.log(Math.floor((downloaded / total) * 100) + '%')
  }

  const combineAnswers = await prompts({
    type: 'confirm',
    name: 'combine',
    message: 'Combine output text file?',
  })
  if (combineAnswers.combine) {
    const outputDir = path.join(OUTPUT_DIR, sanitizedBookTitle, 'combines')

    await fs.mkdir(outputDir, {
      recursive: true,
    })

    const contents = await Promise.all(
      outputFilePaths.map(outputFilePath =>
        fs.readFile(outputFilePath, {
          encoding: 'utf8',
        })
      )
    )
    const combineContent = contents.join('\n')
    await fs.writeFile(
      path.join(outputDir, sanitizeFileName(fistChapterTitle ?? '') + '.txt'),
      combineContent
    )
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
