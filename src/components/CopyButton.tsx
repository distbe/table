import { useEffect, useRef, useState } from 'react'

interface Props {
  /** Plain text to put on the clipboard. */
  text: string
  /** Rich text to put alongside it, so the paste lands as a real table. */
  html?: string
  label?: string
  title?: string
}

export default function CopyButton({ text, html, label = 'Copy', title }: Props) {
  const [done, setDone] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = async () => {
    try {
      if (html && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([text], { type: 'text/plain' }),
          }),
        ])
      } else {
        await navigator.clipboard.writeText(text)
      }
      setDone(true)
      timer.current = window.setTimeout(() => setDone(false), 1200)
    } catch {
      setDone(false)
    }
  }

  return (
    <button type="button" className="btn" title={title ?? label} onClick={copy}>
      {done ? '✓' : label}
    </button>
  )
}
