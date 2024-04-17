import url from 'node:url'

export const INITIAL_STATE_REF = '__INITIAL_STATE__REF__'
export const DECRYPTION = '__DECRYPTION__'

export const DATA_DIR = url.fileURLToPath(new URL('../data', import.meta.url))
export const OUTPUT_DIR = url.fileURLToPath(
  new URL('../output', import.meta.url)
)

export const WEREAD_URL = 'https://weread.qq.com/'

export const isUtilsScriptUrl = (url: string) =>
  url.includes('wrwebnjlogic') && url.includes('utils')
