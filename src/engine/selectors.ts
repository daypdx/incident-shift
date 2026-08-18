import type { Scenario } from './validation'

export function selectDailyScenario(scenarios: Scenario[], date: Date, eligibleIds?: string[]) {
  const eligible = scenarios.filter((scenario) => !scenario.unscored && (!eligibleIds || eligibleIds.includes(scenario.id)))
  if (!eligible.length) return null
  const key = date.toISOString().slice(0, 10)
  const seed = [...key].reduce((sum, character) => sum + character.charCodeAt(0), 0)
  return eligible[seed % eligible.length] ?? null
}
