interface BookInfo {
  title: string
}

interface ChapterInfo {
  level: number
  title: string
}

export interface State {
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

export interface Decryption {
  (
    currentSection: string,
    bookId: string,
    chapterUid: number,
    currentSectionIdx: number
  ): string
}
