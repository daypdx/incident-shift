import { useEffect, useRef } from 'react'
import type { Scenario } from '../engine/validation'

export function ConfirmRestartDialog({ scenario, open, onConfirm, onCancel, returnFocus }: { scenario: Scenario; open: boolean; onConfirm: () => void; onCancel: () => void; returnFocus: HTMLElement | null }) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (open && dialog && !dialog.open) dialog.showModal()
  }, [open])

  const close = (confirmed: boolean) => {
    dialogRef.current?.close()
    if (confirmed) onConfirm()
    else onCancel()
    requestAnimationFrame(() => returnFocus?.focus())
  }

  if (!open) return null
  return (
    <dialog className="impact-dialog" ref={dialogRef} aria-labelledby="restart-title" onCancel={(event) => { event.preventDefault(); close(false) }}>
      <span className="status-chip danger">Saved progress</span>
      <h2 id="restart-title">Restart {scenario.title}?</h2>
      <p>This replaces the unfinished attempt with a fresh event log. Your completed-attempt history is not affected.</p>
      <div className="dialog-actions">
        <button className="button secondary" type="button" onClick={() => close(false)}>Keep saved attempt</button>
        <button className="button danger-button" type="button" onClick={() => close(true)}>Restart case</button>
      </div>
    </dialog>
  )
}
