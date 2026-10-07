import { describe, expect, it } from 'vitest'
import { DEFAULT_ASCII_OPTIONS, parseAscii, serializeAscii } from './ascii'
import { parseMarkdown, serializeMarkdown } from './markdown'
import { serializeHtml } from './html'
import { highlightHtml } from './highlight'
import {
  clearCells,
  insertCols,
  insertRows,
  moveCols,
  moveRows,
  removeCols,
  removeRows,
  sliceTable,
  toTsv,
} from './ops'
import { normalize } from './types'
import { stringWidth } from './width'

const SAMPLE = `┌────────┬──────────────────────────────────────────────────┐
│ Method │                   Description                    │
├────────┼──────────────────────────────────────────────────┤
│ GET    │ Returns a paginated list of users together with  │
│        │ their active sessions                            │
├────────┼──────────────────────────────────────────────────┤
│ DELETE │ Removes a user permanently                       │
└────────┴──────────────────────────────────────────────────┘`

const WRAPPED = 'Returns a paginated list of users together with their active sessions'

describe('stringWidth', () => {
  it('counts CJK characters as two cells', () => {
    expect(stringWidth('漢字')).toBe(4)
    expect(stringWidth('ab')).toBe(2)
  })

  it('counts wide symbols and emoji as two cells', () => {
    expect(stringWidth('✅')).toBe(2)
    expect(stringWidth('❌')).toBe(2)
    expect(stringWidth('⭐')).toBe(2)
    expect(stringWidth('🎉')).toBe(2)
  })

  it('keeps arrows, middots and box drawing at one cell', () => {
    expect(stringWidth('→·─│┌')).toBe(5)
  })

  it('counts an emoji cluster once, however many code points it is', () => {
    expect(stringWidth('❤️')).toBe(2) // variation selector turns it into an emoji
    expect(stringWidth('⚠️')).toBe(2)
    expect(stringWidth('👨‍👩‍👧')).toBe(2) // joined with ZWJ
    expect(stringWidth('👍🏽')).toBe(2) // skin tone modifier
    expect(stringWidth('🇰🇷')).toBe(2) // regional indicator pair
    expect(stringWidth('✅😉⭐')).toBe(6)
  })

  it('honours the text presentation selector', () => {
    expect(stringWidth('❤︎')).toBe(1)
  })
})

describe('parseAscii', () => {
  it('parses a pasted table and rejoins wrapped cells', () => {
    const table = parseAscii(SAMPLE)!
    expect(table.rows).toEqual([
      ['Method', 'Description'],
      ['GET', WRAPPED],
      ['DELETE', 'Removes a user permanently'],
    ])
  })

  it('parses the +/- style too', () => {
    const table = parseAscii(['+---+---+', '| a | b |', '+---+---+', '| 1 | 2 |', '+---+---+'].join('\n'))!
    expect(table.rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('returns null when the input is not a table', () => {
    expect(parseAscii('just some text')).toBeNull()
  })
})

describe('serializeAscii', () => {
  it('pads columns and round trips unchanged', () => {
    const table = parseAscii(SAMPLE)!
    const text = serializeAscii(table, DEFAULT_ASCII_OPTIONS)
    expect(new Set(text.split('\n').map(stringWidth)).size).toBe(1)
    expect(serializeAscii(parseAscii(text)!, DEFAULT_ASCII_OPTIONS)).toBe(text)
  })

  it('keeps the header rule when row rules are off', () => {
    const text = serializeAscii(parseAscii(SAMPLE)!, {
      ...DEFAULT_ASCII_OPTIONS,
      rowSeparators: false,
    })
    expect(text.split('\n').filter((line) => line.startsWith('├'))).toHaveLength(1)
  })

  it('wraps cells past the max width', () => {
    const table = parseAscii(SAMPLE)!
    const text = serializeAscii(table, { ...DEFAULT_ASCII_OPTIONS, maxWidth: 30 })
    // 3 borders + 4 padding + content (6 + 30)
    expect(Math.max(...text.split('\n').map(stringWidth))).toBeLessThanOrEqual(43)
    expect(parseAscii(text)!.rows[1][1]).toBe(WRAPPED)
  })
})

describe('markdown', () => {
  it('round trips', () => {
    const table = parseAscii(SAMPLE)!
    const md = serializeMarkdown(table)
    expect(md.split('\n')[1]).toMatch(/^\| -+ \| -+ \|$/)
    expect(parseMarkdown(md)!.rows).toEqual(table.rows)
  })

  it('reads and writes alignment markers', () => {
    const table = parseMarkdown('| a | b | c |\n| :-- | :-: | --: |\n| 1 | 2 | 3 |')!
    expect(table.aligns).toEqual(['left', 'center', 'right'])
    expect(serializeMarkdown(table)).toContain('| :-- | :-: | --: |')
  })

  it('escapes pipe characters', () => {
    const table = normalize({ aligns: [], rows: [['a'], ['x|y']] })
    const md = serializeMarkdown(table)
    expect(md).toContain('x\\|y')
    expect(parseMarkdown(md)!.rows[1][0]).toBe('x|y')
  })
})

describe('serializeHtml', () => {
  it('writes the first row as thead and escapes content', () => {
    const html = serializeHtml(normalize({ aligns: [], rows: [['a&b'], ['<c>']] }))
    expect(html).toContain('<thead>')
    expect(html).toContain('<th')
    expect(html).toContain('a&amp;b')
    expect(html).toContain('&lt;c&gt;')
  })
})

describe('highlightHtml', () => {
  it('wraps tags, attributes and strings in tokens', () => {
    const out = highlightHtml('<td style="text-align:right">1</td>')
    expect(out).toContain('<span class="tok-tag">td</span>')
    expect(out).toContain('<span class="tok-attr">style</span>')
    expect(out).toContain('<span class="tok-str">"text-align:right"</span>')
    expect(out).toContain('1')
  })

  it('escapes input so nothing can be injected', () => {
    const out = highlightHtml('a < b & c <script>x</script>')
    expect(out).not.toContain('<script>')
    expect(out).toContain('&amp;')
    expect(out).toContain('&lt;')
  })

  it('reduces back to the original source when tags are stripped', () => {
    const code = '<table>\n  <tr><td>a&b</td></tr>\n</table>'
    const text = highlightHtml(code)
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
    expect(text).toBe(code)
  })
})

describe('ops', () => {
  const grid = normalize({
    aligns: [],
    rows: [
      ['a', 'b', 'c'],
      ['1', '2', '3'],
      ['4', '5', '6'],
    ],
  })

  it('inserts and removes several rows at once', () => {
    expect(insertRows(grid, 1, 2).rows).toHaveLength(5)
    expect(insertRows(grid, 1, 2).rows[1]).toEqual(['', '', ''])
    expect(removeRows(grid, 1, 2).rows).toEqual([['a', 'b', 'c']])
  })

  it('never removes the last row or column', () => {
    expect(removeRows(grid, 0, 2).rows).toEqual(grid.rows)
    expect(removeCols(grid, 0, 2).aligns).toEqual(grid.aligns)
  })

  it('inserts and removes several columns at once', () => {
    const wider = insertCols(grid, 3, 2)
    expect(wider.aligns).toHaveLength(5)
    expect(wider.rows[0]).toEqual(['a', 'b', 'c', '', ''])
    expect(removeCols(grid, 0, 1).rows[0]).toEqual(['c'])
  })

  it('slices a block out for copying', () => {
    const block = sliceTable(grid, { top: 1, left: 0, bottom: 2, right: 1 })
    expect(toTsv(block)).toBe('1\t2\n4\t5')
    // A block that excludes the header row is copied without a thead.
    expect(serializeHtml(block, true, false)).not.toContain('<thead>')
    expect(serializeHtml(block, true, true)).toContain('<thead>')
  })
})

describe('reordering', () => {
  const grid = normalize({
    aligns: ['left', 'center', 'right'],
    rows: [
      ['a', 'b', 'c'],
      ['1', '2', '3'],
      ['4', '5', '6'],
    ],
  })

  it('moves a row up and down', () => {
    expect(moveRows(grid, 2, 0).rows[0]).toEqual(['4', '5', '6'])
    expect(moveRows(grid, 0, 3).rows[2]).toEqual(['a', 'b', 'c'])
  })

  it('moves a block of rows', () => {
    expect(moveRows(grid, 0, 3, 2).rows).toEqual([
      ['4', '5', '6'],
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ])
  })

  it('does nothing when a line is dropped where it already is', () => {
    expect(moveRows(grid, 1, 1)).toBe(grid)
    expect(moveRows(grid, 1, 2)).toBe(grid)
    expect(moveCols(grid, 0, 1)).toBe(grid)
  })

  it('moves a column together with its alignment', () => {
    const moved = moveCols(grid, 2, 0)
    expect(moved.rows[0]).toEqual(['c', 'a', 'b'])
    expect(moved.aligns).toEqual(['right', 'left', 'center'])
  })
})

describe('clearCells', () => {
  const grid = normalize({
    aligns: [],
    rows: [
      ['a', 'b', 'c'],
      ['1', '2', '3'],
      ['4', '5', '6'],
    ],
  })

  it('empties the selected block and leaves the rest alone', () => {
    expect(clearCells(grid, { top: 1, left: 1, bottom: 2, right: 2 }).rows).toEqual([
      ['a', 'b', 'c'],
      ['1', '', ''],
      ['4', '', ''],
    ])
  })

  it('keeps the shape', () => {
    const cleared = clearCells(grid, { top: 0, left: 0, bottom: 2, right: 2 })
    expect(cleared.rows).toHaveLength(3)
    expect(cleared.rows.every((row) => row.length === 3)).toBe(true)
    expect(cleared.rows.flat().join('')).toBe('')
  })
})
