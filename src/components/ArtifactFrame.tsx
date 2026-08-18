import type { Scenario } from '../engine/validation'

const paths = {
  'device-flow': ['Meeting app', 'Selected output', 'Connected headset'],
  'connection-path': ['Workstation', 'Local path', 'Service path', 'Name resolution'],
} as const

export function ArtifactFrame({ scenario, collectedEvidenceIds }: { scenario: Scenario; collectedEvidenceIds: string[] }) {
  const evidence = scenario.evidence.filter((item) => collectedEvidenceIds.includes(item.id))
  if (scenario.artifactFamily === 'device-flow' || scenario.artifactFamily === 'connection-path') {
    const nodes = paths[scenario.artifactFamily]
    return (
      <section className="artifact-frame" aria-labelledby="artifact-title" data-artifact-family={scenario.artifactFamily}>
        <div className="section-heading">
          <div><span className="eyebrow">Active artifact</span><h2 id="artifact-title">System path</h2></div>
          <span className="status-chip info">Plain-language view</span>
        </div>
        <ol className="system-path" aria-label={`System path with ${Math.min(evidence.length, nodes.length)} observed states`}>
          {nodes.map((label, index) => (
            <li className={index < evidence.length ? 'known' : 'unknown'} key={label}>
              <span className="path-dot" aria-hidden="true">{index < evidence.length ? '✓' : '?'}</span>
              <strong>{label}</strong>
              <small>{index < evidence.length ? 'Evidence available' : 'Not yet tested'}</small>
            </li>
          ))}
        </ol>
        <p className="artifact-alternative">The path updates only as evidence is collected. Unknown does not mean failed.</p>
      </section>
    )
  }

  const title = scenario.artifactFamily === 'sign-in-timeline' ? 'Sign-in timeline' : 'Email and call timeline'
  return (
    <section className="artifact-frame" aria-labelledby="artifact-title" data-artifact-family={scenario.artifactFamily}>
      <div className="section-heading">
        <div><span className="eyebrow">Active artifact</span><h2 id="artifact-title">{title}</h2></div>
        <span className="status-chip info">Plain-language view</span>
      </div>
      <ol className="event-timeline">
        {evidence.slice(-5).map((item, index) => (
          <li key={item.id}>
            <time>{index + 1}</time>
            <div><strong>{item.label}</strong><span>{item.content.split('\n')[0]}</span></div>
          </li>
        ))}
      </ol>
      <p className="artifact-alternative">Text equivalent: {evidence.length} chronological evidence item{evidence.length === 1 ? '' : 's'} collected.</p>
    </section>
  )
}
