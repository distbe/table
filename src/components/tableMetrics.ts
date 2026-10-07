export type Axis = 'row' | 'col'

export interface Band {
  start: number
  size: number
}

export interface Box {
  top: number
  left: number
  width: number
  height: number
}

/** Cell geometry in the scroll container's content coordinates. */
export interface Metrics {
  box: Band & { cross: number; crossSize: number }
  rows: Band[]
  cols: Band[]
}

/**
 * Position of an element inside the scroll container.
 * Measured from rects, not offsetTop: a cell's offsetParent is its own <table>, so
 * offsets would be missing the container's padding.
 */
export function boxOf(root: HTMLElement, element: Element): Box {
  const base = root.getBoundingClientRect()
  const rect = element.getBoundingClientRect()
  return {
    top: rect.top - base.top + root.scrollTop,
    left: rect.left - base.left + root.scrollLeft,
    width: rect.width,
    height: rect.height,
  }
}

export const cellBox = (root: HTMLElement, row: number, col: number): Box | null => {
  const cell = root.querySelector(`[data-row="${row}"][data-col="${col}"]`)
  return cell ? boxOf(root, cell) : null
}

/** Measure the rendered table so handles can be drawn on its border lines. */
export function measure(root: HTMLElement, rowCount: number, colCount: number): Metrics | null {
  const table = root.querySelector('.wysiwyg')
  if (!table) return null

  const rows: Band[] = []
  for (let row = 0; row < rowCount; row += 1) {
    const box = cellBox(root, row, 0)
    if (!box) return null
    rows.push({ start: box.top, size: box.height })
  }
  const cols: Band[] = []
  for (let col = 0; col < colCount; col += 1) {
    const box = cellBox(root, 0, col)
    if (!box) return null
    cols.push({ start: box.left, size: box.width })
  }

  const box = boxOf(root, table)
  return {
    box: { start: box.top, size: box.height, cross: box.left, crossSize: box.width },
    rows,
    cols,
  }
}

export const sameMetrics = (a: Metrics | null, b: Metrics | null) =>
  JSON.stringify(a) === JSON.stringify(b)

const bandsOf = (metrics: Metrics, axis: Axis) => (axis === 'row' ? metrics.rows : metrics.cols)

/** Content-space position of the pointer along the axis being dragged. */
export const pointOn = (root: HTMLElement, axis: Axis, x: number, y: number) => {
  const base = root.getBoundingClientRect()
  return axis === 'row' ? y - base.top + root.scrollTop : x - base.left + root.scrollLeft
}

/** Index the dragged line should be inserted before. */
export function dropIndex(metrics: Metrics, axis: Axis, point: number): number {
  const bands = bandsOf(metrics, axis)
  for (let i = 0; i < bands.length; i += 1) {
    if (point < bands[i].start + bands[i].size / 2) return i
  }
  return bands.length
}

/** Where to draw the drop indicator for that insertion point. */
export function boundaryOf(metrics: Metrics, axis: Axis, index: number): number {
  const bands = bandsOf(metrics, axis)
  const last = bands[bands.length - 1]
  return index >= bands.length ? last.start + last.size : bands[index].start
}
