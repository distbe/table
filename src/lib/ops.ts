import type { Align, TableData } from './types'

/** A rectangular block of cells, in normalized (top <= bottom, left <= right) form. */
export interface Range {
  top: number
  left: number
  bottom: number
  right: number
}

export const insertRows = (table: TableData, at: number, count = 1): TableData => {
  const rows = [...table.rows]
  const blank = () => Array.from({ length: table.aligns.length }, () => '')
  rows.splice(at, 0, ...Array.from({ length: count }, blank))
  return { ...table, rows }
}

export const removeRows = (table: TableData, from: number, to = from): TableData => {
  const rows = table.rows.filter((_, r) => r < from || r > to)
  return rows.length ? { ...table, rows } : table
}

export const insertCols = (table: TableData, at: number, count = 1): TableData => {
  const aligns = [...table.aligns]
  aligns.splice(at, 0, ...Array.from({ length: count }, () => null))
  return {
    aligns,
    rows: table.rows.map((cells) => {
      const next = [...cells]
      next.splice(at, 0, ...Array.from({ length: count }, () => ''))
      return next
    }),
  }
}

export const removeCols = (table: TableData, from: number, to = from): TableData => {
  const keep = (_: unknown, c: number) => c < from || c > to
  const aligns = table.aligns.filter(keep)
  return aligns.length ? { aligns, rows: table.rows.map((cells) => cells.filter(keep)) } : table
}

export const setAligns = (
  table: TableData,
  from: number,
  to: number,
  align: Align,
): TableData => ({
  ...table,
  aligns: table.aligns.map((value, c) => (c >= from && c <= to ? align : value)),
})

export const setCell = (table: TableData, row: number, col: number, value: string): TableData => ({
  ...table,
  rows: table.rows.map((cells, r) =>
    r === row ? cells.map((cell, c) => (c === col ? value : cell)) : cells,
  ),
})

/** Empty every cell of the selected block, keeping the shape. */
export const clearCells = (table: TableData, range: Range): TableData => ({
  ...table,
  rows: table.rows.map((cells, r) =>
    r < range.top || r > range.bottom
      ? cells
      : cells.map((cell, c) => (c < range.left || c > range.right ? cell : '')),
  ),
})

/** The selected block as a table of its own, for copying. */
export const sliceTable = (table: TableData, range: Range): TableData => ({
  aligns: table.aligns.slice(range.left, range.right + 1),
  rows: table.rows
    .slice(range.top, range.bottom + 1)
    .map((cells) => cells.slice(range.left, range.right + 1)),
})

export const toTsv = (table: TableData): string =>
  table.rows.map((cells) => cells.join('\t')).join('\n')

/** Move `count` rows starting at `from` so they land before the original index `to`. */
export const moveRows = (table: TableData, from: number, to: number, count = 1): TableData => {
  if (to >= from && to <= from + count) return table
  const rows = [...table.rows]
  const moved = rows.splice(from, count)
  rows.splice(to > from ? to - count : to, 0, ...moved)
  return { ...table, rows }
}

export const moveCols = (table: TableData, from: number, to: number, count = 1): TableData => {
  if (to >= from && to <= from + count) return table
  const at = to > from ? to - count : to
  const move = <T,>(list: T[]) => {
    const next = [...list]
    next.splice(at, 0, ...next.splice(from, count))
    return next
  }
  return {
    aligns: move(table.aligns),
    rows: table.rows.map((cells) => move(cells)),
  }
}
