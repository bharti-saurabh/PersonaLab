import React from 'react'
import { useProject } from '../state/store.jsx'
import { buildSurvey, fieldSurvey } from '../services/generators.js'
import { hasKey } from '../services/llm.js'
import { getSegment } from '../data/segments.js'
import { SectionTitle, Card, Badge, StatCard, SyntheticBanner, EmptyState } from '../components/ui.jsx'
import { useStagedGenerate, GenConsole, Stagger, ThinkingPill } from '../components/generate.jsx'
import { BarsCard, DonutCard, PALETTE } from '../components/charts.jsx'
import { exportCSV, exportJSON, exportSurveyCSV, printReport } from '../utils/export.js'
import { ClipboardList, Wand2, Play, FileDown, Trash2, Plus, Users, ListChecks, CheckCircle2, Trophy } from 'lucide-react'

const TYPE_META = {
  likert: { label: 'Likert', color: 'brand' },
  comprehension: { label: 'Comprehension', color: 'amber' },
  maxdiff: { label: 'MaxDiff', color: 'violet' },
  intent: { label: 'Apply intent', color: 'emerald' },
  open: { label: 'Open-end', color: 'ink' },
}

export default function Step6Survey() {
  const { project, update, settings } = useProject()
  const variants = project.creative.variants
  const instrument = project.survey.instrument || []
  const results = project.survey.results
  const build = useStagedGenerate()
  const field = useStagedGenerate()

  const variantName = (id) => variants.find((v) => v.id === id)?.name || id
  const segs = (project.target.segments || []).map((id) => getSegment(id, project.target.custom)).filter(Boolean)

  if (variants.length < 2) {
    return (
      <div className="space-y-6">
        <SectionTitle icon={ClipboardList} title="Survey & Quantitative Panel"
          subtitle="Auto-generate a survey instrument from the focus-group themes, then field it to a larger synthetic panel." />
        <Card className="p-2">
          <EmptyState icon={ClipboardList} title="Add creative first"
            children="You need at least two creative variants before you can build and field a survey. Head back to the Creative & Compliance step to add or generate variants." />
        </Card>
      </div>
    )
  }

  const buildInstrument = async () => {
    const inst = await build.run({
      steps: [
        'Mining focus-group themes…',
        'Drafting comprehension & trust items…',
        'Adding apply-intent & objection questions…',
        'Balancing scales & ordering…',
        'Finalizing the instrument…',
      ],
      work: async () => buildSurvey({ settings, focusGroup: project.focusGroup, variants }),
      minMs: 2400,
    })
    update({ survey: { ...project.survey, instrument: inst } })
  }

  const removeItem = (id) => update({ survey: { ...project.survey, instrument: instrument.filter((q) => q.id !== id) } })

  const addOpenEnd = () => {
    const item = { id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, type: 'open', text: 'What, if anything, would make you more likely to apply?' }
    update({ survey: { ...project.survey, instrument: [...instrument, item] } })
  }

  const setSurveySize = (n) => {
    const size = Math.max(50, Math.min(500, Math.round(n) || 250))
    update({ panel: { ...project.panel, surveySize: size } })
  }

  const fieldPanel = async () => {
    const res = await field.run({
      steps: [
        'Sampling the synthetic survey panel…',
        `Presenting variants to ${project.panel.surveySize} respondents…`,
        'Collecting ratings & choices…',
        'Tabulating top-2-box & preference share…',
        'Computing significance & cross-breaks…',
      ],
      work: async () => fieldSurvey({
        settings,
        instrument,
        panelSize: project.panel.surveySize,
        variants,
        target: project.target,
        focusGroup: project.focusGroup,
      }),
      minMs: 2600,
    })
    update({ survey: { instrument, results: res } })
  }

  const surveySize = project.panel.surveySize ?? 250

  // ---- results derivations ----
  let topPref, intentLeader, avgComp
  if (results) {
    topPref = [...results.perVariant].sort((a, b) => b.prefShare - a.prefShare)[0]
    intentLeader = [...results.perVariant].sort((a, b) => b.applyIntent - a.applyIntent)[0]
    avgComp = Math.round(results.perVariant.reduce((s, v) => s + v.comprehensionRate, 0) / results.perVariant.length)
  }

  const top2Data = results ? results.perVariant.map((v) => ({ name: variantName(v.variantId), value: v.top2box })) : []
  const prefData = results ? results.perVariant.map((v) => ({ name: variantName(v.variantId), value: v.prefShare })) : []
  const compData = results ? results.perVariant.map((v) => ({ name: variantName(v.variantId), value: v.comprehensionRate })) : []
  const prefDonut = results ? results.perVariant.map((v, i) => ({ name: variantName(v.variantId), value: v.prefShare, color: PALETTE[i % PALETTE.length] })) : []

  // Apply-intent by segment: rows = segments, one bar series per variant.
  const segmentBars = results ? results.perVariant.map((v, i) => ({ key: v.variantId, name: variantName(v.variantId), color: PALETTE[i % PALETTE.length] })) : []
  const segmentData = results
    ? segs.map((s) => {
        const row = { name: s.name }
        results.perVariant.forEach((v) => {
          const bySeg = v.bySegment.find((b) => b.segment === s.name)
          row[v.variantId] = bySeg ? bySeg.applyIntent : 0
        })
        return row
      })
    : []

  const exportResultsRows = results
    ? results.perVariant.map((v) => ({
        variant: variantName(v.variantId),
        top2box_pct: v.top2box,
        comprehension_pct: v.comprehensionRate,
        apply_intent: v.applyIntent,
        preference_share_pct: v.prefShare,
      }))
    : []

  return (
    <div className="space-y-6">
      <SectionTitle icon={ClipboardList} title="Survey & Quantitative Panel"
        subtitle="Auto-generate a survey instrument from the focus-group themes, then field it to a larger synthetic panel."
        right={
          <button className="btn-ghost" onClick={buildInstrument} disabled={build.running}>
            {build.running ? <ThinkingPill label="Building" /> : <><Wand2 size={15} /> {hasKey(settings) ? 'Build survey' : 'Build survey (demo)'}</>}
          </button>
        } />

      {!project.focusGroup && (
        <div className="flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-[13px] text-sky-900">
          <ListChecks size={16} className="mt-0.5 shrink-0" />
          <p>No focus group yet. You can still build and field a survey — but results are richer and better anchored once you run the focus group in Step 5.</p>
        </div>
      )}

      {/* Instrument builder */}
      <Card className="p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="grid place-items-center h-9 w-9 rounded-lg bg-brand-50 text-brand-600"><ListChecks size={18} /></div>
            <div>
              <h3 className="font-bold text-ink-900">Survey instrument</h3>
              <p className="text-xs text-ink-500">Likert appeal, comprehension checks on material terms, MaxDiff value-prop, and apply-intent · {instrument.length} item{instrument.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={buildInstrument} disabled={build.running}>{build.running ? <ThinkingPill label="Building" /> : <><Wand2 size={15} /> Build survey instrument</>}</button>
            {instrument.length > 0 && <button className="btn-ghost" onClick={addOpenEnd}><Plus size={15} /> Add open-end</button>}
          </div>
        </div>

        {build.running ? (
          <div className="mt-4">
            <GenConsole lines={build.lines} title="Drafting the survey instrument"
              subtitle="Grounding quantitative items in your focus-group themes" />
          </div>
        ) : instrument.length === 0 ? (
          <p className="text-sm text-ink-400 mt-4">Build the instrument to generate quantitative items grounded in your focus-group themes. Each item maps to a standard survey type that imports into Qualtrics / SurveyMonkey-style tools.</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {instrument.map((q, i) => {
              const meta = TYPE_META[q.type] || { label: q.type, color: 'ink' }
              const choices = q.options || q.scale || []
              return (
                <Stagger as="li" key={q.id} i={i} className="rounded-lg border border-ink-100 p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="grid place-items-center h-6 w-6 shrink-0 rounded bg-brand-600 text-white text-xs font-bold">{i + 1}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge color={meta.color}>{meta.label}</Badge>
                          {q.type === 'comprehension' && <span className="chip bg-amber-100 text-amber-800">Material-term check</span>}
                        </div>
                        <p className="text-sm font-medium text-ink-800">{q.text}</p>
                        {choices.length > 0 && (
                          <ul className="mt-2 grid sm:grid-cols-2 gap-1.5">
                            {choices.map((opt, oi) => {
                              const correct = q.type === 'comprehension' && q.correctIndex === oi
                              return (
                                <li key={oi} className={`text-xs rounded-md px-2.5 py-1.5 flex items-center gap-1.5 ${correct ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-ink-50 text-ink-600'}`}>
                                  {correct && <CheckCircle2 size={13} className="shrink-0 text-emerald-600" />}
                                  <span className="truncate">{opt}</span>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                        {choices.length === 0 && q.type === 'open' && <p className="text-xs text-ink-400 mt-1.5 italic">Free-text response.</p>}
                      </div>
                    </div>
                    <button onClick={() => removeItem(q.id)} className="text-ink-300 hover:text-rose-500 shrink-0"><Trash2 size={15} /></button>
                  </div>
                </Stagger>
              )
            })}
          </ol>
        )}
      </Card>

      {/* Panel size + field */}
      <Card className="p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="grid place-items-center h-9 w-9 rounded-lg bg-violet-50 text-violet-600"><Users size={18} /></div>
          <div>
            <h3 className="font-bold text-ink-900">Synthetic quant panel</h3>
            <p className="text-xs text-ink-500">Field the instrument to a larger synthetic panel to read appeal, comprehension, apply-intent, and preference share — by segment.</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-end">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Panel size</label>
              <span className="text-[11px] font-mono text-ink-400">{surveySize} / 500</span>
            </div>
            <div className="flex items-center gap-3">
              <input type="range" min={50} max={500} step={10} value={surveySize} onChange={(e) => setSurveySize(Number(e.target.value))} className="flex-1 accent-brand-600" />
              <input type="number" min={50} max={500} value={surveySize} onChange={(e) => setSurveySize(Number(e.target.value))} className="input w-24" />
            </div>
            <p className="text-[11px] text-ink-400 mt-1.5">Larger panels narrow the noise band but remain directional, not real respondents.</p>
          </div>
          <button className="btn-primary h-fit" onClick={fieldPanel} disabled={field.running || instrument.length === 0}>
            {field.running ? <ThinkingPill label="Fielding" /> : <><Play size={15} /> Field to synthetic panel</>}
          </button>
        </div>
        {instrument.length === 0 && <p className="text-xs text-ink-400 mt-3">Build the survey instrument first to enable fielding.</p>}
      </Card>

      {/* Fielding console */}
      {field.running && (
        <GenConsole lines={field.lines} title="Fielding to the synthetic panel"
          subtitle={`${surveySize} synthetic respondents · ${variants.length} variants`} />
      )}

      {/* Results dashboard */}
      {results && !field.running && (
        <div className="space-y-5">
          {topPref && (
            <Stagger i={0} className="rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 to-white p-4 flex items-center gap-3">
              <span className="grid place-items-center h-11 w-11 rounded-xl bg-brand-600 text-white shrink-0"><Trophy size={20} /></span>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">Preference-share leader</div>
                <div className="text-ink-900 font-bold leading-tight">{variantName(topPref.variantId)} <span className="text-ink-400 font-normal">· {topPref.prefShare}% preference share</span></div>
              </div>
              <span className="ml-auto shrink-0"><Badge color="amber">Directional — validate in Step 8</Badge></span>
            </Stagger>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Panel n" value={results.n} sub="synthetic respondents" color="ink" />
            <StatCard label="Top variant (pref. share)" value={`${topPref.prefShare}%`} sub={variantName(topPref.variantId)} color="brand" />
            <StatCard label="Avg comprehension" value={`${avgComp}%`} sub="across variants" color="emerald" />
            <StatCard label="Apply-intent leader" value={`${intentLeader.applyIntent}`} sub={variantName(intentLeader.variantId)} color="amber" />
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <BarsCard title="Top-2-box appeal" subtitle="% rating the offer Very / Extremely appealing"
              data={top2Data} xKey="name" bars={[{ key: 'value', name: 'Top-2-box %', color: PALETTE[0] }]} />
            <DonutCard title="Preference share" subtitle="Share of preference across variants" data={prefDonut} />
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <BarsCard title="Preference share by variant" subtitle="% preferring each variant"
              data={prefData} xKey="name" bars={[{ key: 'value', name: 'Preference share %', color: PALETTE[3] }]} />
            <BarsCard title="Comprehension rate" subtitle="% answering material-term checks correctly"
              data={compData} xKey="name" bars={[{ key: 'value', name: 'Comprehension %', color: PALETTE[1] }]} />
          </div>

          {segs.length > 0 && segmentBars.length > 0 && (
            <BarsCard title="Apply-intent by segment" subtitle="Apply-intent score per variant, cut by target segment"
              data={segmentData} xKey="name" bars={segmentBars} height={300} />
          )}

          <Card className="p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="grid place-items-center h-9 w-9 rounded-lg bg-amber-50 text-amber-600"><Trophy size={18} /></div>
              <div>
                <h3 className="font-bold text-ink-900">Variant ranking</h3>
                <p className="text-xs text-ink-500">Ordered by predicted preference share across the panel.</p>
              </div>
            </div>
            <ol className="space-y-2">
              {results.ranking.map((id, i) => {
                const pv = results.perVariant.find((v) => v.variantId === id)
                return (
                  <Stagger as="li" key={id} i={i} className="flex items-center justify-between rounded-lg border border-ink-100 px-3.5 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className={`grid place-items-center h-6 w-6 rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-500 text-white' : 'bg-ink-100 text-ink-600'}`}>{i + 1}</span>
                      <span className="font-semibold text-ink-900 text-sm">{variantName(id)}</span>
                      {i === 0 && <Badge color="emerald">Leader</Badge>}
                    </div>
                    <span className="text-sm font-mono text-ink-700">{pv?.prefShare}%</span>
                  </Stagger>
                )
              })}
            </ol>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-bold text-ink-900 text-sm">Exports</h3>
                <p className="text-xs text-ink-500">Export the instrument for real fielding, plus the synthetic results.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-ghost" onClick={() => exportSurveyCSV(instrument, 'survey-instrument.csv')}><FileDown size={15} /> Survey for real fielding (CSV)</button>
                <button className="btn-ghost" onClick={() => exportCSV(exportResultsRows, `survey-results-${project.id}.csv`)}><FileDown size={15} /> Results (CSV)</button>
                <button className="btn-ghost" onClick={() => exportJSON(results, `survey-results-${project.id}.json`)}><FileDown size={15} /> Results (JSON)</button>
                <button className="btn-ghost" onClick={printReport}><FileDown size={15} /> Print report (PDF)</button>
              </div>
            </div>
            <p className="text-[11px] text-ink-400 mt-3">The survey CSV imports into Qualtrics / SurveyMonkey-style tools so you can field the same instrument to real respondents.</p>
          </Card>
        </div>
      )}

      {/* Exports available before results too (instrument only) */}
      {!results && instrument.length > 0 && !field.running && (
        <Card className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-ink-900 text-sm">Export survey for real fielding</h3>
              <p className="text-xs text-ink-500">Download the instrument as a CSV that imports into Qualtrics / SurveyMonkey-style tools.</p>
            </div>
            <button className="btn-ghost" onClick={() => exportSurveyCSV(instrument, 'survey-instrument.csv')}><FileDown size={15} /> Survey instrument (CSV)</button>
          </div>
        </Card>
      )}

      <SyntheticBanner />
    </div>
  )
}
