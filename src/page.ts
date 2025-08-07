import { Browser, Page } from 'puppeteer'
import { Mutex, MutexInterface, withTimeout } from 'async-mutex'
import { SECOND } from './utils/datetime'
import { WEREAD_URL } from './constants'
import { isUtilsScriptUrl, overrideDocument, overrideUtils } from './override'

export const bringPageToFrontMutex: MutexInterface = withTimeout(
  new Mutex(),
  30 * SECOND
)

export const createPage = async (browser: Browser): Promise<Page> => {
  const page = await browser.newPage()

  const client = await page.createCDPSession()

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

  await client.send('Fetch.enable', {
    patterns: [
      {
        urlPattern: 'https://weread.qq.com/*',
        resourceType: 'Document',
        requestStage: 'Response',
      },
      {
        urlPattern: '*/wrwebnjlogic/js/utils*',
        resourceType: 'Script',
        requestStage: 'Response',
      },
    ],
  })

  return page
}
