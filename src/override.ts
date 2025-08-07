import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import rehypeStringify from 'rehype-stringify'
import { visit } from 'unist-util-visit'
import * as acorn from 'acorn'
import * as walk from 'acorn-walk'
import * as astring from 'astring'
import type { Root } from 'hast'
import { WEREAD_URL } from './constants'

export const INITIAL_STATE_REF = '__INITIAL_STATE__REF__'
export const DECRYPTION = '__DECRYPTION__'

export const isUtilsScriptUrl = (url: string): boolean =>
  url.includes('wrwebnjlogic') && url.includes('utils')

export const overrideDocument = async (
  url: string,
  body: string
): Promise<string> => {
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

export const overrideUtils = (url: string, body: string): string => {
  const isUtils = isUtilsScriptUrl(url)

  if (!isUtils) return body

  const ast = acorn.parse(body, { ecmaVersion: 6 })

  let insertIndex = -1
  walk.ancestor(ast, {
    Literal(node, _state, ancestors) {
      const parent = ancestors.at(-2)
      if (
        node.value === 'decrypt' &&
        parent?.type === 'MemberExpression' &&
        (parent as acorn.MemberExpression).object.type === 'MemberExpression' &&
        ((parent as acorn.MemberExpression).object as acorn.MemberExpression)
          .property.type === 'Literal' &&
        (
          ((parent as acorn.MemberExpression).object as acorn.MemberExpression)
            .property as acorn.Literal
        ).value === 'DES'
      ) {
        insertIndex =
          ancestors.findLast(item => item.type === 'FunctionExpression')?.start ??
          -1
      }
    },
  })

  if (insertIndex === -1) {
    return body
  }

  return (
    body.slice(0, insertIndex) +
    `window.${DECRYPTION}=` +
    body.slice(insertIndex)
  )
}
