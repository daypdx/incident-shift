import { useEffect, useRef } from 'react'
import type { Scenario } from '../engine/validation'

export function AuthorityDialog({ scenario, open, onClose, returnFocus }: { scenario: Scenario; open: boolean; onClose: () => void; returnFocus: HTMLElement | null }) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (open && dialog && !dialog.open) dialog.showModal()
  }, [open])

  const close = () => {
    dialogRef.current?.close()
    onClose()
    requestAnimationFrame(() => returnFocus?.focus())
  }

  if (!open) return null
  return (
    <dialog className="authority-dialog" ref={dialogRef} aria-labelledby="authority-title" onCancel={(event) => { event.preventDefault(); close() }}>
      <div className="section-heading"><div><span className="eyebrow">Case policy</span><h2 id="authority-title">Authority boundaries</h2></div><button className="mobile-sheet-close authority-close" aria-label="Close authority" onClick={close}>×</button></div>
      <section><h3>Allowed</h3><ul>{scenario.authorityScope.allowed.map((item) => <li key={item}>{item}</li>)}</ul></section>
      <section><h3>Escalate</h3><ul>{scenario.authorityScope.requiresEscalation.map((item) => <li key={item}>{item}</li>)}</ul></section>
      <section><h3>Prohibited</h3><ul>{scenario.authorityScope.prohibited.map((item) => <li key={item}>{item}</li>)}</ul></section>
      <button className="button secondary full" onClick={close}>Return to case</button>
    </dialog>
  )
}
