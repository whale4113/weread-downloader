import { type Page } from 'puppeteer'
import { load } from 'cheerio'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { bringPageToFrontMutex } from './page'
import { timeout } from './utils/general'
import { DECRYPTION, INITIAL_STATE_REF } from './override'
import { Decryption, State } from './weread'

const openCatalogue = (page: Page): Promise<boolean> => {
  return bringPageToFrontMutex.runExclusive(async () => {
    await page.bringToFront()

    const catalogueButton = await page.waitForSelector(
      '.readerControls_item.catalog'
    )
    if (!catalogueButton) {
      console.log('Failed to find catalogue button.')

      return false
    }

    await page.click('.readerControls_item.catalog')

    return true
  })
}

export const downloadChapter = async (options: {
  page: Page
  outputFilePath: string
  chapterIndex: number
  chapterTitle: string
  maxTimeout: number
  enableCache?: boolean
}): Promise<void> => {
  const {
    page,
    outputFilePath,
    chapterIndex,
    chapterTitle,
    maxTimeout,
    enableCache = false,
  } = options

  if (enableCache && existsSync(outputFilePath)) {
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
    await bringPageToFrontMutex.runExclusive(async () => {
      await Promise.all([
        page.waitForNavigation(),
        page
          .bringToFront()
          .then(() => page.click('.readerControls_item.isHorizontalReader')),
      ])
    })
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

    await bringPageToFrontMutex.runExclusive(async () => {
      await Promise.all([
        page.waitForNavigation(),
        page.bringToFront().then(() => page.click(`#chapter-${chapterIndex}`)),
      ])
    })

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
      const stateRef = (window as any)[INITIAL_STATE_REF] as State
      const decryption = (window as any)[DECRYPTION] as Decryption

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
