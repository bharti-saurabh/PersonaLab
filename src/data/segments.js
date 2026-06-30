// Persona Lab — Target Segment Library
// Four lenses of behavioral / needs-based / financial-profile segmentation.
// IMPORTANT: segments are intentionally NOT defined by protected classes
// (race, color, religion, national origin, sex, marital status, age as a
// protected basis under ECOA, receipt of public assistance). They are
// behavioral, needs-based, and financial-profile based only.

export const LENSES = [
  { id: 'A', name: 'Value & Rewards Orientation', blurb: 'What the customer optimizes for economically.' },
  { id: 'B', name: 'Credit Lifecycle Stage', blurb: 'Where the customer sits on the credit-building journey.' },
  { id: 'C', name: 'Life Stage', blurb: 'The life context shaping financial needs.' },
  { id: 'D', name: 'Financial Mindset & Behavior', blurb: 'How the customer thinks about and uses credit.' },
]

export const SEGMENTS = [
  // ---- Lens A — Value & Rewards Orientation ----
  { id: 'value-conscious', lens: 'A', name: 'Value-Conscious / No-Fee Seeker', descriptor: 'Prioritizes zero or low annual fee and simplicity.', motivation: 'Avoid hidden cost.', objections: ['Suspicious of fees buried in fine print', 'Wants to know the catch'] },
  { id: 'cashback-maximizer', lens: 'A', name: 'Cashback Maximizer', descriptor: 'Optimizes everyday flat or category cashback.', motivation: 'Tangible everyday ROI.', objections: ['Will compare reward rates closely', 'Rotating categories feel like work'] },
  { id: 'travel-maximizer', lens: 'A', name: 'Travel / Points Maximizer', descriptor: 'Chases miles, transfer partners, and redemptions.', motivation: 'Maximize travel value; churn-aware.', objections: ['Annual fee must be earned back', 'Transfer-partner devaluation risk'] },
  { id: 'premium-status', lens: 'A', name: 'Premium / Status Seeker', descriptor: 'Wants lounge access, perks, and prestige.', motivation: 'Status; willing to pay a high fee.', objections: ['Perks must feel genuinely premium', 'Sensitive to perceived nickel-and-diming'] },
  { id: 'welcome-bonus', lens: 'A', name: 'Welcome-Bonus Chaser', descriptor: 'Driven by sign-up offers.', motivation: 'Short-term bonus value; high churn risk.', objections: ['Spend threshold must be attainable', 'Wary of bonus clawbacks'] },
  { id: 'balance-transfer', lens: 'A', name: 'Balance-Transfer / Debt-Consolidation Seeker', descriptor: 'Wants 0% intro APR to pay down debt.', motivation: 'Reduce interest burden.', objections: ['Balance-transfer fee math', 'What the rate becomes after intro'] },
  { id: 'low-apr', lens: 'A', name: 'Low-APR / Rate-Sensitive Carrier', descriptor: 'Revolves a balance month to month.', motivation: 'Lowest ongoing APR.', objections: ['Rewards mean little if APR is high', 'Penalty-APR triggers'] },

  // ---- Lens B — Credit Lifecycle Stage ----
  { id: 'new-to-credit', lens: 'B', name: 'New-to-Credit / Thin-File', descriptor: 'First card, little or no credit history.', motivation: 'Approachability and education.', objections: ['Fear of rejection', 'Does not understand credit jargon'] },
  { id: 'credit-rebuilder', lens: 'B', name: 'Credit Rebuilder', descriptor: 'Recovering from past delinquency; secured-card candidate.', motivation: 'A second chance.', objections: ['Expects to be judged', 'Worried about deposit and fees'] },
  { id: 'score-improver', lens: 'B', name: 'Score-Improver / Credit-Curious', descriptor: 'Actively raising their credit score.', motivation: 'Credit growth and education.', objections: ['Wants proof a product helps the score', 'Distrusts vague promises'] },
  { id: 'established-prime', lens: 'B', name: 'Established Prime', descriptor: 'Solid credit with many options.', motivation: 'A clear reason to switch.', objections: ['Switching cost and inertia', 'Already has a card that works'] },
  { id: 'super-prime', lens: 'B', name: 'Super-Prime / Affluent', descriptor: 'High income and high spend.', motivation: 'Premium experience and concierge service.', objections: ['Service must match the fee', 'Unimpressed by mass-market perks'] },

  // ---- Lens C — Life Stage ----
  { id: 'student', lens: 'C', name: 'Student', descriptor: 'In school, budget-tight, mobile-first.', motivation: 'Build credit affordably.', objections: ['Cannot afford a fee', 'Worried about overspending'] },
  { id: 'young-professional', lens: 'C', name: 'Young Professional / Early Career', descriptor: 'First stable income.', motivation: 'Aspirational, status-aware value.', objections: ['Wants to look established', 'Limited but growing budget'] },
  { id: 'family-manager', lens: 'C', name: 'Family / Household Manager', descriptor: 'Manages shared household spend.', motivation: 'Value plus useful rewards (groceries, gas).', objections: ['Rewards must fit real spending', 'No time for complexity'] },
  { id: 'mid-career', lens: 'C', name: 'Established Mid-Career', descriptor: 'Stable finances.', motivation: 'Optimize and consolidate.', objections: ['Already has cards', 'Needs a compelling upgrade'] },
  { id: 'pre-retiree', lens: 'C', name: 'Pre-Retiree / Retiree', descriptor: 'Fixed income.', motivation: 'Simplicity, security, fraud protection.', objections: ['Distrusts complexity', 'Prioritizes safety over rewards'] },
  { id: 'small-business', lens: 'C', name: 'Small-Business Owner / Side-Hustler', descriptor: 'Business and personal spend blur together.', motivation: 'Cashflow and expense tracking.', objections: ['Needs clean expense separation', 'Cashflow timing sensitivity'] },
  { id: 'new-immigrant', lens: 'C', name: 'New Immigrant / Recently Arrived', descriptor: 'Limited US credit history.', motivation: 'Alternative-data underwriting and trust.', objections: ['No SSN-based history', 'Needs to trust an unfamiliar issuer'] },

  // ---- Lens D — Financial Mindset & Behavior ----
  { id: 'transactor', lens: 'D', name: 'Transactor', descriptor: 'Pays the balance in full every month.', motivation: 'Rewards and convenience; never carries a balance.', objections: ['APR is irrelevant to them', 'Will not tolerate friction'] },
  { id: 'revolver', lens: 'D', name: 'Revolver', descriptor: 'Carries a balance month to month.', motivation: 'Financing; sensitive to APR and minimum payments.', objections: ['Minimum-payment anxiety', 'Interest accrual'] },
  { id: 'convenience-driven', lens: 'D', name: 'Convenience-Driven', descriptor: 'Wants a frictionless digital experience.', motivation: 'Ease over optimization.', objections: ['Will abandon a clunky flow', 'Indifferent to small reward gains'] },
  { id: 'debt-averse', lens: 'D', name: 'Debt-Averse / Financially Cautious', descriptor: 'Careful and skeptical; reads the fine print.', motivation: 'Transparency.', objections: ['Distrusts anything that sounds too good', 'Fee-phobic'] },
  { id: 'aspirational', lens: 'D', name: 'Aspirational Spender', descriptor: 'Uses credit for lifestyle and status.', motivation: 'Emotional, identity-driven.', objections: ['Wants the card to signal success', 'Can overextend'] },
  { id: 'digital-native', lens: 'D', name: 'Digital-Native / App-First', descriptor: 'Gen Z to millennial, app-first.', motivation: 'A slick app and instant decisions.', objections: ['Expects instant approval', 'Low tolerance for paperwork'] },
  { id: 'skeptical', lens: 'D', name: 'Skeptical / Distrustful', descriptor: 'Burned before; wary of banks.', motivation: 'Transparency; wary of fees and banks.', objections: ['Assumes there is a catch', 'Distrusts marketing language'] },
  { id: 'brand-loyal', lens: 'D', name: 'Brand-Loyal / Co-Brand Affinity', descriptor: 'Loyal to a specific airline, hotel, or retailer.', motivation: 'Brand-aligned rewards.', objections: ['Only values brand-relevant perks', 'Loyal to incumbent co-brand'] },
]

export const SEGMENTS_BY_ID = Object.fromEntries(SEGMENTS.map((s) => [s.id, s]))

export function getSegment(id, customSegments = []) {
  return SEGMENTS_BY_ID[id] || customSegments.find((c) => c.id === id) || null
}

export function segmentsByLens(lensId) {
  return SEGMENTS.filter((s) => s.lens === lensId)
}

// Render a plain-language description of the (possibly intersectional) target.
export function describeTarget(segmentIds, customSegments = []) {
  const segs = segmentIds.map((id) => getSegment(id, customSegments)).filter(Boolean)
  if (segs.length === 0) return ''
  if (segs.length === 1) return `${segs[0].name} — ${segs[0].descriptor.toLowerCase()}`
  const names = segs.map((s) => s.name)
  const motivations = segs.map((s) => s.motivation.replace(/\.$/, '').toLowerCase())
  const last = names.pop()
  return `A customer at the intersection of ${names.join(', ')} and ${last}. They are motivated by ${motivations.join('; ')}. Messaging, panel, survey, and recommendation must stay coherent with all of these at once.`
}

// Product → most-relevant segment ids, surfaced at the top of Step 2.
export const PRODUCT_SEGMENT_AFFINITY = {
  'student-card': ['student', 'new-to-credit', 'value-conscious', 'digital-native', 'score-improver'],
  'secured-card': ['credit-rebuilder', 'score-improver', 'new-to-credit', 'new-immigrant', 'debt-averse'],
  'travel-rewards': ['travel-maximizer', 'super-prime', 'welcome-bonus', 'aspirational', 'transactor'],
  'cashback': ['cashback-maximizer', 'family-manager', 'value-conscious', 'convenience-driven', 'transactor'],
  'balance-transfer': ['balance-transfer', 'revolver', 'low-apr', 'debt-averse', 'mid-career'],
}
