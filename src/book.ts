import { Browser, Page } from 'puppeteer'
import prompts from 'prompts'
import { range } from 'es-toolkit'
import fs from 'node:fs/promises'
import path from 'node:path'
import url from 'node:url'
import { SECOND } from './utils/datetime'
import { bringPageToFrontMutex, createPage } from './page'
import { State } from './weread'
import { INITIAL_STATE_REF } from './override'
import { sanitizeFileName } from './utils/general'
import { downloadChapter } from './chapter'
import { WEREAD_URL } from './constants'

const OUTPUT_DIR: string = url.fileURLToPath(
  new URL('../output', import.meta.url)
)

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

const beginRead = async (page: Page) => {
  const beginReadSelector = 'text/开始阅读'
  const beginReadButton = await page.waitForSelector(beginReadSelector)
  if (!beginReadButton) {
    console.log('Failed to find begin read button.')

    await page.close()

    return
  }

  await bringPageToFrontMutex.runExclusive(async () => {
    await Promise.all([
      page.waitForNavigation(),
      page.bringToFront().then(() => page.click(beginReadSelector)),
    ])
  })
}

export const downloadBook = async (
  browser: Browser,
  book?: {
    chapters: string[]
    detail: string
    combine: boolean
  },
  options: {
    enableCache?: boolean
  } = {}
): Promise<void> => {
  const url =
    book?.detail ??
    `${WEREAD_URL}web/bookDetail/${
      (
        await prompts({
          type: 'text',
          name: 'id',
          message: 'Please input book id.',
        })
      ).id
    }`

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
      await page.close()

      return
    }
  }

  await beginRead(page)

  const { bookTitle, chapters } = await page.evaluate(INITIAL_STATE_REF => {
    // @ts-expect-error
    const stateRef = window[INITIAL_STATE_REF] as State

    const chapters = stateRef.reader.chapterInfos.map(
      (chapterInfo, chapterIndex) => ({
        level: chapterInfo.level,
        title: chapterInfo.title || `第${chapterIndex + 1}章`,
      })
    )

    return {
      bookTitle: stateRef.reader.bookInfo.title,
      chapters,
    }
  }, INITIAL_STATE_REF)
  const chapterTitleToIndex = new Map(
    chapters.map((chapter, index) => [chapter.title, index])
  )

  const filterChapters = (chapterNames: string[]): number[] => {
    let indexes: number[] = []

    for (const [i, name] of chapterNames.entries()) {
      if (name === '...') {
        const prevName = chapterNames[i - 1]
        const nextName = chapterNames[i + 1]

        const prevIndex = chapterTitleToIndex.get(prevName)
        const nextIndex = chapterTitleToIndex.get(nextName)

        if (prevIndex === undefined && i !== 0) {
          continue
        }

        if (nextIndex === undefined && i !== chapterNames.length - 1) {
          continue
        }

        indexes = indexes.concat(
          range(
            prevIndex !== undefined ? prevIndex + 1 : 0,
            nextIndex ?? chapters.length
          )
        )

        continue
      }

      const index = chapterTitleToIndex.get(name)
      if (typeof index === 'number') {
        indexes.push(index)
      }
    }

    return indexes
  }

  const selectedChapterIndexes: number[] =
    (book ? filterChapters(book.chapters) : undefined) ??
    (
      await prompts({
        type: 'multiselect',
        name: 'selectedChapterIndexes',
        message: 'Please pick chapters.',
        choices: chapters.map((chapter, index) => ({
          title:
            new Array(chapter.level - 1).fill(' ').join('') + chapter.title,
          value: index,
        })),
        hint: '- Space to select. Return to submit',
      })
    ).selectedChapterIndexes

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
      enableCache: options.enableCache,
    })

    outputFilePaths.push(outputFilePath)

    downloaded++

    console.log(
      `${bookTitle} | ${chapterTitle} | ${Math.floor(
        (downloaded / total) * 100
      )}%`
    )
  }

  const combine = book
    ? book.combine
    : (
        await prompts({
          type: 'confirm',
          name: 'combine',
          message: 'Combine output text file?',
        })
      ).combine
  if (combine) {
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
}
