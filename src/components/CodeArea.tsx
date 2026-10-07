import { useLayoutEffect, useRef } from 'react'

interface Props {
  value: string
  placeholder?: string
  onChange: (value: string) => void
  /** When given, a highlight layer is placed behind the textarea and its text is hidden. */
  highlight?: (code: string) => string
}

export default function CodeArea({ value, placeholder, onChange, highlight }: Props) {
  const layerRef = useRef<HTMLPreElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Keep both layers in sync when the value changes, not only while scrolling.
  useLayoutEffect(() => {
    const layer = layerRef.current
    const input = inputRef.current
    if (!layer || !input) return
    layer.scrollTop = input.scrollTop
    layer.scrollLeft = input.scrollLeft
  }, [value])

  const syncScroll = () => {
    const layer = layerRef.current
    const input = inputRef.current
    if (!layer || !input) return
    layer.scrollTop = input.scrollTop
    layer.scrollLeft = input.scrollLeft
  }

  return (
    <div className="code-wrap">
      {highlight ? (
        <pre
          className="code code-layer"
          ref={layerRef}
          aria-hidden
          dangerouslySetInnerHTML={{ __html: highlight(value) }}
        />
      ) : null}
      <textarea
        ref={inputRef}
        className={`code ${highlight ? 'code-input' : ''}`}
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onScroll={syncScroll}
      />
    </div>
  )
}
