import type { Align, TableData } from '../lib/types'
import type { Range } from '../lib/ops'
import { clearCells, removeCols, removeRows, setAligns } from '../lib/ops'
import Icon from './icons'

const ALIGNS = [
  ['left', 'alignLeft'],
  ['center', 'alignCenter'],
  ['right', 'alignRight'],
] as const

interface Props {
  table: TableData
  range: Range
  onChange: (table: TableData) => void
  onSelect: (range: Range) => void
}

/**
 * Floats over the selection with only what fits its shape: a whole row or column
 * offers deleting it, anything else offers alignment and emptying the cells.
 */
export default function SelectionPopover({ table, range, onChange, onSelect }: Props) {
  const rowCount = table.rows.length
  const colCount = table.aligns.length
  const rowSpan = range.bottom - range.top + 1
  const colSpan = range.right - range.left + 1
  // A whole row is selected when it spans every column, and the other way round.
  const wholeRows = range.left === 0 && range.right === colCount - 1
  const wholeCols = range.top === 0 && range.bottom === rowCount - 1
  const wholeTable = wholeRows && wholeCols

  const clear = (
    <button
      type="button"
      className="btn"
      title="Empty the selected cells"
      onClick={() => onChange(clearCells(table, range))}
    >
      <Icon name="eraser" />
    </button>
  )

  if (wholeTable) {
    // Both deletions would empty the table, so the only thing left is wiping it.
    return (
      <div className="cell-pop" onMouseDown={(event) => event.preventDefault()}>
        {clear}
      </div>
    )
  }

  if (wholeRows || wholeCols) {
    const rows = wholeRows
    const span = rows ? rowSpan : colSpan
    const noun = rows ? 'row' : 'column'
    const drop = () => {
      if (rows) {
        onChange(removeRows(table, range.top, range.bottom))
        const row = Math.max(0, range.top - 1)
        onSelect({ ...range, top: row, bottom: row })
      } else {
        onChange(removeCols(table, range.left, range.right))
        const col = Math.max(0, range.left - 1)
        onSelect({ ...range, left: col, right: col })
      }
    }
    return (
      <div className="cell-pop" onMouseDown={(event) => event.preventDefault()}>
        <button
          type="button"
          className="btn danger"
          title={span > 1 ? `Delete these ${span} ${noun}s` : `Delete this ${noun}`}
          disabled={span >= (rows ? rowCount : colCount)}
          onClick={drop}
        >
          <Icon name="trash" />
        </button>
      </div>
    )
  }

  const align = table.aligns[range.left]
  const sameAlign = table.aligns.slice(range.left, range.right + 1).every((value) => value === align)
  const toggleAlign = (next: Align) =>
    onChange(setAligns(table, range.left, range.right, sameAlign && align === next ? null : next))

  return (
    // Keep the focus (and the selection) on the table while the toolbar is used.
    <div className="cell-pop" onMouseDown={(event) => event.preventDefault()}>
      {ALIGNS.map(([value, icon]) => (
        <button
          key={value}
          type="button"
          title={`Align ${value} (click again to reset)`}
          className={`btn ${sameAlign && align === value ? 'active' : ''}`}
          onClick={() => toggleAlign(value)}
        >
          <Icon name={icon} />
        </button>
      ))}
      {rowSpan > 1 || colSpan > 1 ? (
        <>
          <span className="sep" />
          {clear}
        </>
      ) : null}
    </div>
  )
}
