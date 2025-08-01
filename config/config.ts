export interface Config {
  puppeteer: {
    launch: {
      /**
       * Path to a browser executable to use instead of the bundled Chromium. Note that Puppeteer is only guaranteed to work with the bundled Chromium, so use this setting at your own risk.
       */
      executablePath?: string
    }
  }
  weread: {
    /**
     * 是否使用缓存（output 中已经存在的章节，不会再下载）
     * @default false
     */
    enableCache?: boolean
    books: {
      /**
       * 书籍 ID
       */
      id?: string
      /**
       * 要下载的章节名称
       */
      chapters?: string[]
      /**
       * 是否合并为一个文件
       * @default false
       */
      combine?: boolean
    }[]
  }
}
