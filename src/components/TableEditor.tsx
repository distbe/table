import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ClipboardEvent, FormEvent, KeyboardEvent, MouseEvent, PointerEvent } from 'react'
import type { Align, TableData } from '../lib/types'
import { normalize } from '../lib/types'
import { parseDelimited, parseHtmlTable, serializeHtml } from '../lib/html'
import {
  clearCells,
  insertCols,
  insertRows,
  moveCols,
  moveRows,
  setCell,
  sliceTable,
  toTsv,
  type Range,
} from '../lib/ops'
import SelectionPopover from './SelectionPopover'
import {
  boundaryOf,
  cellBox,
  dropIndex,
  measure,
  pointOn,
  sameMetrics,
  type Axis,
  type Metrics,
} from './tableMetrics'

interface Cursor {
  row: number
  col: number
}

/** Lives outside the component because the toolbar calls it too. */
export function focusCell(row: number, col: number) {
  requestAnimationFrame(() => {
    const cell = document.querySelector<HTMLElement>(
      `.wysiwyg [data-row="${row}"][data-col="${col}"]`,
    )
    if (!cell) return
    cell.focus()
    const range = document.createRange()
    range.selectNodeContents(cell)
    range.collapse(false)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  })
}

const toRange = (anchor: Cursor, head: Cursor): Range => ({
  top: Math.min(anchor.row, head.row),
  bottom: Math.max(anchor.row, head.row),
  left: Math.min(anchor.col, head.col),
  right: Math.max(anchor.col, head.col),
})

interface CellProps {
  value: string
  header: boolean
  selected: boolean
  align: Align
  row: number
  col: number
  onChange: (value: string) => void
  onFocus: () => void
  onMouseDown: (event: MouseEvent<HTMLElement>) => void
  onMouseEnter: () => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  onPaste: (event: ClipboardEvent<HTMLElement>) => void
}

/**
 * A contentEditable cell. Rendered without children so React never touches the inner
 * DOM; textContent is written only when the value changed elsewhere, which keeps the caret.
 */
function Cell({ value, header, selected, align, row, col, ...handlers }: CellProps) {
  const ref = useRef<HTMLTableCellElement>(null)

  useEffect(() => {
    const node = ref.current
    if (node && node.textContent !== value) node.textContent = value
  }, [value])

  const Tag = header ? 'th' : 'td'
  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      className={selected ? 'sel' : undefined}
      data-row={row}
      data-col={col}
      style={{ textAlign: align ?? (header ? 'center' : 'left') }}
      onInput={(event) => handlers.onChange(event.currentTarget.textContent ?? '')}
      {...handlers}
      onChange={undefined}
    />
  )
}

interface Drag {
  axis: Axis
  /** Content-space position of the drop indicator */
  at: number
  /** Extent of the table across the dragged axis */
  start: number
  size: number
  /** Extent of the line being dragged, drawn as a ghost */
  from: number
  span: number
}

interface Props {
  table: TableData
  onChange: (table: TableData) => void
}

export default function TableEditor({ table, onChange }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const keepSelection = useRef(false)
  const [anchor, setAnchor] = useState<Cursor>({ row: 0, col: 0 })
  const [head, setHead] = useState<Cursor>({ row: 0, col: 0 })
  const [active, setActive] = useState(false)
  const [pop, setPop] = useState<{ top: number; left: number; below: boolean } | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [preview, setPreview] = useState<{ axis: Axis; at: number } | null>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)

  const rowCount = table.rows.length
  const colCount = table.aligns.length
  const range = toRange(anchor, head)
  const multi = range.top !== range.bottom || range.left !== range.right
  const rowSpan = range.bottom - range.top + 1
  const colSpan = range.right - range.left + 1

  const selectRange = (next: Range, focus = true) => {
    const top = Math.min(next.top, rowCount - 1)
    const left = Math.min(next.left, colCount - 1)
    setAnchor({ row: top, col: left })
    setHead({ row: Math.min(next.bottom, rowCount - 1), col: Math.min(next.right, colCount - 1) })
    if (focus) focusCell(top, left)
  }

  /** Clicking a grip selects the whole row or column. */
  const selectLine = (axis: Axis, index: number) => {
    keepSelection.current = true
    if (axis === 'row') {
      setAnchor({ row: index, col: 0 })
      setHead({ row: index, col: colCount - 1 })
    } else {
      setAnchor({ row: 0, col: index })
      setHead({ row: rowCount - 1, col: index })
    }
  }

  const lineSelected = (axis: Axis, index: number) =>
    axis === 'row'
      ? range.left === 0 && range.right === colCount - 1 && index >= range.top && index <= range.bottom
      : range.top === 0 && range.bottom === rowCount - 1 && index >= range.left && index <= range.right

  useEffect(() => {
    const stop = () => {
      dragging.current = false
    }
    window.addEventListener('mouseup', stop)
    return () => {
      window.removeEventListener('mouseup', stop)
      document.body.classList.remove('line-dragging')
    }
  }, [])

  // Handles are drawn on the table's border lines, so the geometry has to be measured.
  useLayoutEffect(() => {
    const root = rootRef.current
    const table = root?.querySelector('.wysiwyg')
    if (!root || !table) return
    const remeasure = () =>
      setMetrics((prev) => {
        const next = measure(root, rowCount, colCount)
        return sameMetrics(prev, next) ? prev : next
      })
    remeasure()
    const observer = new ResizeObserver(remeasure)
    observer.observe(table)
    return () => observer.disconnect()
  }, [table, rowCount, colCount])

  // Anchor the floating toolbar to the selected block.
  useLayoutEffect(() => {
    const root = rootRef.current
    const first = root ? cellBox(root, range.top, range.left) : null
    const last = root ? cellBox(root, range.bottom, range.right) : null
    if (!first || !last) {
      setPop(null)
      return
    }
    const below = first.top < 56
    setPop({
      top: below ? last.top + last.height + 6 : first.top - 6,
      left: first.left,
      below,
    })
  }, [range.top, range.left, range.bottom, range.right, table])

  const moveLine = (axis: Axis, to: number, from: number, span: number) => {
    if (axis === 'row') {
      onChange(moveRows(table, from, to, span))
      const top = to > from ? to - span : to
      selectRange({ left: 0, right: colCount - 1, top, bottom: top + span - 1 }, false)
    } else {
      onChange(moveCols(table, from, to, span))
      const left = to > from ? to - span : to
      selectRange({ top: 0, bottom: rowCount - 1, left, right: left + span - 1 }, false)
    }
  }

  /** Drag a grip to reorder. The whole selection moves when the grip is part of it. */
  const startDrag = (axis: Axis, index: number) => (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.focus()
    setPreview(null)
    const inSelection = lineSelected(axis, index)
    if (!inSelection) selectLine(axis, index)
    // Dragging a grip inside the selection moves the whole block, otherwise just this line.
    const from = inSelection ? (axis === 'row' ? range.top : range.left) : index
    const span = inSelection ? (axis === 'row' ? rowSpan : colSpan) : 1
    const root = rootRef.current
    if (!root || !metrics) return

    const bands = axis === 'row' ? metrics.rows : metrics.cols
    const first = bands[from]
    const lastBand = bands[Math.min(from + span - 1, bands.length - 1)]
    const ghost = { from: first.start, span: lastBand.start + lastBand.size - first.start }

    // Make it obvious the pointer is carrying something, whatever it travels over.
    document.body.classList.add('line-dragging')

    const origin = { x: event.clientX, y: event.clientY }
    let moved = false
    let target = index

    const onMove = (move: globalThis.PointerEvent) => {
      if (!moved && Math.abs(move.clientX - origin.x) + Math.abs(move.clientY - origin.y) < 4) return
      moved = true
      target = dropIndex(metrics, axis, pointOn(root, axis, move.clientX, move.clientY))
      setDrag({
        axis,
        at: boundaryOf(metrics, axis, target),
        start: axis === 'row' ? metrics.box.cross : metrics.box.start,
        size: axis === 'row' ? metrics.box.crossSize : metrics.box.size,
        ...ghost,
      })
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.classList.remove('line-dragging')
      setDrag(null)
      if (moved) moveLine(axis, target, from, span)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const addRows = (at: number, count = rowSpan) => {
    onChange(insertRows(table, at, count))
    selectRange({ left: 0, right: colCount - 1, top: at, bottom: at + count - 1 })
  }

  const addCols = (at: number, count = colSpan) => {
    onChange(insertCols(table, at, count))
    selectRange({ top: 0, bottom: rowCount - 1, left: at, right: at + count - 1 })
  }

  const moveTo = (row: number, col: number) => {
    setAnchor({ row, col })
    setHead({ row, col })
    focusCell(row, col)
  }

  const onKeyDown = (row: number, col: number) => (event: KeyboardEvent<HTMLElement>) => {
    const vertical = event.key === 'ArrowUp' || event.key === 'ArrowDown'
    const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight'
    if (event.altKey && (vertical || horizontal)) {
      // Alt + arrows reorder, like moving a line in an editor.
      event.preventDefault()
      if (event.key === 'ArrowUp' && range.top > 0) moveLine('row', range.top - 1, range.top, rowSpan)
      if (event.key === 'ArrowDown' && range.bottom < rowCount - 1)
        moveLine('row', range.bottom + 2, range.top, rowSpan)
      if (event.key === 'ArrowLeft' && range.left > 0) moveLine('col', range.left - 1, range.left, colSpan)
      if (event.key === 'ArrowRight' && range.right < colCount - 1)
        moveLine('col', range.right + 2, range.left, colSpan)
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      const flat = row * colCount + col + (event.shiftKey ? -1 : 1)
      if (flat < 0) return
      if (flat >= rowCount * colCount) {
        onChange(insertRows(table, rowCount))
        moveTo(rowCount, 0)
        return
      }
      moveTo(Math.floor(flat / colCount), flat % colCount)
      return
    }
    if (event.key === 'Enter') {
      // Cells stay single line: Enter moves to the cell below.
      event.preventDefault()
      if (row + 1 >= rowCount) onChange(insertRows(table, rowCount))
      moveTo(row + 1, col)
      return
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && multi) {
      // Spreadsheet behaviour: wipe the block instead of one character.
      event.preventDefault()
      onChange(clearCells(table, range))
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      moveTo(head.row, head.col)
      return
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
      // The default selects the whole document, so one keystroke could wipe the table.
      event.preventDefault()
      const selection = window.getSelection()
      const node = document.createRange()
      node.selectNodeContents(event.currentTarget)
      selection?.removeAllRanges()
      selection?.addRange(node)
      return
    }
    if (event.shiftKey && (vertical || horizontal)) {
      const next = {
        row: head.row + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0),
        col: head.col + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0),
      }
      if (next.row < 0 || next.row >= rowCount || next.col < 0 || next.col >= colCount) return
      event.preventDefault()
      window.getSelection()?.removeAllRanges()
      setHead(next)
      return
    }
    if (vertical) {
      const next = row + (event.key === 'ArrowDown' ? 1 : -1)
      if (next < 0 || next >= rowCount) return
      event.preventDefault()
      moveTo(next, col)
    }
  }

  const onMouseDown = (row: number, col: number) => (event: MouseEvent<HTMLElement>) => {
    if (event.button !== 0) return
    if (event.shiftKey) {
      event.preventDefault()
      keepSelection.current = true
      setHead({ row, col })
      return
    }
    dragging.current = true
    setAnchor({ row, col })
    setHead({ row, col })
  }

  const onMouseEnter = (row: number, col: number) => () => {
    if (!dragging.current || (head.row === row && head.col === col)) return
    // Drop the native caret selection; from here the drag selects whole cells.
    window.getSelection()?.removeAllRanges()
    keepSelection.current = true
    setHead({ row, col })
  }

  const onPaste = (row: number, col: number) => (event: ClipboardEvent<HTMLElement>) => {
    event.preventDefault()
    const html = event.clipboardData.getData('text/html')
    const text = event.clipboardData.getData('text/plain')
    const pasted = (html ? parseHtmlTable(html) : null) ?? parseDelimited(text)
    if (pasted && (pasted.rows.length > 1 || pasted.aligns.length > 1)) {
      onChange(normalize(pasted))
      return
    }
    const node = event.currentTarget
    document.execCommand('insertText', false, text.replace(/\s+/g, ' ').trim())
    onChange(setCell(table, row, col, node.textContent ?? ''))
  }

  /** Copy the selected block as TSV plus a real table, instead of the focused cell only. */
  const onCopy = (event: ClipboardEvent<HTMLDivElement>) => {
    if (!multi) return
    event.preventDefault()
    const slice = sliceTable(table, range)
    event.clipboardData.setData('text/plain', toTsv(slice))
    event.clipboardData.setData('text/html', serializeHtml(slice, true, range.top === 0))
  }

  /** Block input whose selection spans several cells, which would break the table markup. */
  const onBeforeInput = (event: FormEvent<HTMLDivElement>) => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const dom = selection.getRangeAt(0)
    const cellOf = (node: Node | null) => {
      const element = node?.nodeType === Node.ELEMENT_NODE ? (node as Element) : node?.parentElement
      return element?.closest('th,td') ?? null
    }
    const start = cellOf(dom.startContainer)
    if (!start || start !== cellOf(dom.endContainer)) event.preventDefault()
  }

  const cellProps = (row: number, col: number) => ({
    align: table.aligns[col],
    row,
    col,
    selected:
      multi && row >= range.top && row <= range.bottom && col >= range.left && col <= range.right,
    onChange: (value: string) => onChange(setCell(table, row, col, value)),
    onFocus: () => {
      if (keepSelection.current) {
        keepSelection.current = false
        return
      }
      setAnchor({ row, col })
      setHead({ row, col })
    },
    onMouseDown: onMouseDown(row, col),
    onMouseEnter: onMouseEnter(row, col),
    onKeyDown: onKeyDown(row, col),
    onPaste: onPaste(row, col),
  })

  /** A drag handle laid over the table's border line, not a cell of its own. */
  const handle = (axis: Axis, index: number, band: { start: number; size: number }) => {
    const last = index === (axis === 'row' ? rowCount : colCount) - 1
    const add = (at: number, after: boolean) => (
      <button
        type="button"
        className={`handle-add ${after ? 'after' : ''}`}
        title={axis === 'row' ? 'Insert row here' : 'Insert column here'}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerEnter={() => setPreview({ axis, at })}
        onPointerLeave={() => setPreview(null)}
        onClick={() => {
          setPreview(null)
          if (axis === 'row') addRows(at, 1)
          else addCols(at, 1)
        }}
      >
        +
      </button>
    )
    const line = metrics!.box
    return (
      <div
        key={`${axis}-${index}`}
        tabIndex={-1}
        className={`handle handle-${axis} ${lineSelected(axis, index) ? 'on' : ''}`}
        title={axis === 'row' ? 'Drag to move the row' : 'Drag to move the column'}
        style={
          axis === 'row'
            ? { top: band.start, height: band.size, left: line.cross }
            : { left: band.start, width: band.size, top: line.start }
        }
        onPointerDown={startDrag(axis, index)}
      >
        <span className="handle-band" />
        <span className="handle-grip" />
        {add(index, false)}
        {last ? add(index + 1, true) : null}
      </div>
    )
  }

  const [headerRow, ...bodyRows] = table.rows

  return (
    <div
      className="editor-scroll"
      ref={rootRef}
      onBeforeInput={onBeforeInput}
      onCopy={onCopy}
      onFocus={() => setActive(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setActive(false)
      }}
    >
      <table className={`wysiwyg ${multi ? 'selecting' : ''}`}>
        <thead>
          <tr>
            {headerRow.map((cell, col) => (
              <Cell key={col} value={cell} header {...cellProps(0, col)} />
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((cells, index) => (
            <tr key={index + 1}>
              {cells.map((cell, col) => (
                <Cell key={col} value={cell} header={false} {...cellProps(index + 1, col)} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {metrics ? (
        <div className={`handles ${drag ? 'dragging' : ''} ${preview ? 'inserting' : ''}`}>
          <div
            className="handle handle-corner"
            tabIndex={-1}
            title="Select the whole table"
            style={{ top: metrics.box.start, left: metrics.box.cross }}
            onPointerDown={(event) => {
              event.preventDefault()
              event.currentTarget.focus()
              keepSelection.current = true
              setAnchor({ row: 0, col: 0 })
              setHead({ row: rowCount - 1, col: colCount - 1 })
            }}
          />
          {metrics.rows.map((band, row) => handle('row', row, band))}
          {metrics.cols.map((band, col) => handle('col', col, band))}
        </div>
      ) : null}

      {metrics && preview && !drag ? (
        <div
          className={`drop-line preview ${preview.axis}`}
          style={
            preview.axis === 'row'
              ? {
                  top: boundaryOf(metrics, 'row', preview.at),
                  left: metrics.box.cross,
                  width: metrics.box.crossSize,
                }
              : {
                  left: boundaryOf(metrics, 'col', preview.at),
                  top: metrics.box.start,
                  height: metrics.box.size,
                }
          }
        />
      ) : null}

      {drag ? (
        <div
          className={`drag-ghost ${drag.axis}`}
          style={
            drag.axis === 'row'
              ? { top: drag.from, height: drag.span, left: drag.start, width: drag.size }
              : { left: drag.from, width: drag.span, top: drag.start, height: drag.size }
          }
        />
      ) : null}

      {drag ? (
        <div
          className={`drop-line ${drag.axis}`}
          style={
            drag.axis === 'row'
              ? { top: drag.at, left: drag.start, width: drag.size }
              : { left: drag.at, top: drag.start, height: drag.size }
          }
        />
      ) : null}

      {active && pop ? (
        <div
          className={`cell-pop-wrap ${pop.below ? 'below' : ''}`}
          style={{ top: pop.top, left: pop.left }}
        >
          <SelectionPopover table={table} range={range} onChange={onChange} onSelect={selectRange} />
        </div>
      ) : null}

    </div>
  )
}
