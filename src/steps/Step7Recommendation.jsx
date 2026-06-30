import React, { useState } from 'react'
import { useProject } from '../state/store.jsx'
import { useNav } from '../state/nav.js'
import { recommend, generateCreative } from '../services/generators.js'
import { hasKey } from '../services/llm.js'
import { getSegment, describeTarget } from '../data/segments.js'
import { SectionTitle, Card, Badge, RiskBadge, ConfidenceLabel, StatCard, SyntheticBanner, EmptyState, Spinner } from '../components/ui.jsx'
import { useStagedGenerate, GenConsole, Stagger, ThinkingPill, useCountUp } from '../components/generate.jsx'
import { BarsCard, RadarCard, PALETTE } from '../components/charts.jsx'
import { exportCSV, exportJSON, printReport } from '../utils/export.js'
import { Trophy, Wand2, FileDown, RefreshCw, Lightbulb, ClipboardList, Sparkles, Users, Layers, AlertTriangle, ShieldCheck } from 'lucide-react'

export default function Step7Recommendation() {
  const { project, update, settings, store, actions } = useProject()
  const { goTo } = useNav()
  const gen = useStagedGenerate()
  const [iterating, setIterating] = useState(false)

  const variants = project.creative.variants
  const results = project.survey?.results
  const reco = project.recommendation

  const nameFor = (id) => variants.find((v) => v.id === id)?.name || id
  const variantFor = (id) => variants.find((v) => v.id === id)
  const surveyFor = (id) => results?.perVariant?.find((p) => p.variantId === id)
  const focusFor = (id) => project.focusGroup?.perVariant?.find((p) => p.variantId === id)
  const riskFor = (id) => (project.creative.screenResults || []).find((r) => r.variantId === id)?.risk

  // ---- no survey yet ----
  if (!results) {
    return (
      <div className="space-y-6">
        <SectionTitle icon={Trophy} title="Recommendation"
          subtitle="A clear, honest recommendation with a confidence level — directional, not definitive. Validate with the real A/B test before acting." />
        <Card className="p-2">
          <EmptyState icon={ClipboardList} title="No survey results yet"
            action={<button className="btn-primary" onClick={() => goTo(6)}><ClipboardList size={15} /> Go to Survey (Step 6)</button>}>
            Run the quantitative survey panel in Step 6 to produce preference share, comprehension, and apply-intent numbers. The recommendation engine reads those results.
          </EmptyState>
        </Card>
      </div>
    )
  }

  const runRecommend = async () => {
    const out = await gen.run({
      steps: [
        'Aggregating focus-group & survey signal…',
        'Scoring each variant on intent, trust & comprehension…',
        'Weighing segment & intersectional fit…',
        'Checking compliance risk per variant…',
        'Selecting the winner & confidence level…',
        'Drafting improvement recommendations…',
      ],
      work: async () => recommend({ settings, focusGroup: project.focusGroup, survey: project.survey, variants, target: project.target }),
      minMs: 2800,
    })
    update({ recommendation: out })
    actions.addAudit({ timestamp: new Date().toISOString(), action: 'Generated recommendation', detail: `Winner: ${nameFor(out.winnerId)} (${out.predictedPrefShare}% pref share, ${out.confidence} confidence)`, category: 'recommendation', risk: 'low' })
  }

  // ---- iterate loop: keep winner as control + 2 improved, clear downstream, re-screen ----
  const iterateOnWinner = async () => {
    if (!reco) return
    const winner = variantFor(reco.winnerId)
    if (!winner) return
    const ok = window.confirm(
      `Iterate on "${winner.name}"?\n\nThis keeps the winner as a control, generates 2 improved variants, and clears the current compliance screen, focus group, survey results, and recommendation so you can re-test. You'll be sent back to Step 3 (Creative) to re-screen.`
    )
    if (!ok) return
    setIterating(true)
    try {
      const improved = await generateCreative({ settings, campaign: project.campaign, target: project.target, n: 2 })
      const control = { ...winner, name: winner.name.includes('(control)') ? winner.name : `${winner.name} (control)` }
      const nextVariants = [control, ...improved].slice(0, 5)
      update({
        creative: { ...project.creative, variants: nextVariants, screenResults: [] },
        focusGroup: null,
        survey: { ...project.survey, results: null },
        recommendation: null,
      })
      actions.addAudit({ timestamp: new Date().toISOString(), action: 'Iterated on winner', detail: `Kept ${control.name} as control + 2 improved variants; cleared downstream tests`, category: 'recommendation', risk: 'low' })
      goTo(3)
    } finally { setIterating(false) }
  }

  const winnerVar = reco ? variantFor(reco.winnerId) : null
  const targetLabel = describeTarget(project.target.segments, project.target.custom)
  const prefShareCount = Math.round(useCountUp(reco?.predictedPrefShare ?? 0, { ms: 900, active: !!reco }))

  // ---- chart data ----
  const prefData = variants.map((v) => ({ name: v.name, share: surveyFor(v.id)?.prefShare ?? 0, isWinner: reco?.winnerId === v.id }))
  const radarMetrics = [
    { metric: 'Pref share', key: 'pref' },
    { metric: 'Top-2 box', key: 'top2' },
    { metric: 'Comprehension', key: 'comp' },
    { metric: 'Apply intent', key: 'intent' },
    { metric: 'Sentiment', key: 'sentiment' },
    { metric: 'Trust', key: 'trust' },
  ]
  const radarData = radarMetrics.map((m) => {
    const row = { metric: m.metric }
    variants.forEach((v) => {
      const sv = surveyFor(v.id), fg = focusFor(v.id)
      const val = m.key === 'pref' ? sv?.prefShare : m.key === 'top2' ? sv?.top2box : m.key === 'comp' ? sv?.comprehensionRate : m.key === 'intent' ? sv?.applyIntent : m.key === 'sentiment' ? fg?.sentiment : fg?.trust
      row[v.id] = val ?? 0
    })
    return row
  })
  const radarSeries = variants.map((v) => ({ key: v.id, name: v.name }))

  // ---- export rows ----
  const scorecardRows = variants.map((v) => {
    const sv = surveyFor(v.id), fg = focusFor(v.id)
    return {
      variant: v.name,
      winner: reco?.winnerId === v.id ? 'yes' : 'no',
      pref_share_pct: sv?.prefShare ?? '',
      top2box_pct: sv?.top2box ?? '',
      comprehension_pct: sv?.comprehensionRate ?? '',
      apply_intent_pct: sv?.applyIntent ?? '',
      sentiment: fg?.sentiment ?? '',
      trust: fg?.trust ?? '',
      compliance_risk: riskFor(v.id) ?? 'n/a',
    }
  })

  return (
    <div className="space-y-6">
      <SectionTitle icon={Trophy} title="Recommendation"
        subtitle="A clear, honest recommendation with a confidence level — directional, not definitive. Validate with the real A/B test before acting."
        right={
          <div className="flex gap-2">
            <button className="btn-primary" onClick={runRecommend} disabled={gen.running}>
              {gen.running ? <ThinkingPill label="Analyzing" /> : <><Trophy size={15} /> {reco ? 'Re-run recommendation' : 'Generate recommendation'}{!hasKey(settings) && ' (demo)'}</>}
            </button>
          </div>
        } />

      {gen.running ? (
        <GenConsole lines={gen.lines} title="Generating the recommendation"
          subtitle={`Weighing ${variants.length} variants across survey & focus-group signal`} />
      ) : !reco ? (
        <Card className="p-2">
          <EmptyState icon={Sparkles} title="Ready to recommend"
            action={<button className="btn-primary" onClick={runRecommend} disabled={gen.running}><Trophy size={15} /> Generate recommendation</button>}>
            We'll weigh preference share, comprehension, apply-intent, sentiment, and trust across your variants to surface a winner — with a confidence level and an explicit directional caveat.
          </EmptyState>
        </Card>
      ) : (
        <>
          {/* ---- Winner hero ---- */}
          <Stagger i={0} className="card p-5 border-brand-400 ring-2 ring-brand-400/25 bg-gradient-to-br from-brand-50 via-white to-emerald-50/40">
            <div className="flex items-start justify-between gap-5 flex-wrap">
              <div className="flex items-start gap-3 min-w-0">
                <div className="grid place-items-center h-12 w-12 rounded-xl bg-brand-600 text-white shadow-sm shrink-0"><Trophy size={24} /></div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge color="brand"><Trophy size={12} /> Recommended winner</Badge>
                    <ConfidenceLabel level={reco.confidence} />
                    {riskFor(reco.winnerId) && <RiskBadge risk={riskFor(reco.winnerId)} />}
                  </div>
                  <h3 className="text-2xl font-extrabold text-ink-900 leading-tight mt-1.5">{winnerVar?.name || nameFor(reco.winnerId)}</h3>
                  {winnerVar?.headline && <p className="text-sm font-medium text-ink-700 mt-1.5">{winnerVar.headline}</p>}
                  {winnerVar?.valueProp && <p className="text-sm text-ink-500 mt-0.5">{winnerVar.valueProp}</p>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">Predicted preference share</div>
                <div className="text-5xl font-extrabold text-brand-600 leading-none mt-1 tabular-nums">{prefShareCount}%</div>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2 py-1 text-[11px] font-medium text-amber-900">
                  <AlertTriangle size={12} /> Directional — validate with the A/B test
                </div>
              </div>
            </div>
            {reco.rationale && <p className="text-sm text-ink-700 mt-4 leading-relaxed border-t border-ink-100 pt-3.5">{reco.rationale}</p>}
          </Stagger>

          {/* ---- Scorecards ---- */}
          <Stagger i={1} className="">
            <h3 className="text-sm font-bold text-ink-800 mb-2.5 flex items-center gap-2"><Layers size={16} className="text-ink-400" /> Variant scorecards</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {variants.map((v, i) => {
                const sv = surveyFor(v.id), fg = focusFor(v.id), risk = riskFor(v.id)
                const isWinner = reco.winnerId === v.id
                return (
                  <Card key={v.id} className={`p-4 ${isWinner ? 'border-brand-400 ring-2 ring-brand-400/25' : ''}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`grid place-items-center h-6 w-6 rounded text-white text-xs font-bold shrink-0 ${isWinner ? 'bg-brand-600' : 'bg-ink-400'}`}>{String.fromCharCode(65 + i)}</span>
                        <span className="font-semibold text-ink-900 text-sm truncate">{v.name}</span>
                      </div>
                      {isWinner ? <Badge color="brand"><Trophy size={12} /> Winner</Badge> : risk && <RiskBadge risk={risk} />}
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <Metric label="Pref share" value={sv?.prefShare} highlight={isWinner} />
                      <Metric label="Top-2 box" value={sv?.top2box} />
                      <Metric label="Comprehension" value={sv?.comprehensionRate} />
                      <Metric label="Apply intent" value={sv?.applyIntent} />
                      <Metric label="Sentiment" value={fg?.sentiment} />
                      <Metric label="Trust" value={fg?.trust} />
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-ink-100 flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-wide font-semibold text-ink-400">Compliance</span>
                      {risk ? <RiskBadge risk={risk} /> : <span className="text-xs text-ink-400">Not screened</span>}
                    </div>
                  </Card>
                )
              })}
            </div>
          </Stagger>

          {/* ---- Charts ---- */}
          <Stagger i={2} className="grid lg:grid-cols-2 gap-5">
            <BarsCard title="Predicted preference share" subtitle="Winner highlighted"
              data={prefData} xKey="name"
              bars={[{ key: 'share', name: 'Pref share %' }]} />
            <RadarCard title="Variant comparison — key metrics" subtitle="Preference, comprehension, apply-intent, sentiment & trust (0–100)"
              data={radarData} series={radarSeries} />
          </Stagger>

          {/* ---- Segment breakdown + intersectional fit ---- */}
          <Stagger i={3} className="card p-5">
            <h3 className="font-bold text-ink-900 flex items-center gap-2"><Users size={17} className="text-brand-600" /> Segment-level breakdown</h3>
            <p className="text-xs text-ink-500 mt-0.5">Which sub-segment prefers which variant, and why.</p>
            <div className="mt-4 space-y-2.5">
              {(reco.segmentBreakdown || []).map((s, i) => {
                const prefersWinner = s.preferredVariantId === reco.winnerId
                return (
                  <div key={i} className="rounded-lg border border-ink-100 p-3.5">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Badge color="violet">{s.segment}</Badge>
                        <span className="text-sm text-ink-500">prefers</span>
                        <span className="text-sm font-semibold text-ink-900">{s.preferredVariant || nameFor(s.preferredVariantId)}</span>
                        {prefersWinner && <Badge color="brand"><Trophy size={11} /> matches winner</Badge>}
                      </div>
                      <span className="chip bg-ink-100 text-ink-700 font-mono">{s.prefShare}% share</span>
                    </div>
                    {s.why && <p className="text-xs text-ink-600 mt-1.5">{s.why}</p>}
                  </div>
                )
              })}
            </div>
            {reco.intersectionalFit && (
              <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-3 text-[13px] text-sky-900">
                <Layers size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Intersectional fit — {targetLabel ? targetLabel.split('.')[0] : 'combined target'}</p>
                  <p className="mt-0.5">{reco.intersectionalFit}</p>
                </div>
              </div>
            )}
          </Stagger>

          {/* ---- Improvements ---- */}
          {reco.improvements?.length > 0 && (
            <Stagger i={4} className="card p-5">
              <h3 className="font-bold text-ink-900 flex items-center gap-2"><Lightbulb size={17} className="text-amber-500" /> Actionable improvements</h3>
              <ul className="mt-3 space-y-2">
                {reco.improvements.map((imp, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-ink-700">
                    <span className="grid place-items-center h-5 w-5 rounded-full bg-amber-50 text-amber-600 shrink-0 mt-0.5"><Lightbulb size={12} /></span>
                    <span>{imp}</span>
                  </li>
                ))}
              </ul>
            </Stagger>
          )}

          {/* ---- Iterate loop ---- */}
          <Stagger i={5} className="card p-5 bg-brand-50/40 border-brand-200">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3 min-w-0">
                <div className="grid place-items-center h-9 w-9 rounded-lg bg-white text-brand-600 border border-brand-200 shrink-0"><RefreshCw size={18} /></div>
                <div>
                  <h3 className="font-bold text-ink-900">Iterate on the winner & re-test</h3>
                  <p className="text-sm text-ink-600 mt-0.5 max-w-2xl">Keeps the winner as a control, generates 2 improved variants, then clears the compliance screen, focus group, survey results, and recommendation so you can run a fresh, fair re-test. You'll be returned to Step 3 to re-screen and re-test.</p>
                </div>
              </div>
              <button className="btn-primary shrink-0" onClick={iterateOnWinner} disabled={iterating}>
                {iterating ? <Spinner /> : <><Wand2 size={15} /> Iterate on winner & re-test</>}
              </button>
            </div>
          </Stagger>

          {/* ---- Exports ---- */}
          <Stagger i={6} className="card p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <div className="grid place-items-center h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600"><ShieldCheck size={18} /></div>
                <div>
                  <h3 className="font-bold text-ink-900">Export the recommendation</h3>
                  <p className="text-xs text-ink-500">One-page report (PDF), scorecards (CSV), and the full recommendation object (JSON).</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary" onClick={printReport}><FileDown size={15} /> Report (PDF)</button>
                <button className="btn-ghost" onClick={() => exportCSV(scorecardRows, `recommendation-scorecards-${project.id}.csv`)}><FileDown size={15} /> Scorecards (CSV)</button>
                <button className="btn-ghost" onClick={() => exportJSON({ project: project.name, target: targetLabel, winner: nameFor(reco.winnerId), ...reco }, `recommendation-${project.id}.json`)}><FileDown size={15} /> Recommendation (JSON)</button>
              </div>
            </div>
          </Stagger>
        </>
      )}

      <SyntheticBanner />
    </div>
  )
}

function Metric({ label, value, highlight }) {
  const has = value != null && value !== ''
  return (
    <div className="rounded-md bg-ink-50 px-2.5 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">{label}</div>
      <div className={`text-lg font-extrabold leading-tight ${highlight ? 'text-brand-600' : 'text-ink-900'}`}>{has ? `${value}%` : '—'}</div>
    </div>
  )
}
