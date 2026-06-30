// Stats utilities for the A/B Test Planner — two-proportion power / sample-size.

// Inverse normal CDF (Acklam approximation) — good to ~1e-9.
function normInv(p) {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239]
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]
  const pl = 0.02425
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
  }
  if (p <= 1 - pl) {
    const q = p - 0.5, r = q*q
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)
  }
  const q = Math.sqrt(-2 * Math.log(1 - p))
  return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
}

// Required sample size PER ARM for a two-sided two-proportion test.
// baseline & target are proportions (0..1). alpha default .05, power default .80.
export function sampleSizePerArm(baseline, target, alpha = 0.05, power = 0.8) {
  const p1 = baseline, p2 = target
  const zAlpha = normInv(1 - alpha / 2)
  const zBeta = normInv(power)
  const pBar = (p1 + p2) / 2
  const num = zAlpha * Math.sqrt(2 * pBar * (1 - pBar)) + zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))
  const denom = Math.abs(p2 - p1)
  if (denom === 0) return Infinity
  return Math.ceil((num * num) / (denom * denom))
}

// Full plan calc. mde is the RELATIVE lift (e.g. 0.10 for +10%).
export function powerPlan({ baselineRate, mde, alpha = 0.05, power = 0.8, dailyTrafficPerArm }) {
  const baseline = clamp(baselineRate, 0.0001, 0.9999)
  const target = clamp(baseline * (1 + mde), 0.0001, 0.9999)
  const perArm = sampleSizePerArm(baseline, target, alpha, power)
  const total = perArm * 2
  const days = dailyTrafficPerArm > 0 ? Math.ceil(perArm / dailyTrafficPerArm) : null
  return {
    baseline, target,
    absoluteLift: target - baseline,
    relativeLift: mde,
    perArm, total,
    alpha, power,
    durationDays: days,
    dailyTrafficPerArm,
  }
}

// Simulate an expected A/B outcome from synthetic preference share.
// prefShare is winner's predicted share (0..1) among a 2-way choice.
export function simulateOutcome({ baselineRate, prefShare, perArm }) {
  // Map preference share to an expected relative lift, dampened (synthetic ≠ real).
  const rawLift = (prefShare - 0.5) * 2 // -1..1
  const dampened = rawLift * 0.45 // synthetic optimism discount
  const winnerRate = clamp(baselineRate * (1 + dampened), 0.0001, 0.9999)
  const se = Math.sqrt(baselineRate * (1 - baselineRate) / perArm + winnerRate * (1 - winnerRate) / perArm)
  const z = (winnerRate - baselineRate) / (se || 1)
  const pValue = 2 * (1 - normCdf(Math.abs(z)))
  return {
    controlRate: baselineRate,
    winnerRate,
    relativeLift: (winnerRate - baselineRate) / baselineRate,
    z, pValue,
    significant: pValue < 0.05,
  }
}

// Default real-world baseline priors per primary metric (all editable in the UI).
const METRIC_BASELINE = {
  'Click-through rate (CTR)': 0.012,
  'Application start rate': 0.06,
  'Apply rate': 0.045,
  'Approved-and-activated rate': 0.025,
}
const OBJECTIVE_METRIC = {
  'Drive new applications (apply rate)': 'Apply rate',
  'Improve click-through to landing page': 'Click-through rate (CTR)',
  'Increase approved-and-activated accounts': 'Approved-and-activated rate',
  'Grow qualified application starts': 'Application start rate',
  'Improve cost-per-funded-account': 'Approved-and-activated rate',
  'Brand consideration / awareness': 'Click-through rate (CTR)',
}

// Translate the synthetic signal (recommendation + survey answers + focus group)
// into a PRIOR for the real A/B test: which metric, a baseline, the lift we expect
// to see, the MDE to power for, and signal-driven guardrails. Everything here is a
// starting point the user can override — synthetic is directional, not validated.
export function deriveAbPlan({ objective, survey, focusGroup, recommendation, variants = [] }) {
  const results = survey?.results || survey || {}
  const perVariant = results.perVariant || []
  const questions = results.questions || []
  const winnerId = recommendation?.winnerId
  const vName = (id) => variants.find((v) => v.id === id)?.name || id

  const primaryMetric = OBJECTIVE_METRIC[objective] || 'Apply rate'
  const baselineRate = METRIC_BASELINE[primaryMetric] ?? 0.045

  // Winner preference share (0..1) — the same signal the outcome simulation uses.
  const prefSharePct = recommendation?.predictedPrefShare
    ?? perVariant.find((v) => v.variantId === winnerId)?.prefShare
    ?? 50
  const prefShare = clamp(prefSharePct / 100, 0.0001, 0.9999)
  // Expected relative lift, dampened identically to simulateOutcome() so the planner
  // and the simulation never disagree.
  const expectedLift = Math.max(0, (prefShare - 0.5) * 2 * 0.45)
  // Power to detect a conservative fraction of the expected effect, so a weaker-than-
  // synthetic reality still isn't under-powered. Floor 5%, cap 50%.
  const mde = clamp(Math.round(expectedLift * 0.6 * 100) / 100, 0.05, 0.5)

  // ---- Signal-driven guardrails + an explanation of what was learned ----
  const guardrails = ['Approval rate', 'Early-stage delinquency', 'Cost per funded account', 'Customer complaints']
  const notes = [
    `Predicted preference share ${Math.round(prefSharePct)}% → expected relative lift ≈ ${(expectedLift * 100).toFixed(0)}%; powering to detect ${(mde * 100).toFixed(0)}% (a conservative fraction so reality isn't under-powered).`,
  ]

  const intentQ = questions.find((q) => q.type === 'intent')
  const winnerIntent = intentQ?.byVariant?.find((b) => b.variantId === winnerId)?.top2box
  if (winnerIntent != null) notes.push(`Survey apply-intent for ${vName(winnerId)} is ${winnerIntent}% (top-2 box) — corroborates the predicted lift.`)

  const fgWinner = focusGroup?.perVariant?.find((v) => v.variantId === winnerId)
  if (fgWinner) {
    notes.push(`Focus group on the winner: sentiment ${fgWinner.sentiment}, trust ${fgWinner.trust}, comprehension ${fgWinner.comprehension}.`)
    if (fgWinner.trust != null && fgWinner.trust < 55) {
      guardrails.push('Brand trust / sentiment tracking')
      notes.push(`Trust is soft (${fgWinner.trust}/100) — added a trust guardrail so a conversion lift doesn't quietly erode trust.`)
    }
  }

  const compQ = questions.find((q) => q.type === 'comprehension')
  if (compQ?.flagged) {
    guardrails.push('Disclosure comprehension & complaint rate')
    const worst = compQ.worstVariant || (compQ.byVariant ? [...compQ.byVariant].sort((a, b) => a.correctPct - b.correctPct)[0] : null)
    notes.push(`⚠ Survey flagged a misread of ${compQ.term || 'a material term'}${worst ? ` (worst on ${worst.name}, ${worst.correctPct}%)` : ''} — added a disclosure-comprehension guardrail to the live test.`)
  }

  return {
    primaryMetric,
    baselineRate,
    mde,
    expectedLift,
    prefSharePct: Math.round(prefSharePct),
    winnerIntent: winnerIntent ?? null,
    guardrailMetrics: guardrails.filter((x, i) => guardrails.indexOf(x) === i),
    notes,
  }
}

function normCdf(x) {
  // Abramowitz & Stegun 7.1.26
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp(-x * x / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return x > 0 ? 1 - p : p
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
