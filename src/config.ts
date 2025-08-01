import { z } from 'zod'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

interface ConfigOptions<ConfigSchema extends z.ZodObject> {
  configSchema: ConfigSchema
  configFilePath: string
}

export class ConfigImpl<ConfigSchema extends z.ZodObject> {
  constructor(public options: ConfigOptions<ConfigSchema>) {}

  async read(): Promise<z.core.output<ConfigSchema>> {
    if (!existsSync(this.options.configFilePath)) {
      return this.options.configSchema.parse({
        puppeteer: {
          launch: {},
        },
        weread: {
          books: [],
          enableCache: false,
        },
      })
    }

    const configFile = await readFile(this.options.configFilePath, 'utf-8')
    const config = this.options.configSchema.parse(JSON.parse(configFile))
    return config
  }
}
