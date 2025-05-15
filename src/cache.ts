import path from 'node:path'
import fs from 'node:fs'
import { DATA_DIR } from './common'

interface CacheOptions {
  maxAge: number
}

export class Cache {
  public readonly cacheFilePath: string

  constructor(
    public readonly namespace: string,
    private readonly options: CacheOptions = { maxAge: 0 }
  ) {
    this.cacheFilePath = path.join(DATA_DIR, 'cache', this.namespace + '.json')

    if (!fs.existsSync(this.cacheFilePath)) {
      fs.mkdirSync(path.dirname(this.cacheFilePath), {
        recursive: true,
      })
      fs.writeFileSync(this.cacheFilePath, '{}', 'utf-8')
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    if (this.options.maxAge > 0) {
      try {
        const stat = await fs.promises.stat(this.cacheFilePath)
        if (Date.now() - stat.mtime.getTime() > this.options.maxAge) {
          return null
        }
      } catch (error) {
        if ((error as any).code !== 'ENOENT') {
          console.error(error)
        }
      }
    }

    let content = ''
    try {
      content = await fs.promises.readFile(this.cacheFilePath, {
        encoding: 'utf8',
      })
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        console.error(error)
      }
    }

    if (content === '') content = '{}'

    try {
      const store = JSON.parse(content)

      return store[key]
    } catch (error) {
      console.error(error)

      return null
    }
  }

  async getOrElse<T = unknown>(
    key: string,
    defaultFn: () => Promise<T>
  ): Promise<T> {
    return (await this.get<T>(key)) ?? (await defaultFn())
  }

  async set<T = unknown>(key: string, value: T): Promise<T> {
    let content = ''
    try {
      content = await fs.promises.readFile(this.cacheFilePath, {
        encoding: 'utf8',
      })
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        console.error(error)
      }
    }

    if (content === '') content = '{}'

    let store: Record<string, any> = {}
    try {
      store = JSON.parse(content)
    } catch (error) {
      console.error(error)
    }

    store[key] = value

    await fs.promises.writeFile(
      this.cacheFilePath,
      JSON.stringify(store, null, 2),
      {
        encoding: 'utf8',
      }
    )

    return value
  }
}
