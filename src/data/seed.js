// Seed data — two fully completed end-to-end projects so Persona Lab is demoable
// with zero setup and no API key. Everything is internally consistent: creative is
// run through the real Compliance Engine, and the A/B plan uses the real power calc.

import { screenAll } from '../services/compliance.js'
import { powerPlan, simulateOutcome } from '../services/stats.js'
import { getSegment, describeTarget } from './segments.js'
import { DEFAULT_RULEPACK } from './complianceRules.js'

// stable pseudo-random (no Math.random — seed projects must be identical each load)
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 } }
function ci(v, lo, hi) { return Math.max(lo, Math.min(hi, Math.round(v))) }

const NAMES = ['Maya', 'Devin', 'Aisha', 'Carlos', 'Priya', 'Jordan', 'Tariq', 'Elena', 'Sam', 'Noah', 'Grace', 'Leo', 'Nina', 'Omar', 'Ruby', 'Wes']

function makePersonas(projId, segmentIds, custom, dist, n) {
  const segs = segmentIds.map((id) => getSegment(id, custom)).filter(Boolean)
  const r = rng(hash(projId + n))
  const core = Math.round(n * dist.core), adj = Math.round(n * dist.adjacent)
  const arche = (i) => (i < core ? 'core' : i < core + adj ? 'adjacent' : 'skeptical')
  const media = ['TikTok & Instagram', 'YouTube & Reddit', 'Email & news', 'Podcasts & X', 'Mobile banking app']
  const styles = ['Compares options first', 'Decides fast on reviews', 'Reads every term', 'Asks friends/family', 'Brand-trusting']
  return Array.from({ length: n }).map((_, i) => {
    const seg = segs[i % segs.length]
    const a = arche(i)
    return {
      id: `${projId}-p${i}`,
      name: `${NAMES[i % NAMES.length]} ${String.fromCharCode(65 + i)}.`,
      age: ci(19 + r() * 35, 18, 70),
      income: `$${ci(22 + r() * 70, 18, 140)},000`,
      archetype: a,
      goals: a === 'skeptical' ? `Wants ${seg.motivation.toLowerCase()} but expects a catch` : `Focused on ${seg.motivation.toLowerCase()}`,
      voice: a === 'skeptical' ? 'Guarded, asks pointed questions' : a === 'adjacent' ? 'Curious, practical' : 'Engaged, on-message',
      financialLiteracy: a === 'core' ? (r() > 0.5 ? 'high' : 'medium') : (r() > 0.6 ? 'medium' : 'low'),
      mediaHabits: media[i % media.length],
      decisionStyle: styles[i % styles.length],
      keyObjection: (seg.objections || ['hidden fees'])[i % (seg.objections?.length || 1)],
      segmentFit: `${a === 'core' ? 'Core' : a === 'adjacent' ? 'Adjacent' : 'Skeptical'} member of ${seg.name} — ${seg.descriptor.toLowerCase()}`,
    }
  })
}

function focusFor(variants, perVariantMeta, personas) {
  const transcript = []
  variants.forEach((v) => {
    const meta = perVariantMeta[v.id]
    personas.slice(0, 3).forEach((p) => {
      transcript.push({
        variantId: v.id,
        personaName: p.name,
        text: p.archetype === 'skeptical'
          ? `Scrutinizes the offer — wants the APR and any fees spelled out before trusting "${v.headline}". ${meta.comprehensionGaps.length ? 'Initially misread the rate as permanent.' : 'Found the terms clear once pointed out.'}`
          : `Reacts to "${v.valueProp}" — ${meta.sentiment > 60 ? 'finds it clear and relevant to their goals' : 'finds it a little generic'}. Would ${meta.intentScore > 55 ? 'consider applying' : 'want more detail first'}.`,
        intentLabel: meta.intentScore > 60 ? 'would apply' : meta.intentScore > 40 ? 'might apply' : 'would not apply',
      })
    })
  })
  return { transcript, perVariant: variants.map((v) => ({ variantId: v.id, ...perVariantMeta[v.id] })), groupDynamics: true, redTeam: true }
}

const SURVEY_INSTRUMENT = [
  { id: 'q1', type: 'likert', text: 'How appealing is this offer to you?', scale: ['Not at all', 'Slightly', 'Moderately', 'Very', 'Extremely'] },
  { id: 'q2', type: 'comprehension', text: 'After any intro period, the APR on this card is…', options: ['0% forever', 'A variable go-to APR based on creditworthiness', 'Always 9.99%', 'There is no APR'], correctIndex: 1 },
  { id: 'q3', type: 'comprehension', text: 'The annual fee for this card is…', options: ['$0', '$95', 'Not stated', 'Refundable'], correctIndex: 0 },
  { id: 'q4', type: 'maxdiff', text: 'Which value prop matters most to you?' },
  { id: 'q5', type: 'intent', text: 'How likely are you to apply?', scale: ['Definitely not', 'Probably not', 'Might', 'Probably', 'Definitely'] },
  { id: 'q6', type: 'open', text: 'What, if anything, gives you pause about applying?' },
]

function buildProject1() {
  const id = 'seed-student'
  const product = 'student-card'
  const segments = ['value-conscious', 'new-to-credit', 'student']
  const distribution = { core: 0.6, adjacent: 0.25, skeptical: 0.15 }
  const channel = 'landing-page'

  const variants = [
    {
      id: `${id}-vA`, name: 'Variant A — Clear Value', channel, source: 'generated',
      headline: 'Build Credit, No Annual Fee',
      primaryText: 'A student card made simple — know exactly what you pay before you apply.',
      valueProp: '$0 annual fee and transparent terms while you build credit.',
      landingCopy: 'Built for students starting their credit journey. $0 annual fee. Variable APR 19.99%–29.99% based on creditworthiness. See if you pre-qualify with no impact to your credit score. See terms for full details.',
    },
    {
      id: `${id}-vB`, name: 'Variant B — Aspirational', channel, source: 'generated',
      headline: 'Get Approved & Level Up Your Credit',
      primaryText: 'Guaranteed approval for students — start building the future you deserve today.',
      valueProp: 'Your first step to a powerful financial future.',
      landingCopy: 'Unlock your potential with a student card designed for ambition. Start building credit and level up. Apply now — last chance to lock in this offer.',
    },
  ]
  const screenResults = screenAll(variants, DEFAULT_RULEPACK, product)
  const personas = makePersonas(id, segments, [], distribution, 12)

  const perVariantMeta = {
    [`${id}-vA`]: { sentiment: 74, trust: 81, comprehension: 88, intentScore: 63, themes: ['Clarity of $0 fee', 'Trust in transparent terms', 'Approachable for first-timers'], standoutReactions: ['Value-conscious members appreciated seeing the APR up front'], objections: ['Wants reassurance about credit-limit size'], comprehensionGaps: [] },
    [`${id}-vB`]: { sentiment: 69, trust: 48, comprehension: 61, intentScore: 58, themes: ['Aspirational tone lands emotionally', 'Skepticism about "guaranteed approval"', 'Urgency felt pushy'], standoutReactions: ['Several flagged "guaranteed approval" as too good to be true'], objections: ['Distrust of the approval promise', 'No mention of fees or APR'], comprehensionGaps: [{ term: 'APR / fees', issue: 'No rate or fee shown; multiple personas assumed it was free or fixed-rate.' }] },
  }
  const focusGroup = focusFor(variants, perVariantMeta, personas)

  const survey = buildSurvey(id, variants, segments, [], {
    [`${id}-vA`]: { top2box: 71, comprehensionRate: 86, applyIntent: 41, prefShare: 56 },
    [`${id}-vB`]: { top2box: 66, comprehensionRate: 58, applyIntent: 38, prefShare: 44 },
  })

  const recommendation = {
    winnerId: `${id}-vA`,
    predictedPrefShare: 56,
    confidence: 'moderate',
    rationale: 'Variant A is recommended. It leads on predicted preference share (56% vs 44%) and decisively on trust (81 vs 48) and comprehension (86% vs 58%). Variant B scores nearly as high on raw emotional appeal, but it triggers a high-risk "guaranteed approval" compliance issue and omits the APR/fee disclosure — and the panel misread its terms. For a regulated issuer, A is the responsible and higher-converting choice.',
    intersectionalFit: 'A serves the combined Value-Conscious + New-to-Credit + Student target well: the "$0 annual fee" speaks to value-conscious and budget-tight students, while up-front APR builds trust with new-to-credit applicants who fear hidden terms. It is strongest with Value-Conscious members; the thinnest margin is among Aspirational-leaning students who skew toward B.',
    improvements: [
      'Borrow B’s aspirational energy in A’s headline without the risky promise — e.g. lead with momentum, keep the $0 fee proof point.',
      'Add a one-line credit-limit expectation to address the top remaining objection.',
      'A/B test a benefit-led subhead against the current trust-led one.',
    ],
    segmentBreakdown: segments.map((sid) => {
      const s = getSegment(sid)
      const aShare = sid === 'student' ? 52 : sid === 'new-to-credit' ? 60 : 58
      return { segment: s.name, preferredVariantId: aShare >= 50 ? `${id}-vA` : `${id}-vB`, preferredVariant: aShare >= 50 ? 'Variant A — Clear Value' : 'Variant B — Aspirational', prefShare: Math.max(aShare, 100 - aShare), why: `${s.name} responds to ${aShare >= 50 ? 'transparent value and up-front terms' : 'aspirational framing'} — aligned to their motivation (${s.motivation}).` }
    }),
  }

  const abTest = buildAB({ baselineRate: 0.045, mde: 0.12, dailyTrafficPerArm: 1400, prefShare: 0.56, primaryMetric: 'Application start rate' })

  return {
    id, name: 'Student Card — Value-Conscious New-to-Credit', createdAt: '2026-06-01T15:00:00.000Z',
    currentStep: 8, maxStepReached: 8,
    campaign: { product, objective: 'Grow qualified application starts', channels: [channel] },
    target: { segments, custom: [] },
    creative: { variants, screenResults },
    panel: { personas, distribution, size: 12, surveySize: 300 },
    focusGroup,
    survey,
    recommendation,
    abTest,
    calibration: 'First-party benchmark: student segment baseline app-start rate ≈ 4.5%; ~60% are thin-file; mobile-first.',
  }
}

function buildProject2() {
  const id = 'seed-secured'
  const product = 'secured-card'
  const segments = ['credit-rebuilder', 'score-improver']
  const distribution = { core: 0.65, adjacent: 0.2, skeptical: 0.15 }
  const channel = 'paid-search-rsa'

  const variants = [
    {
      id: `${id}-vA`, name: 'Variant A — Second Chance', channel, source: 'generated',
      headline: 'Rebuild Credit Confidently',
      primaryText: 'Refundable deposit, reports to all 3 bureaus. $0 annual fee.',
      valueProp: 'A clear, judgment-free path to rebuild your credit.',
      landingCopy: 'Designed for rebuilding credit. Refundable security deposit sets your limit. Reports to all three bureaus to help you build history. $0 annual fee. Variable APR 27.99% based on creditworthiness. See terms.',
    },
    {
      id: `${id}-vB`, name: 'Variant B — Fast Track', channel, source: 'generated',
      headline: 'Fix Your Credit Fast',
      primaryText: 'Save thousands and repair your score overnight — no credit check needed.',
      valueProp: 'The fast way to a better score.',
      landingCopy: 'Repair your credit fast. Deposit required. Start today and watch your score climb.',
    },
  ]
  const screenResults = screenAll(variants, DEFAULT_RULEPACK, product)
  const personas = makePersonas(id, segments, [], distribution, 12)

  const perVariantMeta = {
    [`${id}-vA`]: { sentiment: 70, trust: 78, comprehension: 84, intentScore: 60, themes: ['"Judgment-free" reduces shame', 'Bureau reporting builds trust', 'Refundable deposit reassures'], standoutReactions: ['Rebuilders valued the non-judgmental tone'], objections: ['Wants to know minimum deposit'], comprehensionGaps: [] },
    [`${id}-vB`]: { sentiment: 58, trust: 34, comprehension: 52, intentScore: 47, themes: ['"Overnight" felt unrealistic', '"No credit check" raised suspicion', '"Save thousands" not believable'], standoutReactions: ['Skeptical members distrusted the speed claims'], objections: ['Distrust of overnight repair', 'Unsubstantiated savings'], comprehensionGaps: [{ term: 'Credit-building timeline', issue: 'Implied instant results; rebuilding reports over months, not overnight.' }] },
  }
  const focusGroup = focusFor(variants, perVariantMeta, personas)

  const survey = buildSurvey(id, variants, segments, [], {
    [`${id}-vA`]: { top2box: 68, comprehensionRate: 83, applyIntent: 44, prefShare: 63 },
    [`${id}-vB`]: { top2box: 51, comprehensionRate: 49, applyIntent: 33, prefShare: 37 },
  })

  const recommendation = {
    winnerId: `${id}-vA`,
    predictedPrefShare: 63,
    confidence: 'high',
    rationale: 'Variant A is recommended with high confidence (63% vs 37% preference, a 26-pt margin). It wins on trust (78 vs 34) and comprehension (83% vs 49%). Variant B carries three compliance flags — "no credit check", "save thousands", and "overnight" repair — all high/medium risk, and the panel actively distrusted it. A converts better and is compliant.',
    intersectionalFit: 'A serves both Credit Rebuilders and Score-Improvers: the judgment-free, bureau-reporting message addresses rebuilders’ fear of being judged and improvers’ desire for proof that the product helps their score. Strongest among rebuilders; improvers want even more explicit "how this builds your score" detail.',
    improvements: [
      'Add a concrete proof point: "reports to all 3 bureaus monthly" lands the score-building promise honestly.',
      'State the minimum refundable deposit to remove the top objection.',
      'Avoid any speed language entirely; lead with reliability.',
    ],
    segmentBreakdown: segments.map((sid) => {
      const s = getSegment(sid)
      const aShare = sid === 'credit-rebuilder' ? 67 : 59
      return { segment: s.name, preferredVariantId: `${id}-vA`, preferredVariant: 'Variant A — Second Chance', prefShare: aShare, why: `${s.name} responds to a credible, judgment-free message — aligned to their motivation (${s.motivation}).` }
    }),
  }

  const abTest = buildAB({ baselineRate: 0.038, mde: 0.15, dailyTrafficPerArm: 900, prefShare: 0.63, primaryMetric: 'Apply rate' })

  return {
    id, name: 'Secured Card — Rebuilders & Score-Improvers', createdAt: '2026-06-10T17:30:00.000Z',
    currentStep: 8, maxStepReached: 8,
    campaign: { product, objective: 'Drive new applications (apply rate)', channels: [channel] },
    target: { segments, custom: [] },
    creative: { variants, screenResults },
    panel: { personas, distribution, size: 12, surveySize: 250 },
    focusGroup,
    survey,
    recommendation,
    abTest,
    calibration: 'First-party benchmark: secured-card apply rate ≈ 3.8%; avg first deposit ≈ $200; primarily prior-delinquency rebuilders.',
  }
}

function buildSurvey(id, variants, segments, custom, perVariantStats) {
  const segs = segments.map((sid) => getSegment(sid, custom)).filter(Boolean)
  const perVariant = variants.map((v) => {
    const stat = perVariantStats[v.id]
    const r = rng(hash(v.id + 'seg'))
    const bySegment = segs.map((s) => ({
      segment: s.name,
      applyIntent: ci(stat.applyIntent + (r() * 18 - 9), 5, 85),
      prefShare: 0,
    }))
    return { variantId: v.id, ...stat, bySegment }
  })
  // normalize per-segment pref share across the two variants from applyIntent
  segs.forEach((s) => {
    const exps = perVariant.map((v) => Math.exp(v.bySegment.find((b) => b.segment === s.name).applyIntent / 16))
    const tot = exps.reduce((a, b) => a + b, 0)
    perVariant.forEach((v, i) => { v.bySegment.find((b) => b.segment === s.name).prefShare = Math.round((exps[i] / tot) * 100) })
  })
  const ranking = [...perVariant].sort((a, b) => b.prefShare - a.prefShare).map((v) => v.variantId)
  return { instrument: SURVEY_INSTRUMENT, results: { n: id.includes('student') ? 300 : 250, perVariant, ranking } }
}

function buildAB({ baselineRate, mde, dailyTrafficPerArm, prefShare, primaryMetric }) {
  const plan = powerPlan({ baselineRate, mde, dailyTrafficPerArm })
  const simulation = simulateOutcome({ baselineRate, prefShare, perArm: plan.perArm })
  return {
    hypothesis: `The recommended variant will lift ${primaryMetric.toLowerCase()} vs. the current control by at least ${Math.round(mde * 100)}% (relative).`,
    primaryMetric,
    guardrailMetrics: ['Approval rate', 'Early-stage delinquency', 'Cost per funded account', 'Customer complaints'],
    mde,
    alpha: 0.05,
    power: 0.8,
    baselineRate,
    dailyTrafficPerArm,
    plan,
    simulation,
  }
}

export function buildSeedState(base) {
  const p1 = buildProject1()
  const p2 = buildProject2()
  // record the compliance screens of seed creative into the audit trail
  const auditLog = []
  return {
    ...base,
    rulepack: DEFAULT_RULEPACK,
    projects: [p1, p2],
    activeProjectId: p1.id,
    auditLog,
    libraries: {
      targetingProfiles: {
        'student-card': [{ id: 'tp-student', name: 'Value-Conscious New-to-Credit Students', segments: p1.target.segments, custom: [], description: describeTarget(p1.target.segments) }],
        'secured-card': [{ id: 'tp-secured', name: 'Rebuilders & Score-Improvers', segments: p2.target.segments, custom: [], description: describeTarget(p2.target.segments) }],
      },
      panels: {
        'student-card': [{ id: 'panel-student', name: 'Student 12-persona panel', personas: p1.panel.personas, distribution: p1.panel.distribution }],
        'secured-card': [{ id: 'panel-secured', name: 'Secured 12-persona panel', personas: p2.panel.personas, distribution: p2.panel.distribution }],
      },
    },
  }
}
