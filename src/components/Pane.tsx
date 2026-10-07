import type { ReactNode } from 'react'

interface Props {
  className?: string
  title: string
  actions?: ReactNode
  children: ReactNode
}

export default function Pane({ className, title, actions, children }: Props) {
  return (
    <section className={`pane ${className ?? ''}`}>
      <header className="pane-head">
        <h2>{title}</h2>
        {actions}
      </header>
      <div className="pane-body">{children}</div>
    </section>
  )
}
