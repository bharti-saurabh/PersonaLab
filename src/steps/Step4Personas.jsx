import React, { useMemo, useState } from 'react'
import { useProject } from '../state/store.jsx'
import { getSegment, describeTarget } from '../data/segments.js'
import { generatePersonas } from '../services/generators.js'
import { hasKey } from '../services/llm.js'
import { SectionTitle, Card, Badge, StatCard, SyntheticBanner, ComplianceBanner, EmptyState } from '../components/ui.jsx'
import { useStagedGenerate, GenConsole, Stagger, ThinkingPill } from '../components/generate.jsx'
import { DonutCard, BarsCard, PALETTE } from '../components/charts.jsx'
import { exportCSV, exportJSON } from '../utils/export.js'
import { UserCog, Wand2, Save, FolderOpen, FileDown, Users } from 'lucide-react'

const ARCHETYPE_META = {
  core: { color: 'emerald', label: 'Core', hex: '#16b3a3' },
  adjacent: { color: 'sky', label: 'Adjacent', hex: '#0ea5e9' },
  skeptical: { color: 'amber', label: 'Skeptical', hex: '#f59e0b' },
}
const LITERACY_META = { low: 'amber', medium: 'sky', high: 'emerald' }

function normalize(raw) {
  const total = (raw.core || 0) + (raw.adjacent || 0) + (raw.skeptical || 0)
  if (total <= 0) return { core: 0.6, adjacent: 0.25, skeptical: 0.15 }
  return { core: raw.core / total, adjacent: raw.adjacent / total, skeptical: raw.skeptical / total }
}

export default function Step4Personas() {
  const { project, update, settings, store, actions } = useProject()
  const panel = project.panel
  const productId = project.campaign.product
  const gen = useStagedGenerate()
  const [raw, setRaw] = useState({
    core: (panel.distribution?.core ?? 0.6) * 100,
    adjacent: (panel.distribution?.adjacent ?? 0.25) * 100,
    skeptical: (panel.distribution?.skeptical ?? 0.15) * 100,
  })

  const hasTarget = project.target.segments.length > 0 || project.target.custom.length > 0
  const targetText = describeTarget(project.target.segments, project.target.custom)
  const personas = panel.personas || []
  const savedPanels = store.libraries.panels[productId] || []

  const dist = useMemo(() => normalize(raw), [raw])
  const pct = (v) => Math.round(v * 100)
  const setSlider = (key, value) => setRaw((r) => ({ ...r, [key]: Number(value) }))

  const generate = async () => {
    if (!hasTarget) return
    const distribution = normalize(raw)
    const size = panel.size || 12
    const result = await gen.run({
      steps: [
        'Reading the target segment definition…',
        'Sampling the within-segment archetype mix…',
        'Drafting persona profiles & core motivations…',
        'Assigning financial literacy & media habits…',
        'Verifying every persona stays on-segment (ECOA)…',
        'Assembling the synthetic panel…',
      ],
      work: async () => generatePersonas({ settings, target: project.target, distribution, n: size }),
      minMs: 2600,
    })
    update({ panel: { ...panel, personas: result, distribution, size } })
  }

  // --- composition metrics ---
  const counts = useMemo(() => {
    const c = { core: 0, adjacent: 0, skeptical: 0 }
    personas.forEach((p) => { c[p.archetype] = (c[p.archetype] || 0) + 1 })
    return c
  }, [personas])
  const total = personas.length || 1
  const ages = personas.map((p) => p.age).filter((a) => typeof a === 'number')
  const distinctAges = new Set(ages).size
  const ageSpread = ages.length ? `${Math.min(...ages)}–${Math.max(...ages)}` : '—'
  const litCounts = useMemo(() => {
    const c = { low: 0, medium: 0, high: 0 }
    personas.forEach((p) => { c[p.financialLiteracy] = (c[p.financialLiteracy] || 0) + 1 })
    return c
  }, [personas])
  const litSpread = ['low', 'medium', 'high'].filter((k) => litCounts[k] > 0).length

  const archetypeData = [
    { name: 'Core', value: counts.core, color: ARCHETYPE_META.core.hex },
    { name: 'Adjacent', value: counts.adjacent, color: ARCHETYPE_META.adjacent.hex },
    { name: 'Skeptical', value: counts.skeptical, color: ARCHETYPE_META.skeptical.hex },
  ]
  const literacyData = [
    { name: 'Low', literacy: litCounts.low },
    { name: 'Medium', literacy: litCounts.medium },
    { name: 'High', literacy: litCounts.high },
  ]

  const savePanel = () => {
    if (!personas.length) return
    const name = prompt('Name this panel:', `Panel — ${targetText.slice(0, 30)}`)
    if (!name) return
    actions.savePanel(productId, { id: `panel-${Date.now()}`, name, personas, distribution: dist })
  }
  const loadPanel = (p) => {
    setRaw({ core: (p.distribution?.core ?? 0.6) * 100, adjacent: (p.distribution?.adjacent ?? 0.25) * 100, skeptical: (p.distribution?.skeptical ?? 0.15) * 100 })
    update({ panel: { ...panel, personas: p.personas, distribution: p.distribution || panel.distribution, size: p.personas.length } })
  }

  const exportRows = personas.map((p) => ({
    name: p.name, age: p.age, income: p.income, archetype: p.archetype,
    financialLiteracy: p.financialLiteracy, mediaHabits: p.mediaHabits, decisionStyle: p.decisionStyle,
    keyObjection: p.keyObjection, segmentFit: p.segmentFit, goals: p.goals, voice: p.voice,
  }))

  return (
    <div className="space-y-6">
      <SectionTitle icon={UserCog} title="Synthetic Persona Generation"
        subtitle="Every persona is conditioned on your selected segment(s) and varies only within them — never off-segment. This builds a diverse-but-coherent panel for the focus group and survey downstream."
        right={
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={savePanel} disabled={!personas.length}><Save size={15} /> Save panel</button>
            <button className="btn-primary" onClick={generate} disabled={gen.running || !hasTarget}>{gen.running ? <ThinkingPill label="Building panel" /> : <><Wand2 size={15} /> {hasKey(settings) ? 'Generate panel' : 'Generate panel (demo)'}</>}</button>
          </div>
        } />

      <ComplianceBanner tone="emerald">Personas are built from behavioral, needs-based, and financial-profile attributes only — never protected classes (race, religion, sex, marital status, national origin, public assistance) or close proxies (ECOA / Reg B).</ComplianceBanner>

      {!hasTarget ? (
        <Card className="p-2">
          <EmptyState icon={Users} title="No target segment selected"
            action={<span className="text-sm text-ink-500">Pick a primary segment in Step 2 — personas are conditioned on it.</span>}>
            Personas can only be generated once you have defined who you are targeting. Head back to Step 2 to select a segment.
          </EmptyState>
        </Card>
      ) : (
        <>
          {/* Target context */}
          <Card className="p-4">
            <div className="label mb-1">Conditioning on target</div>
            <p className="text-sm text-ink-800 leading-relaxed">{targetText}</p>
          </Card>

          {/* Controls */}
          <div className="grid lg:grid-cols-2 gap-5">
            <Card className="p-5">
              <div className="label mb-1">Within-segment archetype mix</div>
              <p className="text-xs text-ink-500 mb-4">Personas always stay on-segment; this controls the spread between engaged core members, curious adjacents, and skeptics. Values normalize to 100%.</p>
              <div className="space-y-4">
                {['core', 'adjacent', 'skeptical'].map((key) => {
                  const m = ARCHETYPE_META[key]
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="flex items-center gap-2 text-sm font-medium text-ink-800"><Badge color={m.color}>{m.label}</Badge></span>
                        <span className="text-sm font-mono text-ink-600">{pct(dist[key])}%</span>
                      </div>
                      <input type="range" min="0" max="100" value={raw[key]} onChange={(e) => setSlider(key, e.target.value)}
                        className="w-full accent-brand-600" />
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 pt-3 border-t border-ink-100 text-xs text-ink-500">
                Live mix: <span className="font-medium text-ink-700">{pct(dist.core)}% core · {pct(dist.adjacent)}% adjacent · {pct(dist.skeptical)}% skeptical</span>
              </div>
            </Card>

            <Card className="p-5">
              <div className="label mb-1">Panel size</div>
              <p className="text-xs text-ink-500 mb-4">The focus-group panel is generated now; the survey panel size is used when fielding the quant study in Step 6.</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Focus-group panel</label>
                  <input type="number" min="6" max="20" className="input mt-1" value={panel.size}
                    onChange={(e) => update({ panel: { ...panel, size: Math.max(6, Math.min(20, Number(e.target.value) || 6)) } })} />
                  <p className="text-[11px] text-ink-400 mt-1">6–20 personas (default 12)</p>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Survey panel</label>
                  <input type="number" min="50" max="500" step="10" className="input mt-1" value={panel.surveySize}
                    onChange={(e) => update({ panel: { ...panel, surveySize: Math.max(50, Math.min(500, Number(e.target.value) || 250)) } })} />
                  <p className="text-[11px] text-ink-400 mt-1">up to 500 (default 250)</p>
                </div>
              </div>
              <div className="mt-4">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Calibration anchor</label>
                <textarea className="input min-h-[88px] resize-y mt-1" value={project.calibration}
                  onChange={(e) => update({ calibration: e.target.value })}
                  placeholder="Paste known segment benchmarks or first-party stats…" />
                <p className="text-[11px] text-ink-400 mt-1">Paste known segment benchmarks or first-party stats so personas are grounded (optional).</p>
              </div>
            </Card>
          </div>

          {/* Saved panels */}
          {savedPanels.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-ink-400 flex items-center gap-1"><FolderOpen size={13} /> Saved panels:</span>
                {savedPanels.map((p) => <button key={p.id} className="chip bg-ink-100 text-ink-700 hover:bg-ink-200" onClick={() => loadPanel(p)}>{p.name} · {p.personas.length}</button>)}
              </div>
            </Card>
          )}

          {gen.running ? (
            <GenConsole lines={gen.lines} title="Generating synthetic personas"
              subtitle={`${panel.size} personas · conditioned on your target segment`} />
          ) : personas.length === 0 ? (
            <Card className="p-2">
              <EmptyState icon={Wand2} title="No panel generated yet">
                Set the within-segment mix and panel size, then generate a panel of synthetic personas grounded in your target.
              </EmptyState>
            </Card>
          ) : (
            <>
              {/* Composition summary — demonstrates within-segment diversity */}
              <div>
                <h3 className="font-bold text-ink-900 mb-3">Panel composition</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                  <StatCard label="Panel size" value={personas.length} sub="synthetic personas" />
                  <StatCard label="% Core" value={`${Math.round((counts.core / total) * 100)}%`} sub={`${counts.adjacent} adjacent · ${counts.skeptical} skeptical`} color="emerald" />
                  <StatCard label="Distinct ages" value={distinctAges} sub={`range ${ageSpread}`} color="ink" />
                  <StatCard label="Literacy spread" value={`${litSpread} of 3`} sub={`${litCounts.low} low · ${litCounts.medium} med · ${litCounts.high} high`} color="amber" />
                </div>
                <div className="grid lg:grid-cols-2 gap-5">
                  <DonutCard title="Archetype mix" subtitle="Within-segment diversity (core / adjacent / skeptical)" data={archetypeData} />
                  <BarsCard title="Financial-literacy spread" subtitle="Personas vary realistically within the segment"
                    data={literacyData} xKey="name" bars={[{ key: 'literacy', name: 'Personas', color: PALETTE[0] }]} />
                </div>
              </div>

              {/* Persona cards */}
              <div>
                <h3 className="font-bold text-ink-900 mb-3">Personas</h3>
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {personas.map((p, idx) => {
                    const m = ARCHETYPE_META[p.archetype] || ARCHETYPE_META.core
                    return (
                      <Stagger key={p.id} i={idx} className="card p-4 flex flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold text-ink-900 leading-tight">{p.name}</div>
                            <div className="text-xs text-ink-500 mt-0.5">{p.age} yrs · {p.income}</div>
                          </div>
                          <Badge color={m.color}>{m.label}</Badge>
                        </div>

                        <div className="mt-3 rounded-lg bg-brand-50 border border-brand-100 px-3 py-2">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-brand-700">Segment fit</div>
                          <p className="text-xs text-brand-900 mt-0.5 leading-snug">{p.segmentFit}</p>
                        </div>

                        <dl className="mt-3 space-y-2 text-xs">
                          <Row label="Financial literacy"><Badge color={LITERACY_META[p.financialLiteracy] || 'sky'}>{p.financialLiteracy}</Badge></Row>
                          <Row label="Media habits">{p.mediaHabits}</Row>
                          <Row label="Decision style">{p.decisionStyle}</Row>
                          <Row label="Key objection"><span className="text-ink-700">{p.keyObjection}</span></Row>
                        </dl>
                      </Stagger>
                    )
                  })}
                </div>
              </div>

              {/* Export */}
              <Card className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="font-bold text-ink-900">Export panel</h3>
                    <p className="text-xs text-ink-500">Hand off the synthetic panel for review or downstream use.</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-ghost" onClick={() => exportCSV(exportRows, `personas-${project.id}.csv`)}><FileDown size={15} /> CSV</button>
                    <button className="btn-ghost" onClick={() => exportJSON({ target: targetText, distribution: dist, personas }, `personas-${project.id}.json`)}><FileDown size={15} /> JSON</button>
                  </div>
                </div>
              </Card>
            </>
          )}
        </>
      )}

      <SyntheticBanner />
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-ink-400 shrink-0">{label}</dt>
      <dd className="text-ink-700 text-right">{children}</dd>
    </div>
  )
}
