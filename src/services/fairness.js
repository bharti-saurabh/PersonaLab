// Fairness & Representation Audit.
// (1) Block custom segments defined on protected classes or close proxies.
// (2) Surface representation / disparate-impact considerations for the active target.

import { PROTECTED_CLASS_PROXIES } from '../data/complianceRules.js'

// Returns { blocked: boolean, hits: [{term, basis, field}] }
export function screenCustomSegment(segment) {
  const fields = {
    name: segment.name || '',
    descriptor: segment.descriptor || '',
    motivation: segment.motivation || '',
    objections: Array.isArray(segment.objections) ? segment.objections.join(' ') : (segment.objections || ''),
  }
  const hits = []
  for (const [field, value] of Object.entries(fields)) {
    const lower = value.toLowerCase()
    for (const proxy of PROTECTED_CLASS_PROXIES) {
      const re = new RegExp(`\\b${proxy.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (re.test(lower)) hits.push({ term: proxy.term, basis: proxy.basis, field })
    }
  }
  return { blocked: hits.length > 0, hits }
}

// A refusal record for the compliance audit trail.
export function refusalRecord(segment, hits) {
  return {
    timestamp: safeNow(),
    action: 'BLOCKED custom segment',
    detail: `Custom segment "${segment.name || '(unnamed)'}" was blocked: definition references protected-class basis or close proxy (${hits.map((h) => `${h.term} → ${h.basis}`).join('; ')}).`,
    basis: 'ECOA / Reg B — segmentation must be behavioral, needs-based, or financial-profile based.',
    category: 'fair-lending',
    risk: 'high',
  }
}

// Representation note for the active (possibly intersectional) target.
export function representationNote(segmentNames) {
  return {
    summary:
      'Panel composition is constructed from behavioral and financial-profile attributes only. Protected classes are not used to define, refine, or weight the audience.',
    monitor: [
      'Confirm messaging does not imply eligibility tied to a protected basis.',
      'Check that channel targeting (where this creative runs) does not create geographic redlining or proxy exclusion.',
      'Validate that any winning variant performs acceptably across, not just within, the targeted segments to limit disparate impact.',
    ],
    targets: segmentNames,
  }
}

function safeNow() {
  try { return new Date().toISOString() } catch { return '' }
}
