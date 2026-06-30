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

function normCdf(x) {
  // Abramowitz & Stegun 7.1.26
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp(-x * x / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return x > 0 ? 1 - p : p
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
