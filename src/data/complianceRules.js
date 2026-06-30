// Persona Lab — Financial-Services Compliance Rulepack (editable, default policy)
//
// This is a configurable, demo-grade rulepack — NOT legal advice. It approximates
// common credit-card marketing review standards so issuers can tune it to their own
// policy. Categories:
//   fair-lending  — ECOA / Reg B (no discouragement, no protected-class basis)
//   udaap         — unfair, deceptive, or abusive acts or practices
//   disclosure    — required & clear-and-conspicuous terms (APR, fees, terms)
//   prohibited    — prohibited / high-risk claims
//
// Rule kinds:
//   trigger     — matching `patterns` (regex, case-insensitive) flags the text
//   requirement — for products in `appliesToProducts`, if NONE of `patterns`
//                 appear anywhere in the creative, the disclosure is missing
//
// Severity drives the risk rating: high > medium > low.

export const DEFAULT_RULEPACK = [
  // ---------- Prohibited / high-risk claims ----------
  {
    id: 'guaranteed-approval',
    category: 'prohibited',
    kind: 'trigger',
    severity: 'high',
    name: 'Guaranteed approval claim',
    patterns: ['guarantee[d]?\\s+(approval|acceptance)', 'approval\\s+guaranteed', 'everyone\\s+is\\s+approved', '100%\\s+approval'],
    rationale: 'Promising approval is deceptive (UDAAP) and conflicts with individualized underwriting required under ECOA. Approval can never be guaranteed before an application is evaluated.',
    rewrite: 'See if you may pre-qualify with no impact to your credit score.',
  },
  {
    id: 'no-credit-check',
    category: 'prohibited',
    kind: 'trigger',
    severity: 'high',
    name: '"No credit check" claim',
    patterns: ['no\\s+credit\\s+check', 'without\\s+a\\s+credit\\s+check', 'no\\s+credit\\s+required'],
    rationale: 'Most credit products involve a credit inquiry. Stating "no credit check" is typically deceptive unless literally and always true for the product.',
    rewrite: 'Checking if you pre-qualify won’t affect your credit score.',
  },
  {
    id: 'free-misuse',
    category: 'udaap',
    kind: 'trigger',
    severity: 'medium',
    name: 'Unqualified use of "free"',
    patterns: ['\\bfree\\b'],
    rationale: '"Free" must not be used when costs apply. If any fee, deposit, or condition exists, "free" is potentially deceptive and triggers the FTC/clear-and-conspicuous standard for qualifying the claim.',
    rewrite: 'State the actual cost plainly — e.g. "$0 annual fee" — rather than the unqualified word "free".',
  },
  {
    id: 'unsubstantiated-savings',
    category: 'udaap',
    kind: 'trigger',
    severity: 'medium',
    name: 'Unsubstantiated savings / earnings claim',
    patterns: ['save\\s+\\$?\\d{3,}', 'save\\s+thousands', 'earn\\s+\\$?\\d{3,}\\s+(back|cash)', 'pay\\s+off.*(fast|instantly|overnight)'],
    rationale: 'Specific savings or earnings figures must be substantiated and typically require "results vary" context. Unsupported numbers are deceptive.',
    rewrite: 'Tie any savings figure to a stated assumption (e.g. "based on $X balance at Y% APR") or remove it.',
  },
  {
    id: 'pressure-tactics',
    category: 'udaap',
    kind: 'trigger',
    severity: 'medium',
    name: 'Abusive urgency / pressure',
    patterns: ['act\\s+now\\s+or', 'last\\s+chance', 'don.?t\\s+miss\\s+out', 'limited\\s+time\\s+only', 'expires\\s+today'],
    rationale: 'Manufactured urgency can be an abusive practice when it pressures consumers into financial decisions without adequate consideration.',
    rewrite: 'Communicate genuine offer windows factually (e.g. "Offer ends 12/31") without coercive language.',
  },
  {
    id: 'risk-free',
    category: 'udaap',
    kind: 'trigger',
    severity: 'medium',
    name: '"Risk-free" / "no risk" claim',
    patterns: ['risk[-\\s]?free', 'no\\s+risk', 'zero\\s+risk'],
    rationale: 'Credit products carry risk (interest, fees, credit impact). "Risk-free" is misleading.',
    rewrite: 'Describe specific protections factually instead of implying there is no risk.',
  },

  // ---------- Fair lending / ECOA (Reg B) ----------
  {
    id: 'discouragement',
    category: 'fair-lending',
    kind: 'trigger',
    severity: 'high',
    name: 'Potential applicant discouragement',
    patterns: ['not\\s+for\\s+(you\\s+)?(everyone|people\\s+with\\s+bad)', 'only\\s+for\\s+(the\\s+)?(wealthy|elite|rich)', 'must\\s+be\\s+(a\\s+)?(homeowner|married)'],
    rationale: 'Reg B prohibits statements that would discourage a reasonable person from applying on a prohibited basis or that impose non-creditworthiness conditions.',
    rewrite: 'Focus on product benefits and eligibility tied to creditworthiness, not exclusionary language.',
  },
  {
    id: 'protected-basis-language',
    category: 'fair-lending',
    kind: 'trigger',
    severity: 'high',
    name: 'Targeting language referencing a protected basis',
    patterns: ['\\b(men|women|male|female)\\s+only\\b', '\\bfor\\s+(christians|muslims|jews|catholics)\\b', '\\b(young|old)\\s+people\\s+only\\b', 'perfect\\s+for\\s+(single\\s+moms|married\\s+couples)'],
    rationale: 'ECOA prohibits targeting or copy that references race, color, religion, national origin, sex, marital status, age, or public-assistance status as a basis.',
    rewrite: 'Describe the product’s value to a behavioral/financial need, not to a protected class.',
  },

  // ---------- Required disclosures ----------
  {
    id: 'apr-disclosure',
    category: 'disclosure',
    kind: 'requirement',
    severity: 'high',
    name: 'APR disclosure present',
    appliesToProducts: ['student-card', 'cashback', 'travel-rewards', 'low-apr-card', 'balance-transfer'],
    patterns: ['\\bAPR\\b', 'annual\\s+percentage\\s+rate', '%\\s*(intro\\s*)?apr'],
    rationale: 'When an APR or rate-related benefit is advertised, the APR (and that rates vary by creditworthiness) must be clearly and conspicuously disclosed. Required terms cannot be buried.',
    rewrite: 'Add a clear APR line, e.g. "Variable APR 19.99%–29.99% based on creditworthiness. See terms."',
  },
  {
    id: 'fee-disclosure',
    category: 'disclosure',
    kind: 'requirement',
    severity: 'medium',
    name: 'Fee disclosure present',
    appliesToProducts: ['secured-card', 'travel-rewards', 'student-card', 'cashback', 'low-apr-card', 'balance-transfer'],
    patterns: ['\\bfee[s]?\\b', 'annual\\s+fee', 'no\\s+annual\\s+fee', '\\$0\\s+annual', 'deposit'],
    rationale: 'Fees and any required deposit (for secured products) are material terms and must be disclosed clearly and conspicuously.',
    rewrite: 'State the annual fee (or "$0 annual fee") and, for secured cards, the refundable deposit range.',
  },
  {
    id: 'intro-rate-terms',
    category: 'disclosure',
    kind: 'requirement',
    severity: 'high',
    name: 'Intro-rate terms & go-to APR present',
    appliesToProducts: ['balance-transfer'],
    patterns: ['after\\s+the\\s+intro', 'then\\s+\\d', 'go-?to\\s+apr', 'regular\\s+apr', 'intro\\s+period', '\\d+\\s+months'],
    rationale: 'A 0% intro offer must disclose the promotional length and the go-to APR afterward, plus any balance-transfer fee. Omitting the post-intro rate is deceptive.',
    rewrite: 'Add: "0% intro APR for N months, then XX.XX%–XX.XX% variable. Balance-transfer fee applies."',
  },
]

// Terms/phrases that are protected classes or close proxies. Used by the Fairness
// Audit to BLOCK custom segments and flag targeting that could create disparate impact.
export const PROTECTED_CLASS_PROXIES = [
  { term: 'race', basis: 'Race / color' }, { term: 'black', basis: 'Race / color' },
  { term: 'white', basis: 'Race / color' }, { term: 'hispanic', basis: 'National origin' },
  { term: 'latino', basis: 'National origin' }, { term: 'latina', basis: 'National origin' },
  { term: 'asian', basis: 'Race / national origin' }, { term: 'african', basis: 'Race / national origin' },
  { term: 'immigrant status', basis: 'National origin (status as proxy)' },
  { term: 'religion', basis: 'Religion' }, { term: 'christian', basis: 'Religion' },
  { term: 'muslim', basis: 'Religion' }, { term: 'jewish', basis: 'Religion' },
  { term: 'catholic', basis: 'Religion' },
  { term: 'male', basis: 'Sex' }, { term: 'female', basis: 'Sex' },
  { term: 'men', basis: 'Sex' }, { term: 'women', basis: 'Sex' },
  { term: 'gender', basis: 'Sex' },
  { term: 'married', basis: 'Marital status' }, { term: 'single mom', basis: 'Marital status / sex' },
  { term: 'divorced', basis: 'Marital status' }, { term: 'widow', basis: 'Marital status' },
  { term: 'elderly', basis: 'Age' }, { term: 'seniors only', basis: 'Age' },
  { term: 'under 25 only', basis: 'Age' },
  { term: 'pregnant', basis: 'Sex' }, { term: 'disabled', basis: 'Disability (and public-assistance proxy)' },
  { term: 'public assistance', basis: 'Receipt of public assistance' },
  { term: 'welfare', basis: 'Receipt of public assistance' },
  { term: 'food stamps', basis: 'Receipt of public assistance' },
  { term: 'zip code', basis: 'Geography as redlining proxy' },
  { term: 'neighborhood', basis: 'Geography as redlining proxy' },
]

export const CATEGORY_META = {
  'fair-lending': { label: 'Fair Lending (ECOA / Reg B)', color: 'violet' },
  udaab: { label: 'UDAAP', color: 'amber' },
  udaap: { label: 'UDAAP', color: 'amber' },
  disclosure: { label: 'Required Disclosure', color: 'sky' },
  prohibited: { label: 'Prohibited Claim', color: 'rose' },
}

export const SEVERITY_RANK = { low: 1, medium: 2, high: 3 }
