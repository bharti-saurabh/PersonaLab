import React, { useState, useMemo } from 'react'
import { useProject } from '../state/store.jsx'
import { buildSurvey, regenerateSurvey, fieldSurvey, sampleAudience } from '../services/generators.js'
import { hasKey } from '../services/llm.js'
import { getSegment } from '../data/segments.js'
import { SectionTitle, Card, Badge, StatCard, SyntheticBanner, EmptyState, Modal } from '../components/ui.jsx'
import { useStagedGenerate, GenConsole, Stagger, ThinkingPill } from '../components/generate.jsx'
import { PALETTE } from '../components/charts.jsx'
import { exportCSV, exportJSON, exportSurveyCSV, printReport } from '../utils/export.js'
import {
  ClipboardList, Wand2, Play, FileDown, Trash2, Plus, Users, ListChecks, CheckCircle2, Trophy,
  Link2, MessageSquare, RefreshCw, Lightbulb, AlertTriangle, Quote, BarChart3, Sparkles, Pencil,
  Eye, Layers, UserCircle2, Split,
} from 'lucide-react'

const TYPE_META = {
  likert: { label: 'Likert · appeal', color: 'brand' },
  comprehension: { label: 'Comprehension', color: 'amber' },
  maxdiff: { label: 'MaxDiff', color: 'violet' },
  intent: { label: 'Apply intent', color: 'emerald' },
  open: { label: 'Open-end', color: 'ink' },
  rating: { label: 'Rating', color: 'brand' },
}
const SOURCE_META = {
  theme: { label: 'Theme', color: 'brand' },
  objection: { label: 'Objection', color: 'rose' },
  comprehensionGap: { label: 'Comprehension gap', color: 'amber' },
  intent: { label: 'Apply intent', color: 'emerald' },
  comment: { label: 'Your comment', color: 'violet' },
  baseline: { label: 'Diagnostic', color: 'ink' },
}
const ADDABLE = [
  { type: 'likert', label: 'Likert' },
  { type: 'comprehension', label: 'Comprehension' },
  { type: 'intent', label: 'Apply intent' },
  { type: 'open', label: 'Open-end' },
]

// Small CSS-only horizontal distribution bar for a 5-point scale.
function DistBar({ scale, distribution }) {
  const colors = ['#e2e3e7', '#c3cad2', '#7c95ab', '#3d77a6', '#004977']
  return (
    <div>
      <div className="flex h-7 w-full overflow-hidden rounded-md border border-ink-100">
        {distribution.map((p, i) => (
          <div key={i} className="grid place-items-center text-[10px] font-semibold text-white/95 transition-all"
            style={{ width: `${p}%`, background: colors[i], color: i < 2 ? '#5b6470' : '#fff' }} title={`${scale[i]}: ${p}%`}>
            {p >= 9 ? `${p}%` : ''}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-ink-400">
        <span>{scale[0]}</span>
        <span>{scale[scale.length - 1]}</span>
      </div>
    </div>
  )
}

// A thin labeled progress bar (used for comprehension options, maxdiff shares, open themes).
function RowBar({ label, pct, tone = 'brand', icon, sub, count }) {
  const bg = { brand: 'bg-brand-600', emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500', violet: 'bg-violet-500', ink: 'bg-ink-400' }[tone]
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5 text-[13px] text-ink-700">
          {icon}
          <span className="truncate">{label}</span>
          {sub}
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-100">
          <div className={`h-full rounded-full ${bg}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="w-14 shrink-0 text-right">
        <span className="font-mono text-sm font-semibold text-ink-800">{pct}%</span>
        {count != null && <div className="text-[10px] text-ink-400">{count}</div>}
      </div>
    </div>
  )
}

function SourceChip({ source }) {
  if (!source) return null
  const m = SOURCE_META[source.kind] || SOURCE_META.baseline
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-ink-50 px-2 py-1 text-[11px] text-ink-600">
      <Link2 size={11} className="text-ink-400" />
      <span className="font-semibold text-ink-500">{m.label}:</span>
      <span className="truncate max-w-[22rem]">{source.label}</span>
    </span>
  )
}

export default function Step6Survey() {
  const { project, update, settings } = useProject()
  const variants = project.creative.variants
  const instrument = project.survey.instrument || []
  const results = project.survey.results
  const build = useStagedGenerate()
  const regen = useStagedGenerate()
  const field = useStagedGenerate()
  const [comments, setComments] = useState('')
  const [audTab, setAudTab] = useState('split')
  const [personaModal, setPersonaModal] = useState(null)
  const surveySize = project.panel.surveySize ?? 250
  const audience = useMemo(
    () => sampleAudience({ target: project.target, variants, n: surveySize, distribution: project.panel.distribution, previewCount: 8 }),
    [surveySize, variants, project.target, project.panel.distribution]
  )

  const variantName = (id) => variants.find((v) => v.id === id)?.name || id
  const segs = (project.target.segments || []).map((id) => getSegment(id, project.target.custom)).filter(Boolean)
  const fg = project.focusGroup

  if (variants.length < 2) {
    return (
      <div className="space-y-6">
        <SectionTitle icon={ClipboardList} title="Survey & Quantitative Panel"
          subtitle="Turn the focus-group findings into a survey, field it to a synthetic audience, and read the outcome question by question." />
        <Card className="p-2">
          <EmptyState icon={ClipboardList} title="Add creative first"
            children="You need at least two creative variants before you can build and field a survey. Head back to the Creative & Compliance step to add or generate variants." />
        </Card>
      </div>
    )
  }

  // ----- respondents to preview -----
  // Prefer the ACTUAL personas generated in Step 4 (rich, individual profiles — the
  // same people who sat in the focus group), assigning each to one variant cell
  // (between-subjects). Fall back to a lightweight synthetic sample if none exist yet.
  const panelPersonas = project.panel?.personas || []
  const respondents = panelPersonas.length
    ? panelPersonas.map((p, i) => ({ ...p, assignedVariantId: variants[i % variants.length].id, assignedVariantName: variants[i % variants.length].name }))
    : audience.sample

  // ----- focus-group connective tissue (what the questions are built from) -----
  const fgThemes = [...new Set((fg?.perVariant || []).flatMap((v) => v.themes || []))].filter(Boolean)
  const fgObjections = [...new Set((fg?.perVariant || []).flatMap((v) => v.objections || []))].filter(Boolean)
  const fgGaps = (fg?.perVariant || []).flatMap((v) => v.comprehensionGaps || [])

  const setInstrument = (next) => update({ survey: { ...project.survey, instrument: next } })

  const buildInstrument = async () => {
    const inst = await build.run({
      steps: ['Mining focus-group themes…', 'Mapping objections to trust items…', 'Adding material-term comprehension checks…', 'Linking each question to its insight…', 'Finalizing the instrument…'],
      work: async () => buildSurvey({ settings, focusGroup: fg, variants, campaign: project.campaign }),
      minMs: 2200,
    })
    setInstrument(inst)
  }

  const regenerate = async () => {
    if (!comments.trim()) return
    const inst = await regen.run({
      steps: ['Reading your comments…', 'Re-checking focus-group grounding…', 'Revising & adding questions…', 'Re-linking each item to its insight…'],
      work: async () => regenerateSurvey({ settings, instrument, comments: comments.trim(), focusGroup: fg, variants }),
      minMs: 1800,
    })
    setInstrument(inst)
    setComments('')
  }

  const editText = (id, text) => setInstrument(instrument.map((q) => (q.id === id ? { ...q, text } : q)))
  const removeItem = (id) => setInstrument(instrument.filter((q) => q.id !== id))
  const addQuestion = (type) => {
    const base = { id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, type, source: { kind: 'baseline', label: 'Added manually' } }
    const presets = {
      likert: { text: 'How appealing is this offer to you?', scale: ['Not at all', 'Slightly', 'Moderately', 'Very', 'Extremely'] },
      intent: { text: 'How likely are you to apply for this card?', scale: ['Definitely not', 'Probably not', 'Might', 'Probably', 'Definitely'] },
      open: { text: 'What, if anything, would make you more likely to apply?' },
      comprehension: { text: 'After any intro period, the APR on this card is…', options: ['0% forever', 'A variable go-to APR based on creditworthiness', 'Always 9.99%', 'There is no APR'], correctIndex: 1 },
    }
    setInstrument([...instrument, { ...base, ...presets[type] }])
  }

  const setSurveySize = (n) => update({ panel: { ...project.panel, surveySize: Math.max(50, Math.min(1000, Math.round(n) || 250)) } })

  const fieldPanel = async () => {
    const res = await field.run({
      steps: ['Sampling the synthetic audience…', 'Assigning each respondent to one variant (A/B split)…', 'Each respondent answers about their assigned variant…', 'Running the head-to-head preference question…', 'Tabulating per-question distributions…', 'Summarizing key takeaways…'],
      work: async () => fieldSurvey({ settings, instrument, panelSize: surveySize, variants, target: project.target, focusGroup: fg }),
      minMs: 2600,
    })
    update({ survey: { ...project.survey, instrument, results: res } })
  }

  const instrumentChanged = results && results.questions && results.questions.length !== instrument.length

  // ----- results derivations -----
  let topPref, intentLeader, avgComp
  if (results) {
    topPref = [...results.perVariant].sort((a, b) => b.prefShare - a.prefShare)[0]
    intentLeader = [...results.perVariant].sort((a, b) => b.applyIntent - a.applyIntent)[0]
    avgComp = Math.round(results.perVariant.reduce((s, v) => s + v.comprehensionRate, 0) / results.perVariant.length)
  }
  const exportResultsRows = results
    ? results.perVariant.map((v) => ({ variant: variantName(v.variantId), top2box_pct: v.top2box, comprehension_pct: v.comprehensionRate, apply_intent: v.applyIntent, preference_share_pct: v.prefShare }))
    : []

  return (
    <div className="space-y-6">
      <SectionTitle icon={ClipboardList} title="Survey & Quantitative Panel"
        subtitle="Turn the focus-group findings into a survey, field it to a synthetic audience, and read the outcome question by question."
        right={
          <button className="btn-ghost" onClick={buildInstrument} disabled={build.running}>
            {build.running ? <ThinkingPill label="Building" /> : <><Wand2 size={15} /> {hasKey(settings) ? 'Build from focus group' : 'Build from focus group (demo)'}</>}
          </button>
        } />

      {/* Focus-group linkage — the questions are grounded in this */}
      {fg ? (
        <Card className="p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="grid place-items-center h-9 w-9 rounded-lg bg-brand-50 text-brand-600"><Link2 size={18} /></div>
            <div>
              <h3 className="font-bold text-ink-900">Grounded in your focus group</h3>
              <p className="text-xs text-ink-500">Every survey question below traces back to one of these signals from Step 5 — themes you saw land, objections that surfaced, and material terms the panel misread.</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-brand-100 bg-brand-50/40 p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-700"><Sparkles size={13} /> Themes</div>
              <ul className="space-y-1 text-[13px] text-ink-700">
                {(fgThemes.length ? fgThemes : ['—']).slice(0, 4).map((t, i) => <li key={i} className="flex gap-1.5"><span className="text-brand-400">•</span><span>{t}</span></li>)}
              </ul>
            </div>
            <div className="rounded-lg border border-rose-100 bg-rose-50/40 p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-rose-700"><AlertTriangle size={13} /> Objections</div>
              <ul className="space-y-1 text-[13px] text-ink-700">
                {(fgObjections.length ? fgObjections : ['—']).slice(0, 4).map((t, i) => <li key={i} className="flex gap-1.5"><span className="text-rose-400">•</span><span>{t}</span></li>)}
              </ul>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50/40 p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-700"><ListChecks size={13} /> Comprehension gaps</div>
              <ul className="space-y-1 text-[13px] text-ink-700">
                {(fgGaps.length ? fgGaps.map((g) => g.term) : ['None flagged']).slice(0, 4).map((t, i) => <li key={i} className="flex gap-1.5"><span className="text-amber-400">•</span><span>{t}</span></li>)}
              </ul>
            </div>
          </div>
        </Card>
      ) : (
        <div className="flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-[13px] text-sky-900">
          <ListChecks size={16} className="mt-0.5 shrink-0" />
          <p>No focus group yet. You can still build a survey from generic diagnostics — but questions and outcomes are far better anchored once you run the focus group in Step 5.</p>
        </div>
      )}

      {/* Instrument builder (editable) */}
      <Card className="p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="grid place-items-center h-9 w-9 rounded-lg bg-brand-50 text-brand-600"><ListChecks size={18} /></div>
            <div>
              <h3 className="font-bold text-ink-900">Survey questions</h3>
              <p className="text-xs text-ink-500">Edit any question inline, add your own, or regenerate with comments · {instrument.length} item{instrument.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          <button className="btn-primary" onClick={buildInstrument} disabled={build.running}>{build.running ? <ThinkingPill label="Building" /> : <><Wand2 size={15} /> {instrument.length ? 'Rebuild from focus group' : 'Build from focus group'}</>}</button>
        </div>

        {build.running ? (
          <div className="mt-4"><GenConsole lines={build.lines} title="Drafting the survey" subtitle="Linking each question to a focus-group insight" /></div>
        ) : instrument.length === 0 ? (
          <p className="text-sm text-ink-400 mt-4">Build the survey to generate questions grounded in your focus-group themes, objections, and comprehension gaps. You can then edit every question, add your own, and tell the AI how to revise them.</p>
        ) : (
          <>
            <ol className="mt-4 space-y-3">
              {instrument.map((q, i) => {
                const meta = TYPE_META[q.type] || { label: q.type, color: 'ink' }
                const choices = q.options || q.scale || []
                return (
                  <Stagger as="li" key={q.id} i={i} className="rounded-lg border border-ink-100 p-3.5">
                    <div className="flex items-start gap-2.5">
                      <span className="grid place-items-center h-6 w-6 shrink-0 rounded bg-brand-600 text-white text-xs font-bold">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <Badge color={meta.color}>{meta.label}</Badge>
                          {q.type === 'comprehension' && <span className="chip bg-amber-100 text-amber-800">Material-term check</span>}
                          <SourceChip source={q.source} />
                        </div>
                        <div className="group relative flex items-center gap-1.5">
                          <Pencil size={12} className="shrink-0 text-ink-300" />
                          <input value={q.text} onChange={(e) => editText(q.id, e.target.value)}
                            className="w-full bg-transparent text-sm font-medium text-ink-800 outline-none rounded px-1 py-0.5 -ml-1 hover:bg-ink-50 focus:bg-ink-50 focus:ring-1 focus:ring-brand-200" />
                        </div>
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
                        {q.type === 'maxdiff' && choices.length === 0 && <p className="text-xs text-ink-400 mt-1.5 italic">Forced choice across the variant value props (filled at field time).</p>}
                        {q.type === 'open' && <p className="text-xs text-ink-400 mt-1.5 italic">Free-text response — synthesized into themes + verbatims.</p>}
                      </div>
                      <button onClick={() => removeItem(q.id)} className="text-ink-300 hover:text-rose-500 shrink-0"><Trash2 size={15} /></button>
                    </div>
                  </Stagger>
                )
              })}
            </ol>

            {/* Add a question */}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Add</span>
              {ADDABLE.map((a) => (
                <button key={a.type} onClick={() => addQuestion(a.type)} className="btn-subtle text-xs"><Plus size={13} /> {a.label}</button>
              ))}
            </div>

            {/* Comments → regenerate */}
            <div className="mt-4 rounded-lg border border-violet-100 bg-violet-50/40 p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare size={15} className="text-violet-600" />
                <h4 className="text-sm font-bold text-ink-800">Comment & regenerate</h4>
                <span className="text-[11px] text-ink-400">Tell the AI how to revise the questions</span>
              </div>
              {regen.running ? (
                <GenConsole lines={regen.lines} title="Revising the survey" subtitle="Applying your comments, keeping focus-group grounding" />
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2}
                    placeholder="e.g. “Add a question about the annual fee”, “make the trust question simpler”, “fewer open-ends”"
                    className="input flex-1 resize-y text-sm" />
                  <button className="btn-accent h-fit shrink-0" onClick={regenerate} disabled={regen.running || !comments.trim()}>
                    <RefreshCw size={15} /> Regenerate
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </Card>

      {/* Audience size + field */}
      <Card className="p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="grid place-items-center h-9 w-9 rounded-lg bg-violet-50 text-violet-600"><Users size={18} /></div>
          <div>
            <h3 className="font-bold text-ink-900">Synthetic audience</h3>
            <p className="text-xs text-ink-500">This is a <b>between-subjects A/B test</b>: each respondent is assigned <b>one</b> variant and answers the diagnostics about that variant only — everyone answers the final head-to-head preference question. Drawn from your Step 2 segment mix.</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-end">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Audience size</label>
              <span className="text-[11px] font-mono text-ink-400">{surveySize} respondents · ~{Math.round(surveySize / variants.length)} per variant</span>
            </div>
            <div className="flex items-center gap-3">
              <input type="range" min={50} max={1000} step={10} value={surveySize} onChange={(e) => setSurveySize(Number(e.target.value))} className="flex-1 accent-brand-600" />
              <input type="number" min={50} max={1000} value={surveySize} onChange={(e) => setSurveySize(Number(e.target.value))} className="input w-24" />
            </div>
            {segs.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {segs.map((s) => <span key={s.id} className="chip bg-ink-50 text-ink-600">{s.name}</span>)}
              </div>
            )}
            <p className="text-[11px] text-ink-400 mt-1.5">Larger audiences narrow the noise band but remain directional, not real respondents.</p>
          </div>
          <button className="btn-primary h-fit" onClick={fieldPanel} disabled={field.running || instrument.length === 0}>
            {field.running ? <ThinkingPill label="Fielding" /> : <><Play size={15} /> Field to {surveySize} respondents</>}
          </button>
        </div>
        {instrument.length === 0 && <p className="text-xs text-ink-400 mt-3">Build the survey questions first to enable fielding.</p>}
        {instrumentChanged && <p className="text-xs text-amber-600 mt-3 flex items-center gap-1.5"><AlertTriangle size={13} /> Questions changed since the last run — re-field to refresh the outcomes.</p>}

        {/* Assignment + respondent preview */}
        <div className="mt-5 border-t border-ink-100 pt-4">
          <div className="flex items-center gap-1.5 mb-4">
            <button onClick={() => setAudTab('split')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${audTab === 'split' ? 'bg-brand-600 text-white' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'}`}>
              <Split size={14} /> Variant split
            </button>
            <button onClick={() => setAudTab('people')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${audTab === 'people' ? 'bg-brand-600 text-white' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'}`}>
              <Users size={14} /> Respondent preview
            </button>
          </div>

          {audTab === 'split' ? (
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <div className="label mb-2 flex items-center gap-1.5"><Split size={13} /> Variant assignment</div>
                <div className="space-y-2">
                  {audience.cells.map((c, i) => (
                    <div key={c.variantId} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 truncate text-sm text-ink-700">{c.name}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                        <div className="h-full rounded-full" style={{ width: `${Math.round((c.n / audience.total) * 100)}%`, background: PALETTE[i % PALETTE.length] }} />
                      </div>
                      <span className="w-24 shrink-0 text-right font-mono text-sm text-ink-800">{c.n} <span className="text-ink-400">resp.</span></span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-ink-400 mt-2">Each respondent sees exactly one variant — mirroring a real A/B field test, so there's no question of "which creative" a response is about.</p>
              </div>
              <div>
                <div className="label mb-2 flex items-center gap-1.5"><Layers size={13} /> Audience composition</div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 mb-1.5">By segment</div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {audience.composition.bySegment.map((s) => <span key={s.name} className="chip bg-ink-50 text-ink-600">{s.name} · {s.n}</span>)}
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 mb-1.5">By within-segment archetype</div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="chip bg-emerald-50 text-emerald-700">Core · {audience.composition.byArchetype.core}</span>
                  <span className="chip bg-sky-50 text-sky-700">Adjacent · {audience.composition.byArchetype.adjacent}</span>
                  <span className="chip bg-amber-50 text-amber-700">Skeptical · {audience.composition.byArchetype.skeptical}</span>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[11px] text-ink-400 mb-3">
                {panelPersonas.length
                  ? <>The {panelPersonas.length} personas generated for this campaign — the same synthetic people who sat in your focus group. <b>Click any card</b> for the full profile. Each is tagged with the variant it's assigned in this between-subjects test.</>
                  : <>A representative sample of the {audience.total} synthetic respondents — each tagged with the one variant it's assigned. Generate personas in Step 4 to inspect full individual profiles. Illustrative, not real people.</>}
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {respondents.map((p, i) => {
                  const vi = variants.findIndex((v) => v.id === p.assignedVariantId)
                  return (
                    <Stagger key={p.id} i={i} className="rounded-lg border border-ink-100 hover:border-brand-200 hover:shadow-card transition-all">
                      <button type="button" onClick={() => setPersonaModal(p)} className="block w-full text-left p-3">
                        <div className="flex items-center gap-2">
                          <span className="grid place-items-center h-8 w-8 rounded-full bg-ink-100 text-ink-500"><UserCircle2 size={18} /></span>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-ink-900 truncate">{p.name}</div>
                            <div className="text-[11px] text-ink-400">{p.age} · {p.income}{p.archetype ? <span className="capitalize"> · {p.archetype}</span> : null}</div>
                          </div>
                        </div>
                        <p className="text-[11px] text-ink-600 mt-2 leading-snug">{p.segmentFit || p.profile || p.goals}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="chip bg-ink-50 text-ink-500 text-[10px] capitalize">{p.financialLiteracy} literacy</span>
                          <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-white shrink-0" style={{ background: PALETTE[(vi < 0 ? 0 : vi) % PALETTE.length] }}>
                            <Eye size={11} /> {p.assignedVariantName}
                          </span>
                        </div>
                        <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600"><UserCircle2 size={12} /> View full profile</span>
                      </button>
                    </Stagger>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </Card>

      {field.running && <GenConsole lines={field.lines} title="Fielding to the synthetic audience" subtitle={`${surveySize} respondents · ${instrument.length} questions · ${variants.length} variants`} />}

      {/* Results */}
      {results && !field.running && (
        <div className="space-y-5">
          {/* headline */}
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
            <StatCard label="Audience n" value={results.n} sub="synthetic respondents" color="ink" />
            <StatCard label="Top variant (pref. share)" value={`${topPref.prefShare}%`} sub={variantName(topPref.variantId)} color="brand" />
            <StatCard label="Avg comprehension" value={`${avgComp}%`} sub="material-term checks" color="emerald" />
            <StatCard label="Apply-intent leader" value={`${intentLeader.applyIntent}`} sub={variantName(intentLeader.variantId)} color="amber" />
          </div>

          {/* Key takeaways */}
          {results.takeaways?.length > 0 && (
            <Card className="p-5 border-brand-100">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="grid place-items-center h-9 w-9 rounded-lg bg-amber-50 text-amber-600"><Lightbulb size={18} /></div>
                <div>
                  <h3 className="font-bold text-ink-900">Key takeaways</h3>
                  <p className="text-xs text-ink-500">What the survey says — read straight off the per-question outcomes below.</p>
                </div>
              </div>
              <ul className="space-y-2">
                {results.takeaways.map((t, i) => {
                  const warn = /^⚠/.test(t)
                  return (
                    <Stagger as="li" key={i} i={i} className={`flex items-start gap-2.5 rounded-lg border p-3 text-sm ${warn ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-ink-100 bg-ink-50/50 text-ink-700'}`}>
                      <span className={`mt-0.5 shrink-0 ${warn ? 'text-amber-600' : 'text-brand-500'}`}>{warn ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}</span>
                      <span>{warn ? t.replace(/^⚠\s*/, '') : t}</span>
                    </Stagger>
                  )
                })}
              </ul>
            </Card>
          )}

          {/* Per-question outcomes */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={17} className="text-brand-600" />
              <h3 className="font-bold text-ink-900">Question-by-question outcomes</h3>
              <span className="text-xs text-ink-400">Between-subjects · diagnostics within each variant's cell{results.cells?.[0] ? ` (~${results.cells[0].n}/variant)` : ''}</span>
            </div>
            <div className="space-y-4">
              {(results.questions || []).map((q, i) => <QuestionResult key={q.id} q={q} idx={i} variantName={variantName} />)}
            </div>
          </div>

          {/* Preference share + ranking — one card, one insight (from the head-to-head question) */}
          <Card className="p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="grid place-items-center h-9 w-9 rounded-lg bg-amber-50 text-amber-600"><Trophy size={18} /></div>
              <div>
                <h3 className="font-bold text-ink-900">Preference share &amp; ranking</h3>
                <p className="text-xs text-ink-500">From the head-to-head question every respondent answered — this is what feeds the Step 7 recommendation.</p>
              </div>
            </div>
            <ol className="space-y-2.5">
              {results.ranking.map((id, i) => {
                const pv = results.perVariant.find((v) => v.variantId === id)
                const share = pv?.prefShare ?? 0
                return (
                  <Stagger as="li" key={id} i={i} className="flex items-center gap-3">
                    <span className={`grid place-items-center h-6 w-6 shrink-0 rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-500 text-white' : 'bg-ink-100 text-ink-600'}`}>{i + 1}</span>
                    <span className="w-44 shrink-0 truncate flex items-center gap-1.5 font-semibold text-ink-900 text-sm">{variantName(id)}{i === 0 && <Badge color="emerald">Leader</Badge>}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                      <div className="h-full rounded-full" style={{ width: `${share}%`, background: PALETTE[i % PALETTE.length] }} />
                    </div>
                    <span className="w-12 shrink-0 text-right text-sm font-mono font-semibold text-ink-800">{share}%</span>
                  </Stagger>
                )
              })}
            </ol>
          </Card>

          {/* Exports */}
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

      <Modal open={!!personaModal} onClose={() => setPersonaModal(null)} title="Respondent profile" wide>
        {personaModal && <PersonaDossier p={personaModal} variants={variants} />}
      </Modal>

      <SyntheticBanner />
    </div>
  )
}

// ---- full persona dossier shown in the respondent modal ----
function PersonaDossier({ p, variants }) {
  const vi = variants.findIndex((v) => v.id === p.assignedVariantId)
  const cap = (s) => (s ? `${s[0].toUpperCase()}${s.slice(1)}` : s)
  const archColor = { core: 'emerald', adjacent: 'sky', skeptical: 'amber' }[p.archetype] || 'ink'
  const wide = new Set(['Goals', 'How they talk', 'Segment fit', 'Decision style'])
  const rows = [
    ['Age', p.age],
    ['Income', p.income],
    ['Financial literacy', cap(p.financialLiteracy)],
    ['Media habits', p.mediaHabits],
    ['Decision style', p.decisionStyle],
    ['Key objection', p.keyObjection],
    ['Goals', p.goals],
    ['How they talk', p.voice],
    ['Segment fit', p.segmentFit || p.profile],
  ].filter(([, v]) => v != null && v !== '')
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="grid place-items-center h-12 w-12 rounded-full bg-brand-50 text-brand-600"><UserCircle2 size={26} /></span>
        <div className="min-w-0">
          <div className="text-base font-bold text-ink-900">{p.name}</div>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            {p.archetype && <Badge color={archColor}>{cap(p.archetype)} member</Badge>}
            {p.segment && <span className="chip bg-ink-50 text-ink-600">{p.segment}</span>}
            {p.assignedVariantName && (
              <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: PALETTE[(vi < 0 ? 0 : vi) % PALETTE.length] }}>
                <Eye size={11} /> Sees {p.assignedVariantName}
              </span>
            )}
          </div>
        </div>
      </div>
      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
        {rows.map(([k, v]) => (
          <div key={k} className={wide.has(k) ? 'sm:col-span-2' : ''}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{k}</dt>
            <dd className="text-sm text-ink-800 mt-0.5">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[11px] text-ink-400 border-t border-ink-100 pt-3">Synthetic persona — a directional, illustrative profile generated for this campaign, not a real person.</p>
    </div>
  )
}

// ---- one result card per question, shaped by question type ----
function QuestionResult({ q, idx, variantName }) {
  const meta = TYPE_META[q.type] || { label: q.type, color: 'ink' }
  return (
    <Stagger i={idx} className="rounded-xl border border-ink-100 bg-white p-4">
      <div className="flex items-start gap-2.5 mb-3">
        <span className="grid place-items-center h-6 w-6 shrink-0 rounded bg-ink-100 text-ink-600 text-xs font-bold">{idx + 1}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-900">{q.text}</p>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <Badge color={q.preference ? 'violet' : meta.color}>{q.preference ? 'Head-to-head preference' : meta.label}</Badge>
            <span className="chip bg-ink-50 text-ink-500 text-[10px]">{q.preference ? 'Asked of all respondents' : 'Asked within each variant cell'}</span>
            <SourceChip source={q.source} />
          </div>
        </div>
      </div>

      {(q.type === 'likert' || q.type === 'intent' || q.type === 'rating') && (
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="flex-1"><DistBar scale={q.scale} distribution={q.distribution} /></div>
            <div className="shrink-0 text-center">
              <div className="text-2xl font-extrabold text-brand-700 leading-none">{q.top2box}%</div>
              <div className="text-[10px] uppercase tracking-wide text-ink-400 mt-0.5">Top-2-box</div>
              <div className="text-[11px] text-ink-500 mt-0.5">mean {q.mean}</div>
            </div>
          </div>
          {q.byVariant?.length > 1 && (
            <div className="space-y-1.5 pt-1">
              {q.byVariant.map((bv, i) => (
                <RowBar key={bv.variantId} label={bv.name} pct={bv.top2box} tone={i === 0 ? 'brand' : 'violet'} count={bv.n != null ? `n=${bv.n}` : undefined}
                  sub={<span className="text-[11px] text-ink-400">· top-2-box</span>} />
              ))}
            </div>
          )}
        </div>
      )}

      {q.type === 'comprehension' && (
        <div className="space-y-3">
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${q.flagged ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
            {q.flagged ? <AlertTriangle size={15} className="shrink-0" /> : <CheckCircle2 size={15} className="shrink-0" />}
            <span>
              <b>{q.correctPct}%</b> answered correctly overall
              {q.flagged
                ? `${q.worstVariant && q.worstVariant.correctPct < 70 ? ` — but only ${q.worstVariant.correctPct}% on ${q.worstVariant.name}` : ''}, below the 70% bar. Misreading ${q.term} is both a conversion risk and a compliance signal.`
                : ' — the material term is landing.'}
            </span>
          </div>
          <div className="space-y-2">
            {q.byOption.map((o, i) => (
              <RowBar key={i} label={o.label} pct={o.pct} count={q.counts?.[i]}
                tone={o.correct ? 'emerald' : o.misread ? 'amber' : 'ink'}
                icon={o.correct ? <CheckCircle2 size={13} className="shrink-0 text-emerald-600" /> : o.misread ? <AlertTriangle size={13} className="shrink-0 text-amber-500" /> : null}
                sub={o.misread ? <span className="chip bg-amber-100 text-amber-800 text-[10px]">common misread</span> : null} />
            ))}
          </div>
          {q.byVariant?.length > 1 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {q.byVariant.map((bv) => (
                <span key={bv.variantId} className={`chip ${bv.correctPct < 70 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{bv.name}: {bv.correctPct}% correct</span>
              ))}
            </div>
          )}
        </div>
      )}

      {q.type === 'maxdiff' && (
        <div className="space-y-2">
          {q.preference && <p className="text-[11px] text-ink-400 -mt-1 mb-1">Forced choice across the variants — the share each won is the preference share that feeds the recommendation.</p>}
          {[...q.shares].sort((a, b) => b.pct - a.pct).map((s, i) => (
            <RowBar key={s.variantId || i} label={s.label} pct={s.pct} count={q.counts?.[q.shares.indexOf(s)]}
              tone={i === 0 ? 'violet' : 'ink'}
              sub={s.name ? <span className="text-[11px] text-ink-400">· {s.name}</span> : null} />
          ))}
        </div>
      )}

      {q.type === 'open' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wide text-ink-400">Top themes mentioned</div>
            {q.themes.map((t, i) => <RowBar key={i} label={t.label} pct={t.pct} tone="rose" />)}
          </div>
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wide text-ink-400">Representative responses</div>
            {q.verbatims.map((v, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg bg-ink-50 px-3 py-2 text-[13px] text-ink-700">
                <Quote size={14} className="mt-0.5 shrink-0 text-ink-300" />
                <span className="italic">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Stagger>
  )
}
