import React, { useState } from 'react'
import { Modal, Badge } from './ui.jsx'
import { PROVIDERS } from '../services/llm.js'
import { useStore } from '../state/store.jsx'
import { KeyRound, Trash2, Link2, Cpu, Sparkles } from 'lucide-react'

export default function SettingsModal({ open, onClose }) {
  const { state, actions } = useStore()
  const s = state.settings
  const [showKey, setShowKey] = useState(false)
  const provider = PROVIDERS[s.provider] || PROVIDERS.anthropic
  const effectiveBase = (s.baseURL || '').trim() || provider.defaultBaseURL

  return (
    <Modal open={open} onClose={onClose} title="Settings — LLM Connection">
      <div className="space-y-4">
        <p className="text-sm text-ink-500">
          Persona Lab runs fully on preloaded seed data with no key. Connect a model to power live generation
          (creative, personas, focus group, recommendations). Everything is stored only in this browser.
        </p>

        <div>
          <label className="label">Provider</label>
          <div className="flex gap-2">
            {Object.entries(PROVIDERS).map(([id, p]) => (
              <button key={id}
                className={`pill-tab border ${s.provider === id ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-ink-200 text-ink-700 hover:border-ink-300'}`}
                onClick={() => actions.setSettings({ provider: id, model: p.defaultModel, baseURL: '' })}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label flex items-center gap-2"><Link2 size={13} /> LLM Base URL</label>
          <input className="input font-mono text-xs" placeholder={provider.baseHint}
            value={s.baseURL || ''} onChange={(e) => actions.setSettings({ baseURL: e.target.value })} />
          <p className="text-xs text-ink-400 mt-1">
            Leave blank to use the default. Point at any compatible endpoint (Azure OpenAI, a gateway/proxy, or a
            local server). Requests go to <span className="font-mono text-ink-600">{effectiveBase}</span>.
          </p>
        </div>

        <div>
          <label className="label flex items-center gap-2"><Cpu size={13} /> Model</label>
          <input className="input font-mono" list="model-suggestions" placeholder={provider.defaultModel}
            value={s.model} onChange={(e) => actions.setSettings({ model: e.target.value })} />
          <datalist id="model-suggestions">
            {provider.models.map((m) => <option key={m} value={m} />)}
          </datalist>
          <p className="text-xs text-ink-400 mt-1">Type any model ID your endpoint exposes. Suggestions appear as you type.</p>
        </div>

        <div>
          <label className="label flex items-center gap-2"><KeyRound size={13} /> API Key</label>
          <div className="flex gap-2">
            <input className="input font-mono" type={showKey ? 'text' : 'password'} placeholder={provider.keyHint}
              value={s.apiKey} onChange={(e) => actions.setSettings({ apiKey: e.target.value })} />
            <button className="btn-ghost" onClick={() => setShowKey((v) => !v)}>{showKey ? 'Hide' : 'Show'}</button>
            {s.apiKey && <button className="btn-ghost text-rose-600" onClick={() => actions.setSettings({ apiKey: '' })}><Trash2 size={15} /></button>}
          </div>
          <div className="mt-1.5">{s.apiKey
            ? <Badge color="emerald"><Sparkles size={12} /> Live mode — connected</Badge>
            : <Badge color="amber">Demo mode — using seed &amp; synthetic fallback</Badge>}</div>
        </div>

        <div>
          <label className="label">Creativity (temperature): {Number(s.temperature).toFixed(2)}</label>
          <input type="range" min="0" max="1" step="0.05" value={s.temperature} className="w-full accent-brand-600"
            onChange={(e) => actions.setSettings({ temperature: parseFloat(e.target.value) })} />
        </div>

        <div className="border-t border-ink-100 pt-3 flex items-center justify-between">
          <span className="text-xs text-ink-400">Reset clears all projects and restores the two seed examples.</span>
          <button className="btn-ghost text-rose-600 text-xs" onClick={() => { if (confirm('Reset all data to seed examples?')) { actions.resetAll(); onClose() } }}>Reset to seed</button>
        </div>
      </div>
    </Modal>
  )
}
