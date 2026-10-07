/** Token class name; null means plain text. */
type Token = [cls: string | null, text: string]

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const TAG = /<!--[\s\S]*?-->|<\/?[a-zA-Z][\w:-]*(?:"[^"]*"|'[^']*'|[^>"'])*>?/g
const TAG_HEAD = /^(<\/?)([a-zA-Z][\w:-]*)/
const ATTR = /([a-zA-Z_:][\w:.-]*)(\s*=\s*)("[^"]*"|'[^']*')?|\s+/g

function tokenizeTag(tag: string): Token[] {
  const head = TAG_HEAD.exec(tag)
  if (!head) return [[null, tag]]

  const tokens: Token[] = [
    ['punct', head[1]],
    ['tag', head[2]],
  ]
  let rest = tag.slice(head[0].length)
  const close = /\/?>$/.exec(rest)
  if (close) rest = rest.slice(0, close.index)

  let last = 0
  for (const attr of rest.matchAll(ATTR)) {
    if (attr.index > last) tokens.push([null, rest.slice(last, attr.index)])
    if (attr[1]) {
      tokens.push(['attr', attr[1]])
      if (attr[2]) tokens.push(['punct', attr[2]])
      if (attr[3]) tokens.push(['str', attr[3]])
    } else {
      tokens.push([null, attr[0]])
    }
    last = attr.index + attr[0].length
  }
  if (last < rest.length) tokens.push([null, rest.slice(last)])
  if (close) tokens.push(['punct', close[0]])
  return tokens
}

/** Wrap each token of the HTML source in a <span>. Every input character is escaped. */
export function highlightHtml(code: string): string {
  const render = ([cls, text]: Token) =>
    cls ? `<span class="tok-${cls}">${escapeHtml(text)}</span>` : escapeHtml(text)

  let out = ''
  let last = 0
  for (const match of code.matchAll(TAG)) {
    out += escapeHtml(code.slice(last, match.index))
    out += match[0].startsWith('<!--')
      ? render(['comment', match[0]])
      : tokenizeTag(match[0]).map(render).join('')
    last = match.index + match[0].length
  }
  return out + escapeHtml(code.slice(last))
}
