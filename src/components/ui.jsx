import React from 'react'
import { Info, ShieldCheck, X, Sparkles } from 'lucide-react'

export function Card({ className = '', children, ...rest }) {
  return <div className={`card ${className}`} {...rest}>{children}</div>
}

export function SectionTitle({ icon: Icon, title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="flex items-start gap-3">
        {Icon && <div className="mt-0.5 grid place-items-center h-9 w-9 rounded-lg bg-brand-50 text-brand-600"><Icon size={18} /></div>}
        <div>
          <h2 className="text-lg font-bold text-ink-900 leading-tight">{title}</h2>
          {subtitle && <p className="text-sm text-ink-500 mt-0.5 max-w-2xl">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  )
}

export function Badge({ children, color = 'ink', className = '' }) {
  const map = {
    ink: 'bg-ink-100 text-ink-700', brand: 'bg-brand-50 text-brand-700', accent: 'bg-accent-100 text-accent-800',
    emerald: 'bg-emerald-100 text-emerald-800', amber: 'bg-amber-100 text-amber-800', rose: 'bg-rose-100 text-rose-800',
    sky: 'bg-sky-100 text-sky-800', violet: 'bg-violet-100 text-violet-800',
  }
  return <span className={`chip ${map[color] || map.ink} ${className}`}>{children}</span>
}

export function RiskBadge({ risk }) {
  const map = {
    low: { c: 'emerald', t: 'Low risk' }, medium: { c: 'amber', t: 'Medium risk' }, high: { c: 'rose', t: 'High risk' },
  }
  const m = map[risk] || map.low
  return <Badge color={m.c}><span className={`h-1.5 w-1.5 rounded-full ${risk === 'low' ? 'bg-emerald-500' : risk === 'medium' ? 'bg-amber-500' : 'bg-rose-500'}`} />{m.t}</Badge>
}

export function ConfidenceLabel({ level }) {
  const map = { low: { c: 'amber', t: 'Low confidence' }, moderate: { c: 'sky', t: 'Moderate confidence' }, high: { c: 'emerald', t: 'High confidence' } }
  const m = map[level] || map.moderate
  return <Badge color={m.c}>{m.t}</Badge>
}

export function StatCard({ label, value, sub, color = 'brand' }) {
  const accent = { brand: 'text-brand-600', emerald: 'text-emerald-600', amber: 'text-amber-600', rose: 'text-rose-600', ink: 'text-ink-900' }
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</div>
      <div className={`text-2xl font-extrabold mt-1 ${accent[color] || accent.brand}`}>{value}</div>
      {sub && <div className="text-xs text-ink-500 mt-0.5">{sub}</div>}
    </div>
  )
}

// The omnipresent "this is directional, not real research" banner.
export function SyntheticBanner({ className = '' }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900 ${className}`}>
      <Info size={16} className="mt-0.5 shrink-0" />
      <p><strong>Directional signal, not validated research.</strong> These outputs simulate how an LLM models the selected audience. Treat them as a hypothesis generator — validate with the real A/B test in Step 8 before acting.</p>
    </div>
  )
}

export function ComplianceBanner({ children, tone = 'sky' }) {
  const map = { sky: 'border-sky-200 bg-sky-50 text-sky-900', emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900' }
  return (
    <div className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px] ${map[tone]}`}>
      <ShieldCheck size={16} className="mt-0.5 shrink-0" />
      <p>{children}</p>
    </div>
  )
}

export function EmptyState({ icon: Icon = Sparkles, title, children, action }) {
  return (
    <div className="grid place-items-center text-center py-12 px-6">
      <div className="grid place-items-center h-12 w-12 rounded-xl bg-ink-100 text-ink-400 mb-3"><Icon size={22} /></div>
      <h3 className="font-semibold text-ink-800">{title}</h3>
      {children && <p className="text-sm text-ink-500 mt-1 max-w-md">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
      <span className={`relative h-5 w-9 rounded-full transition ${checked ? 'bg-brand-600' : 'bg-ink-300'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label && <span className="text-sm text-ink-700">{label}</span>}
    </label>
  )
}

export function Modal({ open, onClose, title, children, wide = false }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/40 p-4 no-print" onClick={onClose}>
      <div className={`card shadow-pop w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[88vh] overflow-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5 sticky top-0 bg-white">
          <h3 className="font-bold text-ink-900">{title}</h3>
          <button className="text-ink-400 hover:text-ink-700" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function ProgressDots({ value, max = 100, color = 'bg-brand-600' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="h-2 w-full rounded-full bg-ink-100 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Spinner({ label }) {
  return (
    <div className="inline-flex items-center gap-2 text-sm text-ink-500">
      <span className="h-4 w-4 rounded-full border-2 border-ink-300 border-t-brand-600 animate-spin" />
      {label}
    </div>
  )
}
