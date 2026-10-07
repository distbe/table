import type { Align, TableData } from './types'
import { normalize } from './types'

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** HTML with inline styles so borders survive a paste into a document or mail client. */
export function serializeHtml(input: TableData, inlineStyle = true, header = true): string {
  const table = normalize(input)
  const tableStyle = inlineStyle ? ' style="border-collapse:collapse"' : ''
  const cellStyle = (align: Align, header: boolean) => {
    if (!inlineStyle) return align ? ` style="text-align:${align}"` : ''
    const parts = [
      'border:1px solid #d0d7de',
      'padding:6px 10px',
      `text-align:${align ?? (header ? 'center' : 'left')}`,
    ]
    if (header) parts.push('background:#f6f8fa', 'font-weight:600')
    return ` style="${parts.join(';')}"`
  }

  const row = (cells: string[], header: boolean) =>
    `    <tr>\n${cells
      .map((cell, col) => {
        const tag = header ? 'th' : 'td'
        return `      <${tag}${cellStyle(table.aligns[col], header)}>${escapeHtml(cell)}</${tag}>`
      })
      .join('\n')}\n    </tr>`

  const [first, ...rest] = table.rows
  const body = header ? rest : table.rows
  const out = [
    `<table${tableStyle}>`,
    ...(header ? ['  <thead>', row(first, true), '  </thead>'] : []),
    '  <tbody>',
    ...body.map((cells) => row(cells, false)),
    '  </tbody>',
    '</table>',
  ]
  return out.join('\n')
}

const alignOf = (element: HTMLElement): Align => {
  const value = (element.style.textAlign || element.getAttribute('align') || '').toLowerCase()
  return value === 'center' || value === 'right' || value === 'left' ? value : null
}

const cellText = (element: HTMLElement) =>
  (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim()

/** Read the first table out of pasted HTML. colspan is expanded, rowspan ignored. */
export function parseHtmlTable(html: string): TableData | null {
  if (typeof DOMParser === 'undefined') return null
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const element = doc.querySelector('table')
  if (!element) return null

  const rows: string[][] = []
  let aligns: Align[] = []

  element.querySelectorAll('tr').forEach((tr, index) => {
    const cells = Array.from(tr.querySelectorAll<HTMLElement>('th,td'))
    if (!cells.length) return
    if (index === 0) aligns = cells.map(alignOf)
    const expanded: string[] = []
    cells.forEach((cell) => {
      const span = Math.max(1, Number(cell.getAttribute('colspan') ?? 1))
      const text = cellText(cell)
      for (let i = 0; i < span; i += 1) expanded.push(i === 0 ? text : '')
    })
    rows.push(expanded)
  })

  if (!rows.length) return null
  return normalize({ rows, aligns })
}

/** Read a TSV / CSV string, as copied from a spreadsheet. */
export function parseDelimited(text: string): TableData | null {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((line) => line.trim() !== '')
  if (lines.length < 2) return null
  const delimiter = lines[0].includes('\t') ? '\t' : lines.every((line) => line.includes(',')) ? ',' : null
  if (!delimiter) return null
  const rows = lines.map((line) => line.split(delimiter).map((cell) => cell.trim()))
  if (rows[0].length < 2) return null
  return normalize({ rows, aligns: [] })
}
