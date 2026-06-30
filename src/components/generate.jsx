import React, { useEffect, useRef, useState } from 'react'
import { Check, Loader2, Sparkles, Cpu } from 'lucide-react'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Orchestrates the "generating in real time" feel:
 *  - streams a list of status lines into a live console (one by one)
 *  - runs the async `work` in parallel
 *  - resolves once both the streamed steps AND the work have finished
 *
 * Returns { running, lines, activeIndex, run }. While running, render <GenConsole/>.
 * When done, render the results — wrap items in .reveal (via Stagger) for the
 * staggered fade-in so they "come up one by one".
 */
export function useStagedGenerate() {
  const [running, setRunning] = useState(false)
  const [lines, setLines] = useState([]) // [{ text, done }]
  const cancelled = useRef(false)

  useEffect(() => () => { cancelled.current = true }, [])

  const run = async ({ steps = [], work, stepMs = 620, minMs = 0 }) => {
    cancelled.current = false
    setRunning(true)
    setLines(steps.map((text) => ({ text, done: false })))
    const t0 = Date.now()

    let result, error, settled = false
    const workP = Promise.resolve()
      .then(() => (work ? work() : undefined))
      .then((r) => { result = r; settled = true }, (e) => { error = e; settled = true })

    for (let i = 0; i < steps.length; i++) {
      if (cancelled.current) break
      // Once the work is already done, accelerate through the remaining lines.
      await sleep(settled ? 90 : stepMs)
      setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, done: true } : l)))
    }
    await workP
    const elapsed = Date.now() - t0
    if (minMs && elapsed < minMs) await sleep(minMs - elapsed)

    if (!cancelled.current) setRunning(false)
    if (error) throw error
    return result
  }

  return { running, lines, run }
}

/** Live "model is working" console. */
export function GenConsole({ lines, title = 'Synthesizing', subtitle }) {
  const activeIndex = lines.findIndex((l) => !l.done)
  return (
    <div className="rounded-xl border border-brand-200 bg-gradient-to-b from-brand-50/70 to-white p-4 animate-scale-in">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="grid place-items-center h-8 w-8 rounded-lg bg-brand-600 text-white shadow-sm">
          <Cpu size={16} className="animate-pulse" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-bold text-ink-900 flex items-center gap-1.5">
            {title}<span className="inline-flex gap-0.5 ml-0.5">
              <Dot d={0} /><Dot d={160} /><Dot d={320} />
            </span>
          </div>
          {subtitle && <div className="text-[11px] text-ink-500 leading-none mt-0.5">{subtitle}</div>}
        </div>
      </div>
      <div className="space-y-1.5 font-mono text-[12px]">
        {lines.map((l, i) => {
          const active = i === activeIndex
          const pending = activeIndex !== -1 && i > activeIndex
          return (
            <div key={i} className={`flex items-center gap-2 transition ${pending ? 'opacity-40' : ''}`}>
              <span className="shrink-0">
                {l.done
                  ? <Check size={13} className="text-emerald-600" />
                  : active
                    ? <Loader2 size={13} className="text-brand-600 animate-spin" />
                    : <span className="inline-block h-[13px] w-[13px] rounded-full border border-ink-200" />}
              </span>
              <span className={l.done ? 'text-ink-500' : active ? 'text-ink-900' : 'text-ink-400'}>
                {l.text}{active && <span className="inline-block w-1.5 -mb-0.5 ml-0.5 h-3.5 bg-brand-500 animate-blink" />}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Dot({ d }) {
  return <span className="h-1 w-1 rounded-full bg-brand-500 animate-blink" style={{ animationDelay: `${d}ms` }} />
}

/** Wraps a child so it fades up in sequence. Pass the running index `i`. */
export function Stagger({ i = 0, as: Tag = 'div', className = '', children, ...rest }) {
  return (
    <Tag className={`reveal ${className}`} style={{ '--i': i }} {...rest}>{children}</Tag>
  )
}

/** Small inline "thinking" indicator for buttons / inline spots. */
export function ThinkingPill({ label = 'Generating' }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <Sparkles size={14} className="animate-pulse" /> {label}…
    </span>
  )
}

/** A number that counts up to `value` for a lively "computed" feel. */
export function useCountUp(value, { ms = 700, active = true } = {}) {
  const [n, setN] = useState(active ? 0 : value)
  useEffect(() => {
    if (!active) { setN(value); return }
    let raf, start
    const from = 0, to = Number(value) || 0
    const tick = (t) => {
      if (start == null) start = t
      const p = Math.min(1, (t - start) / ms)
      const eased = 1 - Math.pow(1 - p, 3)
      setN(from + (to - from) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, ms, active])
  return n
}
