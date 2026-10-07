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
 * Floats over the selection: alignment always, plus whatever the shape of the
 * selection makes sense — delete for whole rows or columns, clear for a block.
 */
export default function SelectionPopover({ table, range, onChange, onSelect }: Props) {
  const rowCount = table.rows.length
  const colCount = table.aligns.length
  const rowSpan = range.bottom - range.top + 1
  const colSpan = range.right - range.left + 1
  const multi = rowSpan > 1 || colSpan > 1
  // A whole row is selected when it spans every column, and the other way round.
  const wholeRows = range.left === 0 && range.right === colCount - 1
  const wholeCols = range.top === 0 && range.bottom === rowCount - 1

  const align = table.aligns[range.left]
  const sameAlign = table.aligns.slice(range.left, range.right + 1).every((value) => value === align)

  const toggleAlign = (next: Align) =>
    onChange(setAligns(table, range.left, range.right, sameAlign && align === next ? null : next))

  const dropRows = () => {
    onChange(removeRows(table, range.top, range.bottom))
    const row = Math.max(0, range.top - 1)
    onSelect({ ...range, top: row, bottom: row })
  }

  const dropCols = () => {
    onChange(removeCols(table, range.left, range.right))
    const col = Math.max(0, range.left - 1)
    onSelect({ ...range, left: col, right: col })
  }

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

      {multi ? (
        <>
          <span className="sep" />
          <button
            type="button"
            className="btn"
            title="Empty the selected cells"
            onClick={() => onChange(clearCells(table, range))}
          >
            <Icon name="eraser" />
          </button>
        </>
      ) : null}

      {wholeRows || wholeCols ? <span className="sep" /> : null}
      {wholeRows ? (
        <button
          type="button"
          className="btn danger"
          title={rowSpan > 1 ? `Delete ${rowSpan} rows` : 'Delete this row'}
          disabled={rowSpan >= rowCount}
          onClick={dropRows}
        >
          <Icon name="rowRemove" />
        </button>
      ) : null}
      {wholeCols ? (
        <button
          type="button"
          className="btn danger"
          title={colSpan > 1 ? `Delete ${colSpan} columns` : 'Delete this column'}
          disabled={colSpan >= colCount}
          onClick={dropCols}
        >
          <Icon name="columnRemove" />
        </button>
      ) : null}
    </div>
  )
}
