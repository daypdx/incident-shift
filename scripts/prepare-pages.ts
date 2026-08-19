import { copyFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const entryPoint = 'dist/index.html'
const staticRoutes = ['shifts', 'daily', 'progress', 'settings']
const caseScreens = ['briefing', 'play', 'decision', 'resolve', 'verify', 'communicate', 'debrief']
const scenarioIds = readdirSync('src/content/scenarios')
  .filter((file) => file.endsWith('.json'))
  .map((file) => JSON.parse(readFileSync(join('src/content/scenarios', file), 'utf8')) as { id: string })
  .map((scenario) => scenario.id)

for (const scenarioId of scenarioIds) {
  for (const screen of caseScreens) staticRoutes.push(`case/${scenarioId}/${screen}`)
}

for (const route of staticRoutes) {
  const routeDirectory = join('dist', route)
  mkdirSync(routeDirectory, { recursive: true })
  copyFileSync(entryPoint, join(routeDirectory, 'index.html'))
}

copyFileSync(entryPoint, 'dist/404.html')
console.log(`Created ${staticRoutes.length} direct route entries and the GitHub Pages fallback.`)
