import React, { useMemo, useState } from 'react'
import { useProject } from '../state/store.jsx'
import { LENSES, SEGMENTS, segmentsByLens, describeTarget, getSegment, PRODUCT_SEGMENT_AFFINITY } from '../data/segments.js'
import { PRODUCTS_BY_ID } from '../data/products.js'
import { screenCustomSegment, refusalRecord } from '../services/fairness.js'
import { SectionTitle, Card, Badge, Modal, ComplianceBanner } from '../components/ui.jsx'
import { Users, Check, Search, Plus, Sparkles, Save, FolderOpen, ShieldAlert, X, Pencil, RotateCcw, Wand2 } from 'lucide-react'

export default function Step2Segment() {
  const { project, update, store, actions } = useProject()
  const t = project.target
  const productId = project.campaign.product
  const [query, setQuery] = useState('')
  const [customOpen, setCustomOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const affinity = PRODUCT_SEGMENT_AFFINITY[productId] || []
  const allSegments = useMemo(() => [...SEGMENTS, ...t.custom], [t.custom])

  const selected = t.segments
  const toggle = (id) => update({ target: { ...t, segments: selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id] } })

  const filtered = (lensId) => {
    const base = lensId === 'custom' ? t.custom : segmentsByLens(lensId)
    if (!query) return base
    const q = query.toLowerCase()
    return base.filter((s) => `${s.name} ${s.descriptor} ${s.motivation}`.toLowerCase().includes(q))
  }

  const combined = describeTarget(selected, t.custom)
  const shownBrief = t.brief?.trim() || combined
  const profiles = store.libraries.targetingProfiles[productId] || []

  const saveBrief = () => { update({ target: { ...t, brief: draft.trim() } }); setEditing(false) }
  const resetBrief = () => { update({ target: { ...t, brief: '' } }); setEditing(false) }

  const saveProfile = () => {
    const name = prompt('Name this targeting profile:', shownBrief.slice(0, 40))
    if (!name) return
    actions.saveTargetingProfile(productId, { id: `tp-${Date.now()}`, name, segments: selected, custom: t.custom, brief: t.brief || '', description: shownBrief })
  }
  const loadProfile = (p) => update({ target: { segments: p.segments, custom: p.custom || [], brief: p.brief || '' } })

  return (
    <div className="space-y-6">
      <SectionTitle icon={Users} title="Target Segment Selection"
        subtitle="Pick a primary segment, then optionally layer segments across lenses to define an intersectional target. Segments are behavioral, needs-based, and financial-profile based — never protected classes." />

      {/* product-aware suggestions */}
      {affinity.length > 0 && (
        <Card className="p-4 border-brand-200 bg-brand-50/40">
          <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-brand-800"><Sparkles size={15} /> Suggested for {PRODUCTS_BY_ID[productId]?.name}</div>
          <div className="flex flex-wrap gap-2">
            {affinity.map((id) => {
              const s = getSegment(id); const on = selected.includes(id)
              return <button key={id} onClick={() => toggle(id)} className={`rounded-full border px-3 py-1.5 text-sm transition ${on ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-brand-200 text-brand-700 hover:border-brand-400'}`}>{on && <Check size={13} className="inline mr-1 -mt-0.5" />}{s.name}</button>
            })}
          </div>
        </Card>
      )}

      {/* combined target render — editable */}
      <Card className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="label mb-1 flex items-center gap-2">
              Your target
              {selected.length > 1 && <Badge color="violet">Intersectional · {selected.length} segments</Badge>}
              {t.brief?.trim() && <Badge color="amber"><Pencil size={10} /> Edited</Badge>}
            </div>

            {!selected.length ? (
              <p className="text-sm text-ink-400">No segment selected yet. Choose one below — it drives personas, survey, and recommendation.</p>
            ) : editing ? (
              <div className="space-y-2">
                <textarea className="input min-h-[120px] resize-y text-sm leading-relaxed" value={draft} autoFocus
                  onChange={(e) => setDraft(e.target.value)} placeholder="Describe your target audience in your own words…" />
                <div className="flex items-center gap-2 flex-wrap">
                  <button className="btn-primary text-xs" onClick={saveBrief}><Check size={13} /> Save</button>
                  <button className="btn-ghost text-xs" onClick={() => setEditing(false)}>Cancel</button>
                  <button className="btn-subtle text-xs" onClick={() => setDraft(combined)} title="Replace with the auto-generated description"><Wand2 size={13} /> Regenerate from segments</button>
                  <span className="text-[11px] text-ink-400 ml-auto">{draft.length} chars · this brief drives personas, creative, survey & recommendation</span>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-ink-800 leading-relaxed">{shownBrief}</p>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {selected.map((id) => { const s = getSegment(id, t.custom); return s ? <span key={id} className="chip bg-violet-100 text-violet-800">{s.name}<button onClick={() => toggle(id)} className="ml-0.5 hover:text-violet-950"><X size={11} /></button></span> : null })}
                </div>
                <div className="flex items-center gap-3 mt-2.5">
                  <button className="text-xs font-medium text-brand-600 hover:text-brand-700 inline-flex items-center gap-1" onClick={() => { setDraft(shownBrief); setEditing(true) }}><Pencil size={12} /> Edit description</button>
                  {t.brief?.trim() && <button className="text-xs text-ink-400 hover:text-ink-700 inline-flex items-center gap-1" onClick={resetBrief}><RotateCcw size={12} /> Reset to auto</button>}
                </div>
              </>
            )}
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <button className="btn-ghost text-xs" onClick={saveProfile} disabled={!selected.length}><Save size={13} /> Save profile</button>
            <button className="btn-subtle text-xs" onClick={() => setCustomOpen(true)}><Plus size={13} /> Custom segment</button>
          </div>
        </div>
        {profiles.length > 0 && (
          <div className="mt-3 pt-3 border-t border-ink-100 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-ink-400 flex items-center gap-1"><FolderOpen size={13} /> Saved profiles:</span>
            {profiles.map((p) => <button key={p.id} className="chip bg-ink-100 text-ink-700 hover:bg-ink-200" onClick={() => loadProfile(p)}>{p.name}</button>)}
          </div>
        )}
      </Card>

      {/* search */}
      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input className="input pl-9" placeholder="Search segments…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {/* lenses */}
      <div className="grid md:grid-cols-2 gap-5">
        {LENSES.map((lens) => (
          <Card key={lens.id} className="p-4">
            <div className="mb-3">
              <div className="flex items-center gap-2"><Badge color="brand">Lens {lens.id}</Badge><h3 className="font-bold text-ink-900">{lens.name}</h3></div>
              <p className="text-xs text-ink-500 mt-1">{lens.blurb}</p>
            </div>
            <div className="space-y-1.5">
              {filtered(lens.id).map((s) => <SegRow key={s.id} s={s} on={selected.includes(s.id)} onToggle={() => toggle(s.id)} />)}
              {filtered(lens.id).length === 0 && <p className="text-xs text-ink-400 py-2">No matches.</p>}
            </div>
          </Card>
        ))}
        {t.custom.length > 0 && (
          <Card className="p-4 md:col-span-2 border-accent-200">
            <div className="flex items-center gap-2 mb-3"><Badge color="accent">Custom</Badge><h3 className="font-bold text-ink-900">Proprietary segments</h3></div>
            <div className="grid md:grid-cols-2 gap-1.5">
              {t.custom.map((s) => <SegRow key={s.id} s={s} on={selected.includes(s.id)} onToggle={() => toggle(s.id)} custom onRemove={() => update({ target: { ...t, custom: t.custom.filter((x) => x.id !== s.id), segments: selected.filter((x) => x !== s.id) } })} />)}
            </div>
          </Card>
        )}
      </div>

      <CustomSegmentModal open={customOpen} onClose={() => setCustomOpen(false)} />
    </div>
  )
}

function SegRow({ s, on, onToggle, custom, onRemove }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition ${on ? 'border-brand-400 bg-brand-50' : 'border-ink-100 hover:bg-ink-50'}`} onClick={onToggle}>
      <span className={`mt-0.5 grid place-items-center h-4 w-4 rounded border shrink-0 ${on ? 'bg-brand-600 border-brand-600 text-white' : 'border-ink-300'}`}>{on && <Check size={11} />}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink-900 leading-tight">{s.name}</div>
        <div className="text-xs text-ink-500">{s.descriptor} <span className="text-ink-400">· {s.motivation}</span></div>
      </div>
      {custom && <button onClick={(e) => { e.stopPropagation(); onRemove() }} className="text-ink-300 hover:text-rose-500"><X size={14} /></button>}
    </div>
  )
}

function CustomSegmentModal({ open, onClose }) {
  const { project, update, actions } = useProject()
  const [form, setForm] = useState({ name: '', descriptor: '', motivation: '', objections: '' })
  const [block, setBlock] = useState(null)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = () => {
    const seg = { id: `custom-${Date.now()}`, lens: 'custom', name: form.name.trim(), descriptor: form.descriptor.trim(), motivation: form.motivation.trim(), objections: form.objections.split(',').map((x) => x.trim()).filter(Boolean) }
    const audit = screenCustomSegment(seg)
    if (audit.blocked) {
      // Fairness audit BLOCKS and logs the refusal.
      actions.addAudit(refusalRecord(seg, audit.hits))
      setBlock(audit.hits)
      return
    }
    update({ target: { ...project.target, custom: [...project.target.custom, seg], segments: [...project.target.segments, seg.id] } })
    setForm({ name: '', descriptor: '', motivation: '', objections: '' }); setBlock(null); onClose()
  }

  return (
    <Modal open={open} onClose={() => { setBlock(null); onClose() }} title="Add custom segment">
      <ComplianceBanner tone="emerald">Segments must be behavioral, needs-based, or financial-profile based. The Fairness Audit will block and log any definition that references a protected class or close proxy (ECOA / Reg B).</ComplianceBanner>
      <div className="space-y-3 mt-4">
        <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Rewards-Indifferent Auto-Pay User" /></div>
        <div><label className="label">Descriptor</label><input className="input" value={form.descriptor} onChange={(e) => set('descriptor', e.target.value)} placeholder="Behavior / financial profile" /></div>
        <div><label className="label">Core motivation</label><input className="input" value={form.motivation} onChange={(e) => set('motivation', e.target.value)} placeholder="What drives them" /></div>
        <div><label className="label">Key objections (comma-separated)</label><input className="input" value={form.objections} onChange={(e) => set('objections', e.target.value)} placeholder="hidden fees, complexity" /></div>
      </div>
      {block && (
        <div className="mt-4 rounded-lg border border-rose-300 bg-rose-50 p-3.5">
          <div className="flex items-center gap-2 text-rose-800 font-semibold text-sm"><ShieldAlert size={16} /> Blocked by Fairness Audit</div>
          <p className="text-xs text-rose-700 mt-1.5">This definition references a protected class or close proxy and was refused (and logged to the compliance audit trail):</p>
          <ul className="text-xs text-rose-700 mt-1.5 list-disc pl-5">{block.map((h, i) => <li key={i}><strong>{h.term}</strong> → {h.basis} (in {h.field})</li>)}</ul>
        </div>
      )}
      <div className="flex justify-end gap-2 mt-5">
        <button className="btn-ghost" onClick={() => { setBlock(null); onClose() }}>Cancel</button>
        <button className="btn-primary" disabled={!form.name || !form.motivation} onClick={submit}>Add segment</button>
      </div>
    </Modal>
  )
}
