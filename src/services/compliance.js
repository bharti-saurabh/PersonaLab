// Compliance Engine — rule-based screening of creative variants.
// Runs deterministically (no API needed) so it always works in the demo, and can be
// augmented by an LLM pass (see services/llm.js + prompts.js).

import { SEVERITY_RANK } from '../data/complianceRules.js'

function variantText(variant) {
  return [variant.headline, variant.primaryText, variant.valueProp, variant.landingCopy]
    .filter(Boolean)
    .join('  \n')
}

// Screen one variant against the rulepack. Returns findings + an overall risk rating.
export function screenVariant(variant, rulepack, productId) {
  const text = variantText(variant)
  const findings = []

  for (const rule of rulepack) {
    const regexes = (rule.patterns || []).map((p) => new RegExp(p, 'i'))

    if (rule.kind === 'requirement') {
      const applies = !rule.appliesToProducts || rule.appliesToProducts.includes(productId)
      if (!applies) continue
      const satisfied = regexes.some((re) => re.test(text))
      if (!satisfied) {
        findings.push({
          ruleId: rule.id,
          category: rule.category,
          severity: rule.severity,
          name: rule.name,
          status: 'missing',
          matched: null,
          rationale: rule.rationale,
          rewrite: rule.rewrite,
        })
      }
      continue
    }

    // trigger rule
    for (const re of regexes) {
      const m = text.match(re)
      if (m) {
        findings.push({
          ruleId: rule.id,
          category: rule.category,
          severity: rule.severity,
          name: rule.name,
          status: 'triggered',
          matched: m[0],
          rationale: rule.rationale,
          rewrite: rule.rewrite,
        })
        break
      }
    }
  }

  const risk = overallRisk(findings)
  return { variantId: variant.id, risk, findings, screenedAt: nowStamp() }
}

export function overallRisk(findings) {
  if (!findings.length) return 'low'
  const max = Math.max(...findings.map((f) => SEVERITY_RANK[f.severity] || 1))
  return max >= 3 ? 'high' : max === 2 ? 'medium' : 'low'
}

export function screenAll(variants, rulepack, productId) {
  return variants.map((v) => screenVariant(v, rulepack, productId))
}

// Build an exportable audit-log row set from screen results.
export function buildAuditLog(variants, results) {
  const rows = []
  results.forEach((res) => {
    const v = variants.find((x) => x.id === res.variantId)
    if (!res.findings.length) {
      rows.push({
        variant: v?.name || res.variantId,
        timestamp: res.screenedAt,
        risk: res.risk,
        category: '—',
        rule: 'No issues detected',
        detail: 'Passed all configured rules',
        suggestedRewrite: '—',
      })
      return
    }
    res.findings.forEach((f) => {
      rows.push({
        variant: v?.name || res.variantId,
        timestamp: res.screenedAt,
        risk: f.severity,
        category: f.category,
        rule: f.name,
        detail: f.status === 'missing'
          ? `Required disclosure missing — ${f.rationale}`
          : `Triggered by "${f.matched}" — ${f.rationale}`,
        suggestedRewrite: f.rewrite,
      })
    })
  })
  return rows
}

export const RISK_STYLES = {
  low: { label: 'Low risk', chip: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  medium: { label: 'Medium risk', chip: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  high: { label: 'High risk', chip: 'bg-rose-100 text-rose-800', dot: 'bg-rose-500' },
}

function nowStamp() {
  try { return new Date().toISOString() } catch { return '' }
}
