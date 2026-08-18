import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateScenarioCollection } from '../src/engine/validation.ts'

const directory = resolve('src/content/scenarios')
const files = readdirSync(directory).filter((file) => file.endsWith('.json')).sort()
const content = files.map((file) => JSON.parse(readFileSync(resolve(directory, file), 'utf8')) as unknown)
const scenarios = validateScenarioCollection(content)

console.log(`Validated ${scenarios.length} scenarios with Zod and semantic reference checks:`)
for (const scenario of scenarios) console.log(`  ${scenario.id} v${scenario.version} — review by ${scenario.contentReview.reviewBy}`)
