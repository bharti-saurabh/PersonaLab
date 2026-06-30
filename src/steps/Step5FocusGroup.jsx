import React, { useState } from 'react'
import { useProject } from '../state/store.jsx'
import { runFocusGroup } from '../services/generators.js'
import { hasKey } from '../services/llm.js'
import { SectionTitle, Card, Badge, RiskBadge, StatCard, SyntheticBanner, EmptyState, Toggle } from '../components/ui.jsx'
import { useStagedGenerate, GenConsole, Stagger, ThinkingPill } from '../components/generate.jsx'
import { RadarCard, BarsCard, PALETTE } from '../components/charts.jsx'
import { exportCSV, exportJSON, printReport } from '../utils/export.js'
import { MessagesSquare, Wand2, AlertTriangle, FileDown, Quote, MessageCircle, ShieldCheck, BookOpen, Sparkles, TrendingUp, Trophy } from 'lucide-react'

const INTENT_COLOR = { 'would apply': 'emerald', 'might apply': 'amber', 'would not apply': 'rose' }

function avg(arr) { return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0 }
function scoreColor(v) { return v >= 67 ? 'emerald' : v >= 40 ? 'amber' : 'rose' }
function scoreRisk(v) { return v >= 67 ? 'low' : v >= 40 ? 'medium' : 'high' }

export default function Step5FocusGroup() {
  const { project, update, settings } = useProject()
  const personas = project.panel.personas
  const variants = project.creative.variants
  const fg = project.focusGroup

  const gen = useStagedGenerate()
  const [groupDynamics, setGroupDynamics] = useState(fg?.groupDynamics ?? true)
  const [redTeam, setRedTeam] = useState(fg?.redTeam ?? true)

  const ready = personas.length > 0 && variants.length >= 2

  const variantName = (id) => variants.find((v) => v.id === id)?.name || 'Variant'

  const run = async () => {
    const out = await gen.run({
      steps: [
        'Seating the synthetic panel…',
        'Moderator presenting each variant…',
        `Personas reacting in character${redTeam ? ' (incl. red-team reviewers)' : ''}…`,
        'Probing trust & material-term comprehension…',
        groupDynamics ? 'Letting the group agree & push back…' : 'Capturing individual reactions…',
        'Synthesizing sentiment, objections & quotes…',
      ],
      work: async () => runFocusGroup({ settings, personas, variants: project.creative.variants, campaign: project.campaign, options: { groupDynamics } }),
      minMs: 3000,
    })
    update({ focusGroup: { transcript: out.transcript, perVariant: out.perVariant, groupDynamics, redTeam } })
  }

  const exportTranscript = () => {
    const rows = (fg?.transcript || []).map((t) => ({ variant: variantName(t.variantId), persona: t.personaName, intent: t.intentLabel, reaction: t.text }))
    exportCSV(rows, `focus-group-transcript-${project.id}.csv`)
  }
  const exportSynthesis = () => exportJSON({ groupDynamics: fg?.groupDynamics, redTeam: fg?.redTeam, perVariant: fg?.perVariant }, `focus-group-synthesis-${project.id}.json`)

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

  const pv = fg?.perVariant || []
  const sentimentLeader = pv.length ? [...pv].sort((a, b) => b.intentScore - a.intentScore)[0] : null

  return (
    <div className="space-y-6">
      <SectionTitle icon={MessagesSquare} title="Synthetic Focus Group"
        subtitle="A moderator agent runs a structured discussion; personas react in character to each variant."
        right={
          <div className="flex gap-2">
            {fg && <>
              <button className="btn-ghost" onClick={exportTranscript}><FileDown size={15} /> Transcript (CSV)</button>
              <button className="btn-ghost" onClick={exportSynthesis}><FileDown size={15} /> Synthesis (JSON)</button>
              <button className="btn-ghost" onClick={printReport}><FileDown size={15} /> Print summary (PDF)</button>
            </>}
          </div>
        } />

      <Card className="p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-3">
            <Toggle checked={groupDynamics} onChange={setGroupDynamics} label="Group dynamics (agreement & pushback)" />
            <Toggle checked={redTeam} onChange={setRedTeam} label="Include red-team reviewers (skeptical consumer, consumer advocate, compliance-minded reader)" />
            <p className="text-xs text-ink-400 max-w-xl">{personas.length} personas in the panel react to {variants.length} variants. {hasKey(settings) ? 'Using your connected model.' : 'No API key — synthetic demo output.'}</p>
          </div>
          <button className="btn-primary" onClick={run} disabled={gen.running}>
            {gen.running ? <ThinkingPill label="Running" /> : <><Wand2 size={15} /> {fg ? 'Re-run focus group' : 'Run focus group'}</>}
          </button>
        </div>
      </Card>

      {gen.running && (
        <GenConsole lines={gen.lines} title="Running the synthetic focus group"
          subtitle={`${personas.length} personas · ${variants.length} variants`} />
      )}

      {fg && !gen.running && (
        <>
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <Quote size={16} className="text-ink-500" />
              <h3 className="font-bold text-ink-900">Discussion transcript</h3>
              <Badge color="brand" className="ml-1">First look</Badge>
            </div>
            <p className="text-xs text-ink-400 mb-4">The raw discussion as it unfolded — read the room first, then see the synthesized signal below. Reactions are paraphrased by the moderator agent and are never attributed as real quotes from real people.</p>
            <div className="space-y-5">
              {variants.map((v, vi) => {
                const entries = (fg.transcript || []).filter((t) => t.variantId === v.id)
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
                          <p className="text-sm text-ink-700"><span className="font-medium text-ink-900">{t.personaName}:</span> {t.text}</p>
                          <Badge color={INTENT_COLOR[t.intentLabel] || 'ink'} className="shrink-0">{t.intentLabel}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

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
        </>
      )}

      <SyntheticBanner />
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
