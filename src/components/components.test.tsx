import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { scenarioById } from '../content/generated'
import { acceptCase } from '../engine/engine'
import { saveAttempt } from '../engine/persistence'

describe('case interface', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('uses evidence provenance and hides the debrief explanation before completion', () => {
    const scenario = scenarioById.get('TRAIN-001')!
    saveAttempt(acceptCase(scenario, 'coach', '2026-08-18T12:00:00.000Z'))
    window.history.replaceState({}, '', '/case/TRAIN-001/play')
    const { container } = render(<App />)
    expect(screen.getByText('Reported', { exact: false })).toBeInTheDocument()
    expect(screen.queryByText(scenario.debrief.rootCauseExplanation)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'What is your next test?' })).toBeInTheDocument()
    expect(container.querySelectorAll('.action-drawer > div > .action-card')).toHaveLength(3)
    expect(screen.getByText(/More tests/)).toBeInTheDocument()
  })

  it('requires a deliberate impact confirmation and returns focus on cancel', async () => {
    const user = userEvent.setup()
    const scenario = scenarioById.get('TRAIN-001')!
    saveAttempt(acceptCase(scenario, 'coach', '2026-08-18T12:00:00.000Z'))
    window.history.replaceState({}, '', '/case/TRAIN-001/play')
    render(<App />)
    await user.click(screen.getByText(/More tests/))
    const card = screen.getByRole('heading', { name: 'Remove and reinstall every audio driver' }).closest('article')!
    const trigger = within(card).getByRole('button', { name: 'Take action' })
    await user.click(trigger)
    expect(screen.getByRole('dialog')).toHaveTextContent('prohibited')
    await user.click(screen.getByRole('button', { name: 'Go back' }))
    await waitFor(() => expect(trigger).toHaveFocus())
  })
})
