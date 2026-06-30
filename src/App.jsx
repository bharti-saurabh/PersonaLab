import React, { useState } from 'react'
import { useStore, useProject } from './state/store.jsx'
import { STEPS, stepStatus, useNav } from './state/nav.js'
import { hasKey } from './services/llm.js'
import SettingsModal from './components/SettingsModal.jsx'
import { Modal, Badge } from './components/ui.jsx'
import {
  Settings, Plus, ChevronLeft, ChevronRight, Check, Lock,
  ChevronsUpDown, Copy, Trash2, ShieldCheck, Sparkles,
} from 'lucide-react'

import Step1Campaign from './steps/Step1Campaign.jsx'
import Step2Segment from './steps/Step2Segment.jsx'
import Step3Creative from './steps/Step3Creative.jsx'
import Step4Personas from './steps/Step4Personas.jsx'
import Step5FocusGroup from './steps/Step5FocusGroup.jsx'
import Step6Survey from './steps/Step6Survey.jsx'
import Step7Recommendation from './steps/Step7Recommendation.jsx'
import Step8ABTest from './steps/Step8ABTest.jsx'

const STEP_COMPONENTS = {
  1: Step1Campaign, 2: Step2Segment, 3: Step3Creative, 4: Step4Personas,
  5: Step5FocusGroup, 6: Step6Survey, 7: Step7Recommendation, 8: Step8ABTest,
}

// ---------------- Brand lockup ----------------
function BrandMark({ size = 36 }) {
  return (
    <div className="flex items-center gap-3">
      <img src={`${import.meta.env.BASE_URL}capone-logo.webp`} alt="Capital One" width={size} height={size}
        className="rounded-lg object-contain" style={{ width: size, height: size }} />
      <div className="leading-none">
        <div className="flex items-baseline gap-1.5">
          <span className="font-extrabold tracking-tight text-ink-900 text-[15px]">Persona&nbsp;Lab</span>
        </div>
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent-600 mt-1">Capital One</div>
      </div>
    </div>
  )
}

export default function App() {
  const { state } = useStore()
  const { project } = useProject()
  const [settingsOpen, setSettingsOpen] = useState(false)

  if (!project) return <NoProject onSettings={() => setSettingsOpen(true)} settingsOpen={settingsOpen} setSettingsOpen={setSettingsOpen} />

  return (
    <div className="min-h-full flex flex-col">
      <TopBar onSettings={() => setSettingsOpen(true)} live={hasKey(state.settings)} />
      <TopStepper />
      <main className="flex-1 min-w-0 w-full max-w-[1180px] mx-auto px-6 py-7">
        <StepHost />
        <FooterNav />
      </main>
      <Footer />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

function StepHost() {
  const { step } = useNav()
  const Comp = STEP_COMPONENTS[step] || Step1Campaign
  return <div key={step} className="animate-fade-up"><Comp /></div>
}

// ---------------- Top Bar ----------------
function TopBar({ onSettings, live }) {
  return (
    <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-ink-200 no-print">
      <div className="max-w-[1180px] mx-auto px-6 h-16 flex items-center justify-between">
        <BrandMark />
        <div className="flex items-center gap-2">
          <Badge color={live ? 'emerald' : 'amber'}>
            {live ? <><Sparkles size={12} /> Live LLM</> : 'Demo mode'}
          </Badge>
          <ProjectSwitcher />
          <button className="btn-ghost" onClick={onSettings}><Settings size={16} /> Settings</button>
        </div>
      </div>
    </header>
  )
}

function ProjectSwitcher() {
  const { state, actions } = useStore()
  const { project } = useProject()
  const [open, setOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [name, setName] = useState('')

  return (
    <div className="relative">
      <button className="btn-ghost min-w-[200px] justify-between" onClick={() => setOpen((v) => !v)}>
        <span className="truncate">{project?.name || 'Select project'}</span>
        <ChevronsUpDown size={15} className="text-ink-400 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-40 w-80 card shadow-pop p-1.5">
            {state.projects.map((p) => (
              <div key={p.id} className={`flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-ink-50 ${p.id === project?.id ? 'bg-brand-50' : ''}`}>
                <button className="flex-1 text-left min-w-0" onClick={() => { actions.selectProject(p.id); setOpen(false) }}>
                  <div className="text-sm font-medium text-ink-800 truncate">{p.name}</div>
                  <div className="text-[11px] text-ink-400">Step {p.currentStep} of 8 · {new Date(p.createdAt).toLocaleDateString()}</div>
                </button>
                <button className="p-1 text-ink-400 hover:text-brand-600" title="Duplicate" onClick={() => { actions.duplicateProject(p.id); setOpen(false) }}><Copy size={14} /></button>
                {state.projects.length > 1 && <button className="p-1 text-ink-400 hover:text-rose-600" title="Delete" onClick={() => { if (confirm(`Delete "${p.name}"?`)) actions.deleteProject(p.id) }}><Trash2 size={14} /></button>}
              </div>
            ))}
            <button className="w-full btn-subtle mt-1.5 justify-center" onClick={() => { setOpen(false); setNewOpen(true) }}><Plus size={15} /> New campaign</button>
          </div>
        </>
      )}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="New campaign">
        <label className="label">Campaign name</label>
        <input className="input" autoFocus value={name} placeholder="e.g. Q3 Cashback Acquisition" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { actions.createProject(name.trim()); setNewOpen(false); setName('') } }} />
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-ghost" onClick={() => setNewOpen(false)}>Cancel</button>
          <button className="btn-primary" disabled={!name.trim()} onClick={() => { actions.createProject(name.trim()); setNewOpen(false); setName('') }}>Create</button>
        </div>
      </Modal>
    </div>
  )
}

// ---------------- Horizontal Top Stepper ----------------
function TopStepper() {
  const { project } = useProject()
  const { step, goTo } = useNav()
  const status = stepStatus(project)
  const maxReached = project.maxStepReached || 1
  const doneCount = STEPS.filter((s) => status[s.n]).length
  const pct = (doneCount / STEPS.length) * 100

  return (
    <div className="sticky top-16 z-20 bg-white/85 backdrop-blur-md border-b border-ink-200 no-print">
      <div className="max-w-[1180px] mx-auto px-5">
        <div className="flex items-stretch gap-1 overflow-x-auto py-2.5">
          {STEPS.map((s, idx) => {
            const done = status[s.n]
            const active = s.n === step
            const locked = s.n > maxReached && s.n > 1 && !status[s.n - 1] && !active
            const Icon = s.icon
            return (
              <React.Fragment key={s.n}>
                {idx > 0 && (
                  <div className="flex items-center shrink-0 -mx-0.5">
                    <span className={`h-[2px] w-4 sm:w-7 rounded-full ${status[s.n - 1] ? 'bg-brand-500' : 'bg-ink-200'}`} />
                  </div>
                )}
                <button
                  disabled={locked}
                  onClick={() => goTo(s.n)}
                  title={s.title}
                  className={`group relative flex items-center gap-2 rounded-xl px-2.5 py-1.5 shrink-0 transition
                    ${active ? 'bg-brand-600 text-white shadow-sm'
                      : locked ? 'text-ink-300 cursor-not-allowed'
                      : 'text-ink-700 hover:bg-brand-50'}`}>
                  <span className={`grid place-items-center h-7 w-7 rounded-lg text-[11px] font-bold shrink-0 transition
                    ${active ? 'bg-white/20 text-white'
                      : done ? 'bg-emerald-100 text-emerald-700'
                      : locked ? 'bg-ink-100 text-ink-300' : 'bg-ink-100 text-ink-500 group-hover:bg-white'}`}>
                    {done && !active ? <Check size={14} /> : locked ? <Lock size={11} /> : <Icon size={14} />}
                  </span>
                  <span className="text-left leading-tight hidden md:block">
                    <span className={`block text-[9px] font-bold uppercase tracking-wider ${active ? 'text-white/70' : 'text-ink-400'}`}>Step {s.n}</span>
                    <span className="block text-[12px] font-semibold whitespace-nowrap">{s.short}</span>
                  </span>
                </button>
              </React.Fragment>
            )
          })}
        </div>
        <div className="h-[3px] -mt-px bg-ink-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-brand-600 to-accent-500 rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}

// ---------------- Footer Nav ----------------
function FooterNav() {
  const { project } = useProject()
  const { step, goNext, goBack } = useNav()
  const status = stepStatus(project)
  const canNext = status[step]
  const nextLabel = STEPS.find((s) => s.n === step + 1)?.title

  return (
    <div className="flex items-center justify-between mt-8 pt-5 border-t border-ink-200 no-print">
      <button className="btn-ghost" onClick={goBack} disabled={step === 1}><ChevronLeft size={16} /> Back</button>
      <div className="text-xs text-ink-400 flex items-center gap-1.5">
        {canNext ? <><Check size={13} className="text-emerald-600" /> Step complete</> : 'Complete this step to continue'}
      </div>
      {step < 8
        ? <button className="btn-primary" onClick={goNext} disabled={!canNext} title={canNext ? '' : 'Finish this step first'}>{nextLabel ? `Next: ${nextLabel}` : 'Next'} <ChevronRight size={16} /></button>
        : <Badge color="emerald"><Check size={13} /> Pipeline complete</Badge>}
    </div>
  )
}

// ---------------- Footer ----------------
function Footer() {
  return (
    <footer className="no-print border-t border-ink-200 bg-white/60">
      <div className="max-w-[1180px] mx-auto px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-[11px] text-ink-400">
          <img src={`${import.meta.env.BASE_URL}capone-logo.webp`} alt="" width={16} height={16} className="opacity-70" />
          <span>Persona Lab · Capital One — compliance-first synthetic audience platform.</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-ink-400">
          <ShieldCheck size={13} className="text-emerald-600" />
          Directional signal, not validated research. Data stays in your browser.
        </div>
      </div>
    </footer>
  )
}

// ---------------- Empty (no project) ----------------
function NoProject({ onSettings, settingsOpen, setSettingsOpen }) {
  const { actions } = useStore()
  return (
    <div className="min-h-full grid place-items-center p-6">
      <div className="card p-8 max-w-md text-center shadow-pop">
        <img src={`${import.meta.env.BASE_URL}capone-logo.webp`} alt="Capital One" width={56} height={56} className="mx-auto mb-3" />
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-accent-600">Capital One</div>
        <h1 className="text-2xl font-extrabold mt-0.5">Persona Lab</h1>
        <p className="text-sm text-ink-500 mt-1 mb-4">Compliance-first synthetic audience platform. No campaigns yet — create one to begin.</p>
        <button className="btn-primary mx-auto" onClick={() => actions.createProject('New Campaign')}><Plus size={16} /> New campaign</button>
      </div>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
