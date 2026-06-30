import React, { useState } from 'react'
import { STEPS, stepStatus } from '../state/nav.js'
import { SyntheticBanner, Badge, Modal } from './ui.jsx'
import { Stagger } from './generate.jsx'
import {
  Settings, Sparkles, ArrowRight, Plus, ShieldCheck, Scale,
  FlaskConical, Zap, Check, Play, FileBarChart,
} from 'lucide-react'

const LOGO = `${import.meta.env.BASE_URL}capone-logo.webp`

// one-line teaching copy per pipeline step
const STEP_BLURB = {
  campaign: 'Pick the product, objective, and channels you’re taking to market.',
  segment: 'Choose a behavioral audience from the library — or compose your own.',
  creative: 'Draft or generate variants. Every one is screened for compliance before testing.',
  personas: 'Build an on-segment panel with realistic within-segment diversity.',
  focus: 'A moderated AI discussion surfaces honest reactions and misreads.',
  survey: 'Auto-build and field a quant instrument to a larger panel for the numbers.',
  reco: 'Get a winner with confidence, segment fit, and concrete improvement ideas.',
  abtest: 'Turn the prediction into a real, properly-powered in-market A/B test.',
}

const PRINCIPLES = [
  { icon: ShieldCheck, tint: 'bg-emerald-50 text-emerald-600', title: 'Compliance-first', body: 'Fair-lending (ECOA/Reg B), UDAAP, disclosures, and prohibited-claim screening run on every variant before it’s ever tested.' },
  { icon: Scale, tint: 'bg-brand-50 text-brand-600', title: 'Fairness by design', body: 'Audiences are behavioral and needs-based. Custom segments that encode a protected class or close proxy are blocked and logged.' },
  { icon: FlaskConical, tint: 'bg-accent-50 text-accent-600', title: 'Directional, not definitive', body: 'Outputs are LLM-simulated signal to form hypotheses fast — you validate the winner with the real A/B test in Step 8.' },
  { icon: Zap, tint: 'bg-amber-50 text-amber-600', title: 'Works instantly', body: 'Runs entirely in your browser. No API key? A deterministic demo mode keeps the whole pipeline working.' },
]

export default function HomePage({ projects = [], live, onStart, onOpen, onSettings }) {
  const [nameOpen, setNameOpen] = useState(false)
  const [name, setName] = useState('')

  const start = () => { onStart(name.trim() || 'Untitled Campaign'); setNameOpen(false); setName('') }
  const firstExample = projects[0]

  return (
    <div className="min-h-full flex flex-col">
      {/* slim header */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-ink-200">
        <div className="max-w-[1180px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={LOGO} alt="Capital One" width={36} height={36} className="rounded-lg object-contain" />
            <div className="leading-none">
              <span className="font-extrabold tracking-tight text-ink-900 text-[15px]">Persona&nbsp;Lab</span>
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent-600 mt-1">Capital One</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge color={live ? 'emerald' : 'amber'}>{live ? <><Sparkles size={12} /> Live LLM</> : 'Demo mode'}</Badge>
            <button className="btn-ghost" onClick={onSettings}><Settings size={16} /> Settings</button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ---------- Hero ---------- */}
        <section className="relative overflow-hidden border-b border-ink-200">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-50 via-white to-accent-50/40" />
          <div className="absolute -top-24 -right-24 -z-10 h-80 w-80 rounded-full bg-brand-100/50 blur-3xl" />
          <div className="absolute -bottom-32 -left-24 -z-10 h-80 w-80 rounded-full bg-accent-100/40 blur-3xl" />
          <div className="max-w-[1180px] mx-auto px-6 py-16 sm:py-20">
            <div className="max-w-3xl">
              <Stagger i={0} className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/70 px-3 py-1 text-[12px] font-semibold text-brand-700 mb-5">
                <Sparkles size={13} /> Synthetic audience testing for card marketing
              </Stagger>
              <Stagger i={1} as="h1" className="text-4xl sm:text-5xl font-extrabold tracking-tight text-ink-900 leading-[1.05]">
                Pressure-test your creative on a synthetic audience —{' '}
                <span className="text-brand-600">before</span> you spend a dollar in market.
              </Stagger>
              <Stagger i={2} as="p" className="mt-5 text-lg text-ink-600 leading-relaxed max-w-2xl">
                Persona Lab simulates how a target Capital One audience reacts to your ads — a focus group,
                a survey, a clear winner, and a ready-to-run A/B plan — in minutes. It’s a fast hypothesis
                engine, with compliance and fairness built into every step.
              </Stagger>
              <Stagger i={3} className="mt-8 flex flex-wrap items-center gap-3">
                <button className="btn-accent text-[15px] px-5 py-2.5" onClick={() => setNameOpen(true)}>
                  <Plus size={18} /> Start a new campaign <ArrowRight size={16} />
                </button>
                {firstExample && (
                  <button className="btn-ghost text-[15px] px-5 py-2.5" onClick={() => onOpen(firstExample.id)}>
                    <Play size={16} /> See a finished example
                  </button>
                )}
              </Stagger>
              <Stagger i={4} className="mt-4 text-[12.5px] text-ink-400 flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-emerald-600" /> No sign-in. Everything stays in your browser.
              </Stagger>
            </div>
          </div>
        </section>

        <div className="max-w-[1180px] mx-auto px-6">
          {/* directional-signal framing (load-bearing) */}
          <div className="mt-8"><SyntheticBanner /></div>

          {/* ---------- How it works ---------- */}
          <section className="mt-14">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-2xl font-extrabold text-ink-900">How it works</h2>
              <p className="text-ink-500 mt-1.5">Eight guided steps take you from a blank campaign to an in-market test plan.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
              {STEPS.map((s, i) => {
                const Icon = s.icon
                return (
                  <Stagger key={s.key} i={i} className="card p-5 flex flex-col gap-3 hover:shadow-pop transition-shadow">
                    <div className="flex items-center justify-between">
                      <span className="grid place-items-center h-10 w-10 rounded-xl bg-brand-50 text-brand-600">
                        <Icon size={19} />
                      </span>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-ink-300">Step {s.n}</span>
                    </div>
                    <div>
                      <div className="font-bold text-ink-900 text-[15px]">{s.title}</div>
                      <p className="text-[13px] text-ink-500 leading-relaxed mt-1">{STEP_BLURB[s.key]}</p>
                    </div>
                  </Stagger>
                )
              })}
            </div>
          </section>

          {/* ---------- Principles ---------- */}
          <section className="mt-16">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-2xl font-extrabold text-ink-900">Built for a regulated business</h2>
              <p className="text-ink-500 mt-1.5">Speed is the point — but never at the expense of compliance, fairness, or honesty about what the signal is.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mt-8">
              {PRINCIPLES.map((p, i) => {
                const Icon = p.icon
                return (
                  <Stagger key={p.title} i={i} className="card p-5 flex gap-4">
                    <span className={`grid place-items-center h-11 w-11 shrink-0 rounded-xl ${p.tint}`}>
                      <Icon size={20} />
                    </span>
                    <div>
                      <div className="font-bold text-ink-900">{p.title}</div>
                      <p className="text-[13.5px] text-ink-500 leading-relaxed mt-1">{p.body}</p>
                    </div>
                  </Stagger>
                )
              })}
            </div>
          </section>

          {/* ---------- Your campaigns ---------- */}
          {projects.length > 0 && (
            <section className="mt-16">
              <div className="flex items-end justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-2xl font-extrabold text-ink-900">Your campaigns</h2>
                  <p className="text-ink-500 mt-1.5">Pick up where you left off, or open a finished example to see what the outputs look like.</p>
                </div>
                <button className="btn-primary" onClick={() => setNameOpen(true)}><Plus size={16} /> New campaign</button>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                {projects.map((p, i) => {
                  const status = stepStatus(p)
                  const done = STEPS.filter((s) => status[s.n]).length
                  const complete = done === STEPS.length
                  return (
                    <Stagger key={p.id} i={i} as="button" onClick={() => onOpen(p.id)}
                      className="card p-5 text-left hover:shadow-pop hover:border-brand-200 transition w-full">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-ink-900 truncate">{p.name}</div>
                        {complete
                          ? <Badge color="emerald"><Check size={11} /> Example</Badge>
                          : <Badge color="brand">In progress</Badge>}
                      </div>
                      <div className="text-[12px] text-ink-400 mt-1">
                        {p.campaign?.product ? p.campaign.product : 'Not set up yet'} · {new Date(p.createdAt).toLocaleDateString()}
                      </div>
                      <div className="mt-4 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-brand-600 to-accent-500 rounded-full transition-all"
                          style={{ width: `${(done / STEPS.length) * 100}%` }} />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[12px]">
                        <span className="text-ink-500">{done} / {STEPS.length} steps</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-brand-600">
                          {complete ? <><FileBarChart size={13} /> View results</> : <>Continue <ArrowRight size={13} /></>}
                        </span>
                      </div>
                    </Stagger>
                  )
                })}
              </div>
            </section>
          )}

          {/* ---------- closing CTA ---------- */}
          <section className="mt-16 mb-4">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 to-brand-600 text-white px-8 py-10 text-center shadow-pop">
              <div className="absolute -top-16 -right-10 h-56 w-56 rounded-full bg-accent-500/30 blur-3xl" />
              <h2 className="text-2xl sm:text-3xl font-extrabold relative">Ready to test an idea?</h2>
              <p className="text-white/80 mt-2 max-w-xl mx-auto relative">
                Spin up a campaign and get directional read on your creative in a few minutes. Validate the winner in market.
              </p>
              <button className="btn-accent mx-auto mt-6 text-[15px] px-6 py-2.5 relative" onClick={() => setNameOpen(true)}>
                <Plus size={18} /> Start a new campaign <ArrowRight size={16} />
              </button>
            </div>
          </section>
        </div>
      </main>

      {/* footer */}
      <footer className="border-t border-ink-200 bg-white/60 mt-8">
        <div className="max-w-[1180px] mx-auto px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-[11px] text-ink-400">
            <img src={LOGO} alt="" width={16} height={16} className="opacity-70" />
            <span>Persona Lab · Capital One — compliance-first synthetic audience platform.</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-ink-400">
            <ShieldCheck size={13} className="text-emerald-600" />
            Directional signal, not validated research. Data stays in your browser.
          </div>
        </div>
      </footer>

      {/* new-campaign name modal */}
      <Modal open={nameOpen} onClose={() => setNameOpen(false)} title="Name your campaign">
        <label className="label">Campaign name</label>
        <input className="input" autoFocus value={name} placeholder="e.g. Q3 Cashback Acquisition"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') start() }} />
        <p className="text-[12px] text-ink-400 mt-2">You’ll set the product, objective, and channels on the first step.</p>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-ghost" onClick={() => setNameOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={start}>Create &amp; start <ArrowRight size={15} /></button>
        </div>
      </Modal>
    </div>
  )
}
