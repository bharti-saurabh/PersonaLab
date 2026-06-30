import React from 'react'
import { useProject } from '../state/store.jsx'
import { PRODUCTS, OBJECTIVES, CHANNELS } from '../data/products.js'
import { SectionTitle, Card } from '../components/ui.jsx'
import { Megaphone, Check } from 'lucide-react'

export default function Step1Campaign() {
  const { project, update } = useProject()
  const c = project.campaign

  const toggleChannel = (id) => {
    const has = c.channels.includes(id)
    update({ campaign: { ...c, channels: has ? c.channels.filter((x) => x !== id) : [...c.channels, id] } })
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <SectionTitle icon={Megaphone} title="Campaign Setup"
        subtitle="Define the product, objective, and channels. Your product choice drives segment suggestions and channel constraints downstream." />

      <Card className="p-5">
        <label className="label">Product</label>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PRODUCTS.map((p) => (
            <button key={p.id}
              onClick={() => update({ campaign: { ...c, product: p.id } })}
              className={`text-left rounded-xl border p-3.5 transition ${c.product === p.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-400/30' : 'border-ink-200 hover:border-ink-300 bg-white'}`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink-900">{p.name}</span>
                {c.product === p.id && <span className="grid place-items-center h-5 w-5 rounded-full bg-brand-600 text-white"><Check size={12} /></span>}
              </div>
              <p className="text-xs text-ink-500 mt-1">{p.blurb}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <label className="label">Primary objective</label>
        <div className="grid sm:grid-cols-2 gap-2">
          {OBJECTIVES.map((o) => (
            <button key={o} onClick={() => update({ campaign: { ...c, objective: o } })}
              className={`text-left rounded-lg border px-3.5 py-2.5 text-sm transition ${c.objective === o ? 'border-brand-500 bg-brand-50 text-brand-800 font-medium' : 'border-ink-200 hover:border-ink-300 text-ink-700'}`}>
              {o}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <label className="label">Channel(s)</label>
        <p className="text-xs text-ink-500 -mt-1 mb-3">Channel constraints (character limits, structure) are enforced when you create or paste creative.</p>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((ch) => {
            const on = c.channels.includes(ch.id)
            return (
              <button key={ch.id} onClick={() => toggleChannel(ch.id)}
                className={`rounded-lg border px-3.5 py-2 text-sm transition ${on ? 'border-brand-500 bg-brand-600 text-white' : 'border-ink-200 hover:border-ink-300 text-ink-700'}`}>
                {on && <Check size={14} className="inline mr-1.5 -mt-0.5" />}{ch.name}
              </button>
            )
          })}
        </div>
        {c.channels.length > 0 && (
          <p className="text-xs text-ink-400 mt-3">Primary channel for creative: <span className="font-medium text-ink-600">{CHANNELS.find((x) => x.id === c.channels[0])?.name}</span></p>
        )}
      </Card>
    </div>
  )
}
