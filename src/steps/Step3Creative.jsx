import React, { useState } from 'react'
import { useProject } from '../state/store.jsx'
import { channelFields, CHANNELS_BY_ID } from '../data/products.js'
import { CATEGORY_META } from '../data/complianceRules.js'
import { screenAll, buildAuditLog } from '../services/compliance.js'
import { generateCreative } from '../services/generators.js'
import { hasKey } from '../services/llm.js'
import { SectionTitle, Card, Badge, RiskBadge, Modal, SyntheticBanner } from '../components/ui.jsx'
import { useStagedGenerate, GenConsole, Stagger, ThinkingPill } from '../components/generate.jsx'
import CreativePreview from '../components/CreativePreview.jsx'
import { exportCSV, printReport } from '../utils/export.js'
import { PenLine, Plus, Trash2, ShieldCheck, Wand2, Play, FileDown, AlertTriangle, CheckCircle2, Sliders, RotateCcw, PencilLine, Eye, ChevronRight } from 'lucide-react'

const blankVariant = (channel) => ({ id: `var-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, name: 'New variant', channel, source: 'pasted', headline: '', primaryText: '', valueProp: '', landingCopy: '' })

export default function Step3Creative() {
  const { project, update, settings, store, actions } = useProject()
  const channel = project.campaign.channels[0] || 'paid-search-rsa'
  const variants = project.creative.variants
  const results = project.creative.screenResults
  const [rulepackOpen, setRulepackOpen] = useState(false)
  const [count, setCount] = useState(Math.min(5, Math.max(2, variants.length || 3)))
  const gen = useStagedGenerate()
  const screen = useStagedGenerate()

  const activeRules = store.rulepack.filter((r) => r.enabled !== false)

  const setVariant = (id, patch) => update({ creative: { ...project.creative, variants: variants.map((v) => (v.id === id ? { ...v, ...patch } : v)), screenResults: [] } })
  const addVariant = () => { if (variants.length < 5) update({ creative: { ...project.creative, variants: [...variants, blankVariant(channel)], screenResults: [] } }) }
  const removeVariant = (id) => update({ creative: { ...project.creative, variants: variants.filter((v) => v.id !== id), screenResults: [] } })

  const runScreen = async () => {
    const res = await screen.run({
      steps: [
        'Loading active rulepack…',
        'Scanning headlines & body copy…',
        'Checking required disclosures (APR, fees)…',
        'Flagging prohibited claims & UDAAP risk…',
        'Rating overall risk per variant…',
        'Writing exportable audit log…',
      ],
      work: async () => screenAll(variants, activeRules, project.campaign.product),
      minMs: 1900,
    })
    update({ creative: { ...project.creative, screenResults: res } })
    actions.addAudit(buildAuditLog(variants, res).map((r) => ({ timestamp: r.timestamp, action: 'Screened creative', detail: `${r.variant}: ${r.rule}`, category: r.category, risk: r.risk })))
  }

  const generate = async () => {
    const out = await gen.run({
      steps: [
        'Reading the campaign brief & objective…',
        'Conditioning on the target segment…',
        'Drafting on-brand, compliant headlines…',
        'Writing primary copy & value propositions…',
        'Enforcing channel character limits…',
        'Pre-screening for fair-lending risk…',
      ],
      work: async () => {
        const g = await generateCreative({ settings, campaign: project.campaign, target: project.target, n: count })
        const res = screenAll(g, activeRules, project.campaign.product)
        return { g, res }
      },
      minMs: 2800,
    })
    update({ creative: { ...project.creative, variants: out.g, screenResults: out.res } })
  }

  const resultFor = (id) => results.find((r) => r.variantId === id)
  const auditRows = buildAuditLog(variants, results)
  const highCount = results.filter((r) => r.risk === 'high').length

  return (
    <div className="space-y-6">
      <SectionTitle icon={PenLine} title="Creative & Compliance"
        subtitle="Paste 2–5 variants or generate compliant ones. Every variant is screened by the Compliance Engine before any testing."
        right={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5" title="How many creative variants to generate">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 hidden sm:block">Variants</span>
              <div className="flex items-center gap-0.5 rounded-lg bg-ink-100 p-0.5">
                {[2, 3, 4, 5].map((nn) => (
                  <button key={nn} onClick={() => setCount(nn)} disabled={gen.running}
                    className={`h-8 w-8 rounded-md text-sm font-semibold transition ${count === nn ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}>
                    {nn}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn-ghost" onClick={() => setRulepackOpen(true)}><Sliders size={15} /> Rulepack</button>
            <button className="btn-accent" onClick={generate} disabled={gen.running}>
              {gen.running ? <ThinkingPill label="Generating" /> : <><Wand2 size={15} /> {hasKey(settings) ? `Generate ${count}` : `Generate ${count} (demo)`}</>}
            </button>
          </div>
        } />

      {gen.running && (
        <GenConsole lines={gen.lines} title="Generating compliant creative"
          subtitle={`${CHANNELS_BY_ID[channel]?.name} · conditioned on your target segment`} />
      )}

      <div className={`grid lg:grid-cols-2 gap-5 ${gen.running ? 'opacity-50 pointer-events-none' : ''}`}>
        {variants.map((v, i) => (
          <Stagger key={v.id} i={i}>
            <VariantEditor v={v} index={i} channel={channel} result={resultFor(v.id)}
              onChange={(patch) => setVariant(v.id, patch)} onRemove={() => removeVariant(v.id)} canRemove={variants.length > 2}
              onApplyRewrite={(text) => setVariant(v.id, { landingCopy: (v.landingCopy ? v.landingCopy + ' ' : '') + text })} />
          </Stagger>
        ))}
        {variants.length < 5 && (
          <button onClick={addVariant} className="card border-dashed border-2 border-ink-200 grid place-items-center min-h-[180px] text-ink-400 hover:text-brand-600 hover:border-brand-300 transition">
            <span className="flex flex-col items-center gap-1"><Plus size={22} /> <span className="text-sm font-medium">Add variant</span></span>
          </button>
        )}
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="grid place-items-center h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600"><ShieldCheck size={18} /></div>
            <div>
              <h3 className="font-bold text-ink-900">Compliance Engine</h3>
              <p className="text-xs text-ink-500">Fair lending (ECOA/Reg B), UDAAP, required disclosures, prohibited claims · {activeRules.length} active rules</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={runScreen} disabled={screen.running}>
              {screen.running ? <ThinkingPill label="Screening" /> : <><Play size={15} /> Screen all variants</>}
            </button>
            {results.length > 0 && !screen.running && <>
              <button className="btn-ghost" onClick={() => exportCSV(auditRows, `compliance-audit-${project.id}.csv`)}><FileDown size={15} /> Audit log (CSV)</button>
              <button className="btn-ghost" onClick={printReport}><FileDown size={15} /> Summary (PDF)</button>
            </>}
          </div>
        </div>

        {screen.running ? (
          <div className="mt-4"><GenConsole lines={screen.lines} title="Screening against the rulepack" subtitle={`${activeRules.length} active rules · ${variants.length} variants`} /></div>
        ) : results.length === 0 ? (
          <p className="text-sm text-ink-400 mt-4">Run the screen to rate every variant and produce an exportable audit log + one-page compliance summary.</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2 text-sm">
              {highCount > 0
                ? <Badge color="rose"><AlertTriangle size={13} /> {highCount} variant{highCount > 1 ? 's' : ''} with high-risk issues</Badge>
                : <Badge color="emerald"><CheckCircle2 size={13} /> No high-risk issues detected</Badge>}
              <span className="text-ink-400 text-xs">Reviewed {results.length} variants against the active rulepack. Click a variant to see why.</span>
            </div>
            {results.map((r, idx) => {
              const vv = variants.find((x) => x.id === r.variantId)
              return <ComplianceResultRow key={r.variantId} index={idx} name={vv?.name} result={r} activeRules={activeRules} defaultOpen={idx === 0} />
            })}
          </div>
        )}
      </Card>

      <SyntheticBanner />
      <RulepackEditor open={rulepackOpen} onClose={() => setRulepackOpen(false)} />
    </div>
  )
}

// Clickable per-variant compliance breakdown — shows BOTH why it cleared (rules
// passed) and any issues, so a reviewer understands the verdict, not just the badge.
function ComplianceResultRow({ name, result, activeRules, defaultOpen, index }) {
  const [open, setOpen] = useState(defaultOpen)
  const failedIds = new Set(result.findings.map((f) => f.ruleId))
  const passed = activeRules.filter((r) => !failedIds.has(r.id))
  const issues = result.findings.length

  return (
    <Stagger i={index} className="rounded-lg border border-ink-100 overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-3 p-3.5 text-left hover:bg-ink-50 transition">
        <div className="flex items-center gap-2 min-w-0">
          <ChevronRight size={15} className={`text-ink-400 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
          <span className="font-semibold text-ink-900 text-sm truncate">{name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-medium hidden sm:inline ${issues ? 'text-rose-700' : 'text-emerald-700'}`}>
            {issues ? `${issues} issue${issues > 1 ? 's' : ''} to resolve` : `Cleared all ${passed.length} rules`}
          </span>
          <RiskBadge risk={result.risk} />
        </div>
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 pt-1 border-t border-ink-100 animate-fade-in space-y-3">
          {/* Why it's compliant — rules cleared */}
          {passed.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 mb-1.5 flex items-center gap-1"><ShieldCheck size={13} /> Why it’s compliant — {passed.length} rule{passed.length > 1 ? 's' : ''} cleared</div>
              <div className="space-y-1.5">
                {passed.map((r) => {
                  const cat = CATEGORY_META[r.category] || { label: r.category, color: 'ink' }
                  return (
                    <div key={r.id} className="flex items-start gap-2 text-xs">
                      <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                      <span className="text-ink-600"><span className="font-medium text-ink-800">{r.name}</span> <Badge color={cat.color}>{cat.label}</Badge> — {r.rationale}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Why it's flagged — issues */}
          {issues === 0 ? (
            <p className="text-xs text-emerald-700 flex items-center gap-1.5"><CheckCircle2 size={14} /> No issues — this variant passed every active rule and is cleared for testing.</p>
          ) : (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-rose-700 mb-1.5 flex items-center gap-1"><AlertTriangle size={13} /> Why it’s flagged — {issues} issue{issues > 1 ? 's' : ''}</div>
              <div className="space-y-2">
                {result.findings.map((f, i) => {
                  const cat = CATEGORY_META[f.category] || { label: f.category, color: 'ink' }
                  return (
                    <div key={i} className="rounded-md bg-ink-50 p-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge color={cat.color}>{cat.label}</Badge>
                        <RiskBadge risk={f.severity} />
                        <span className="text-sm font-medium text-ink-800">{f.name}</span>
                        {f.matched && <span className="chip bg-rose-100 text-rose-700 font-mono">“{f.matched}”</span>}
                        {f.status === 'missing' && <span className="chip bg-amber-100 text-amber-800">Disclosure missing</span>}
                      </div>
                      <p className="text-xs text-ink-600 mt-1.5">{f.rationale}</p>
                      <div className="mt-1.5 flex items-start gap-2 text-xs">
                        <span className="font-semibold text-emerald-700 shrink-0">Suggested fix:</span>
                        <span className="text-ink-700 italic">{f.rewrite}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Stagger>
  )
}

function VariantEditor({ v, index, channel, result, onChange, onRemove, canRemove }) {
  const fields = channelFields(channel)
  const ch = CHANNELS_BY_ID[channel]
  const [tab, setTab] = useState('edit')
  return (
    <Card className="p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="grid place-items-center h-6 w-6 rounded bg-brand-600 text-white text-xs font-bold shrink-0">{String.fromCharCode(65 + index)}</span>
          <input className="font-semibold text-ink-900 bg-transparent border-0 focus:ring-0 p-0 text-sm w-36" value={v.name} onChange={(e) => onChange({ name: e.target.value })} />
          <Badge color={v.source === 'generated' ? 'sky' : 'ink'}>{v.source === 'generated' ? 'Generated' : 'Pasted'}</Badge>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {result && <RiskBadge risk={result.risk} />}
          {canRemove && <button onClick={onRemove} className="text-ink-300 hover:text-rose-500"><Trash2 size={15} /></button>}
        </div>
      </div>

      <div className="flex gap-1 mb-3 rounded-lg bg-ink-100 p-0.5 w-fit">
        <button onClick={() => setTab('edit')} className={`pill-tab text-xs ${tab === 'edit' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'}`}><PencilLine size={13} className="inline -mt-0.5 mr-1" />Edit</button>
        <button onClick={() => setTab('preview')} className={`pill-tab text-xs ${tab === 'preview' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'}`}><Eye size={13} className="inline -mt-0.5 mr-1" />Preview</button>
      </div>

      {tab === 'edit' ? (
        <div className="space-y-2.5 animate-fade-in">
          {fields.map((f) => {
            const val = v[f.key] || ''
            const over = val.length > f.max
            const Tag = f.key === 'landingCopy' || (f.max > 200) ? 'textarea' : 'input'
            return (
              <div key={f.key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{f.label}</label>
                  <span className={`text-[11px] font-mono ${over ? 'text-rose-600 font-bold' : 'text-ink-400'}`}>{val.length}/{f.max}</span>
                </div>
                <Tag className={`input ${Tag === 'textarea' ? 'min-h-[68px] resize-y' : ''} ${over ? 'border-rose-400 ring-rose-200' : ''}`} value={val} onChange={(e) => onChange({ [f.key]: e.target.value })} placeholder={f.hint || f.label} />
              </div>
            )
          })}
          <p className="text-[11px] text-ink-400 mt-2">{ch?.name} constraints enforced.</p>
        </div>
      ) : (
        <div className="animate-fade-in">
          <CreativePreview variant={v} channel={channel} />
        </div>
      )}
    </Card>
  )
}

function RulepackEditor({ open, onClose }) {
  const { store, actions } = useProject()
  const rulepack = store.rulepack
  const toggle = (id) => actions.setRulepack(rulepack.map((r) => (r.id === id ? { ...r, enabled: r.enabled === false } : r)))
  const setSeverity = (id, severity) => actions.setRulepack(rulepack.map((r) => (r.id === id ? { ...r, severity } : r)))
  const [kw, setKw] = useState('')

  const addCustom = () => {
    if (!kw.trim()) return
    const rule = { id: `custom-${Date.now()}`, category: 'prohibited', kind: 'trigger', severity: 'medium', name: `Custom: "${kw.trim()}"`, patterns: [kw.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')], rationale: 'Custom issuer-policy keyword.', rewrite: 'Review and revise per internal policy.', enabled: true }
    actions.setRulepack([...rulepack, rule]); setKw('')
  }

  return (
    <Modal open={open} onClose={onClose} title="Compliance Rulepack" wide>
      <p className="text-sm text-ink-500 mb-3">Tune the rulepack to your institution's policy. Toggle rules on/off, adjust severity, or add a custom prohibited keyword. This is a demo-grade pack — not legal advice.</p>
      <div className="flex gap-2 mb-4">
        <input className="input" placeholder="Add prohibited keyword/phrase (e.g. instant approval)" value={kw} onChange={(e) => setKw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCustom()} />
        <button className="btn-primary" onClick={addCustom}><Plus size={15} /> Add</button>
      </div>
      <div className="space-y-2 max-h-[50vh] overflow-auto pr-1">
        {rulepack.map((r) => {
          const cat = CATEGORY_META[r.category] || { label: r.category, color: 'ink' }
          const on = r.enabled !== false
          return (
            <div key={r.id} className={`rounded-lg border p-3 ${on ? 'border-ink-200' : 'border-ink-100 opacity-60'}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap"><Badge color={cat.color}>{cat.label}</Badge><span className="text-sm font-medium text-ink-800">{r.name}</span><Badge color="ink">{r.kind}</Badge></div>
                  <p className="text-xs text-ink-500 mt-1 line-clamp-2">{r.rationale}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select className="input py-1 text-xs w-24" value={r.severity} onChange={(e) => setSeverity(r.id, e.target.value)}><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select>
                  <button onClick={() => toggle(r.id)} className={`pill-tab border text-xs ${on ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-ink-200 text-ink-500'}`}>{on ? 'On' : 'Off'}</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-4">
        <button className="btn-ghost text-xs" onClick={() => { if (confirm('Restore default rulepack?')) location.reload() }}><RotateCcw size={13} /> Defaults require app reset</button>
        <button className="btn-primary" onClick={onClose}>Done</button>
      </div>
    </Modal>
  )
}
