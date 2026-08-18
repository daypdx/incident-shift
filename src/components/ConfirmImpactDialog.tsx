import { useEffect, useRef } from 'react'
import type { Scenario } from '../engine/validation'

type Action = Scenario['actions'][number]

export function ConfirmImpactDialog({ action, onConfirm, onCancel, returnFocus }: { action: Action | null; onConfirm: () => void; onCancel: () => void; returnFocus: HTMLElement | null }) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (action && dialog && !dialog.open) dialog.showModal()
  }, [action])

  const close = (confirmed: boolean) => {
    dialogRef.current?.close()
    if (confirmed) onConfirm()
    else onCancel()
    requestAnimationFrame(() => returnFocus?.focus())
  }

  if (!action) return null
  return (
    <dialog className="impact-dialog" ref={dialogRef} aria-labelledby="impact-title" onCancel={(event) => { event.preventDefault(); close(false) }}>
      <span className="status-chip danger">Impact confirmation</span>
      <h2 id="impact-title">This action is {action.authorization === 'prohibited' ? 'prohibited' : 'high impact'}</h2>
      <p>{action.immediateFeedback}</p>
      <dl className="impact-grid">
        <div><dt>Disruption</dt><dd>{action.disruptionCost}/5</dd></div>
        <div><dt>Authority</dt><dd>{action.authorization.replace('-', ' ')}</dd></div>
      </dl>
      <div className="dialog-actions">
        <button className="button secondary" type="button" onClick={() => close(false)}>Go back</button>
        <button className="button danger-button" type="button" onClick={() => close(true)}>Take action anyway</button>
      </div>
    </dialog>
  )
}
