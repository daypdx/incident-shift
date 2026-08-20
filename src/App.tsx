import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArtifactFrame } from './components/ArtifactFrame'
import { AuthorityDialog } from './components/AuthorityDialog'
import { BrandMark } from './components/BrandMark'
import { ConfirmImpactDialog } from './components/ConfirmImpactDialog'
import { ConfirmRestartDialog } from './components/ConfirmRestartDialog'
import { useMediaQuery, useModalSheet } from './components/useModalSheet'
import { scenarioById, scenarios } from './content/generated'
import { acceptCase, applyAction, classifyEvidence, commitCommunication, commitDecision, commitResolution, commitVerification, getAvailableActions, getClassificationReview, getHypothesisStates, hasEvidenceBasedRevision, removeEvidenceClassification, routeForAttempt, scoreAttempt, type AttemptState, type Confidence, type Mode } from './engine/engine'
import { clearAttempt, exportLocalData, loadAttempt, loadHistory, loadProgress, loadSettings, recordCompletion, resetLocalData, saveAttempt, saveSettings, type Settings } from './engine/persistence'
import { selectDailyScenario } from './engine/selectors'
import type { EvidenceRelation, Scenario } from './engine/validation'

const deploymentBase = import.meta.env.BASE_URL.replace(/\/$/, '')

function appPath(pathname: string) {
  let path = pathname
  if (deploymentBase && pathname === deploymentBase) path = '/'
  else if (deploymentBase && pathname.startsWith(`${deploymentBase}/`)) path = pathname.slice(deploymentBase.length) || '/'
  return path.length > 1 ? path.replace(/\/+$/, '') : path
}

function browserPath(path: string) {
  return `${deploymentBase}${path}` || '/'
}

function usePath() {
  const [path, setPath] = useState(appPath(window.location.pathname))
  useEffect(() => {
    const update = () => setPath(appPath(window.location.pathname))
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])
  const navigate = (next: string) => {
    window.history.pushState({}, '', browserPath(next))
    setPath(next)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  return { path, navigate }
}

function GlobalShell({ children, navigate }: { children: React.ReactNode; navigate: (path: string) => void }) {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="global-header">
        <button className="brand-button" onClick={() => navigate('/')} aria-label="Incident Shift home"><BrandMark /></button>
        <nav aria-label="Primary navigation">
          <button onClick={() => navigate('/shifts')}>Shifts</button>
          <button onClick={() => navigate('/daily')}>Daily</button>
          <button onClick={() => navigate('/progress')}>Progress</button>
          <button onClick={() => navigate('/settings')}>Settings</button>
        </nav>
      </header>
      <main id="main-content">{children}</main>
    </>
  )
}

function Landing({ navigate }: { navigate: (path: string) => void }) {
  return (
    <GlobalShell navigate={navigate}>
      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow">Your shift starts here</span>
          <h1>Work the incident.<br />Find the cause.<br /><em>Protect the uptime.</em></h1>
          <p>Handle short, synthetic tickets and security alerts. Inspect the evidence, choose your next test, resolve or escalate, and see how your reasoning held up.</p>
          <div className="button-row">
            <button className="button primary" onClick={() => navigate('/case/TRAIN-001/briefing')}>Start Training Shift <span aria-hidden="true">→</span></button>
            <button className="button secondary" onClick={() => document.getElementById('how-it-works')?.scrollIntoView()}>How a case works</button>
          </div>
          <p className="trust-line"><span aria-hidden="true">✓</span> No real systems &nbsp; <span aria-hidden="true">✓</span> No hacking required &nbsp; <span aria-hidden="true">✓</span> No account needed</p>
        </div>
        <div className="hero-workbench" aria-label="Preview of the evidence-first case workbench">
          <div className="preview-header"><span className="status-dot"></span><strong>Active case</strong><span>Investigate</span></div>
          <article className="preview-ticket"><span className="provenance reported">Reported</span><h2>Connected, but nothing loads</h2><p>One user asks for “the server” to be restarted.</p></article>
          <div className="preview-path"><span>Device</span><i></i><span>Gateway</span><i></i><span className="unknown">?</span></div>
          <div className="preview-actions"><span>Ask scope</span><span>Observe path</span><span>Run safe test</span></div>
          <p className="next-test">What is your next test?</p>
        </div>
      </section>
      <section id="how-it-works" className="proof-section" aria-labelledby="proof-title">
        <div><span className="eyebrow">The method is the game</span><h2 id="proof-title">Real work, without real risk.</h2></div>
        <div className="proof-grid">
          <article><span className="proof-number">01</span><h3>Read realistic evidence</h3><p>Tickets, timelines, connection paths, identity events, and policy—always synthetic and safe.</p></article>
          <article><span className="proof-number">02</span><h3>Make bounded decisions</h3><p>Link claims to supporting and contradicting evidence before you commit.</p></article>
          <article><span className="proof-number">03</span><h3>Prove the outcome</h3><p>A fix is not closure. Verify the original symptom or protective state and leave a clean handoff.</p></article>
        </div>
      </section>
      <section className="case-preview-section" aria-labelledby="preview-title">
        <div className="section-heading"><div><span className="eyebrow">On the board</span><h2 id="preview-title">A shift across IT and security</h2></div><button className="text-button" onClick={() => navigate('/shifts')}>View shift board →</button></div>
        <div className="case-preview-grid">
          {scenarios.filter((item) => !item.unscored).map((scenario) => <article key={scenario.id}><span className="status-chip info">{scenario.track.replace('-', ' ')}</span><h3>{scenario.title}</h3><p>{scenario.subtitle}</p><small>{scenario.estimatedMinutes} min · {scenario.difficulty}</small></article>)}
        </div>
      </section>
    </GlobalShell>
  )
}

function DailyRoute({ navigate }: { navigate: (path: string) => void }) {
  const [continueWithoutTraining, setContinueWithoutTraining] = useState(false)
  const training = scenarioById.get('TRAIN-001')!
  const daily = selectDailyScenario(scenarios, new Date()) ?? training
  if (loadProgress().trainingComplete || continueWithoutTraining) return <Briefing scenario={daily} navigate={navigate} />
  return <GlobalShell navigate={navigate}><section className="page-heading onboarding-gate"><span className="eyebrow">Daily Incident</span><h1>Learn the incident loop first.</h1><p>The three-minute Training Shift introduces evidence, safe tests, commitment gates, verification, and handoff before your first scored case.</p><div className="button-row"><button className="button primary" onClick={() => navigate(`/case/${training.id}/briefing`)}>Learn the loop first</button><button className="button secondary" onClick={() => setContinueWithoutTraining(true)}>Continue without training</button></div><small>Continuing is an explicit choice. Training can still be completed later from the Shift Board.</small></section></GlobalShell>
}

function ShiftBoard({ navigate }: { navigate: (path: string) => void }) {
  const progress = loadProgress()
  const training = scenarioById.get('TRAIN-001')!
  const trainingAttempt = loadAttempt(training)
  const trainingIncomplete = Boolean(trainingAttempt && trainingAttempt.stage !== 'debrief')
  return (
    <GlobalShell navigate={navigate}>
      <section className="page-heading"><span className="eyebrow">Shift One · Start with scope</span><h1>Choose your next case</h1><p>Progress comes from completed incidents, not scores. Replay any case to find a cleaner path.</p></section>
      <section className="shift-route" aria-label="Case route">
        <article className="route-card training-card"><div className="route-marker">T</div><div><span className="status-chip verified">Training · unscored</span><h2>{training.title}</h2><p>{training.subtitle}</p><div className="card-meta"><span>{training.estimatedMinutes} min</span><span>Coach recommended</span>{progress.trainingComplete && <span>Completed ✓</span>}{trainingIncomplete && <span>Saved in {trainingAttempt?.mode} mode</span>}</div>{trainingIncomplete && trainingAttempt ? <div className="case-action-row"><button className="button primary" onClick={() => navigate(routeForAttempt(trainingAttempt))}>Resume case</button><button className="button secondary" onClick={() => navigate(`/case/${training.id}/briefing`)}>Restart case</button></div> : <button className="button primary" onClick={() => navigate(`/case/${training.id}/briefing`)}>{progress.trainingComplete ? 'Replay Training Shift' : 'Start Training Shift'}</button>}</div></article>
        {scenarios.filter((item) => !item.unscored).map((scenario, index) => {
          const completed = progress.completed[scenario.id]
          const attempt = loadAttempt(scenario)
          const incomplete = Boolean(attempt && attempt.stage !== 'debrief')
          const locked = !progress.trainingComplete && !incomplete
          return <article className={`route-card ${locked ? 'locked' : ''}`} key={scenario.id}><div className="route-marker">{index + 1}</div><div><span className="eyebrow">{scenario.track.replace('-', ' ')} · {scenario.difficulty}</span><h2>{scenario.title}</h2><p>{scenario.subtitle}</p><div className="card-meta"><span>{scenario.estimatedMinutes} min</span><span>Coach {completed?.coach ? '✓' : '—'}</span><span>Independent {completed?.independent ? '✓' : '—'}</span>{incomplete && <span>Saved in {attempt?.mode} mode</span>}</div>{incomplete && attempt ? <div className="case-action-row"><button className="button primary" onClick={() => navigate(routeForAttempt(attempt))}>Resume case</button><button className="button secondary" onClick={() => navigate(`/case/${scenario.id}/briefing`)}>Restart case</button></div> : <button className="button secondary" disabled={locked} onClick={() => navigate(`/case/${scenario.id}/briefing`)}>{locked ? 'Complete Training Shift to unlock' : completed ? 'Replay case' : 'Start case'}</button>}</div></article>
        })}
      </section>
      <p className="qualification-note">Game progression reflects completed scenarios, not employment qualification.</p>
    </GlobalShell>
  )
}

function CaseHeader({ scenario, state, navigate, sheetBackground = false }: { scenario: Scenario; state?: AttemptState | null; navigate: (path: string) => void; sheetBackground?: boolean }) {
  return (
    <header className="case-header" data-sheet-background={sheetBackground ? '' : undefined}>
      <button className="brand-button" onClick={() => navigate('/shifts')} aria-label="Return to shift board"><BrandMark compact /></button>
      <div className="case-title"><span>{scenario.title}</span><small>{state?.stage ?? 'Briefing'} · {state?.mode ?? 'Choose mode'}</small></div>
      {state && <div className="case-metrics"><span><small>Moves</small>{state.moves}</span><span><small>Disruption</small>{state.disruption}</span></div>}
      <button className="icon-button" onClick={() => navigate('/shifts')} aria-label="Exit case and preserve progress">•••</button>
    </header>
  )
}

function Briefing({ scenario, navigate }: { scenario: Scenario; navigate: (path: string) => void }) {
  const settings = loadSettings()
  const [mode, setMode] = useState<Mode>(scenario.unscored ? 'coach' : settings.defaultMode)
  const [restartOpen, setRestartOpen] = useState(false)
  const [restartFocus, setRestartFocus] = useState<HTMLElement | null>(null)
  const existing = loadAttempt(scenario)
  const incomplete = Boolean(existing && existing.stage !== 'debrief')
  const startFresh = () => {
    if (existing?.stage === 'debrief') clearAttempt(scenario.id)
    const state = acceptCase(scenario, mode)
    saveAttempt(state)
    navigate(`/case/${scenario.id}/play`)
  }
  const confirmRestart = () => {
    const state = acceptCase(scenario, mode)
    saveAttempt(state)
    setRestartOpen(false)
    navigate(`/case/${scenario.id}/play`)
  }
  return (
    <div className="case-page"><CaseHeader scenario={scenario} state={existing} navigate={navigate} />
      <main id="main-content" className="briefing-layout">
        <section className="briefing-main"><span className="eyebrow">{scenario.unscored ? 'Training Shift' : `${scenario.track.replace('-', ' ')} · ${scenario.difficulty}`}</span><h1>{scenario.title}</h1><p className="subtitle">{scenario.subtitle}</p>
          <article className="ticket-paper"><div className="ticket-meta"><span>{scenario.briefing.channel}</span><time>{scenario.briefing.timestamp}</time></div><h2>{scenario.briefing.requester}</h2><p>{scenario.briefing.summary}</p><span className="provenance reported">Reported — not yet verified</span></article>
          <fieldset className="mode-selector"><legend>Choose guidance</legend><label><input type="radio" name="mode" checked={mode === 'coach'} onChange={() => setMode('coach')} /><span><strong>Coach</strong><small>Explains what a test could distinguish, never its result.</small></span></label><label><input type="radio" name="mode" checked={mode === 'independent'} onChange={() => setMode('independent')} disabled={scenario.unscored} /><span><strong>Independent</strong><small>Removes pre-action hints; all authority labels remain.</small></span></label></fieldset>
        </section>
        <aside className="briefing-aside"><span className="eyebrow">Your role</span><h2>{scenario.playerRole}</h2><dl><div><dt>Estimated time</dt><dd>{scenario.estimatedMinutes} minutes</dd></div><div><dt>Scoring</dt><dd>{scenario.unscored ? 'Unscored practice' : 'Path and commitments'}</dd></div></dl><details><summary>Authority summary</summary><h3>Allowed</h3><ul>{scenario.authorityScope.allowed.map((item) => <li key={item}>{item}</li>)}</ul><h3>Escalate</h3><ul>{scenario.authorityScope.requiresEscalation.map((item) => <li key={item}>{item}</li>)}</ul><h3>Prohibited</h3><ul>{scenario.authorityScope.prohibited.map((item) => <li key={item}>{item}</li>)}</ul></details>{incomplete && existing ? <><p className="saved-attempt-note"><strong>Unfinished {existing.mode} attempt</strong><br />{existing.moves} moves · {existing.collectedEvidenceIds.length} evidence items</p><div className="briefing-actions"><button className="button primary full" onClick={() => navigate(routeForAttempt(existing))}>Resume case →</button><button className="button danger-button full" onClick={(event) => { setRestartFocus(event.currentTarget); setRestartOpen(true) }}>Restart case</button></div></> : <button className="button primary full" onClick={startFresh}>Accept case →</button>}</aside>
      </main>
      <ConfirmRestartDialog scenario={scenario} open={restartOpen} returnFocus={restartFocus} onCancel={() => setRestartOpen(false)} onConfirm={confirmRestart} />
    </div>
  )
}

function EvidenceClassifier({ scenario, state, setState, announce }: { scenario: Scenario; state: AttemptState; setState: (state: AttemptState) => void; announce: (message: string) => void }) {
  const evidence = scenario.evidence.filter((item) => state.collectedEvidenceIds.includes(item.id))
  const [evidenceId, setEvidenceId] = useState(evidence.at(-1)?.id ?? '')
  const [hypothesisId, setHypothesisId] = useState(scenario.hypotheses[0]?.id ?? '')
  const classify = (relation: EvidenceRelation) => {
    try {
      const next = classifyEvidence(scenario, state, evidenceId, hypothesisId, relation)
      setState(next); saveAttempt(next); announce(`Evidence classified as ${relation}.`)
    } catch (error) { announce(error instanceof Error ? error.message : 'Unable to classify evidence.') }
  }
  const remove = (item: AttemptState['classifications'][number]) => {
    try {
      const next = removeEvidenceClassification(scenario, state, item.evidenceId, item.hypothesisId)
      setState(next); saveAttempt(next); announce('Evidence relationship removed.')
    } catch (error) { announce(error instanceof Error ? error.message : 'Unable to remove evidence relationship.') }
  }
  return (
    <section className="classifier" aria-labelledby="classifier-title"><div className="section-heading"><div><span className="eyebrow">Reasoning graph</span><h2 id="classifier-title">Link evidence to a hypothesis</h2></div><span className="status-chip policy">{state.classifications.length} links</span></div>
      <div className="classifier-fields"><div><label htmlFor="evidence-select">Evidence</label><select id="evidence-select" value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)}>{evidence.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></div><div><label htmlFor="hypothesis-select">Hypothesis</label><select id="hypothesis-select" value={hypothesisId} onChange={(event) => setHypothesisId(event.target.value)}>{scenario.hypotheses.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></div></div>
      <div className="relation-buttons" aria-label="Evidence relationship"><button onClick={() => classify('supports')}>Supports</button><button onClick={() => classify('contradicts')}>Contradicts</button><button onClick={() => classify('context')}>Context only</button></div>
      {state.classifications.length > 0 && <div className="reasoning-ledger"><h3>Reasoning ledger</h3>{state.classifications.map((item) => { const evidenceItem = scenario.evidence.find((evidenceEntry) => evidenceEntry.id === item.evidenceId); const hypothesis = scenario.hypotheses.find((hypothesisEntry) => hypothesisEntry.id === item.hypothesisId); return <article key={`${item.evidenceId}-${item.hypothesisId}`}><div><strong>{evidenceItem?.label}</strong><span>{hypothesis?.label}</span></div><label>Relation<select aria-label={`Relation for ${evidenceItem?.label} and ${hypothesis?.label}`} value={item.relation} onChange={(event) => { const next = classifyEvidence(scenario, state, item.evidenceId, item.hypothesisId, event.target.value as EvidenceRelation); setState(next); saveAttempt(next); announce('Evidence relationship changed.') }}><option value="supports">Supports</option><option value="contradicts">Contradicts</option><option value="context">Context only</option></select></label><button className="text-button" onClick={() => remove(item)}>Remove</button></article> })}</div>}
      {state.mode === 'coach' && <p className="coach-note"><strong>Coach:</strong> Classify what this evidence actually says—not what you hope it proves. Feedback is scored against the authored relationship map.</p>}
    </section>
  )
}

function ActionCard({ action, disabled, onTake }: { action: Scenario['actions'][number]; disabled: boolean; onTake: (button: HTMLButtonElement) => void }) {
  return <article className={`action-card ${action.authorization === 'prohibited' ? 'prohibited' : ''}`}><div className="action-top"><span className={`intent ${action.intent}`}>{action.intent}</span><span>{action.moveCost} move{action.moveCost === 1 ? '' : 's'}</span></div><h3>{action.label}</h3><div className="action-meta"><span>Disruption {action.disruptionCost}/5</span><span>Authority: {action.authorization.replace('-', ' ')}</span></div><button disabled={disabled} onClick={(event) => onTake(event.currentTarget)}>{disabled ? 'Needs more evidence' : 'Take action'}</button></article>
}

function PlayCase({ scenario, navigate }: { scenario: Scenario; navigate: (path: string) => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const actionsTriggerRef = useRef<HTMLButtonElement>(null)
  const evidenceTitleRef = useRef<HTMLHeadingElement>(null)
  const restored = loadAttempt(scenario)
  const [state, setState] = useState(restored)
  const [announcement, setAnnouncement] = useState('')
  const [pendingAction, setPendingAction] = useState<Scenario['actions'][number] | null>(null)
  const [returnFocus, setReturnFocus] = useState<HTMLElement | null>(null)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [authorityOpen, setAuthorityOpen] = useState(false)
  const [authorityFocus, setAuthorityFocus] = useState<HTMLElement | null>(null)
  const isMobile = useMediaQuery('(max-width: 799px)')
  const closeActions = useCallback(() => setActionsOpen(false), [])
  useModalSheet(isMobile && actionsOpen, closeActions, drawerRef, actionsTriggerRef, rootRef)
  useEffect(() => { if (!state) navigate(`/case/${scenario.id}/briefing`) }, [scenario.id, state])
  if (!state) return null
  const availability = getAvailableActions(scenario, state).filter((item) => !state.usedActionIds.includes(item.action.id))
  const runAction = (action: Scenario['actions'][number]) => {
    try {
      const next = applyAction(scenario, state, action.id); setState(next); saveAttempt(next)
      const evidence = action.revealsEvidenceIds.map((id) => scenario.evidence.find((item) => item.id === id)?.label).filter(Boolean).join(', ')
      setAnnouncement(evidence ? `New evidence: ${evidence}. ${action.immediateFeedback}` : action.immediateFeedback)
    } catch (error) { setAnnouncement(error instanceof Error ? error.message : 'Unable to take that action.') }
    setPendingAction(null)
  }
  const take = (action: Scenario['actions'][number], button: HTMLButtonElement) => {
    if (action.authorization === 'prohibited' || action.disruptionCost >= 4) { setPendingAction(action); setReturnFocus(button); return }
    runAction(action)
  }
  const hypotheses = getHypothesisStates(scenario, state)
  const collected = scenario.evidence.filter((item) => state.collectedEvidenceIds.includes(item.id))
  const commitReady = state.classifications.some((item) => item.relation === 'supports')
  const showEvidence = () => {
    evidenceTitleRef.current?.scrollIntoView({ block: 'start' })
    evidenceTitleRef.current?.focus()
  }
  return (
    <div className="case-page" ref={rootRef}><a className="skip-link" data-sheet-background href="#case-workspace">Skip to case workspace</a><CaseHeader scenario={scenario} state={state} navigate={navigate} sheetBackground />
      <div className="play-layout">
        <aside className="case-rail" data-sheet-background aria-label="Case file"><section><span className="eyebrow">Stage route</span><ol className="stage-list"><li className="done">Briefed</li><li className="active">Investigate</li><li>Decide</li><li>Resolve</li><li>Verify</li><li>Handoff</li></ol></section><section><span className="eyebrow">Hypotheses</span>{hypotheses.slice(0, 3).map(({ hypothesis, state: hypothesisState }) => <div className="hypothesis-row" key={hypothesis.id}><span>{hypothesis.label}</span><small>{hypothesisState}</small></div>)}{hypotheses.length > 3 && <details><summary>{hypotheses.length - 3} more hypotheses</summary>{hypotheses.slice(3).map(({ hypothesis }) => <p key={hypothesis.id}>{hypothesis.label}</p>)}</details>}</section><section><span className="eyebrow">Case file</span><button className="rail-link" onClick={showEvidence}>Evidence <span>{collected.length}</span></button><button className="rail-link" onClick={(event) => { setAuthorityFocus(event.currentTarget); setAuthorityOpen(true) }}>Authority <span>View</span></button></section></aside>
        <main id="case-workspace" className="workspace" data-sheet-background><h1 className="visually-hidden">{scenario.title} case workbench</h1><ArtifactFrame scenario={scenario} collectedEvidenceIds={state.collectedEvidenceIds} />
          <section className="latest-evidence" aria-labelledby="evidence-title"><div className="section-heading"><div><span className="eyebrow">Evidence timeline</span><h2 id="evidence-title" ref={evidenceTitleRef} tabIndex={-1}>Latest evidence</h2></div><span>{collected.length} collected</span></div><div className="evidence-stack">{collected.slice(-2).reverse().map((item) => <article className="evidence-card" key={item.id}><div><span className={`provenance ${item.provenance}`}>{item.provenance === 'system-generated' ? 'System' : item.provenance === 'policy-defined' ? 'Policy' : item.provenance}</span><span>{item.type.replace('-', ' ')}</span></div><h3>{item.label}</h3><p>{item.content}</p>{state.mode === 'coach' && item.coachExplanation && <details><summary>Why this matters</summary><p>{item.coachExplanation}</p></details>}</article>)}</div></section>
          <EvidenceClassifier scenario={scenario} state={state} setState={setState} announce={setAnnouncement} />
        </main>
        <div ref={drawerRef} className={`action-drawer ${actionsOpen ? 'mobile-open' : ''}`} role={isMobile && actionsOpen ? 'dialog' : 'complementary'} aria-modal={isMobile && actionsOpen ? true : undefined} aria-hidden={isMobile && !actionsOpen ? true : undefined} inert={isMobile && !actionsOpen ? true : undefined} aria-labelledby="actions-title"><div className="section-heading action-sheet-heading"><div><span className="eyebrow">Choose next step</span><h2 id="actions-title">What is your next test?</h2></div><button className="mobile-sheet-close" aria-label="Close actions" onClick={closeActions}>×</button></div>{availability.slice(0, 3).map(({ action, available }) => <div key={action.id}>{state.mode === 'coach' && action.coachHint && <p className="action-hint">Could distinguish: {action.coachHint}</p>}<ActionCard action={action} disabled={!available} onTake={(button) => take(action, button)} /></div>)}{availability.length > 3 && <details className="more-tests"><summary>More tests ({availability.length - 3})</summary>{availability.slice(3).map(({ action, available }) => <ActionCard key={action.id} action={action} disabled={!available} onTake={(button) => take(action, button)} />)}</details>}<div className="commit-panel"><p><span className={commitReady ? 'gate-pass' : 'gate-wait'}>{commitReady ? '✓' : '○'}</span> Supporting evidence classified</p><p><span className="gate-wait">○</span> Verification plan selected at decision</p><button className="button primary full" onClick={() => navigate(`/case/${scenario.id}/decision`)}>Commit decision →</button></div></div>
      </div>
      <nav className="mobile-case-nav" data-sheet-background aria-label="Mobile case panes"><a href="#case-workspace">Work</a><button onClick={showEvidence}>Evidence {collected.length}</button><button ref={actionsTriggerRef} onClick={() => setActionsOpen(true)} aria-expanded={actionsOpen}>Actions</button></nav>
      <div className="live-region" aria-live="polite">{announcement}</div>
      <ConfirmImpactDialog action={pendingAction} returnFocus={returnFocus} onCancel={() => setPendingAction(null)} onConfirm={() => pendingAction && runAction(pendingAction)} />
      <AuthorityDialog scenario={scenario} open={authorityOpen} returnFocus={authorityFocus} onClose={() => setAuthorityOpen(false)} />
    </div>
  )
}

function FocusedStage({ scenario, state, title, eyebrow, children, navigate }: { scenario: Scenario; state: AttemptState; title: string; eyebrow: string; children: React.ReactNode; navigate: (path: string) => void }) {
  return <div className="case-page"><CaseHeader scenario={scenario} state={state} navigate={navigate} /><main id="main-content" className="focused-stage"><header><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>The commitments below are preserved in the event log and explained in the debrief.</p></header>{children}</main></div>
}

function DecisionStage({ scenario, navigate }: { scenario: Scenario; navigate: (path: string) => void }) {
  const state = loadAttempt(scenario)
  const [optionId, setOptionId] = useState('')
  const [confidence, setConfidence] = useState<Confidence>('moderate')
  const [planId, setPlanId] = useState('')
  const [error, setError] = useState('')
  if (!state) return <Briefing scenario={scenario} navigate={navigate} />
  const submit = () => { try { const next = commitDecision(scenario, state, optionId, confidence, planId); saveAttempt(next); navigate(`/case/${scenario.id}/resolve`) } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to commit decision.') } }
  return <FocusedStage scenario={scenario} state={state} title="Commit to the best-supported explanation" eyebrow="Decision gate" navigate={navigate}><section className="commitment-card"><h2>{scenario.decision.prompt}</h2><div className="pinned-summary"><span>{state.collectedEvidenceIds.length} evidence items</span><span>{state.classifications.filter((item) => item.relation === 'supports').length} supporting links</span><span>{state.classifications.filter((item) => item.relation === 'contradicts').length} contradictions</span></div><fieldset className="choice-list"><legend>Decision</legend>{scenario.decision.options.map((option) => <label key={option.id}><input type="radio" name="decision" value={option.id} checked={optionId === option.id} onChange={() => setOptionId(option.id)} /><span>{option.label}<small>{option.requiresEvidenceIds.every((id) => state.collectedEvidenceIds.includes(id)) ? 'Evidence gate met' : 'More investigation may be required'}</small></span></label>)}</fieldset><div className="two-column-fields"><div><label htmlFor="confidence-select">Confidence</label><select id="confidence-select" value={confidence} onChange={(event) => setConfidence(event.target.value as Confidence)}><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option></select></div><div><label htmlFor="verification-plan-select">Verification plan</label><select id="verification-plan-select" value={planId} onChange={(event) => setPlanId(event.target.value)}><option value="">Select how you will prove the outcome</option>{scenario.verification.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div></div>{error && <p className="error-message" role="alert">{error}</p>}<div className="button-row spread"><button className="button secondary" onClick={() => navigate(`/case/${scenario.id}/play`)}>Return to investigation</button><button className="button primary" disabled={!optionId || !planId} onClick={submit}>Commit decision →</button></div></section></FocusedStage>
}

function ResolutionStage({ scenario, navigate }: { scenario: Scenario; navigate: (path: string) => void }) {
  const state = loadAttempt(scenario)
  const [optionId, setOptionId] = useState('')
  const [error, setError] = useState('')
  if (!state) return <Briefing scenario={scenario} navigate={navigate} />
  const submit = () => { try { const next = commitResolution(scenario, state, optionId); saveAttempt(next); navigate(`/case/${scenario.id}/verify`) } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to commit resolution.') } }
  return <FocusedStage scenario={scenario} state={state} title="Choose the narrowest safe action" eyebrow="Resolution commitment" navigate={navigate}><section className="commitment-card"><h2>{scenario.resolution.prompt}</h2><fieldset className="choice-list"><legend>Resolution, containment, or escalation</legend>{scenario.resolution.options.map((option) => <label key={option.id}><input type="radio" name="resolution" checked={optionId === option.id} onChange={() => setOptionId(option.id)} /><span>{option.label}</span></label>)}</fieldset>{error && <p className="error-message" role="alert">{error}</p>}<div className="button-row spread"><button className="button secondary" onClick={() => navigate(`/case/${scenario.id}/play`)}>Review evidence</button><button className="button primary" disabled={!optionId} onClick={submit}>Choose resolution →</button></div></section></FocusedStage>
}

function VerificationStage({ scenario, navigate }: { scenario: Scenario; navigate: (path: string) => void }) {
  const state = loadAttempt(scenario)
  const [optionId, setOptionId] = useState(state?.decision?.verificationPlanOptionId ?? '')
  const [error, setError] = useState('')
  if (!state) return <Briefing scenario={scenario} navigate={navigate} />
  const submit = () => { try { const next = commitVerification(scenario, state, optionId); saveAttempt(next); navigate(`/case/${scenario.id}/communicate`) } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to verify.') } }
  return <FocusedStage scenario={scenario} state={state} title="Prove the required outcome" eyebrow="Verification commitment" navigate={navigate}><section className="outcome-reminder"><span className="eyebrow">Original report</span><p>{scenario.briefing.summary}</p></section><section className="commitment-card"><h2>{scenario.verification.prompt}</h2><fieldset className="choice-list"><legend>Verification action</legend>{scenario.verification.options.map((option) => <label key={option.id}><input type="radio" name="verification" checked={optionId === option.id} onChange={() => setOptionId(option.id)} /><span>{option.label}</span></label>)}</fieldset>{error && <p className="error-message" role="alert">{error}</p>}<button className="button primary full" disabled={!optionId} onClick={submit}>Verify outcome →</button></section></FocusedStage>
}

function badgesFor(scenario: Scenario, state: AttemptState) {
  const actions = state.usedActionIds.map((id) => scenario.actions.find((item) => item.id === id)).filter(Boolean) as Scenario['actions']
  const badges: string[] = []
  if (actions[0]?.intent === 'ask') badges.push('Scope First')
  if (actions.slice(0, 3).every((action) => action.disruptionCost === 0)) badges.push('Read-Only Start')
  const types = new Set(scenario.evidence.filter((item) => state.collectedEvidenceIds.includes(item.id)).map((item) => item.provenance))
  if (types.size >= 3) badges.push('Evidence Chain')
  if (!actions.some((action) => action.authorization === 'prohibited')) badges.push('Inside the Lines')
  if (scenario.resolution.options.find((item) => item.id === state.resolutionOptionId)?.label.toLowerCase().includes('escalat')) badges.push('Safe Escalation')
  if (scenario.verification.options.find((item) => item.id === state.verificationOptionId)?.isCorrect) badges.push('Verified Closure')
  if (hasEvidenceBasedRevision(scenario, state)) badges.push('Changed Mind With Evidence')
  return badges
}

const dimensionPractice: Record<string, string> = {
  scope: 'Ask one scope question before changing anything.',
  authorization: 'Name the boundary and next owner before acting.',
  safety: 'Prefer the lowest-impact test that can separate the leading explanations.',
  information: 'Choose the next test for what it can distinguish, not for familiarity.',
  efficiency: 'Stop collecting once the decision and verification gates are defensible.',
  evidence: 'Link one supporting observation and one meaningful contradiction.',
  communication: 'State knowns, unknowns, action, verification, and ownership without guarantees.',
  verification: 'Repeat the original user outcome or protective-state check.',
  closure: 'Record the evidence, result, limits, and next owner.',
}

function CommunicationStage({ scenario, navigate }: { scenario: Scenario; navigate: (path: string) => void }) {
  const state = loadAttempt(scenario)
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState('')
  if (!state) return <Briefing scenario={scenario} navigate={navigate} />
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const submit = () => { try { const next = commitCommunication(scenario, state, selected); saveAttempt(next); const score = scoreAttempt(scenario, next); const badges = badgesFor(scenario, next); if (!score.unsupportedStatements.length) badges.push('Bounded Language'); recordCompletion(scenario, next, score, badges); navigate(`/case/${scenario.id}/debrief`) } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to complete the update.') } }
  const complete = scenario.communication.requiredMessageParts.every((id) => selected.includes(id))
  return <FocusedStage scenario={scenario} state={state} title="Leave an evidence-bound update" eyebrow="Communication builder" navigate={navigate}><section className="commitment-card"><h2>{scenario.communication.prompt}</h2><p>Select the statements that belong in the record. Free text is optional and ungraded.</p><fieldset className="message-builder"><legend>Message blocks</legend>{scenario.communication.availableMessageParts.map((part, index) => <label key={part.id}><input type="checkbox" checked={selected.includes(part.id)} onChange={() => toggle(part.id)} /><span><small>Statement {index + 1}</small>{part.text}{state.mode === 'coach' && selected.includes(part.id) && part.category === 'unsupported' && <em className="coach-inline">Coach: This statement claims more than the supplied evidence supports.</em>}</span></label>)}</fieldset><label className="reflection">Optional reflection<textarea rows={3} placeholder="What signal would you look for next time? This stays on this device and is not graded." /></label>{error && <p className="error-message" role="alert">{error}</p>}<button className="button primary full" disabled={!complete} onClick={submit}>Complete handoff →</button></section></FocusedStage>
}

function Debrief({ scenario, navigate }: { scenario: Scenario; navigate: (path: string) => void }) {
  const state = loadAttempt(scenario)
  if (!state) return <Briefing scenario={scenario} navigate={navigate} />
  const score = scoreAttempt(scenario, state)
  const badges = badgesFor(scenario, state)
  const actionEvents = state.events.filter((event) => event.type === 'action.taken')
  const firstScored = scenarios.find((item) => !item.unscored)!
  const classificationReview = getClassificationReview(scenario, state)
  const weakestDimension = scenario.scoring.dimensions.reduce((weakest, dimension) => score.dimensions[dimension.id] < score.dimensions[weakest.id] ? dimension : weakest)
  const temptingAlternative = scenario.decision.options.find((option) => !option.isCorrect)
  const handledContradiction = classificationReview.find((item) => item.reviewed === 'contradicts' && item.relation === 'contradicts')
  const firstMissedContradiction = scenario.hypotheses.flatMap((hypothesis) => hypothesis.contradictedBy.map((evidenceId) => ({ hypothesis, evidenceId }))).find((item) => state.collectedEvidenceIds.includes(item.evidenceId) && !classificationReview.some((review) => review.hypothesisId === item.hypothesis.id && review.evidenceId === item.evidenceId && review.relation === 'contradicts'))
  return <div className="case-page debrief-page"><CaseHeader scenario={scenario} state={state} navigate={navigate} /><main id="main-content" className="debrief-layout"><header className="result-header"><span className={`status-chip ${score.caps.length ? 'danger' : 'verified'}`}>{scenario.unscored ? 'Training complete' : score.rank}</span><h1>{scenario.unscored ? 'You worked the complete incident loop.' : score.caps.length ? 'Review the path' : 'A defensible investigation.'}</h1><p>{score.caps[0]?.explanation ?? (scenario.unscored ? 'Your review reflects the path, commitments, verification, and handoff.' : 'Your final score reflects the path, commitments, verification, and handoff.')}</p>{!scenario.unscored && <div className="score-line"><strong>{score.finalScore}</strong><span>/ 100</span><small>Raw {score.rawScore}{score.caps.length ? ` → Final ${score.finalScore}` : ' · No score cap'}</small></div>}</header>
    {score.caps.length > 0 && <section className="cap-notice" aria-labelledby="cap-title"><h2 id="cap-title">Applied score caps</h2>{score.caps.map((cap) => <p key={cap.id}><strong>Maximum {cap.maximum}</strong> — {cap.explanation}</p>)}</section>}
    <section className="debrief-grid"><article><span className="eyebrow">Strongest method</span><h2>{badges[0] ?? 'Evidence collected'}</h2><p>You can replay to find a safer, shorter, or better-supported path.</p></article><article><span className="eyebrow">Commitment record</span><h2>{state.decision?.confidence ?? 'No'} confidence</h2><p>Decision, resolution, verification, and handoff are stored as separate events.</p></article></section>
    <div className="badge-row" aria-label="Method badges">{badges.map((badge) => <span className="status-chip verified" key={badge}>{badge}</span>)}</div>
    <section className="improvement-section" aria-labelledby="improvement-title"><span className="eyebrow">What to improve next</span><h2 id="improvement-title">Turn this review into the next behavior</h2><div className="review-grid"><article><h3>Evidence classifications</h3>{classificationReview.length ? <div className="classification-review">{classificationReview.map((item) => { const evidence = scenario.evidence.find((entry) => entry.id === item.evidenceId); const hypothesis = scenario.hypotheses.find((entry) => entry.id === item.hypothesisId); return <div key={`${item.evidenceId}-${item.hypothesisId}`} className={item.correct ? 'review-correct' : 'review-change'}><strong>{evidence?.label}</strong><span>{hypothesis?.label}</span><small>Player: {item.relation} · Reviewed: {item.reviewed}{item.revised ? ' · revised' : ''}</small><p>{item.explanation}</p></div> })}</div> : <p>No evidence relationships were recorded. Next time, classify at least one supporting observation and one contradiction.</p>}</article><article><h3>One tempting alternative</h3><p><strong>{temptingAlternative?.label}</strong></p><p>{temptingAlternative?.feedback}</p><h3>Key contradiction</h3>{handledContradiction ? <p>You correctly used {scenario.evidence.find((item) => item.id === handledContradiction.evidenceId)?.label} to weaken {scenario.hypotheses.find((item) => item.id === handledContradiction.hypothesisId)?.label}.</p> : firstMissedContradiction ? <p>You collected {scenario.evidence.find((item) => item.id === firstMissedContradiction.evidenceId)?.label}, but did not link it as a contradiction to {firstMissedContradiction.hypothesis.label}.</p> : <p>No collected contradiction was available for review in this path.</p>}</article></div><article className="next-behavior"><span className="status-chip policy">Next behavior</span><strong>{dimensionPractice[weakestDimension.id]}</strong><small>Recommended from your lowest reviewed dimension: {weakestDimension.label}.</small></article><details className="review-details"><summary>Teaching points and score-ledger details</summary><h3>Scenario teaching points</h3><ul>{scenario.debrief.teachingPoints.map((point) => <li key={point}>{point}</li>)}</ul><h3>Actions that materially helped or hurt</h3><ul>{score.ledger.slice().sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 8).map((entry, index) => <li key={`${entry.source}-${entry.dimension}-${index}`}><strong>{entry.amount > 0 ? '+' : ''}{entry.amount} {entry.dimension}</strong> — {entry.source}</li>)}</ul></details></section>
    {!scenario.unscored && <section className="score-section"><div className="section-heading"><div><span className="eyebrow">Nine dimensions</span><h2>How the path held up</h2></div></div><div className="score-bars">{scenario.scoring.dimensions.map((dimension) => <div key={dimension.id}><span>{dimension.label}</span><div role="meter" aria-label={dimension.label} aria-valuenow={score.dimensions[dimension.id]} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${score.dimensions[dimension.id]}%` }}></i></div><strong>{score.dimensions[dimension.id]}</strong></div>)}</div></section>}
    <section className="timeline-section"><span className="eyebrow">Evidence timeline</span><h2>Your investigation</h2><ol>{actionEvents.map((event, index) => { if (event.type !== 'action.taken') return null; const action = scenario.actions.find((item) => item.id === event.actionId); return <li key={`${event.actionId}-${index}`}><span>{index + 1}</span><div><strong>{action?.label}</strong><small>{action?.intent} · disruption {action?.disruptionCost}</small></div></li> })}</ol></section>
    <section className="root-explanation"><span className="eyebrow">Root explanation</span><h2>What the complete evidence shows</h2><p>{scenario.debrief.rootCauseExplanation}</p></section>
    <section className="best-path"><span className="eyebrow">Best path comparison</span><h2>A clean reviewed path</h2><ol>{scenario.debrief.bestPathActionIds.map((id) => <li key={id}>{scenario.actions.find((item) => item.id === id)?.label}</li>)}</ol></section>
    {score.unsupportedStatements.length > 0 && <section className="cap-notice"><h2>Unsupported statements</h2>{score.unsupportedStatements.map((text) => <p key={text}>{text}</p>)}</section>}
    <section className="share-card" aria-label="Spoiler-free result card"><BrandMark compact /><strong>{scenario.title}</strong><span>{scenario.unscored ? 'Training complete' : `${score.rank} · ${score.finalScore}`}</span><small>{state.moves} moves · {state.disruption} disruption · No spoilers</small></section>
    {scenario.unscored ? <div className="button-row"><button className="button primary" onClick={() => navigate(`/case/${firstScored.id}/briefing`)}>Continue to your first scored case</button><button className="button secondary" onClick={() => { clearAttempt(scenario.id); navigate(`/case/${scenario.id}/briefing`) }}>Replay Training Shift</button><button className="text-button" onClick={() => navigate('/shifts')}>Return to shift board</button></div> : <div className="button-row"><button className="button primary" onClick={() => { clearAttempt(scenario.id); navigate(`/case/${scenario.id}/briefing`) }}>Replay case</button><button className="button secondary" onClick={() => navigate('/shifts')}>Return to shift board</button></div>}</main></div>
}

function ProgressPage({ navigate }: { navigate: (path: string) => void }) {
  const progress = loadProgress()
  const history = loadHistory()
  const scored = history.filter((item) => item.score !== null)
  const average = (mode: Mode) => { const values = scored.filter((item) => item.mode === mode).map((item) => item.score as number); return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null }
  const recentDimensions = history.filter((item) => item.dimensions).slice(-5)
  const dimensions = scenarios.find((item) => !item.unscored)?.scoring.dimensions ?? []
  const trends = dimensions.map((dimension) => { const values = recentDimensions.map((item) => item.dimensions?.[dimension.id]).filter((value): value is number => typeof value === 'number'); return { ...dimension, average: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null } })
  const repeatChanges = scenarios.map((scenario) => { const attempts = scored.filter((item) => item.scenarioId === scenario.id).map((item) => item.score as number); return attempts.length > 1 ? { scenario, change: attempts.at(-1)! - attempts[0]! } : null }).filter((item): item is { scenario: Scenario; change: number } => Boolean(item))
  const weakest = trends.filter((item) => item.average !== null).sort((a, b) => (a.average ?? 100) - (b.average ?? 100))[0]
  const recommended = scenarios.find((item) => !item.unscored && !progress.completed[item.id]) ?? scenarios.filter((item) => !item.unscored).sort((a, b) => { const scoresA = scored.filter((entry) => entry.scenarioId === a.id).map((entry) => entry.score as number); const scoresB = scored.filter((entry) => entry.scenarioId === b.id).map((entry) => entry.score as number); return (scoresA.length ? Math.min(...scoresA) : 101) - (scoresB.length ? Math.min(...scoresB) : 101) })[0]
  return <GlobalShell navigate={navigate}><section className="page-heading"><span className="eyebrow">Shift log · private on this device</span><h1>Your completed work</h1><p>Completion unlocks practice. Scores never block progress, and this view is not an employment qualification.</p></section><section className="progress-summary"><article><strong>{Object.keys(progress.completed).length}</strong><span>Cases completed</span></article><article><strong>{average('coach') ?? '—'}</strong><span>Coach average</span></article><article><strong>{average('independent') ?? '—'}</strong><span>Independent average</span></article></section><section className="progress-insights"><article><h2>Recent dimension trend</h2>{recentDimensions.length ? <div className="trend-list">{trends.map((item) => <div key={item.id}><span>{item.label}</span><strong>{item.average ?? '—'}</strong></div>)}</div> : <p>Complete a scored case to begin a private five-attempt trend.</p>}</article><article><h2>Repeat-attempt improvement</h2>{repeatChanges.length ? repeatChanges.map((item) => <p key={item.scenario.id}><strong>{item.scenario.title}</strong> {item.change >= 0 ? '+' : ''}{item.change} points from first to latest attempt.</p>) : <p>Replay a scored case to compare your first and latest result.</p>}<h2>Recurring practice signal</h2><p>{weakest ? `${weakest.label} is the lowest recent dimension. ${dimensionPractice[weakest.id]}` : 'Complete a scored case for a behavior-level recommendation.'}</p></article><article className="recommended-case"><span className="eyebrow">Recommended next drill</span><h2>{recommended?.title ?? 'Training Shift'}</h2><p>{recommended?.subtitle ?? 'Learn the complete incident loop.'}</p><button className="button primary" onClick={() => navigate(`/case/${recommended?.id ?? 'TRAIN-001'}/briefing`)}>Open recommended case</button></article></section><section className="history-list"><h2>Attempt history</h2>{history.length ? history.slice().reverse().map((item, index) => <article key={`${item.scenarioId}-${index}`}><div><strong>{scenarioById.get(item.scenarioId)?.title ?? item.scenarioId}</strong><span>{item.mode} · {new Date(item.completedAt).toLocaleDateString()}{typeof item.moves === 'number' ? ` · ${item.moves} moves` : ''}</span></div><span>{item.score === null ? 'Training' : `${item.score} · ${item.rank}`}</span></article>) : <p>No completed cases yet. Training Shift is the best place to start.</p>}</section><p className="qualification-note">Game progression reflects completed scenarios, not employment qualification.</p></GlobalShell>
}

function SettingsPage({ navigate }: { navigate: (path: string) => void }) {
  const [settings, setSettingsState] = useState<Settings>(loadSettings())
  const update = (next: Settings) => { setSettingsState(next); saveSettings(next); document.documentElement.dataset.contrast = next.highContrast ? 'high' : 'normal'; document.documentElement.dataset.motion = next.reducedMotion ? 'reduced' : 'system' }
  const download = () => { const blob = new Blob([exportLocalData()], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'incident-shift-local-export.json'; link.click(); URL.revokeObjectURL(link.href) }
  return <GlobalShell navigate={navigate}><section className="page-heading"><span className="eyebrow">Local preferences</span><h1>Settings</h1><p>Incident Shift stores progress on this device only. It collects no name, email, IP, analytics, or free-text response.</p></section><section className="settings-panel"><fieldset><legend>Default guidance</legend><label><input type="radio" checked={settings.defaultMode === 'coach'} onChange={() => update({ ...settings, defaultMode: 'coach' })} /> Coach</label><label><input type="radio" checked={settings.defaultMode === 'independent'} onChange={() => update({ ...settings, defaultMode: 'independent' })} /> Independent</label></fieldset><fieldset><legend>Display</legend><label><input type="checkbox" checked={settings.reducedMotion} onChange={(event) => update({ ...settings, reducedMotion: event.target.checked })} /> Reduce motion</label><label><input type="checkbox" checked={settings.highContrast} onChange={(event) => update({ ...settings, highContrast: event.target.checked })} /> Increase contrast</label></fieldset><div className="settings-actions"><button className="button secondary" onClick={download}>Export local test data</button><button className="button danger-button" onClick={() => { if (window.confirm('Reset all Incident Shift progress on this device?')) { resetLocalData(); setSettingsState(loadSettings()) } }}>Reset local progress</button></div></section></GlobalShell>
}

function NotFound({ navigate }: { navigate: (path: string) => void }) { return <GlobalShell navigate={navigate}><section className="page-heading"><h1>That case file is unavailable.</h1><p>The route does not match a validated local scenario.</p><button className="button primary" onClick={() => navigate('/shifts')}>Return to shifts</button></section></GlobalShell> }

function App() {
  const { path, navigate } = usePath()
  const route = useMemo(() => path.split('/').filter(Boolean), [path])
  useEffect(() => { const settings = loadSettings(); document.documentElement.dataset.contrast = settings.highContrast ? 'high' : 'normal'; document.documentElement.dataset.motion = settings.reducedMotion ? 'reduced' : 'system' }, [])
  if (path === '/') return <Landing navigate={navigate} />
  if (path === '/shifts') return <ShiftBoard navigate={navigate} />
  if (path === '/daily') return <DailyRoute navigate={navigate} />
  if (path === '/progress') return <ProgressPage navigate={navigate} />
  if (path === '/settings') return <SettingsPage navigate={navigate} />
  if (route[0] === 'case' && route[1] && route[2]) {
    const scenario = scenarioById.get(route[1]); if (!scenario) return <NotFound navigate={navigate} />
    const screen = route[2]
    if (screen === 'briefing') return <Briefing scenario={scenario} navigate={navigate} />
    if (screen === 'play') return <PlayCase scenario={scenario} navigate={navigate} />
    if (screen === 'decision') return <DecisionStage scenario={scenario} navigate={navigate} />
    if (screen === 'resolve') return <ResolutionStage scenario={scenario} navigate={navigate} />
    if (screen === 'verify') return <VerificationStage scenario={scenario} navigate={navigate} />
    if (screen === 'communicate') return <CommunicationStage scenario={scenario} navigate={navigate} />
    if (screen === 'debrief') return <Debrief scenario={scenario} navigate={navigate} />
  }
  return <NotFound navigate={navigate} />
}

export default App
