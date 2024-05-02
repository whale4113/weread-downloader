import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import rehypeStringify from 'rehype-stringify'
import { visit } from 'unist-util-visit'
import * as acorn from 'acorn'
import * as walk from 'acorn-walk'
import * as astring from 'astring'
import type { Root } from 'hast'
import {
  DECRYPTION,
  INITIAL_STATE_REF,
  WEREAD_URL,
  isUtilsScriptUrl,
} from './common'

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
                { ecmaVersion: 6 }
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

  const ast = acorn.parse(body, { ecmaVersion: 6 })

  let insertIndex = -1
  let len = 0
  let originIndex = 0
  let offsetIndex = 0
  walk.ancestor(ast, {
    Literal(node, _state, ancestors) {
      if (insertIndex !== -1) {
        return
      }

      if (node.value === 'decryption') {
        const parent = ancestors.at(-2)

        if (parent?.type === 'MemberExpression') {
          if (ancestors.at(-5)?.type === 'ExpressionStatement') {
            insertIndex = parent?.end ?? -1
          }

          return
        }

        len = (parent as acorn.ArrayExpression).elements.length
        originIndex = (parent as acorn.ArrayExpression).elements.findIndex(
          el => el === node
        )
      } else if (
        ast.body.findIndex(node => node === ancestors.at(1)) === 1 &&
        typeof node.value === 'number'
      ) {
        offsetIndex = node.value
      }
    },
  })

  if (insertIndex === -1) {
    let index =
      originIndex >= offsetIndex
        ? originIndex - offsetIndex
        : len - offsetIndex + originIndex
    let hexIndex = index.toString(16)

    walk.ancestor(ast, {
      Literal(node, _state, ancestors) {
        if (node.value === '0x' + hexIndex) {
          insertIndex = ancestors.at(-3)?.end ?? -1
        }
      },
    })
  }

  if (insertIndex === -1) {
    return body
  }

  return (
    body.slice(0, insertIndex) +
    `=window.${DECRYPTION}` +
    body.slice(insertIndex)
  )
}
