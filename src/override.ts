import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import rehypeStringify from 'rehype-stringify'
import { visit } from 'unist-util-visit'
import * as acorn from 'acorn'
import * as astring from 'astring'
import type { Root } from 'hast'
import { DECRYPTION, INITIAL_STATE_REF, WEREAD_URL, isUtilsScriptUrl } from './common'

export const overrideDocument = async (url: string, body: string) => {
  if (!url.startsWith(WEREAD_URL)) return body

  const file = await unified()
    .use(rehypeParse, { fragment: true })
    .use(function () {
      return function (tree: Root) {
        visit(tree, 'element', function (node) {
          const text = node.children.at(0)

          if (
            node.tagName === 'script' &&
            typeof node.properties.nonce === 'string' &&
            text &&
            text.type === 'text'
          ) {
            const ast = acorn.parse(text.value, { ecmaVersion: 6 })
            const expressionStatement = acorn
              .parse(
                `window.${INITIAL_STATE_REF} = Object.assign({}, window.__INITIAL_STATE__);\n\n`,
                { ecmaVersion: 6 },
              )
              .body.at(0)
            if (expressionStatement) {
              ast.body.splice(1, 0, expressionStatement)
            }
            const newTextValue = astring.generate(ast)

            text.value = newTextValue
          }
        })
      }
    })
    .use(rehypeStringify)
    .process(body)

  return String(file)
}

export const overrideUtils = (url: string, body: string) => {
  const isUtils = isUtilsScriptUrl(url)

  if (!isUtils) return body

  const search = "['decryption']="
  const startIndex = body.indexOf(search)

  if (startIndex === -1) return body

  const endIndex = startIndex + search.length

  return (
    body.slice(0, endIndex) + `window.${DECRYPTION}=` + body.slice(endIndex)
  )
}
