import type { Align, TableData } from './types'
import { normalize } from './types'
import { padTo, stringWidth } from './width'

const DELIMITER_CELL = /^:?-{1,}:?$/

function splitRow(line: string): string[] {
  let text = line.trim()
  if (text.startsWith('|')) text = text.slice(1)
  if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0, -1)

  const cells: string[] = []
  let buffer = ''
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (char === '\\' && text[i + 1] === '|') {
      buffer += '|'
      i += 1
      continue
    }
    if (char === '|') {
      cells.push(buffer.trim())
      buffer = ''
      continue
    }
    buffer += char
  }
  cells.push(buffer.trim())
  return cells
}

const isDelimiterRow = (line: string) => {
  const cells = splitRow(line)
  return cells.length > 0 && cells.every((cell) => DELIMITER_CELL.test(cell))
}

const alignOf = (cell: string): Align => {
  const left = cell.startsWith(':')
  const right = cell.endsWith(':')
  if (left && right) return 'center'
  if (right) return 'right'
  if (left) return 'left'
  return null
}

/** Collapse <br> and whitespace so a cell stays on a single line. */
const unescapeCell = (cell: string) => cell.replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim()

export function parseMarkdown(text: string): TableData | null {
  const lines = text.split('\n').filter((line) => line.trim() !== '')
  if (!lines.length) return null
  // Nothing that looks like a table row.
  if (!lines.some((line) => line.includes('|'))) return null

  const rows: string[][] = []
  let aligns: Align[] = []
  let delimiterAt = -1

  for (const line of lines) {
    if (!line.includes('|')) continue
    if (delimiterAt === -1 && rows.length > 0 && isDelimiterRow(line)) {
      delimiterAt = rows.length
      aligns = splitRow(line).map(alignOf)
      continue
    }
    rows.push(splitRow(line).map(unescapeCell))
  }

  if (!rows.length) return null
  return normalize({ rows, aligns })
}

const escapeCell = (cell: string) => cell.replace(/\|/g, '\\|').replace(/\n/g, '<br>')

export function serializeMarkdown(input: TableData, pad = true): string {
  const table = normalize(input)
  const colCount = table.aligns.length
  const body = table.rows.map((row) => row.map(escapeCell))
  const [header, ...rest] = body

  const widths = Array.from({ length: colCount }, (_, col) => {
    if (!pad) return 0
    const cells = [header[col] ?? '', ...rest.map((row) => row[col] ?? '')]
    return Math.max(3, ...cells.map(stringWidth))
  })

  const renderRow = (cells: string[]) =>
    `| ${cells
      .map((cell, col) => padTo(cell ?? '', widths[col], table.aligns[col] === 'right' ? 'right' : 'left'))
      .join(' | ')} |`.replace(/ +$/gm, '')

  const delimiter = `| ${table.aligns
    .map((align, col) => {
      const width = Math.max(3, widths[col])
      if (align === 'center') return `:${'-'.repeat(width - 2)}:`
      if (align === 'right') return `${'-'.repeat(width - 1)}:`
      if (align === 'left') return `:${'-'.repeat(width - 1)}`
      return '-'.repeat(width)
    })
    .join(' | ')} |`

  return [renderRow(header), delimiter, ...rest.map(renderRow)].join('\n')
}

export function looksLikeMarkdown(text: string): boolean {
  return parseMarkdown(text) !== null
}
