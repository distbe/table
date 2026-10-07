import { useCallback, useEffect, useMemo, useState } from 'react'
import logo from './assets/logo.svg'
import CodeArea from './components/CodeArea'
import CopyButton from './components/CopyButton'
import Icon from './components/icons'
import Pane from './components/Pane'
import TableEditor from './components/TableEditor'
import { DEFAULT_ASCII_OPTIONS, parseAscii, serializeAscii } from './lib/ascii'
import { parseHtmlTable, serializeHtml } from './lib/html'
import { highlightHtml } from './lib/highlight'
import { parseMarkdown, serializeMarkdown } from './lib/markdown'
import type { AsciiOptions, BoxStyle, TableData } from './lib/types'
import { normalize } from './lib/types'

const SAMPLE: TableData = normalize({
  aligns: [null, null, 'right'],
  rows: [
    ['Method', 'Endpoint', 'Status'],
    ['GET', '/v1/users', '200'],
    ['POST', '/v1/users', '201'],
    ['DELETE', '/v1/users/:id', '204'],
  ],
})

const STORAGE_KEY = 'distbe-table-state-v1'

interface Persisted {
  table: TableData
  asciiOptions: AsciiOptions
}

function loadState(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Persisted
      if (parsed?.table?.rows?.length) {
        return {
          table: normalize(parsed.table),
          asciiOptions: { ...DEFAULT_ASCII_OPTIONS, ...parsed.asciiOptions },
        }
      }
    }
  } catch {
    // Ignore a corrupted value and start from the sample.
  }
  return { table: SAMPLE, asciiOptions: DEFAULT_ASCII_OPTIONS }
}

/** A text table carries no alignment, so keep the previous one when the shape matches. */
const keepAligns = (prev: TableData, next: TableData): TableData =>
  prev.aligns.length === next.aligns.length ? { ...next, aligns: prev.aligns } : next

export default function App() {
  const initial = useMemo(loadState, [])
  const [table, setTable] = useState<TableData>(initial.table)
  const [asciiOptions, setAsciiOptions] = useState<AsciiOptions>(initial.asciiOptions)
  // The pane being edited keeps its raw input so typing is never reformatted underfoot.
  const [draft, setDraft] = useState<{ ascii?: string; markdown?: string; html?: string }>({})

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ table, asciiOptions }))
      } catch {
        // Ignore write failures (private mode, quota).
      }
    }, 300)
    return () => window.clearTimeout(id)
  }, [table, asciiOptions])

  const asciiText = useMemo(
    () => draft.ascii ?? serializeAscii(table, asciiOptions),
    [draft.ascii, table, asciiOptions],
  )
  const markdownText = useMemo(
    () => draft.markdown ?? serializeMarkdown(table),
    [draft.markdown, table],
  )
  const htmlText = useMemo(() => draft.html ?? serializeHtml(table, false), [draft.html, table])
  const richHtml = useMemo(() => serializeHtml(table), [table])

  const applyTable = useCallback((next: TableData) => {
    setDraft({})
    setTable(normalize(next))
  }, [])

  const onAsciiChange = (text: string) => {
    setDraft({ ascii: text })
    const parsed = parseAscii(text)
    if (parsed) setTable((prev) => keepAligns(prev, parsed))
  }

  const onMarkdownChange = (text: string) => {
    setDraft({ markdown: text })
    const parsed = parseMarkdown(text)
    if (parsed) setTable(parsed)
  }

  const onHtmlChange = (text: string) => {
    setDraft({ html: text })
    const parsed = parseHtmlTable(text)
    if (parsed) setTable(parsed)
  }

  const patchOptions = (patch: Partial<AsciiOptions>) => {
    setDraft((prev) => ({ ...prev, ascii: undefined }))
    setAsciiOptions((prev) => ({ ...prev, ...patch }))
  }

  return (
    <div className="app">
      <main className="layout">
        <Pane
          className="area-ascii"
          title="Text"
          actions={
            <>
              <select
                title="Border style"
                value={asciiOptions.style}
                onChange={(event) => patchOptions({ style: event.target.value as BoxStyle })}
              >
                <option value="unicode">┌─┬┐</option>
                <option value="rounded">╭─┬╮</option>
                <option value="double">╔═╦╗</option>
                <option value="ascii">+--+</option>
              </select>
              <button
                type="button"
                className={`btn ${asciiOptions.rowSeparators ? 'active' : ''}`}
                title="Rules between rows"
                onClick={() => patchOptions({ rowSeparators: !asciiOptions.rowSeparators })}
              >
                <Icon name="layoutRows" />
              </button>
              <input
                type="number"
                title="Max cell width (0 = no wrapping)"
                min={0}
                max={200}
                step={4}
                value={asciiOptions.maxWidth}
                onChange={(event) =>
                  patchOptions({ maxWidth: Math.max(0, Number(event.target.value) || 0) })
                }
              />
              <button
                type="button"
                className="btn"
                title="Reformat"
                onClick={() => setDraft((prev) => ({ ...prev, ascii: undefined }))}
              >
                <Icon name="wand" />
              </button>
              <CopyButton text={asciiText} />
            </>
          }
        >
          <CodeArea
            value={asciiText}
            onChange={onAsciiChange}
            placeholder={'┌─────┬─────┐\n│ ... │ ... │\n└─────┴─────┘'}
          />
        </Pane>

        <Pane
          className="area-markdown"
          title="Markdown"
          actions={<CopyButton text={markdownText} />}
        >
          <CodeArea
            value={markdownText}
            onChange={onMarkdownChange}
            placeholder={'| a | b |\n| --- | --- |\n| 1 | 2 |'}
          />
        </Pane>

        <Pane
          className="area-wysiwyg"
          title="WYSIWYG"
          actions={<CopyButton text={markdownText} html={richHtml} title="Copy as a table" />}
        >
          <TableEditor table={table} onChange={applyTable} />
        </Pane>

        <Pane className="area-html" title="HTML" actions={<CopyButton text={htmlText} />}>
          <CodeArea
            value={htmlText}
            onChange={onHtmlChange}
            highlight={highlightHtml}
            placeholder={'<table>\n  <tr><td>a</td></tr>\n</table>'}
          />
        </Pane>
      </main>

      {/* Floats over the bottom right corner, out of the layout and out of the way. */}
      <div className="app-mark" aria-hidden>
        <img src={logo} alt="dist.be" width="54" height="24" />
        <span>v{VERSION}</span>
      </div>
    </div>
  )
}
