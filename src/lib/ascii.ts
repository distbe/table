import type { AsciiOptions, BoxStyle, TableData } from './types'
import { normalize } from './types'
import { padTo, stringWidth, wrapText } from './width'

interface Chars {
  h: string
  v: string
  topLeft: string
  topMid: string
  topRight: string
  midLeft: string
  midMid: string
  midRight: string
  botLeft: string
  botMid: string
  botRight: string
}

const CHARS: Record<BoxStyle, Chars> = {
  unicode: {
    h: '─', v: '│',
    topLeft: '┌', topMid: '┬', topRight: '┐',
    midLeft: '├', midMid: '┼', midRight: '┤',
    botLeft: '└', botMid: '┴', botRight: '┘',
  },
  rounded: {
    h: '─', v: '│',
    topLeft: '╭', topMid: '┬', topRight: '╮',
    midLeft: '├', midMid: '┼', midRight: '┤',
    botLeft: '╰', botMid: '┴', botRight: '╯',
  },
  double: {
    h: '═', v: '║',
    topLeft: '╔', topMid: '╦', topRight: '╗',
    midLeft: '╠', midMid: '╬', midRight: '╣',
    botLeft: '╚', botMid: '╩', botRight: '╝',
  },
  ascii: {
    h: '-', v: '|',
    topLeft: '+', topMid: '+', topRight: '+',
    midLeft: '+', midMid: '+', midRight: '+',
    botLeft: '+', botMid: '+', botRight: '+',
  },
}

export const DEFAULT_ASCII_OPTIONS: AsciiOptions = {
  style: 'unicode',
  rowSeparators: true,
  maxWidth: 0,
}

const PAD = 1

export function serializeAscii(input: TableData, options: AsciiOptions): string {
  const table = normalize(input)
  const chars = CHARS[options.style]

  // Turn every cell into its (wrapped) lines.
  const blocks = table.rows.map((row) =>
    row.map((cell) => wrapText(cell.replace(/<br\s*\/?>/gi, '\n'), options.maxWidth)),
  )

  const colCount = table.aligns.length
  const widths = Array.from({ length: colCount }, (_, col) =>
    Math.max(1, ...blocks.map((block) => Math.max(...block[col].map(stringWidth)))),
  )

  const line = (left: string, mid: string, right: string) =>
    left + widths.map((w) => chars.h.repeat(w + PAD * 2)).join(mid) + right

  const out: string[] = [line(chars.topLeft, chars.topMid, chars.topRight)]

  blocks.forEach((block, rowIndex) => {
    const isHeader = rowIndex === 0
    const height = Math.max(...block.map((cell) => cell.length))
    for (let i = 0; i < height; i += 1) {
      const cells = block.map((cell, col) => {
        const text = cell[i] ?? ''
        // The header is centered; body cells follow the column alignment.
        const align = isHeader ? 'center' : (table.aligns[col] ?? 'left')
        return ' '.repeat(PAD) + padTo(text, widths[col], align) + ' '.repeat(PAD)
      })
      out.push(chars.v + cells.join(chars.v) + chars.v)
    }
    const isLast = rowIndex === blocks.length - 1
    if (isLast) {
      out.push(line(chars.botLeft, chars.botMid, chars.botRight))
    } else if (isHeader || options.rowSeparators) {
      out.push(line(chars.midLeft, chars.midMid, chars.midRight))
    }
  })

  return out.join('\n')
}

const VERTICAL = /[│┃║|┆┇┊┋]/
const BORDER_ONLY = /^[\s\-=_~+:.·*#│┃║|┆┇┊┋┌┬┐├┼┤└┴┘─━═╔╦╗╠╬╣╚╩╝╤╧╪╞╡╟╢╥╨┄┅┈┉╌╍]+$/
const RULE_CHAR = /[-=_~+─━═┄┅┈┉╌╍]/

const isSeparatorLine = (line: string) =>
  line.trim() !== '' && BORDER_ONLY.test(line) && RULE_CHAR.test(line)

function splitCells(line: string): string[] {
  let text = line.trim()
  if (VERTICAL.test(text.charAt(0))) text = text.slice(1)
  if (VERTICAL.test(text.charAt(text.length - 1))) text = text.slice(0, -1)
  return text.split(VERTICAL).map((cell) => cell.trim())
}

/**
 * Parse a text table. Works with any border characters and joins
 * cells that were wrapped across several lines back into one.
 */
export function parseAscii(text: string): TableData | null {
  const lines = text.split('\n').filter((line) => line.trim() !== '')
  if (!lines.length) return null

  type Block = { cells: string[][] }
  const blocks: Block[] = []
  let current: Block | null = null

  for (const line of lines) {
    if (isSeparatorLine(line)) {
      current = null
      continue
    }
    if (!VERTICAL.test(line)) continue // Ignore lines that are not part of the table.
    const cells = splitCells(line)
    if (!current) {
      current = { cells: cells.map((cell) => [cell]) }
      blocks.push(current)
    } else {
      cells.forEach((cell, col) => {
        if (!current!.cells[col]) current!.cells[col] = []
        current!.cells[col].push(cell)
      })
    }
  }

  if (!blocks.length) return null

  const rows = blocks.map((block) =>
    block.cells.map((parts) => parts.filter((part) => part !== '').join(' ')),
  )

  return normalize({ rows, aligns: [] })
}

export function looksLikeAscii(text: string): boolean {
  return parseAscii(text) !== null
}
