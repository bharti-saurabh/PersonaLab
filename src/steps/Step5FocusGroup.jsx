import React, { useState, useEffect, useMemo } from 'react'
import { useProject } from '../state/store.jsx'
import { runFocusGroup, steerFocusGroup } from '../services/generators.js'
import { hasKey } from '../services/llm.js'
import { SectionTitle, Card, Badge, RiskBadge, StatCard, SyntheticBanner, EmptyState, Toggle } from '../components/ui.jsx'
import { useStagedGenerate, GenConsole, Stagger, ThinkingPill } from '../components/generate.jsx'
import { RadarCard, BarsCard, PALETTE } from '../components/charts.jsx'
import { exportCSV, exportJSON, printReport } from '../utils/export.js'
import {
  MessagesSquare, Wand2, AlertTriangle, FileDown, Quote, MessageCircle, ShieldCheck,
  BookOpen, Sparkles, TrendingUp, Trophy, Play, Send, ListChecks, Users, Megaphone,
  CornerDownRight, ArrowRight, RotateCcw, Gauge,
} from 'lucide-react'

const INTENT_COLOR = { 'would apply': 'emerald', 'might apply': 'amber', 'would not apply': 'rose' }

const AGENDA = [
  { icon: Sparkles, label: 'First impressions & emotional response' },
  { icon: ShieldCheck, label: 'Trust & credibility of the offer' },
  { icon: BookOpen, label: 'Comprehension of material terms (APR, fees, intro period)' },
  { icon: AlertTriangle, label: 'Objections & points of confusion' },
  { icon: TrendingUp, label: 'Apply intent & what would move it' },
]

const STEER_SUGGESTIONS = [
  'Push them harder on the annual fee',
  'Probe trust — does it feel like there’s a catch?',
  'Test comprehension of the APR after the intro period',
  'Focus on what would make them actually apply',
]

const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)))
function avg(arr) { return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0 }
function scoreColor(v) { return v >= 67 ? 'emerald' : v >= 40 ? 'amber' : 'rose' }
function scoreRisk(v) { return v >= 67 ? 'low' : v >= 40 ? 'medium' : 'high' }

function summarize(entries, pv, variants) {
  const counts = { 'would apply': 0, 'might apply': 0, 'would not apply': 0 }
  entries.forEach((e) => { counts[e.intentLabel] = (counts[e.intentLabel] || 0) + 1 })
  const seenIds = uniq(entries.map((e) => e.variantId))
  const seenPv = pv.filter((v) => seenIds.includes(v.variantId))
  const themes = uniq(seenPv.flatMap((v) => v.themes || [])).slice(0, 5)
  const objections = uniq(seenPv.flatMap((v) => v.objections || [])).slice(0, 4)
  const gaps = uniq(seenPv.flatMap((v) => (v.comprehensionGaps || []).map((g) => g.term)))
  const total = entries.length
  const lean = !total ? '—'
    : counts['would apply'] >= counts['might apply'] && counts['would apply'] >= counts['would not apply'] ? 'Leaning apply'
    : counts['would not apply'] > counts['would apply'] ? 'Leaning away'
    : 'Mixed / cautious'
  return { counts, themes, objections, gaps, total, lean, variantsSeen: seenIds.length }
}

export default function Step5FocusGroup() {
  const { project, update, settings } = useProject()
  const personas = project.panel.personas
  const variants = project.creative.variants
  const fg = project.focusGroup

  const gen = useStagedGenerate()
  const [phase, setPhase] = useState(fg ? 'done' : 'setup') // setup | live | done
  const [groupDynamics, setGroupDynamics] = useState(fg?.groupDynamics ?? true)
  const [redTeam, setRedTeam] = useState(fg?.redTeam ?? true)

  const [fullTranscript, setFullTranscript] = useState(fg?.transcript || [])
  const [perVariant, setPerVariant] = useState(fg?.perVariant || [])
  const [shown, setShown] = useState(fg ? (fg.transcript?.length || 0) : 0)
  const [steerLog, setSteerLog] = useState(fg?.steerLog || [])
  const [steerText, setSteerText] = useState('')
  const [steering, setSteering] = useState(false)

  const ready = personas.length > 0 && variants.length >= 2
  const variantName = (id) => variants.find((v) => v.id === id)?.name || 'Variant'
  const variantIndex = (id) => Math.max(0, variants.findIndex((v) => v.id === id))

  // Stream the transcript in one entry at a time while live.
  useEffect(() => {
    if (phase !== 'live' || shown >= fullTranscript.length) return
    const t = setTimeout(() => setShown((s) => s + 1), 650)
    return () => clearTimeout(t)
  }, [phase, shown, fullTranscript.length])

  const streaming = phase === 'live' && shown < fullTranscript.length
  const shownEntries = useMemo(() => fullTranscript.slice(0, shown), [fullTranscript, shown])
  const summary = useMemo(() => summarize(shownEntries, perVariant, variants), [shownEntries, perVariant, variants])

  const initiate = async () => {
    const out = await gen.run({
      steps: [
        'Seating the synthetic panel…',
        'Moderator opening the discussion…',
        `Personas reacting in character${redTeam ? ' (incl. red-team reviewers)' : ''}…`,
        'Probing trust & material-term comprehension…',
        groupDynamics ? 'Letting the group agree & push back…' : 'Capturing individual reactions…',
      ],
      work: async () => runFocusGroup({ settings, personas, variants, campaign: project.campaign, options: { groupDynamics } }),
      minMs: 2200,
    })
    setPerVariant(out.perVariant)
    setFullTranscript(out.transcript)
    setSteerLog([])
    setShown(0)
    setPhase('live')
  }

  const onSteer = async () => {
    const d = steerText.trim()
    if (!d || steering) return
    setSteering(true)
    try {
      const add = await steerFocusGroup({ settings, directive: d, personas, variants, campaign: project.campaign })
      if (add.length) {
        setFullTranscript((t) => [...t, ...add])
        setSteerLog((l) => [...l, d])
      }
    } finally {
      setSteering(false)
      setSteerText('')
    }
  }

  const conclude = () => {
    setShown(fullTranscript.length)
    update({ focusGroup: { transcript: fullTranscript, perVariant, groupDynamics, redTeam, steerLog } })
    setPhase('done')
  }

  const rerun = () => { setPhase('setup'); setShown(0) }

  const exportTranscript = () => {
    const rows = (fullTranscript || []).map((t) => ({ variant: variantName(t.variantId), persona: t.personaName, intent: t.intentLabel, steer: t.steer || '', reaction: t.text }))
    exportCSV(rows, `focus-group-transcript-${project.id}.csv`)
  }
  const exportSynthesis = () => exportJSON({ groupDynamics, redTeam, steerLog, perVariant }, `focus-group-synthesis-${project.id}.json`)

  if (!ready) {
    return (
      <div className="space-y-6">
        <SectionTitle icon={MessagesSquare} title="Synthetic Focus Group"
          subtitle="A moderator agent runs a structured discussion; personas react in character to each variant." />
        <Card className="p-2">
          <EmptyState icon={MessagesSquare} title="Complete personas and creative first">
            {personas.length === 0
              ? 'Build a synthetic persona panel in Step 4, then add at least two creative variants in Step 3.'
              : 'Add at least two creative variants in Step 3 so the group has something to compare.'}
          </EmptyState>
        </Card>
      </div>
    )
  }

  const pv = perVariant
  const sentimentLeader = pv.length ? [...pv].sort((a, b) => b.intentScore - a.intentScore)[0] : null

  // ---- Build the chronological live feed with moderator context headers ----
  const feed = []
  {
    let prevVariant = null, prevSteer = null
    shownEntries.forEach((e, i) => {
      if (e.steer) {
        if (e.steer !== prevSteer) { feed.push({ type: 'steer', directive: e.steer, key: `s${i}` }); prevSteer = e.steer; prevVariant = null }
      } else if (e.variantId !== prevVariant) {
        feed.push({ type: 'variant', variantId: e.variantId, key: `v${i}` }); prevVariant = e.variantId; prevSteer = null
      }
      feed.push({ type: 'line', e, key: `l${i}` })
    })
  }

  return (
    <div className="space-y-6">
      <SectionTitle icon={MessagesSquare} title="Synthetic Focus Group"
        subtitle="A moderator agent runs a structured discussion; personas react in character, you can steer, then we synthesize the signal."
        right={
          phase === 'done' && (
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={exportTranscript}><FileDown size={15} /> Transcript (CSV)</button>
              <button className="btn-ghost" onClick={exportSynthesis}><FileDown size={15} /> Synthesis (JSON)</button>
              <button className="btn-ghost" onClick={printReport}><FileDown size={15} /> Print (PDF)</button>
            </div>
          )
        } />

      {/* ============ SETUP — agenda + decisions ============ */}
      {phase === 'setup' && (
        <>
          <div className="grid lg:grid-cols-3 gap-5">
            <Card className="p-5 lg:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <ListChecks size={17} className="text-brand-600" />
                <h3 className="font-bold text-ink-900">Discussion agenda</h3>
                <Badge color="brand" className="ml-1">{AGENDA.length} topics</Badge>
              </div>
              <p className="text-xs text-ink-400 mb-4">The moderator will guide the panel through these topics in order. You can steer the conversation live once it’s underway.</p>
              <ol className="space-y-2.5">
                {AGENDA.map((a, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="grid place-items-center h-7 w-7 rounded-lg bg-brand-50 text-brand-600 text-xs font-bold shrink-0">{i + 1}</span>
                    <a.icon size={15} className="text-ink-400 shrink-0" />
                    <span className="text-sm text-ink-700">{a.label}</span>
                  </li>
                ))}
              </ol>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Gauge size={17} className="text-brand-600" />
                <h3 className="font-bold text-ink-900">Key decisions</h3>
              </div>
              <div className="space-y-3">
                <Toggle checked={groupDynamics} onChange={setGroupDynamics} label="Group dynamics (agreement & pushback)" />
                <Toggle checked={redTeam} onChange={setRedTeam} label="Include red-team reviewers (skeptical consumer, advocate, compliance-minded reader)" />
              </div>
              <div className="mt-4 pt-4 border-t border-ink-100 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-ink-50 p-2.5">
                  <div className="flex items-center justify-center gap-1 text-brand-600"><Users size={14} /><span className="text-lg font-bold text-ink-900">{personas.length}</span></div>
                  <div className="text-[10px] uppercase tracking-wide text-ink-400 font-semibold">Personas</div>
                </div>
                <div className="rounded-lg bg-ink-50 p-2.5">
                  <div className="flex items-center justify-center gap-1 text-accent-600"><Quote size={14} /><span className="text-lg font-bold text-ink-900">{variants.length}</span></div>
                  <div className="text-[10px] uppercase tracking-wide text-ink-400 font-semibold">Variants</div>
                </div>
              </div>
              <p className="text-[11px] text-ink-400 mt-3">{hasKey(settings) ? 'Using your connected model.' : 'No API key — synthetic demo output.'}</p>
            </Card>
          </div>

          {gen.running ? (
            <GenConsole lines={gen.lines} title="Convening the synthetic focus group"
              subtitle={`${personas.length} personas · ${variants.length} variants`} />
          ) : (
            <div className="flex justify-center">
              <button className="btn-primary text-base px-7 py-3" onClick={initiate}>
                <Play size={18} /> Initiate discussion
              </button>
            </div>
          )}
        </>
      )}

      {/* ============ LIVE — streaming transcript + rolling summary + steering ============ */}
      {phase === 'live' && (
        <div className="grid lg:grid-cols-3 gap-5 items-start">
          {/* Transcript (left, 2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <Quote size={16} className="text-ink-500" />
                  <h3 className="font-bold text-ink-900">Live discussion</h3>
                  {streaming
                    ? <Badge color="amber"><span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 animate-blink" /> In session</Badge>
                    : <Badge color="emerald">Floor open</Badge>}
                </div>
                <span className="text-[11px] text-ink-400">{shown} / {fullTranscript.length} reactions</span>
              </div>
              <p className="text-xs text-ink-400 mb-4">Reactions are paraphrased by the moderator agent and are never attributed as real quotes from real people.</p>

              <div className="space-y-3">
                {feed.map((f) => {
                  if (f.type === 'variant') {
                    const vi = variantIndex(f.variantId)
                    return (
                      <div key={f.key} className="flex items-center gap-2 pt-1">
                        <span className="grid place-items-center h-6 w-6 rounded text-white text-xs font-bold" style={{ backgroundColor: PALETTE[vi % PALETTE.length] }}>{String.fromCharCode(65 + vi)}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Now reviewing — {variantName(f.variantId)}</span>
                        <span className="h-px flex-1 bg-ink-100" />
                      </div>
                    )
                  }
                  if (f.type === 'steer') {
                    return (
                      <div key={f.key} className="flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 reveal">
                        <Megaphone size={15} className="text-brand-600 mt-0.5 shrink-0" />
                        <p className="text-sm text-brand-900"><span className="font-semibold">Moderator steers:</span> “{f.directive}”</p>
                      </div>
                    )
                  }
                  const { e } = f
                  return (
                    <div key={f.key} className="flex items-start justify-between gap-3 reveal">
                      <p className="text-sm text-ink-700">
                        <CornerDownRight size={13} className="inline text-ink-300 mr-1 -mt-0.5" />
                        <span className="font-medium text-ink-900">{e.personaName}:</span> {e.text}
                      </p>
                      <Badge color={INTENT_COLOR[e.intentLabel] || 'ink'} className="shrink-0">{e.intentLabel}</Badge>
                    </div>
                  )
                })}
                {streaming && (
                  <div className="flex items-center gap-2 text-xs text-ink-400 pl-5">
                    <span className="flex gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-ink-300 animate-blink" />
                      <span className="h-1.5 w-1.5 rounded-full bg-ink-300 animate-blink" style={{ animationDelay: '150ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-ink-300 animate-blink" style={{ animationDelay: '300ms' }} />
                    </span>
                    personas responding…
                  </div>
                )}
              </div>
            </Card>

            {/* Moderator steering */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Megaphone size={15} className="text-brand-600" />
                <h4 className="font-semibold text-ink-800 text-sm">Steer the conversation</h4>
              </div>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="e.g. Push them on the annual fee, or probe whether the APR is clear…"
                  value={steerText}
                  onChange={(e) => setSteerText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onSteer() }}
                  disabled={steering}
                />
                <button className="btn-primary shrink-0" onClick={onSteer} disabled={steering || !steerText.trim()}>
                  {steering ? <ThinkingPill label="Steering" /> : <><Send size={15} /> Send</>}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {STEER_SUGGESTIONS.map((s, i) => (
                  <button key={i} className="chip bg-ink-50 hover:bg-brand-50 hover:text-brand-700 text-ink-600" onClick={() => setSteerText(s)} disabled={steering}>{s}</button>
                ))}
              </div>
            </Card>
          </div>

          {/* Rolling summary (right, sticky) */}
          <div className="lg:sticky lg:top-36 space-y-4">
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-brand-600" />
                <h3 className="font-bold text-ink-900">Summary so far</h3>
              </div>

              <div className="rounded-lg bg-gradient-to-r from-brand-50 to-white border border-brand-100 p-3 mb-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-brand-700">Room is</div>
                <div className="text-ink-900 font-bold">{summary.lean}</div>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  <Badge color="emerald">{summary.counts['would apply']} would apply</Badge>
                  <Badge color="amber">{summary.counts['might apply']} might</Badge>
                  <Badge color="rose">{summary.counts['would not apply']} would not</Badge>
                </div>
              </div>

              <SummaryBlock title="Emerging themes" empty="Listening…">
                {summary.themes.map((t, i) => <Badge key={i} color="brand">{t}</Badge>)}
              </SummaryBlock>
              <SummaryBlock title="Open concerns" empty="None raised yet">
                {summary.objections.map((o, i) => <Badge key={i} color="amber">{o}</Badge>)}
              </SummaryBlock>
              {summary.gaps.length > 0 && (
                <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5">
                  <div className="flex items-center gap-1.5 text-rose-800 font-semibold text-xs"><AlertTriangle size={13} /> Material-term misreads</div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">{summary.gaps.map((g, i) => <span key={i} className="chip bg-rose-200 text-rose-900 font-mono">{g}</span>)}</div>
                </div>
              )}

              {steerLog.length > 0 && (
                <div className="mt-3 pt-3 border-t border-ink-100">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400 mb-1.5">Moderator steers ({steerLog.length})</div>
                  <ul className="space-y-1">{steerLog.map((s, i) => <li key={i} className="text-xs text-ink-600 flex items-start gap-1.5"><Megaphone size={11} className="text-brand-500 mt-0.5 shrink-0" />“{s}”</li>)}</ul>
                </div>
              )}
            </Card>

            <button className="btn-primary w-full justify-center py-2.5" onClick={conclude} disabled={shown === 0}>
              Conclude &amp; analyze <ArrowRight size={16} />
            </button>
            {streaming && <p className="text-[11px] text-ink-400 text-center">You can conclude now or wait for the panel to finish and steer further.</p>}
          </div>
        </div>
      )}

      {/* ============ DONE — graphs & synthesis ============ */}
      {phase === 'done' && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2 rounded-xl border border-ink-200 bg-ink-50/60 px-4 py-2.5 no-print">
            <div className="flex items-center gap-2 text-xs text-ink-500">
              <Badge color="brand">Discussion concluded</Badge>
              <span>{fullTranscript.length} reactions · {variants.length} variants</span>
              {steerLog.length > 0 && <span>· {steerLog.length} moderator steer{steerLog.length > 1 ? 's' : ''}</span>}
            </div>
            <button className="btn-ghost" onClick={rerun}><RotateCcw size={15} /> Re-run focus group</button>
          </div>

          {sentimentLeader && (
            <div className="rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 to-white p-4 flex items-center gap-3 animate-scale-in">
              <span className="grid place-items-center h-11 w-11 rounded-xl bg-brand-600 text-white shrink-0"><Trophy size={20} /></span>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">Apply-intent leader</div>
                <div className="text-ink-900 font-bold leading-tight">{variantName(sentimentLeader.variantId)} <span className="text-ink-400 font-normal">· intent score {sentimentLeader.intentScore}</span></div>
              </div>
              <span className="ml-auto shrink-0"><Badge color="amber">Directional — validate in Step 8</Badge></span>
            </div>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Avg sentiment" value={avg(pv.map((v) => v.sentiment))} color="brand" sub="across variants" />
            <StatCard label="Avg trust" value={avg(pv.map((v) => v.trust))} color="emerald" sub="credibility of terms" />
            <StatCard label="Avg comprehension" value={avg(pv.map((v) => v.comprehension))} color="amber" sub="material terms understood" />
            <StatCard label="Apply-intent leader" value={sentimentLeader ? variantName(sentimentLeader.variantId) : '—'} color="ink" sub={sentimentLeader ? `${sentimentLeader.intentScore} intent score` : ''} />
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <RadarCard
              title="Variant comparison"
              subtitle="Sentiment, trust, comprehension, and intent by variant"
              data={[
                { metric: 'Sentiment', ...Object.fromEntries(pv.map((v) => [variantName(v.variantId), v.sentiment])) },
                { metric: 'Trust', ...Object.fromEntries(pv.map((v) => [variantName(v.variantId), v.trust])) },
                { metric: 'Comprehension', ...Object.fromEntries(pv.map((v) => [variantName(v.variantId), v.comprehension])) },
                { metric: 'Intent', ...Object.fromEntries(pv.map((v) => [variantName(v.variantId), v.intentScore])) },
              ]}
              series={variants.map((v) => ({ key: v.name, name: v.name }))}
            />
            <BarsCard
              title="Sentiment & apply intent"
              subtitle="Per variant, 0–100"
              data={pv.map((v) => ({ name: variantName(v.variantId), sentiment: v.sentiment, intent: v.intentScore }))}
              bars={[{ key: 'sentiment', name: 'Sentiment', color: PALETTE[0] }, { key: 'intent', name: 'Apply intent', color: PALETTE[1] }]}
              xKey="name"
            />
          </div>

          <div className="space-y-4">
            {pv.map((v, idx) => {
              const gaps = v.comprehensionGaps || []
              return (
                <Stagger key={v.variantId} i={idx} className="card p-5">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <h3 className="font-bold text-ink-900">{variantName(v.variantId)}</h3>
                    <div className="flex items-center gap-2">
                      <Badge color={INTENT_COLOR['would apply']}><TrendingUp size={13} /> Apply intent {v.intentScore}</Badge>
                      <RiskBadge risk={scoreRisk(v.trust)} />
                    </div>
                  </div>

                  {gaps.length > 0 && (
                    <div className="rounded-lg border-2 border-rose-300 bg-rose-50 p-3.5 mb-4">
                      <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
                        <AlertTriangle size={17} /> Material-term misread — conversion risk AND compliance signal
                      </div>
                      <ul className="mt-2 space-y-1.5">
                        {gaps.map((g, i) => (
                          <li key={i} className="text-sm text-rose-900 flex items-start gap-2">
                            <span className="chip bg-rose-200 text-rose-900 font-mono shrink-0">{g.term}</span>
                            <span className="text-rose-800">{g.issue}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <Synth icon={Sparkles} color="brand" title="First impression & emotional response" value={`Sentiment ${v.sentiment}`}>
                      <Chips items={v.themes} color="brand" />
                    </Synth>
                    <Synth icon={ShieldCheck} color={scoreColor(v.trust)} title="Trust & credibility" value={`Trust ${v.trust}`}>
                      <RiskBadge risk={scoreRisk(v.trust)} />
                    </Synth>
                    <Synth icon={BookOpen} color={scoreColor(v.comprehension)} title="Comprehension" value={`${v.comprehension}/100`}>
                      <p className="text-xs text-ink-500">{v.comprehension >= 67 ? 'Material terms generally understood.' : 'Several personas misread material terms.'}</p>
                    </Synth>
                    <Synth icon={AlertTriangle} color="amber" title="Top objections">
                      <ul className="text-xs text-ink-700 space-y-1 list-disc pl-4">{(v.objections || []).map((o, i) => <li key={i}>{o}</li>)}</ul>
                    </Synth>
                    <Synth icon={MessageCircle} color="rose" title="Points of confusion">
                      {gaps.length > 0
                        ? <ul className="text-xs text-ink-700 space-y-1 list-disc pl-4">{gaps.map((g, i) => <li key={i}>{g.term}</li>)}</ul>
                        : <p className="text-xs text-ink-500">No material-term confusion flagged.</p>}
                    </Synth>
                    <Synth icon={Quote} color="violet" title="Standout reactions">
                      <ul className="text-xs text-ink-700 italic space-y-1">{(v.standoutReactions || []).map((s, i) => <li key={i}>“{s}”</li>)}</ul>
                    </Synth>
                  </div>
                </Stagger>
              )
            })}
          </div>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <Quote size={16} className="text-ink-500" />
              <h3 className="font-bold text-ink-900">Full discussion transcript</h3>
            </div>
            <p className="text-xs text-ink-400 mb-4">Reactions are paraphrased by the moderator agent and are never attributed as real quotes from real people.</p>
            <div className="space-y-5">
              {variants.map((v, vi) => {
                const entries = (fullTranscript || []).filter((t) => t.variantId === v.id)
                if (!entries.length) return null
                return (
                  <div key={v.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="grid place-items-center h-6 w-6 rounded text-white text-xs font-bold" style={{ backgroundColor: PALETTE[vi % PALETTE.length] }}>{String.fromCharCode(65 + vi)}</span>
                      <span className="font-semibold text-ink-800 text-sm">{v.name}</span>
                    </div>
                    <div className="space-y-2 border-l-2 border-ink-100 pl-3.5">
                      {entries.map((t, i) => (
                        <div key={i} className="flex items-start justify-between gap-3">
                          <p className="text-sm text-ink-700">
                            <span className="font-medium text-ink-900">{t.personaName}:</span> {t.text}
                            {t.steer && <span className="ml-1.5 chip bg-brand-50 text-brand-600 align-middle">steered</span>}
                          </p>
                          <Badge color={INTENT_COLOR[t.intentLabel] || 'ink'} className="shrink-0">{t.intentLabel}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </>
      )}

      <SyntheticBanner />
    </div>
  )
}

function SummaryBlock({ title, empty, children }) {
  const items = React.Children.toArray(children)
  return (
    <div className="mt-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400 mb-1.5">{title}</div>
      {items.length ? <div className="flex flex-wrap gap-1.5">{items}</div> : <p className="text-xs text-ink-300 italic">{empty}</p>}
    </div>
  )
}

function Synth({ icon: Icon, color = 'brand', title, value, children }) {
  const tint = { brand: 'bg-brand-50 text-brand-600', emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', rose: 'bg-rose-50 text-rose-600', violet: 'bg-violet-50 text-violet-600' }
  return (
    <div className="rounded-lg border border-ink-100 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`grid place-items-center h-6 w-6 rounded ${tint[color] || tint.brand}`}><Icon size={14} /></span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{title}</span>
        </div>
        {value && <span className="text-xs font-bold text-ink-700">{value}</span>}
      </div>
      {children}
    </div>
  )
}

function Chips({ items = [], color = 'ink' }) {
  return <div className="flex flex-wrap gap-1.5">{items.map((it, i) => <Badge key={i} color={color}>{it}</Badge>)}</div>
}
