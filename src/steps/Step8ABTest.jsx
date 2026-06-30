import React, { useEffect, useMemo, useState } from 'react'
import { useProject } from '../state/store.jsx'
import { SectionTitle, Card, Badge, StatCard, SyntheticBanner, EmptyState, Toggle } from '../components/ui.jsx'
import { useStagedGenerate, GenConsole, Stagger, ThinkingPill, useCountUp } from '../components/generate.jsx'
import { BarsCard, PALETTE } from '../components/charts.jsx'
import { exportCSV, exportJSON, printReport } from '../utils/export.js'
import { powerPlan, simulateOutcome } from '../services/stats.js'
import { FlaskConical, Calculator, FileDown, Save, Target, AlertTriangle, CheckCircle2, Beaker } from 'lucide-react'

const PRIMARY_METRICS = ['Click-through rate (CTR)', 'Application start rate', 'Apply rate', 'Approved-and-activated rate']
const DEFAULT_GUARDRAILS = 'Approval rate, Early-stage delinquency, Cost per funded account, Customer complaints'

const fmtPct = (v) => (Number.isFinite(v) ? (v * 100).toFixed(1) + '%' : '—')
const fmtInt = (v) => (Number.isFinite(v) ? Math.round(v).toLocaleString() : '—')

export default function Step8ABTest() {
  const { project, update } = useProject()
  const rec = project.recommendation
  const variants = project.creative?.variants || []
  const winner = rec ? variants.find((v) => v.id === rec.winnerId) : null
  const winnerName = winner?.name || 'the recommended variant'
  const objective = project.campaign?.objective || ''

  const saved = project.abTest || {}
  const [primaryMetric, setPrimaryMetric] = useState(saved.primaryMetric || PRIMARY_METRICS[0])
  const [baselineRate, setBaselineRate] = useState(saved.baselineRate ?? 0.045)
  const [mde, setMde] = useState(saved.mde ?? 0.10)
  const [alpha, setAlpha] = useState(saved.alpha ?? 0.05)
  const [power, setPower] = useState(saved.power ?? 0.80)
  const [dailyTrafficPerArm, setDailyTrafficPerArm] = useState(saved.dailyTrafficPerArm ?? 1200)
  const [guardrailsText, setGuardrailsText] = useState(
    saved.guardrailMetrics?.length ? saved.guardrailMetrics.join(', ') : DEFAULT_GUARDRAILS
  )
  const [simOn, setSimOn] = useState(!!saved.simulation)
  const [simResult, setSimResult] = useState(saved.simulation || null)
  const [hypothesis, setHypothesis] = useState(saved.hypothesis || '')

  const gen = useStagedGenerate()

  const guardrailMetrics = useMemo(
    () => guardrailsText.split(',').map((s) => s.trim()).filter(Boolean),
    [guardrailsText]
  )

  const plan = useMemo(
    () => powerPlan({ baselineRate, mde, alpha, power, dailyTrafficPerArm }),
    [baselineRate, mde, alpha, power, dailyTrafficPerArm]
  )

  const autoHypothesis = useMemo(() => {
    const lift = `a relative lift of at least ${(mde * 100).toFixed(0)}%`
    const base = `Showing "${winnerName}" instead of the control will improve ${primaryMetric.toLowerCase()} by ${lift} (from ${fmtPct(plan.baseline)} to ${fmtPct(plan.target)})`
    return objective ? `${base}, advancing the campaign objective of ${objective.toLowerCase()}.` : `${base}.`
  }, [winnerName, primaryMetric, mde, plan.baseline, plan.target, objective])

  const effectiveHypothesis = hypothesis.trim() ? hypothesis : autoHypothesis

  const canSimulate = simOn && rec && Number.isFinite(plan.perArm)
  const simulation = canSimulate ? simResult : null

  const runSimulation = async () => {
    const out = await gen.run({
      steps: [
        'Stating the hypothesis…',
        'Computing required sample size (power calc)…',
        'Estimating duration from traffic…',
        'Setting guardrail metrics…',
        'Simulating the outcome distribution…',
        'Compiling the test plan…',
      ],
      work: async () => simulateOutcome({ baselineRate, prefShare: (rec.predictedPrefShare || 0) / 100, perArm: plan.perArm }),
      minMs: 2200,
    })
    setSimResult(out)
  }

  const toggleSim = (on) => {
    setSimOn(on)
    if (on) {
      if (canSimulateNow()) runSimulation()
    } else {
      setSimResult(null)
    }
  }

  const canSimulateNow = () => !!rec && Number.isFinite(plan.perArm)

  // Inputs feeding the simulation changed — drop the stale result so the user
  // re-runs the (re-staged) simulation rather than reading outdated numbers.
  useEffect(() => {
    if (!gen.running) setSimResult(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baselineRate, plan.perArm, rec])

  const durationWeeks = Number.isFinite(plan.durationDays) && plan.durationDays != null
    ? (plan.durationDays / 7).toFixed(1)
    : null

  const buildAbTest = () => ({
    hypothesis: effectiveHypothesis,
    primaryMetric,
    guardrailMetrics,
    mde, alpha, power,
    baselineRate,
    dailyTrafficPerArm,
    plan,
    simulation,
  })

  const savePlan = () => update({ abTest: buildAbTest() })

  const planRows = () => ([{
    primary_metric: primaryMetric,
    hypothesis: effectiveHypothesis,
    baseline_rate: fmtPct(plan.baseline),
    target_rate: fmtPct(plan.target),
    relative_mde: (mde * 100).toFixed(0) + '%',
    absolute_lift: fmtPct(plan.absoluteLift),
    alpha: plan.alpha,
    power: plan.power,
    sample_per_arm: Number.isFinite(plan.perArm) ? plan.perArm : '—',
    sample_total: Number.isFinite(plan.total) ? plan.total : '—',
    daily_traffic_per_arm: dailyTrafficPerArm,
    duration_days: plan.durationDays ?? '—',
    duration_weeks: durationWeeks ?? '—',
    guardrail_metrics: guardrailMetrics.join(' | '),
  }])

  const exportPlanCSV = () => exportCSV(planRows(), `ab-test-plan-${project.id}.csv`)
  const exportPlanJSON = () => exportJSON(buildAbTest(), `ab-test-plan-${project.id}.json`)

  const simData = simulation ? [
    { name: 'Control', rate: +(simulation.controlRate * 100).toFixed(2) },
    { name: 'Predicted winner', rate: +(simulation.winnerRate * 100).toFixed(2) },
  ] : []

  return (
    <div className="space-y-6">
      <SectionTitle icon={FlaskConical} title="A/B Test Planner"
        subtitle="Turn the synthetic prediction into a real, ready-to-run experiment that validates it."
        right={
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={exportPlanCSV}><FileDown size={15} /> Plan (CSV)</button>
            <button className="btn-ghost" onClick={exportPlanJSON}><FileDown size={15} /> Plan (JSON)</button>
            <button className="btn-ghost" onClick={printReport}><FileDown size={15} /> Print</button>
            <button className="btn-primary" onClick={savePlan}><Save size={15} /> Save plan</button>
          </div>
        } />

      {!rec && (
        <Card className="p-0">
          <EmptyState icon={Target} title="No synthetic recommendation yet">
            You can still plan the experiment below. Running Step 7 produces a predicted winner and preference share, which unlocks the expected-outcome simulation here.
          </EmptyState>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="grid place-items-center h-9 w-9 rounded-lg bg-brand-50 text-brand-600"><Calculator size={18} /></div>
            <div>
              <h3 className="font-bold text-ink-900">Test inputs</h3>
              <p className="text-xs text-ink-500">Sample size and duration recompute live as you edit.</p>
            </div>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="label">Primary metric</label>
              <select className="input" value={primaryMetric} onChange={(e) => setPrimaryMetric(e.target.value)}>
                {PRIMARY_METRICS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Baseline rate (%)</label>
                <input type="number" step="0.1" min="0.1" max="99" className="input"
                  value={+(baselineRate * 100).toFixed(2)}
                  onChange={(e) => setBaselineRate(Math.max(0, (parseFloat(e.target.value) || 0) / 100))} />
                <p className="text-[11px] text-ink-400 mt-1">Current conversion for the primary metric.</p>
              </div>
              <div>
                <label className="label">Minimum detectable effect — relative lift (%)</label>
                <input type="number" step="1" min="1" className="input"
                  value={+(mde * 100).toFixed(0)}
                  onChange={(e) => setMde(Math.max(0, (parseFloat(e.target.value) || 0) / 100))} />
                <p className="text-[11px] text-ink-400 mt-1">e.g. 10 = detect a +10% relative improvement.</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="label">Significance (alpha)</label>
                <input type="number" step="0.01" min="0.01" max="0.5" className="input"
                  value={alpha} onChange={(e) => setAlpha(Math.min(0.5, Math.max(0.001, parseFloat(e.target.value) || 0.05)))} />
              </div>
              <div>
                <label className="label">Power</label>
                <input type="number" step="0.05" min="0.5" max="0.99" className="input"
                  value={power} onChange={(e) => setPower(Math.min(0.99, Math.max(0.5, parseFloat(e.target.value) || 0.8)))} />
              </div>
              <div>
                <label className="label">Daily traffic / arm</label>
                <input type="number" step="100" min="0" className="input"
                  value={dailyTrafficPerArm} onChange={(e) => setDailyTrafficPerArm(Math.max(0, parseInt(e.target.value, 10) || 0))} />
              </div>
            </div>

            <div>
              <label className="label">Guardrail metrics (comma-separated)</label>
              <input className="input" value={guardrailsText} onChange={(e) => setGuardrailsText(e.target.value)}
                placeholder={DEFAULT_GUARDRAILS} />
              {guardrailMetrics.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {guardrailMetrics.map((g, i) => <Badge key={i} color="ink">{g}</Badge>)}
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="grid place-items-center h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600"><Target size={18} /></div>
            <div>
              <h3 className="font-bold text-ink-900">Hypothesis</h3>
              <p className="text-xs text-ink-500">Auto-composed from your winner and inputs — edit if you like.</p>
            </div>
          </div>
          <textarea className="input min-h-[120px] resize-y" value={hypothesis} placeholder={autoHypothesis}
            onChange={(e) => setHypothesis(e.target.value)} />
          {!hypothesis.trim() && (
            <p className="text-xs text-ink-500 mt-2 italic">Using auto-generated hypothesis: “{autoHypothesis}”</p>
          )}
          <div className="mt-4 rounded-lg bg-ink-50 p-3.5 text-sm text-ink-700">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">Design</span>
              <Badge color="brand">Two-sided two-proportion test</Badge>
            </div>
            <p className="mt-2 text-xs text-ink-600">
              Control vs. <span className="font-medium text-ink-800">{winnerName}</span> · primary metric{' '}
              <span className="font-medium text-ink-800">{primaryMetric}</span> · alpha {plan.alpha} · power {plan.power}.
            </p>
          </div>
        </Card>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stagger i={0}>
          <CountStatCard label="Sample per arm" value={plan.perArm} format={fmtInt} sub="Required visitors in each arm" color="brand" />
        </Stagger>
        <Stagger i={1}>
          <CountStatCard label="Total sample" value={plan.total} format={fmtInt} sub="Both arms combined" color="ink" />
        </Stagger>
        <Stagger i={2}>
          <CountStatCard label="Estimated duration"
            value={Number.isFinite(plan.durationDays) ? plan.durationDays : null}
            format={(v) => (Number.isFinite(v) ? `${Math.round(v)} d` : '—')}
            sub={durationWeeks ? `≈ ${durationWeeks} weeks at ${dailyTrafficPerArm.toLocaleString()}/arm/day` : 'Set daily traffic to estimate'}
            color="amber" />
        </Stagger>
        <Stagger i={3}>
          <StatCard label="Target rate" value={fmtPct(plan.target)}
            sub={`${fmtPct(plan.baseline)} baseline · +${fmtPct(plan.absoluteLift)} absolute`} color="emerald" />
        </Stagger>
      </div>

      {!Number.isFinite(plan.perArm) && (
        <Card className="p-4">
          <p className="text-sm text-amber-800 flex items-center gap-2"><AlertTriangle size={15} /> The effect size is too small to size this test (sample would be effectively infinite). Increase the minimum detectable effect.</p>
        </Card>
      )}

      {rec && (
        <Card className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="grid place-items-center h-9 w-9 rounded-lg bg-violet-50 text-violet-600"><Beaker size={18} /></div>
              <div>
                <h3 className="font-bold text-ink-900">Expected outcome simulation</h3>
                <p className="text-xs text-ink-500">Projects the test result from the synthetic preference share ({(rec.predictedPrefShare || 0).toFixed(0)}% for the winner).</p>
              </div>
            </div>
            <Toggle checked={simOn} onChange={toggleSim} label="Simulate expected A/B outcome from synthetic preference share" />
          </div>

          {!simOn ? (
            <p className="text-sm text-ink-400">Turn on to project control vs. predicted-winner rates at your planned sample size.</p>
          ) : gen.running ? (
            <GenConsole lines={gen.lines} title="Simulating the expected A/B outcome"
              subtitle={`${primaryMetric} · ${(rec.predictedPrefShare || 0).toFixed(0)}% synthetic preference share`} />
          ) : !Number.isFinite(plan.perArm) ? (
            <div className="flex items-center gap-2 text-sm text-ink-500"><AlertTriangle size={15} className="text-amber-600" /> Awaiting a finite sample size to simulate.</div>
          ) : !simulation ? (
            <button className="btn-primary" onClick={runSimulation} disabled={gen.running}>
              {gen.running ? <ThinkingPill label="Simulating" /> : <><Beaker size={15} /> Run simulation</>}
            </button>
          ) : (
            <div className="grid lg:grid-cols-2 gap-5 items-start">
              <Stagger i={0}>
                <BarsCard title="Control vs. predicted winner" subtitle="Primary metric rate (%)"
                  data={simData} xKey="name"
                  bars={[{ key: 'rate', name: primaryMetric, color: PALETTE[0] }]} />
              </Stagger>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Stagger i={1}>
                    <StatCard label="Predicted relative lift" value={fmtPct(simulation.relativeLift)}
                      sub={`${fmtPct(simulation.controlRate)} → ${fmtPct(simulation.winnerRate)}`} color="brand" />
                  </Stagger>
                  <Stagger i={2}>
                    <StatCard label="p-value" value={Number.isFinite(simulation.pValue) ? simulation.pValue.toFixed(4) : '—'}
                      sub={`z = ${Number.isFinite(simulation.z) ? simulation.z.toFixed(2) : '—'}`} color="ink" />
                  </Stagger>
                </div>
                <Stagger i={3} className="flex items-center gap-2">
                  {simulation.significant
                    ? <Badge color="emerald"><CheckCircle2 size={13} /> Projected significant at alpha {plan.alpha}</Badge>
                    : <Badge color="amber"><AlertTriangle size={13} /> Projected not significant at alpha {plan.alpha}</Badge>}
                </Stagger>
                <p className="text-[13px] text-ink-500">
                  This is a <strong>synthetic projection, not a guarantee</strong>. It maps the LLM's predicted preference share to a dampened expected lift — real customer behavior may differ. The live A/B test is what confirms it.
                </p>
              </div>
            </div>
          )}
        </Card>
      )}

      <div className="rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-[13px] text-sky-900">
        <p><strong>This is the validation step.</strong> Everything upstream is a synthetic hypothesis about how your audience reacts. Running this experiment with real customers is how that prediction gets confirmed — or corrected — before you scale spend.</p>
      </div>

      <SyntheticBanner />
    </div>
  )
}

function CountStatCard({ label, value, format, sub, color }) {
  const active = Number.isFinite(value)
  const n = useCountUp(active ? value : 0, { ms: 900, active })
  return <StatCard label={label} value={active ? format(n) : format(value)} sub={sub} color={color} />
}
