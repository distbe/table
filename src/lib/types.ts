export type Align = 'left' | 'center' | 'right' | null

/**
 * The single model shared by every representation (text / markdown / HTML).
 * The first row is always treated as the header.
 */
export interface TableData {
  rows: string[][]
  aligns: Align[]
}

export type BoxStyle = 'unicode' | 'ascii' | 'double' | 'rounded'

export interface AsciiOptions {
  style: BoxStyle
  /** Draw a rule between every row, not just under the header. */
  rowSeparators: boolean
  /** Wrap cell content at this display width. 0 disables wrapping. */
  maxWidth: number
}

export const emptyTable = (): TableData => ({
  rows: [
    ['', ''],
    ['', ''],
  ],
  aligns: [null, null],
})

/** Pad every row to the same column count and keep `aligns` the same length. */
export function normalize(table: TableData): TableData {
  const colCount = Math.max(1, ...table.rows.map((row) => row.length))
  return {
    rows: (table.rows.length ? table.rows : [[]]).map((row) =>
      Array.from({ length: colCount }, (_, i) => (row[i] ?? '').trim()),
    ),
    aligns: Array.from({ length: colCount }, (_, i) => table.aligns[i] ?? null),
  }
}

export function isEmptyTable(table: TableData): boolean {
  return table.rows.every((row) => row.every((cell) => cell === ''))
}
