import { useEffect, useState, type RefObject } from 'react'

const focusableSelector = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])'

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(query).matches)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])

  return matches
}

export function useModalSheet(open: boolean, onClose: () => void, sheetRef: RefObject<HTMLElement | null>, triggerRef: RefObject<HTMLElement | null>, rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return
    const sheet = sheetRef.current
    const root = rootRef.current
    if (!sheet || !root) return
    const background = Array.from(root.querySelectorAll<HTMLElement>('[data-sheet-background]'))
    background.forEach((element) => { element.inert = true })

    const focusable = () => Array.from(sheet.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => !element.hasAttribute('disabled') && element.getClientRects().length > 0)
    requestAnimationFrame(() => focusable()[0]?.focus())

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const controls = focusable()
      if (!controls.length) return
      const first = controls[0]!
      const last = controls.at(-1)!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      background.forEach((element) => { element.inert = false })
      requestAnimationFrame(() => triggerRef.current?.focus())
    }
  }, [onClose, open, rootRef, sheetRef, triggerRef])
}
