import { replay, type AttemptEvent, type AttemptState, type Mode, type ScoreResult } from './engine'
import type { DimensionId, Scenario } from './validation'

const SETTINGS_KEY = 'incident-shift.settings.v1'
const PROGRESS_KEY = 'incident-shift.progress.v1'
const HISTORY_KEY = 'incident-shift.history.v1'

export interface Settings {
  defaultMode: Mode
  reducedMotion: boolean
  highContrast: boolean
}

export interface CompletedAttempt {
  scenarioId: string
  mode: Mode
  completedAt: string
  score: number | null
  rank: string
  badges: string[]
  dimensions?: Partial<Record<DimensionId, number>>
  moves?: number
  disruption?: number
}

export interface Progress {
  trainingComplete: boolean
  completed: Record<string, { coach: boolean; independent: boolean }>
}

const defaultSettings: Settings = { defaultMode: 'coach', reducedMotion: false, highContrast: false }
const defaultProgress: Progress = { trainingComplete: false, completed: {} }

function parse<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

function save(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export const loadSettings = () => {
  const stored = parse<Partial<Settings>>(SETTINGS_KEY, defaultSettings)
  return {
    defaultMode: stored.defaultMode === 'independent' ? 'independent' : 'coach',
    reducedMotion: Boolean(stored.reducedMotion),
    highContrast: Boolean(stored.highContrast),
  } satisfies Settings
}
export const saveSettings = (settings: Settings) => save(SETTINGS_KEY, settings)
export const loadProgress = () => parse<Progress>(PROGRESS_KEY, defaultProgress)
export const loadHistory = () => parse<CompletedAttempt[]>(HISTORY_KEY, [])

export function saveAttempt(state: AttemptState): boolean {
  return save(`incident-shift.attempt.${state.scenarioId}.v1`, { dataVersion: 1, scenarioId: state.scenarioId, contentVersion: state.contentVersion, events: state.events })
}

export function loadAttempt(scenario: Scenario): AttemptState | null {
  const stored = parse<{ dataVersion?: number; scenarioId?: string; contentVersion?: number; events?: AttemptEvent[] } | null>(`incident-shift.attempt.${scenario.id}.v1`, null)
  if (!stored || stored.dataVersion !== 1 || stored.scenarioId !== scenario.id || stored.contentVersion !== scenario.version || !Array.isArray(stored.events)) return null
  try {
    return replay(stored.events, scenario)
  } catch {
    return null
  }
}

export function clearAttempt(scenarioId: string) {
  localStorage.removeItem(`incident-shift.attempt.${scenarioId}.v1`)
}

export function recordCompletion(scenario: Scenario, state: AttemptState, score: ScoreResult, badges: string[]) {
  const progress = loadProgress()
  progress.trainingComplete ||= scenario.unscored
  progress.completed[scenario.id] ??= { coach: false, independent: false }
  progress.completed[scenario.id][state.mode] = true
  save(PROGRESS_KEY, progress)
  const history = loadHistory()
  history.push({ scenarioId: scenario.id, mode: state.mode, completedAt: state.events.at(-1)?.at ?? new Date().toISOString(), score: scenario.unscored ? null : score.finalScore, rank: score.rank, badges, dimensions: score.dimensions, moves: state.moves, disruption: state.disruption })
  save(HISTORY_KEY, history)
}

export function resetLocalData() {
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index)
    if (key?.startsWith('incident-shift.')) localStorage.removeItem(key)
  }
}

export function exportLocalData() {
  return JSON.stringify({ settings: loadSettings(), progress: loadProgress(), history: loadHistory().map(({ scenarioId, mode, completedAt, score, rank, badges }) => ({ scenarioId, mode, completedAt, score, rank, badges })) }, null, 2)
}

export function migratePersistedAttempt(input: unknown): { dataVersion: 1; events: AttemptEvent[] } | null {
  if (!input || typeof input !== 'object') return null
  const value = input as { dataVersion?: number; events?: AttemptEvent[] }
  if (value.dataVersion === 1 && Array.isArray(value.events)) return { dataVersion: 1, events: value.events }
  return null
}
