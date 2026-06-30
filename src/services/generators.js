// High-level generation functions. Each tries the LLM when a key is present and
// falls back to a deterministic synthesizer so the app is always demoable.
//
// Synthetic output is DIRECTIONAL SIGNAL, never validated human research. The UI
// labels it as such everywhere these functions feed.

import { callLLMJson, hasKey } from './llm.js'
import { describeTarget, getSegment } from '../data/segments.js'
import { PRODUCTS_BY_ID, CHANNELS_BY_ID, channelFields } from '../data/products.js'

// The target narrative that drives every downstream step. Prefer the user's
// edited brief (Step 2) when present, else the auto-generated description.
const briefOf = (target) => (target?.brief?.trim() || describeTarget(target.segments, target.custom))

// ---------- deterministic helpers (stable pseudo-randomness) ----------
function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0)
}
function rng(seed) {
  let s = seed >>> 0
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
}
function pick(arr, r) { return arr[Math.floor(r() * arr.length) % arr.length] }
function clampInt(v, lo, hi) { return Math.max(lo, Math.min(hi, Math.round(v))) }
function uid(prefix) { return `${prefix}-${Math.floor(Math.random() * 1e9).toString(36)}` }

const FIRST_NAMES = ['Maya', 'Devin', 'Aisha', 'Carlos', 'Priya', 'Jordan', 'Tariq', 'Elena', 'Sam', 'Noah', 'Grace', 'Leo', 'Nina', 'Omar', 'Ruby', 'Wes', 'Tessa', 'Andre', 'Iris', 'Marcus', 'June', 'Hana', 'Theo', 'Lana']

// =====================================================================
// CREATIVE GENERATION (Step 3)
// =====================================================================
export async function generateCreative({ settings, campaign, target, n = 2 }) {
  const product = PRODUCTS_BY_ID[campaign.product]
  const channel = CHANNELS_BY_ID[campaign.channels?.[0]] || CHANNELS_BY_ID['paid-search-rsa']
  const targetText = briefOf(target)
  const segs = target.segments.map((id) => getSegment(id, target.custom)).filter(Boolean)

  if (hasKey(settings)) {
    try {
      const fields = channel.fields.map((f) => `- ${f.key} (max ${f.max} chars): ${f.label}`).join('\n')
      const data = await callLLMJson({
        settings,
        temperature: settings.temperature ?? 0.8,
        system: 'You are a senior performance-marketing copywriter at a regulated U.S. credit-card issuer. You write on-brand, channel-correct, compliant copy. You never promise approval, never misuse "free", and always keep required terms clear.',
        prompt: `Product: ${product?.name}. Objective: ${campaign.objective}. Channel: ${channel.name}.
Target audience: ${targetText}
Segment motivations/objections: ${segs.map((s) => `${s.name} (wants: ${s.motivation}; objections: ${(s.objections || []).join(', ')})`).join(' | ')}

Write ${n} distinct creative variants. Each must respect these field limits:
${fields}

Return a JSON array of ${n} objects with keys: name (short label like "Variant A — angle"), headline, primaryText, valueProp, landingCopy. Keep each field within its character limit. Make variants take genuinely different angles (e.g. value vs. aspiration vs. trust).`,
      })
      return (Array.isArray(data) ? data : data.variants || []).slice(0, n).map((v, i) => ({
        id: uid('var'),
        name: v.name || `Variant ${String.fromCharCode(65 + i)}`,
        channel: channel.id,
        headline: trunc(v.headline, fieldMax(channel, 'headline')),
        primaryText: trunc(v.primaryText, fieldMax(channel, 'primaryText')),
        valueProp: trunc(v.valueProp, fieldMax(channel, 'valueProp')),
        landingCopy: trunc(v.landingCopy, fieldMax(channel, 'landingCopy')),
        source: 'generated',
      }))
    } catch (e) { /* fall back */ }
  }

  // Deterministic fallback — each variant takes a GENUINELY different angle,
  // conditioned on the selected product + target segment so no two are alike.
  const pname = product?.name || 'This card'
  const segName = segs[0]?.name || 'your goals'
  const segLower = segName.toLowerCase()
  const motivation = (segs[0]?.motivation || 'real, everyday value').toLowerCase()
  const objection = (segs[0]?.objections?.[0] || 'hidden fees').toLowerCase()
  const tail = 'Variable APR 19.99%–29.99% based on creditworthiness; $0 annual fee. See terms.'

  const angles = [
    {
      tag: 'Clear Value',
      headline: `${pname}: $0 Annual Fee`,
      vp: 'Straightforward value — no hidden cost.',
      body: `Built for ${segName}. Get ${motivation} with no annual fee and no surprises.`,
      lead: `${pname} keeps it simple for ${segLower}: clear value, no hidden cost, and no annual fee.`,
    },
    {
      tag: 'Trust & Transparency',
      headline: `Know Every Term, Up Front`,
      vp: 'Transparent terms — no fine-print surprises.',
      body: `Worried about ${objection}? See your APR and fees clearly, before you apply.`,
      lead: `No fine-print games. ${pname} shows your rate, fees, and terms before you decide — so ${objection} is never a surprise.`,
    },
    {
      tag: 'Aspiration',
      headline: `Your Credit, Leveled Up`,
      vp: 'A smarter start to your financial future.',
      body: `${segName} deserve momentum. Put ${motivation} to work toward where you’re headed.`,
      lead: `Think bigger. ${pname} helps ${segLower} turn everyday spending into real progress.`,
    },
    {
      tag: 'Everyday Rewards',
      headline: `Earn On Everyday Spend`,
      vp: 'Cash back where you actually spend.',
      body: `Turn ${motivation} into rewards on the purchases ${segName} make every day.`,
      lead: `${pname} rewards the spending you already do — groceries, gas, and more — for ${segLower}.`,
    },
    {
      tag: 'Plain-Language Education',
      headline: `Credit, Made Understandable`,
      vp: 'Know your APR, fees, and terms up front.',
      body: `New to this? We explain ${motivation} in plain language — including ${objection}.`,
      lead: `${pname} is built to be understood. We walk ${segLower} through APR, fees, and terms in plain English.`,
    },
  ]
  // Seed a stable starting angle from the brief, then step by 1 so every
  // variant gets a distinct angle (for n up to the number of angles).
  const r = rng(hash(targetText + (product?.id || '') + (campaign.objective || '')))
  const start = Math.floor(r() * angles.length)
  return Array.from({ length: n }).map((_, i) => {
    const a = angles[(start + i) % angles.length]
    return {
      id: uid('var'),
      name: `Variant ${String.fromCharCode(65 + i)} — ${a.tag}`,
      channel: channel.id,
      headline: trunc(a.headline, fieldMax(channel, 'headline')),
      primaryText: trunc(`${a.body} ${tail}`, fieldMax(channel, 'primaryText')),
      valueProp: trunc(a.vp, fieldMax(channel, 'valueProp')),
      landingCopy: trunc(`${a.lead} ${tail} Pre-qualifying won’t affect your credit score.`, fieldMax(channel, 'landingCopy')),
      source: 'generated',
    }
  })
}

// =====================================================================
// PERSONA GENERATION (Step 4)
// =====================================================================
export async function generatePersonas({ settings, target, distribution, n = 12 }) {
  const segs = target.segments.map((id) => getSegment(id, target.custom)).filter(Boolean)
  const targetText = briefOf(target)
  const dist = distribution || { core: 0.6, adjacent: 0.25, skeptical: 0.15 }

  if (hasKey(settings)) {
    try {
      const data = await callLLMJson({
        settings,
        temperature: settings.temperature ?? 0.9,
        maxTokens: 3500,
        system: 'You generate realistic, on-segment synthetic consumer personas for credit-card market research. Personas must embody the target segment(s) defining motivation, objections, and financial behavior, while varying realistically within the segment. Never invent off-segment personas. Never use protected classes (race, religion, sex, marital status, age-as-basis, national origin, public assistance) to define a persona.',
        prompt: `Target: ${targetText}
Within-segment distribution: ${Math.round(dist.core * 100)}% core members, ${Math.round(dist.adjacent * 100)}% adjacent, ${Math.round(dist.skeptical * 100)}% skeptical.
Generate ${n} personas. Return a JSON array of objects with keys: name, age (number), income (e.g. "$38,000"), archetype ("core"|"adjacent"|"skeptical"), goals, voice (how they talk), financialLiteracy ("low"|"medium"|"high"), mediaHabits, decisionStyle, keyObjection, segmentFit (one line mapping this persona to the target definition). Vary age, income within band, goals, and voice realistically.`,
      })
      const arr = (Array.isArray(data) ? data : data.personas || []).slice(0, n)
      return arr.map((p) => ({ id: uid('p'), ...normalizePersona(p) }))
    } catch (e) { /* fall back */ }
  }

  // Deterministic fallback.
  const r = rng(hash(targetText + n))
  const counts = splitCounts(n, dist)
  const archetypes = [...Array(counts.core).fill('core'), ...Array(counts.adjacent).fill('adjacent'), ...Array(counts.skeptical).fill('skeptical')]
  const lit = ['low', 'medium', 'high']
  const media = ['TikTok & Instagram', 'YouTube & Reddit', 'Email & news sites', 'Podcasts & X', 'Mobile banking app']
  const styles = ['Compares 3+ options before deciding', 'Decides fast on gut + reviews', 'Reads every term first', 'Asks friends/family', 'Trusts a trusted brand']
  return archetypes.map((arch, i) => {
    const seg = segs[i % Math.max(segs.length, 1)] || { name: 'Target', motivation: 'value', objections: ['fees'] }
    const age = clampInt(20 + r() * 40, 18, 72)
    const income = `$${clampInt(24 + r() * 90, 18, 160)},000`
    return {
      id: uid('p'),
      name: `${pick(FIRST_NAMES, r)} ${String.fromCharCode(65 + (i % 26))}.`,
      age,
      income,
      archetype: arch,
      goals: arch === 'skeptical' ? `Wants ${seg.motivation.toLowerCase()} but expects a catch` : `Focused on ${seg.motivation.toLowerCase()}`,
      voice: arch === 'skeptical' ? 'Guarded, asks pointed questions' : arch === 'adjacent' ? 'Curious, open but practical' : 'Engaged, on-message',
      financialLiteracy: arch === 'core' ? pick(['medium', 'high'], r) : pick(lit, r),
      mediaHabits: pick(media, r),
      decisionStyle: pick(styles, r),
      keyObjection: pick(seg.objections || ['hidden fees'], r),
      segmentFit: `${arch === 'core' ? 'Core' : arch === 'adjacent' ? 'Adjacent' : 'Skeptical'} member of ${seg.name} — ${seg.descriptor?.toLowerCase() || ''}`,
    }
  })
}

// =====================================================================
// FOCUS GROUP (Step 5)
// =====================================================================
export async function runFocusGroup({ settings, personas, variants, campaign, options = {} }) {
  const sample = personas.slice(0, Math.min(personas.length, 12))
  const lengthMins = options.lengthMins === 30 ? 30 : 15
  const turnTarget = lengthMins === 30 ? 110 : 60
  const gd = options.groupDynamics !== false
  if (hasKey(settings)) {
    try {
      const data = await callLLMJson({
        settings,
        temperature: settings.temperature ?? 0.85,
        maxTokens: lengthMins === 30 ? 12000 : 8000,
        system: 'You are a professional market-research moderator running a REALISTIC, full-length synthetic focus group for a regulated credit-card issuer. Produce an actual moderated discussion transcript that reads like REAL PEOPLE TALKING — natural, conversational, human. Participants should hesitate, use filler ("honestly", "I mean", "yeah, but…"), think out loud, trail off, interrupt and build on each other ("like Maya said…", "I disagree with that"), tell tiny personal anecdotes, and sometimes change their mind mid-thought. Avoid clipped, report-style one-liners; let turns breathe (often 2-4 sentences) the way actual focus-group participants speak. The moderator opens warmly, sets ground rules, presents each concept, and actively moderates — asking open questions, follow-up probes, inviting quieter participants by name, reflecting back what people say, surfacing agreement and disagreement, checking comprehension of material terms, and closing with an apply-intent go-around. Personas speak in character (use their voice, archetype, and key objection). Paraphrase; never fabricate quotes attributed to real people. CRITICAL: when a persona misreads a material term (APR, fees, deposit, intro period), show the confusion in natural dialogue and have the moderator gently clarify — that misread is both a conversion risk and a compliance signal.',
        prompt: `Campaign: ${PRODUCTS_BY_ID[campaign.product]?.name}, objective ${campaign.objective}.
Run the session as if it lasts about ${lengthMins} minutes. Group dynamics (agreement/pushback) enabled: ${gd}.
Personas (every one must participate MULTIPLE times across the discussion): ${JSON.stringify(sample.map((p) => ({ name: p.name, archetype: p.archetype, lit: p.financialLiteracy, voice: p.voice, objection: p.keyObjection })))}
Variants: ${JSON.stringify(variants.map((v) => ({ id: v.id, name: v.name, headline: v.headline, primaryText: v.primaryText, valueProp: v.valueProp })))}

Return JSON: {
 "transcript": [{"role":"moderator"|"persona","speaker": <"Moderator" or the persona name>,"variantId": <variant id being discussed, or null for opening/closing/general>,"phase": <short label e.g. "Opening","First impressions","Trust","Comprehension","Objections","Comparison","Closing">,"text": <1-3 natural sentences>,"intentLabel": <ONLY on persona apply-intent statements: "would apply"|"might apply"|"would not apply"; otherwise null>}],
 "perVariant": [{"variantId","sentiment":0-100,"trust":0-100,"comprehension":0-100,"intentScore":0-100,"themes":[..],"standoutReactions":[..],"objections":[..],"comprehensionGaps":[{"term","issue"}]}]
}
Make the transcript LONG, natural, and complete — aim for at least ${turnTarget} turns, with moderator turns interleaved throughout (roughly one moderator turn for every 2-4 participant turns). Cover every variant, then a head-to-head comparison, then a closing intent round. comprehensionGaps must list any misread material term.`,
      })
      return normalizeFocus(data, variants)
    } catch (e) { /* fall back */ }
  }
  return syntheticFocus({ personas: sample, variants, campaign, lengthMins, groupDynamics: gd })
}

// Moderator steers the live discussion in a new direction; returns a short round
// of additional in-character reactions that engage the directive.
export async function steerFocusGroup({ settings, directive, personas, variants, campaign }) {
  const sample = personas.slice(0, Math.min(personas.length, 8))
  if (hasKey(settings)) {
    try {
      const data = await callLLMJson({
        settings,
        temperature: settings.temperature ?? 0.9,
        maxTokens: 2400,
        system: 'You are the moderator of a synthetic focus group for a regulated credit-card issuer. The moderator is steering the live discussion in a new direction. First the moderator poses the steer to the room, then several personas respond in character (one after another, some agreeing, some pushing back). Paraphrase reactions; never fabricate quotes attributed to real people. Flag any misread material term (APR, fees, deposit, intro period).',
        prompt: `Moderator steer: "${directive}".
Campaign: ${PRODUCTS_BY_ID[campaign.product]?.name || 'card'}, objective ${campaign.objective}.
Personas: ${JSON.stringify(sample.map((p) => ({ name: p.name, archetype: p.archetype, lit: p.financialLiteracy, voice: p.voice, objection: p.keyObjection })))}
Variants: ${JSON.stringify(variants.map((v) => ({ id: v.id, name: v.name, headline: v.headline, valueProp: v.valueProp })))}
Return JSON: {"transcript":[{"role":"moderator"|"persona","speaker":<"Moderator" or persona name>,"variantId":<id or null>,"text":<1-2 sentences>,"intentLabel":<persona apply-intent only, else null>}]}
Start with ONE moderator turn that frames the steer to the group, then 4-8 persona turns that directly engage it.`,
      })
      return (data.transcript || []).map((t) => ({ ...t, steer: directive }))
    } catch (e) { /* fall back */ }
  }
  return syntheticSteer({ directive, personas: sample, variants, campaign })
}

const STEER_TOPICS = [
  { test: /(annual )?fee|cost|charge|catch/i, key: 'fee' },
  { test: /apr|interest|rate/i, key: 'apr' },
  { test: /trust|scam|hidden|fine print|honest|transparen/i, key: 'trust' },
  { test: /reward|cash ?back|point|mile|earn/i, key: 'rewards' },
  { test: /credit|score|build|approv|reject/i, key: 'credit' },
  { test: /app|digital|online|mobile/i, key: 'digital' },
]
function steerTopic(d) { return (STEER_TOPICS.find((t) => t.test.test(d)) || { key: 'general' }).key }

function steerLine(topic, p, v, positive) {
  const vp = v.valueProp || v.name
  const lines = {
    fee: positive
      ? `If the annual fee really is what the headline says, that changes things — ${p.name.split(' ')[0]} would weigh "${vp}" against the cost and likely give it a look.`
      : `Pushes back on the fee — wants the exact dollar amount and any waivers spelled out before believing "${vp}" is worth it.`,
    apr: positive
      ? `Says the APR feels acceptable for how they'd use it, as long as the go-to rate after any intro period is stated plainly.`
      : `Worries the APR after the intro period isn't clear — assumes the low rate is permanent, which is a material-term misread to flag.`,
    trust: positive
      ? `Finds the tone honest and is reassured there's no obvious catch behind "${vp}".`
      : `Stays skeptical — feels there's always a catch and wants the trade-offs of "${vp}" disclosed up front.`,
    rewards: positive
      ? `Likes the rewards angle and starts doing the math on everyday spend; "${vp}" lands if the earn rate is real.`
      : `Thinks the rewards sound good but generic — wants to know the rate and any caps before trusting "${vp}".`,
    credit: positive
      ? `Responds to the credit-building promise; would apply if it demonstrably helps their score.`
      : `Wants proof the card actually helps their credit and is anxious about being rejected before trusting "${vp}".`,
    digital: positive
      ? `Loves that it sounds app-first and instant; "${vp}" plus a slick approval flow would win them over.`
      : `Expects instant approval and a clean app — would abandon if "${vp}" hides a clunky paperwork-heavy flow.`,
    general: positive
      ? `Engages with the moderator's prompt and finds "${vp}" relevant to their situation.`
      : `Engages with the moderator's prompt but stays guarded about "${vp}" until the terms are clear.`,
  }
  return lines[topic] || lines.general
}

function syntheticSteer({ directive, personas, variants, campaign }) {
  const topic = steerTopic(directive)
  const r = rng(hash('steer' + directive))
  const out = [{ role: 'moderator', speaker: 'Moderator', personaName: 'Moderator', variantId: null, text: `Let me pick up on something. ${directive}. I want to go around — be honest, even if you disagree with each other.`, steer: directive }]
  // a rotating cast responds across the variants
  const cast = personas.slice(0, Math.min(personas.length, 6))
  cast.forEach((p, i) => {
    const v = variants[i % variants.length]
    const positive = p.archetype !== 'skeptical' && r() > 0.4
    out.push({
      role: 'persona',
      speaker: p.name,
      personaName: p.name,
      variantId: v.id,
      text: steerLine(topic, p, v, positive),
      intentLabel: p.archetype === 'skeptical' ? 'might apply' : positive ? 'would apply' : 'might apply',
      steer: directive,
    })
  })
  return out
}

// =====================================================================
// SURVEY BUILDER + FIELDING (Step 6)
// Every question traces back to a focus-group insight (theme / objection /
// material-term comprehension gap), and the fielded outcome is a real per-question
// response distribution computed from the focus-group signal — not random insight.
// =====================================================================

// Pull the connective tissue out of the focus group so questions can cite it.
function focusInsights(focusGroup) {
  const pv = focusGroup?.perVariant || []
  const themes = [...new Set(pv.flatMap((v) => v.themes || []))].filter(Boolean)
  const objections = [...new Set(pv.flatMap((v) => v.objections || []))].filter(Boolean)
  const gaps = pv.flatMap((v) => (v.comprehensionGaps || []).map((g) => ({ ...g, variantId: v.variantId })))
  return { themes, objections, gaps, hasFocus: pv.length > 0 }
}

function normalizeQuestion(q, i) {
  const type = ['likert', 'comprehension', 'maxdiff', 'intent', 'open', 'rating'].includes(q.type) ? q.type : 'likert'
  const out = { id: q.id || `q-${i + 1}-${hash((q.text || '') + i) % 9999}`, type, text: q.text || '(untitled question)' }
  if (type === 'likert' || type === 'intent' || type === 'rating') {
    out.scale = Array.isArray(q.scale) && q.scale.length
      ? q.scale
      : (type === 'intent' ? ['Definitely not', 'Probably not', 'Might', 'Probably', 'Definitely'] : ['Not at all', 'Slightly', 'Moderately', 'Very', 'Extremely'])
  }
  if (type === 'comprehension') { out.options = Array.isArray(q.options) ? q.options : []; out.correctIndex = Number.isInteger(q.correctIndex) ? q.correctIndex : 0 }
  if (type === 'maxdiff') out.options = Array.isArray(q.options) ? q.options : []
  if (q.preference != null) out.preference = !!q.preference
  else if (type === 'maxdiff' && /prefer|choose|pick (one|only)|apply for only|which (card|one) would/i.test(out.text)) out.preference = true
  out.source = q.source && typeof q.source === 'object'
    ? { kind: q.source.kind || 'theme', label: q.source.label || 'Focus-group insight', term: q.source.term }
    : { kind: 'baseline', label: 'General creative diagnostic' }
  return out
}

// Deterministic instrument derived straight from the focus-group insights.
function surveyFromFocus(ins, variants) {
  const topTheme = ins.themes[0] || 'Clarity of the value proposition'
  const trustObj = ins.objections.find((o) => /trust|fee|catch|hidden|approv|too good/i.test(o)) || ins.objections[0] || 'Skepticism that the terms are as good as they sound'
  const topObj = ins.objections[0] || 'Worried about fees after the intro'
  const gapTerm = ins.gaps[0]?.term || 'APR after any intro period'
  return [
    { id: 'q-appeal', type: 'likert', text: 'Overall, how appealing is this offer to you?', scale: ['Not at all', 'Slightly', 'Moderately', 'Very', 'Extremely'], source: { kind: 'theme', label: topTheme } },
    { id: 'q-trust', type: 'likert', text: 'How much do you trust that the terms are as good as they sound?', scale: ['Not at all', 'A little', 'Somewhat', 'Mostly', 'Completely'], source: { kind: 'objection', label: trustObj } },
    { id: 'q-comp-apr', type: 'comprehension', text: 'After any intro period, the APR on this card is…', options: ['0% forever', 'A variable go-to APR based on creditworthiness', 'Always 9.99%', 'There is no APR'], correctIndex: 1, source: { kind: 'comprehensionGap', label: 'Material-term check — APR', term: gapTerm } },
    { id: 'q-comp-fee', type: 'comprehension', text: 'The annual fee on this card is…', options: ['Stated clearly up front', 'Not stated anywhere', 'Charged only after year one', 'Refundable'], correctIndex: 0, source: { kind: 'comprehensionGap', label: 'Material-term check — fee', term: 'Annual fee disclosure' } },
    { id: 'q-pref', type: 'maxdiff', preference: true, text: 'If you could apply for only ONE of these cards, which would you choose?', options: variants.map((v) => v.name), source: { kind: 'baseline', label: 'Head-to-head preference — produces the preference-share result' } },
    { id: 'q-intent', type: 'intent', text: 'How likely are you to apply for this card?', scale: ['Definitely not', 'Probably not', 'Might', 'Probably', 'Definitely'], source: { kind: 'intent', label: 'Apply-intent go-around in the focus group' } },
    { id: 'q-open', type: 'open', text: 'What, if anything, gives you pause about applying?', source: { kind: 'objection', label: topObj } },
  ]
}

// Build a survey instrument whose every item is anchored to a focus-group insight.
export async function buildSurvey({ settings, focusGroup, variants, campaign }) {
  const ins = focusInsights(focusGroup)
  if (hasKey(settings)) {
    try {
      const data = await callLLMJson({
        settings,
        temperature: 0.5,
        system: 'You design quantitative survey instruments for credit-card creative testing at a regulated issuer. EVERY item must be grounded in a specific focus-group insight (a theme, an objection, or a material-term comprehension gap) and must name that insight in a "source" field. Always include 1-2 comprehension checks on material terms (APR / fees). Keep wording plain and unbiased.',
        prompt: `Campaign: ${PRODUCTS_BY_ID[campaign?.product]?.name || 'credit card'}.
Focus-group themes: ${JSON.stringify(ins.themes.slice(0, 10))}
Focus-group objections: ${JSON.stringify(ins.objections.slice(0, 8))}
Comprehension gaps (material terms personas misread): ${JSON.stringify(ins.gaps.slice(0, 5))}
Variants (for the value-prop forced choice): ${JSON.stringify(variants.map((v) => ({ id: v.id, valueProp: v.valueProp || v.name })))}
Return a JSON array of 6-9 survey items. Types: "likert" (appeal/trust, 5-pt scale), "comprehension" (options + correctIndex), "maxdiff" (value-prop forced choice; options = the variant value props), "intent" (apply-intent 5-pt), "open". Each item: {id,type,text,scale?,options?,correctIndex?,source:{kind:"theme"|"objection"|"comprehensionGap"|"intent"|"baseline",label:<the exact focus-group insight this question tests>,term?}}.`,
      })
      const items = (Array.isArray(data) ? data : data.items || [])
      if (items.length) return items.map((q, i) => normalizeQuestion(q, i))
    } catch (e) { /* fall back */ }
  }
  return surveyFromFocus(ins, variants)
}

// Topic-targeted questions the deterministic regenerate path can add from a comment.
const REGEN_TOPICS = [
  { test: /fee|annual|cost|charge/i, make: () => ({ type: 'likert', text: 'How clear is the annual fee on this card?', scale: ['Not at all', 'Slightly', 'Moderately', 'Very', 'Completely'], source: { kind: 'comment', label: 'Reviewer asked to probe the annual fee' } }) },
  { test: /apr|interest|\brate\b/i, make: () => ({ type: 'comprehension', text: 'The go-to APR after any intro period is…', options: ['Fixed forever', 'A variable rate based on creditworthiness', 'Zero', 'Not shown'], correctIndex: 1, source: { kind: 'comment', label: 'Reviewer asked to probe the APR' } }) },
  { test: /reward|cash ?back|point|mile|earn/i, make: () => ({ type: 'likert', text: 'How valuable are the rewards on this card to you?', scale: ['Not at all', 'Slightly', 'Moderately', 'Very', 'Extremely'], source: { kind: 'comment', label: 'Reviewer asked to probe rewards' } }) },
  { test: /trust|honest|catch|hidden|scam|believe/i, make: () => ({ type: 'likert', text: 'How much do you trust this offer is what it claims?', scale: ['Not at all', 'A little', 'Somewhat', 'Mostly', 'Completely'], source: { kind: 'comment', label: 'Reviewer asked to probe trust' } }) },
  { test: /credit|score|build|limit|approv/i, make: () => ({ type: 'likert', text: 'How confident are you this card will help your credit?', scale: ['Not at all', 'Slightly', 'Somewhat', 'Very', 'Extremely'], source: { kind: 'comment', label: 'Reviewer asked to probe credit-building' } }) },
  { test: /digital|app|mobile|online/i, make: () => ({ type: 'likert', text: 'How appealing is the digital / app experience implied here?', scale: ['Not at all', 'Slightly', 'Moderately', 'Very', 'Extremely'], source: { kind: 'comment', label: 'Reviewer asked to probe the digital experience' } }) },
]

function regenFallback(instrument, comments, ins, variants) {
  let out = (instrument || []).map((q) => ({ ...q }))
  const c = comments || ''
  let matched = false
  REGEN_TOPICS.forEach((t, i) => {
    if (t.test.test(c)) {
      matched = true
      const q = t.make()
      if (!out.some((x) => x.text === q.text)) out.push({ id: `q-rg-${i}-${hash(c + i) % 9999}`, ...q })
    }
  })
  // "add a question about X" with no recognized topic → an open-end echoing the comment.
  if (!matched && /\badd\b/i.test(c)) {
    const stripped = c.replace(/^.*?\badd\b\s*(a|an|another)?\s*(question|item)?\s*(about|on|for|covering)?\s*/i, '').trim()
    const text = stripped ? `${stripped.charAt(0).toUpperCase()}${stripped.slice(1)}`.replace(/[.?!]*$/, '') + '?' : 'What else matters most to you about this offer?'
    out.push({ id: `q-rg-open-${hash(c) % 9999}`, type: 'open', text: trunc(text, 160), source: { kind: 'comment', label: 'Added from reviewer comment' } })
  }
  // "fewer / shorter / trim" → collapse to a single open-end.
  if (/\b(shorter|fewer|trim|too many|too long|remove an open)\b/i.test(c)) {
    const opens = out.filter((q) => q.type === 'open')
    if (opens.length > 1) out = out.filter((q) => q.type !== 'open' || q === opens[0])
  }
  return out.map((q, i) => normalizeQuestion(q, i))
}

// Refine the instrument using reviewer comments, keeping focus-group grounding.
export async function regenerateSurvey({ settings, instrument, comments, focusGroup, variants }) {
  const ins = focusInsights(focusGroup)
  if (hasKey(settings)) {
    try {
      const data = await callLLMJson({
        settings,
        temperature: 0.5,
        system: 'You refine quantitative survey instruments for credit-card creative testing. Apply the reviewer comments faithfully, but keep every item grounded in the focus-group insights and keep at least one material-term comprehension check. Each item must keep a "source" naming the insight it traces to.',
        prompt: `Current instrument: ${JSON.stringify((instrument || []).map((q) => ({ id: q.id, type: q.type, text: q.text, scale: q.scale, options: q.options, correctIndex: q.correctIndex, source: q.source })))}
Reviewer comments to apply: "${comments}"
Focus-group themes: ${JSON.stringify(ins.themes.slice(0, 10))}
Focus-group objections: ${JSON.stringify(ins.objections.slice(0, 8))}
Comprehension gaps: ${JSON.stringify(ins.gaps.slice(0, 5))}
Variants (for maxdiff options): ${JSON.stringify(variants.map((v) => ({ id: v.id, valueProp: v.valueProp || v.name })))}
Return the FULL revised JSON array of items: {id,type,text,scale?,options?,correctIndex?,source:{kind,label,term?}}. Preserve unchanged items' ids.`,
      })
      const items = (Array.isArray(data) ? data : data.items || [])
      if (items.length) return items.map((q, i) => normalizeQuestion(q, i))
    } catch (e) { /* fall back */ }
  }
  return regenFallback(instrument, comments, ins, variants)
}

// ---- per-question outcome math (everyone answers; distributions, not random insight) ----
// Build a 5-point distribution (pcts summing to 100) with an exact top-2-box share.
function likertDist(top2, posLean, r) {
  top2 = clampInt(top2, 2, 96)
  const p5 = clampInt(top2 * (0.42 + posLean * 0.16) + (r() * 4 - 2), 1, top2 - 1)
  const p4 = top2 - p5
  const rest = 100 - top2
  const p3 = clampInt(rest * 0.5 + (r() * 4 - 2), 0, rest)
  const p2 = clampInt((rest - p3) * 0.62, 0, rest - p3)
  const p1 = Math.max(0, rest - p3 - p2)
  return [p1, p2, p3, p4, p5]
}
function distCounts(pcts, n) {
  const c = pcts.map((p) => Math.round((p / 100) * n))
  const diff = n - c.reduce((a, b) => a + b, 0)
  if (c.length) { const idx = c.indexOf(Math.max(...c)); c[idx] = Math.max(0, c[idx] + diff) }
  return c
}
function meanOf(pcts) { return Math.round((pcts.reduce((a, p, i) => a + p * (i + 1), 0) / 100) * 10) / 10 }

function openVerbatims(objs) {
  const tmpl = [
    (o) => `“Honestly, ${o.toLowerCase()} — that's the thing I'd want cleared up before I'd apply.”`,
    (o) => `“${o.replace(/^./, (m) => m.toUpperCase())}. Show me that's handled and I'm probably in.”`,
    (o) => `“My only real pause is ${o.toLowerCase()}, if I'm being honest.”`,
    (o) => `“I'd want ${o.toLowerCase()} spelled out plainly first — then we can talk.”`,
  ]
  return (objs.length ? objs : ['worried about fees after the intro', 'not sure it really helps my credit', 'the rewards feel generic']).slice(0, 3).map((o, i) => tmpl[i % tmpl.length](o))
}

// Turn already-computed per-variant signal into per-question response distributions
// plus a deterministic key-takeaways summary. Shared by fieldSurvey and the seed demos.
export function deriveSurveyOutcomes({ instrument, n, variants, segs = [], perVariant, focusGroup }) {
  const ins = focusInsights(focusGroup)
  const pvOf = (id) => perVariant.find((v) => v.variantId === id) || {}
  const fgOf = (id) => focusGroup?.perVariant?.find((v) => v.variantId === id) || {}
  const vName = (id) => variants.find((v) => v.id === id)?.name || id

  // Between-subjects: split the audience into one cell per variant. Diagnostic
  // questions (appeal / trust / comprehension / intent) are answered ONLY by the
  // respondents assigned that variant; the head-to-head preference question is the
  // one comparative item every respondent answers.
  const k = Math.max(1, variants.length)
  const cellBase = Math.floor(n / k)
  const cells = variants.map((v, i) => ({ variantId: v.id, name: vName(v.id), n: cellBase + (i < (n - cellBase * k) ? 1 : 0) }))
  const cellN = (id) => cells.find((c) => c.variantId === id)?.n ?? Math.round(n / k)

  const questions = (instrument || []).map((q) => {
    const r = rng(hash('out' + q.id))
    const base = { id: q.id, type: q.type, text: q.text, source: q.source || null }

    if (q.type === 'likert' || q.type === 'intent' || q.type === 'rating') {
      const scale = q.scale || ['1', '2', '3', '4', '5']
      const byVariant = variants.map((v) => {
        const pv = pvOf(v.id)
        const top2 = q.type === 'intent'
          ? clampInt((pv.applyIntent ?? 40) + 10, 4, 92)
          : /trust/i.test(q.id + ' ' + q.text)
            ? clampInt(fgOf(v.id).trust ?? 55, 4, 94)
            : clampInt(pv.top2box ?? 60, 4, 94)
        const dist = likertDist(top2, (pv.top2box ?? 60) / 100, r)
        return { variantId: v.id, name: vName(v.id), n: cellN(v.id), distribution: dist, counts: distCounts(dist, cellN(v.id)), top2box: dist[3] + dist[4], mean: meanOf(dist) }
      })
      const overall = scale.map((_, i) => Math.round(byVariant.reduce((a, bv) => a + bv.distribution[i], 0) / byVariant.length))
      // re-normalize overall to 100 after rounding
      const fix = 100 - overall.reduce((a, b) => a + b, 0); overall[overall.indexOf(Math.max(...overall))] += fix
      return { ...base, scale, distribution: overall, counts: distCounts(overall, n), top2box: overall[3] + overall[4], mean: meanOf(overall), byVariant }
    }

    if (q.type === 'comprehension') {
      const options = q.options || []
      const correctIndex = q.correctIndex ?? 0
      const byVariant = variants.map((v) => ({ variantId: v.id, name: vName(v.id), correctPct: clampInt(pvOf(v.id).comprehensionRate ?? 70, 5, 99) }))
      const correctPct = Math.round(byVariant.reduce((a, bv) => a + bv.correctPct, 0) / byVariant.length)
      const wrong = 100 - correctPct
      const wrongIdxs = options.map((_, i) => i).filter((i) => i !== correctIndex)
      const misreadIdx = wrongIdxs[0] ?? 0
      const byOption = options.map((opt, i) => {
        let pct
        if (i === correctIndex) pct = correctPct
        else if (i === misreadIdx) pct = Math.round(wrong * 0.62)
        else pct = Math.round((wrong * 0.38) / Math.max(1, wrongIdxs.length - 1))
        return { label: opt, pct, correct: i === correctIndex, misread: i === misreadIdx && wrong > 0 }
      })
      if (byOption[correctIndex]) { const s = byOption.reduce((a, o) => a + o.pct, 0); byOption[correctIndex].pct += (100 - s) }
      const worstVariant = [...byVariant].sort((a, b) => a.correctPct - b.correctPct)[0]
      // Flag if EITHER the overall rate OR any single variant falls below the 70% comprehension bar,
      // so a weak variant's material-term misread is never masked by a strong one's average.
      const flagged = correctPct < 70 || (worstVariant && worstVariant.correctPct < 70)
      return { ...base, options, correctIndex, correctPct, byOption, counts: distCounts(byOption.map((o) => o.pct), n), byVariant, worstVariant, flagged, term: q.source?.term || ins.gaps[0]?.term || 'a material term' }
    }

    if (q.type === 'maxdiff') {
      const opts = (q.options && q.options.length) ? q.options : (q.preference ? variants.map((v) => v.name) : variants.map((v) => v.valueProp || v.name))
      const shares = variants.map((v, i) => ({ label: opts[i] ?? (v.valueProp || v.name), variantId: v.id, name: vName(v.id), pct: pvOf(v.id).prefShare ?? Math.round(100 / variants.length) }))
      const s = shares.reduce((a, o) => a + o.pct, 0); if (shares[0]) shares[0].pct += (100 - s)
      return { ...base, preference: !!q.preference, shares, counts: distCounts(shares.map((o) => o.pct), n) }
    }

    // open-end → mined themes + representative verbatims
    const objs = ins.objections.length ? ins.objections : ['Worried about fees after the intro', 'Wants proof it helps their credit', 'Not sure the rewards are worth it']
    const themes = objs.slice(0, 4).map((o, i) => ({ label: o, pct: clampInt(42 - i * 9 + (r() * 10 - 5), 6, 52) }))
    return { ...base, themes, verbatims: openVerbatims(objs) }
  })

  const takeaways = surveyTakeaways({ questions, perVariant, variants, segs, ins, n, vName })
  return { questions, takeaways, cells }
}

// Build a representative preview of the synthetic survey audience: how many
// respondents are assigned to each variant cell (between-subjects), the segment /
// archetype composition, and a sample of individual respondents with their
// assigned variant. Deterministic so the preview is stable for a given setup.
export function sampleAudience({ target, variants, n, distribution, previewCount = 8 }) {
  const segs = (target?.segments || []).map((id) => getSegment(id, target.custom)).filter(Boolean)
  const dist = distribution || { core: 0.6, adjacent: 0.25, skeptical: 0.15 }
  const k = Math.max(1, variants.length)
  const cellBase = Math.floor(n / k)
  const cells = variants.map((v, i) => ({ variantId: v.id, name: v.name, n: cellBase + (i < (n - cellBase * k) ? 1 : 0) }))
  const segCount = Math.max(1, segs.length)
  const bySegment = (segs.length ? segs : [{ name: 'Target audience' }]).map((s, i) => ({
    name: s.name, n: Math.round(n / segCount) + (i === 0 ? n - Math.round(n / segCount) * segCount : 0),
  }))
  const byArchetype = {
    core: Math.round(n * dist.core), adjacent: Math.round(n * dist.adjacent), skeptical: Math.round(n * dist.skeptical),
  }

  const r = rng(hash('aud' + (target?.segments || []).join(',') + n + k))
  const media = ['TikTok & Instagram', 'YouTube & Reddit', 'Email & news sites', 'Podcasts & X', 'Mobile banking app']
  const archPool = [
    ...Array(Math.round(previewCount * dist.core)).fill('core'),
    ...Array(Math.round(previewCount * dist.adjacent)).fill('adjacent'),
    ...Array(Math.round(previewCount * dist.skeptical)).fill('skeptical'),
  ]
  while (archPool.length < previewCount) archPool.push('core')
  const archLabel = { core: 'Core', adjacent: 'Adjacent', skeptical: 'Skeptical' }
  const sample = archPool.slice(0, previewCount).map((arch, i) => {
    const seg = segs[i % Math.max(segs.length, 1)] || { name: 'Target', motivation: 'value', objections: ['fees'] }
    const v = variants[i % k]
    const obj = (seg.objections || ['hidden fees'])[0]
    return {
      id: `aud-${i}`,
      name: `${pick(FIRST_NAMES, r)} ${String.fromCharCode(65 + (i % 26))}.`,
      age: clampInt(20 + r() * 40, 18, 72),
      income: `$${clampInt(24 + r() * 90, 18, 160)},000`,
      segment: seg.name,
      archetype: arch,
      financialLiteracy: arch === 'core' ? pick(['medium', 'high'], r) : pick(['low', 'medium', 'high'], r),
      mediaHabits: pick(media, r),
      assignedVariantId: v.id,
      assignedVariantName: v.name,
      profile: `${archLabel[arch]} member of ${seg.name}${obj ? ` · wary of ${String(obj).toLowerCase()}` : ''}`,
    }
  })
  return { cells, sample, composition: { bySegment, byArchetype }, total: n }
}

function surveyTakeaways({ questions, perVariant, variants, segs, ins, n, vName }) {
  const out = []
  const ranked = [...perVariant].sort((a, b) => b.prefShare - a.prefShare)
  const w = ranked[0], runner = ranked[1]
  if (w) {
    const margin = w.prefShare - (runner?.prefShare ?? 0)
    out.push(`${vName(w.variantId)} leads on preference share at ${w.prefShare}%${runner ? ` vs ${runner.prefShare}% for ${vName(runner.variantId)} — a ${margin}-pt ${margin >= 18 ? 'clear' : margin >= 8 ? 'moderate' : 'narrow'} lead` : ''}, across ${n} synthetic respondents.`)
  }
  const appeal = questions.find((q) => q.id === 'q-appeal') || questions.find((q) => q.type === 'likert')
  if (appeal) out.push(`${appeal.top2box}% rate the offer Very or Extremely appealing — appeal is ${appeal.top2box >= 60 ? 'strong' : appeal.top2box >= 45 ? 'solid but not decisive' : 'soft'}.`)
  const comps = questions.filter((q) => q.type === 'comprehension')
  const flagged = comps.find((q) => q.flagged)
  if (flagged) {
    const worst = (flagged.byVariant || []).slice().sort((a, b) => a.correctPct - b.correctPct)[0]
    out.push(`⚠ Comprehension risk — only ${flagged.correctPct}% read the ${flagged.term} correctly${worst ? `, worst on ${worst.name} (${worst.correctPct}%)` : ''}. That misread is both a conversion risk and a compliance signal: fix the disclosure before fielding for real.`)
  } else if (comps.length) {
    out.push(`Material-term comprehension is healthy (${comps[0].correctPct}% correct on the APR / fee check) — the required disclosures are landing.`)
  }
  const intent = questions.find((q) => q.type === 'intent')
  const intentLeader = [...perVariant].sort((a, b) => b.applyIntent - a.applyIntent)[0]
  if (intent) out.push(`${intent.top2box}% say they would Probably or Definitely apply${intentLeader ? `; apply-intent peaks on ${vName(intentLeader.variantId)}` : ''}.`)
  if (ins.objections[0]) out.push(`The most common hesitation mirrors the focus group: “${ins.objections[0]}.” Address it head-on in the next creative round.`)
  if (segs.length > 1 && w) {
    const flip = segs.find((s) => {
      const best = perVariant.map((v) => ({ id: v.variantId, sh: v.bySegment?.find((b) => b.segment === s.name)?.prefShare ?? 0 })).sort((a, b) => b.sh - a.sh)[0]
      return best && best.id !== w.variantId
    })
    if (flip) out.push(`Segment split: ${flip.name} actually leans the other way — worth a tailored treatment rather than one message for all.`)
  }
  return out
}

export async function fieldSurvey({ settings, instrument, panelSize, variants, target, focusGroup }) {
  // Quant is computed deterministically from focus-group signal + panel size so the
  // numbers stay coherent with qualitative findings (even with a key, we anchor here).
  const segs = target.segments.map((id) => getSegment(id, target.custom)).filter(Boolean)
  const n = panelSize || 250
  const perVariant = variants.map((v) => {
    const fg = focusGroup?.perVariant?.find((x) => x.variantId === v.id)
    const base = fg ? (fg.sentiment * 0.5 + fg.intentScore * 0.3 + fg.trust * 0.2) : 50 + (hash(v.id) % 30)
    const r = rng(hash(v.id + 'survey'))
    const top2 = clampInt(base + (r() * 10 - 5), 5, 95)
    const comp = clampInt((fg?.comprehension ?? 70) + (r() * 8 - 4), 20, 99)
    const intent = clampInt(base * 0.7 + (r() * 10 - 5), 3, 80)
    const bySegment = segs.map((s) => ({
      segment: s.name,
      applyIntent: clampInt(intent + (r() * 24 - 12), 2, 88),
      prefShare: 0, // filled after normalization
    }))
    return { variantId: v.id, top2box: top2, comprehensionRate: comp, applyIntent: intent, bySegment, _score: base }
  })
  // preference share = softmax-ish over scores
  const total = perVariant.reduce((s, v) => s + Math.exp(v._score / 18), 0)
  perVariant.forEach((v) => { v.prefShare = Math.round((Math.exp(v._score / 18) / total) * 100) })
  // normalize per-segment pref share across variants
  segs.forEach((s) => {
    const scores = perVariant.map((v) => {
      const seg = v.bySegment.find((b) => b.segment === s.name)
      return Math.exp((seg.applyIntent) / 16)
    })
    const segTotal = scores.reduce((a, b) => a + b, 0)
    perVariant.forEach((v, i) => {
      const seg = v.bySegment.find((b) => b.segment === s.name)
      seg.prefShare = Math.round((scores[i] / segTotal) * 100)
    })
  })
  const ranking = [...perVariant].sort((a, b) => b.prefShare - a.prefShare).map((v) => v.variantId)
  const cleanPV = perVariant.map(({ _score, ...rest }) => rest)
  const { questions, takeaways, cells } = deriveSurveyOutcomes({ instrument, n, variants, segs, perVariant: cleanPV, focusGroup })

  // With a key, let the LLM polish the plain-English takeaways (numbers stay anchored).
  let finalTakeaways = takeaways
  if (hasKey(settings)) {
    try {
      const data = await callLLMJson({
        settings,
        temperature: 0.4,
        system: 'You are a marketing-science lead writing the key takeaways from a synthetic survey. Be crisp and honest. These are directional signal, not validated research. Keep every number exactly as given. Always keep the comprehension/compliance flag if present.',
        prompt: `Survey n=${n}. Per-variant: ${JSON.stringify(cleanPV.map((v) => ({ variant: variants.find((x) => x.id === v.variantId)?.name, top2box: v.top2box, comprehension: v.comprehensionRate, applyIntent: v.applyIntent, prefShare: v.prefShare })))}
Draft takeaways: ${JSON.stringify(takeaways)}
Return JSON: {"takeaways": ["...", "..."]} — 4-6 tight bullets, keeping all figures and any ⚠ comprehension/compliance flag.`,
      })
      if (Array.isArray(data?.takeaways) && data.takeaways.length) finalTakeaways = data.takeaways.map(String)
    } catch (e) { /* keep deterministic */ }
  }

  return { n, perVariant: cleanPV, ranking, cells, questions, takeaways: finalTakeaways }
}

// =====================================================================
// RECOMMENDATION (Step 7)
// =====================================================================
export async function recommend({ settings, focusGroup, survey, variants, target }) {
  const segs = target.segments.map((id) => getSegment(id, target.custom)).filter(Boolean)
  // Accept the full survey slice ({ instrument, results }) or a bare results object.
  const results = survey?.results || survey || {}
  const perVariant = results.perVariant || []
  const questions = results.questions || []
  const vName = (id) => variants.find((v) => v.id === id)?.name || id

  // ---- Read the winner straight out of the questions respondents actually answered ----
  // 1) The forced-choice head-to-head preference question IS the preference-share result.
  const prefQ = questions.find((q) => q.preference) || questions.find((q) => q.type === 'maxdiff')
  const prefShareOf = (id) =>
    prefQ?.shares?.find((s) => s.variantId === id)?.pct
    ?? perVariant.find((v) => v.variantId === id)?.prefShare ?? 0
  // 2) The comprehension question = the material-term read + the compliance signal.
  const compQ = questions.find((q) => q.type === 'comprehension')
  const compOf = (id) =>
    compQ?.byVariant?.find((b) => b.variantId === id)?.correctPct
    ?? perVariant.find((v) => v.variantId === id)?.comprehensionRate ?? null
  // 3) Appeal (top-2 box) + apply-intent likert questions = within-cell diagnostics.
  const appealQ = questions.find((q) => q.id === 'q-appeal')
    || questions.find((q) => q.type === 'likert' && /appeal/i.test(q.id + ' ' + q.text))
    || questions.find((q) => q.type === 'likert')
  const intentQ = questions.find((q) => q.type === 'intent')
  const top2Of = (q, id) => q?.byVariant?.find((b) => b.variantId === id)?.top2box ?? null

  const scored = variants.map((v) => ({
    variantId: v.id,
    prefShare: prefShareOf(v.id),
    appeal: top2Of(appealQ, v.id),
    intent: top2Of(intentQ, v.id),
    comprehension: compOf(v.id),
  }))
  const ranked = [...scored].sort((a, b) => b.prefShare - a.prefShare)
  const winner = ranked[0] || { variantId: variants[0]?.id, prefShare: 0 }
  const runnerUp = ranked[1]
  const winnerVar = variants.find((v) => v.id === winner.variantId)
  const margin = (winner.prefShare ?? 0) - (runnerUp?.prefShare ?? 0)
  const confidence = margin >= 18 ? 'high' : margin >= 8 ? 'moderate' : 'low'

  // Segment-level winner from the per-segment preference share in the survey results.
  const segmentBreakdown = segs.map((s) => {
    let best = null, bestShare = -1
    perVariant.forEach((v) => {
      const seg = v.bySegment?.find((b) => b.segment === s.name)
      if (seg && seg.prefShare > bestShare) { bestShare = seg.prefShare; best = v.variantId }
    })
    const bv = variants.find((v) => v.id === best)
    return { segment: s.name, preferredVariantId: best, preferredVariant: bv?.name, prefShare: bestShare < 0 ? null : bestShare, why: `${s.name} responds to ${bv?.valueProp || bv?.name} — aligned to their motivation (${s.motivation}).` }
  })

  // Comprehension / compliance read on the winner, taken from the comprehension question.
  const winnerComp = compOf(winner.variantId)
  const winnerWeakComp = winnerComp != null && winnerComp < 70   // the winner itself misreads the term
  const compFlagged = !!compQ?.flagged || winnerWeakComp          // the question is flagged (any variant below the bar)
  const compTerm = compQ?.term || 'a material term'
  const compWorst = compQ?.worstVariant || (compQ?.byVariant ? [...compQ.byVariant].sort((a, b) => a.correctPct - b.correctPct)[0] : null)

  // A compact, question-anchored evidence object so the recommendation is traceable
  // back to exactly what was asked and answered (surfaced in Step 7).
  const evidence = {
    preferenceQuestion: prefQ?.text || null,
    preferenceShares: scored.map((s) => ({ variant: vName(s.variantId), prefSharePct: s.prefShare, isWinner: s.variantId === winner.variantId })),
    appealQuestion: appealQ?.text || null,
    winnerAppealTop2Box: top2Of(appealQ, winner.variantId),
    intentQuestion: intentQ?.text || null,
    winnerIntentTop2Box: top2Of(intentQ, winner.variantId),
    comprehensionQuestion: compQ?.text || null,
    comprehensionTerm: compTerm,
    comprehensionByVariant: compQ?.byVariant?.map((b) => ({ variant: b.name, correctPct: b.correctPct })) || null,
    comprehensionFlagged: compFlagged,
  }

  if (hasKey(settings)) {
    try {
      const data = await callLLMJson({
        settings,
        temperature: 0.4,
        system: 'You are a marketing-science lead. Recommend the winning variant grounded ONLY in the survey questions that were actually asked and answered. Cite the specific questions (the forced-choice preference question, appeal, apply-intent, comprehension) and their numbers. Never override a clear preference-share winner, but always flag any comprehension/compliance risk. Synthetic results are directional, not definitive — say so.',
        prompt: `Target: ${briefOf(target)}
Winner by the forced-choice preference question: ${winnerVar?.name} (${winner.prefShare}% of choices vs runner-up ${runnerUp?.prefShare ?? 0}%).
Answered-question evidence: ${JSON.stringify(evidence)}
Focus-group per-variant (qualitative context only): ${JSON.stringify(focusGroup?.perVariant || [])}
Return JSON: {"rationale": "2-3 sentences citing the specific survey questions and their numbers", "intersectionalFit": "how well the winner serves the combined target vs each component segment", "improvements": ["..."], "predictedPrefShare": ${winner.prefShare}, "confidence": "${confidence}"}`,
      })
      return { winnerId: winner.variantId, predictedPrefShare: winner.prefShare, confidence: data.confidence || confidence, rationale: data.rationale, intersectionalFit: data.intersectionalFit, improvements: data.improvements || [], segmentBreakdown, evidence }
    } catch (e) { /* fall back */ }
  }

  // ---- Deterministic rationale, written straight from the answered questions ----
  const gaps = focusGroup?.perVariant?.find((v) => v.variantId === winner.variantId)?.comprehensionGaps || []
  const appealTop2 = top2Of(appealQ, winner.variantId)
  const intentTop2 = top2Of(intentQ, winner.variantId)
  const bits = []
  bits.push(`${winnerVar?.name} wins the head-to-head: asked to pick just one card, ${winner.prefShare}% of respondents chose it${runnerUp ? ` — a ${margin}-pt ${margin >= 18 ? 'clear' : margin >= 8 ? 'moderate' : 'narrow'} lead over ${vName(runnerUp.variantId)} (${runnerUp.prefShare}%)` : ''}.`)
  if (appealTop2 != null || intentTop2 != null) {
    bits.push(`Within its own cell it reads well too${appealTop2 != null ? ` — ${appealTop2}% rate it appealing (top-2 box)` : ''}${intentTop2 != null ? `${appealTop2 != null ? ' and ' : ' — '}${intentTop2}% say they'd probably or definitely apply` : ''}.`)
  }
  if (winnerComp != null) {
    if (winnerWeakComp) {
      bits.push(`But comprehension is the watch-out: only ${winnerComp}% read ${compTerm} correctly on the winner — that misread is both a conversion risk and a compliance signal, so fix the disclosure before fielding for real.`)
    } else if (compFlagged && compWorst) {
      bits.push(`The winner's own comprehension holds up (${winnerComp}% read ${compTerm} correctly), but ${compWorst.name} falls below the 70% bar (${compWorst.correctPct}%) — keep the disclosure unmistakable across every variant.`)
    } else {
      bits.push(`Material-term comprehension holds up: ${winnerComp}% read ${compTerm} correctly, so the required disclosure is landing.`)
    }
  }

  return {
    winnerId: winner.variantId,
    predictedPrefShare: winner.prefShare,
    confidence,
    rationale: bits.join(' '),
    intersectionalFit: `The winner serves the combined target ${briefOf(target).split('.')[0]}. It is strongest with ${segmentBreakdown[0]?.segment || 'the core segment'}${segmentBreakdown.length > 1 ? `; watch ${segmentBreakdown[segmentBreakdown.length - 1].segment}, where the margin is thinner` : ''}.`,
    improvements: [
      winnerWeakComp ? `Make ${compTerm} unmistakable — only ${winnerComp}% read it correctly on the winner.`
        : compFlagged && compWorst ? `Tighten ${compTerm} on ${compWorst.name} — only ${compWorst.correctPct}% read it correctly there.`
        : (gaps.length ? `Close the comprehension gap on ${gaps[0].term}: ${gaps[0].issue}` : 'Tighten the value prop in the first line for paid-social truncation.'),
      runnerUp && margin < 8 ? `The lead over ${vName(runnerUp.variantId)} is thin (${margin} pts) — treat the winner as provisional until the live test confirms it.` : 'Make the APR/fee disclosure even more prominent to lift trust among skeptical members.',
      'Test a benefit-led headline variant against the current angle in the real A/B test.',
    ],
    segmentBreakdown,
    evidence,
  }
}

// =====================================================================
// normalizers + synthetic fallbacks
// =====================================================================
function normalizePersona(p) {
  return {
    name: p.name || 'Persona',
    age: typeof p.age === 'number' ? p.age : parseInt(p.age) || 30,
    income: p.income || '$45,000',
    archetype: ['core', 'adjacent', 'skeptical'].includes(p.archetype) ? p.archetype : 'core',
    goals: p.goals || '',
    voice: p.voice || '',
    financialLiteracy: ['low', 'medium', 'high'].includes(p.financialLiteracy) ? p.financialLiteracy : 'medium',
    mediaHabits: p.mediaHabits || '',
    decisionStyle: p.decisionStyle || '',
    keyObjection: p.keyObjection || '',
    segmentFit: p.segmentFit || '',
  }
}

function normalizeFocus(data, variants) {
  const perVariant = (data.perVariant || []).map((v) => ({
    variantId: v.variantId,
    sentiment: num(v.sentiment, 60), trust: num(v.trust, 60), comprehension: num(v.comprehension, 70), intentScore: num(v.intentScore, 50),
    themes: v.themes || [], standoutReactions: v.standoutReactions || [], objections: v.objections || [],
    comprehensionGaps: v.comprehensionGaps || [],
  }))
  // ensure every variant present
  variants.forEach((v) => { if (!perVariant.find((x) => x.variantId === v.id)) perVariant.push({ variantId: v.id, sentiment: 55, trust: 55, comprehension: 65, intentScore: 45, themes: [], standoutReactions: [], objections: [], comprehensionGaps: [] }) })
  const transcript = (data.transcript || []).map((t) => {
    const role = t.role === 'moderator' ? 'moderator' : 'persona'
    const speaker = t.speaker || t.personaName || (role === 'moderator' ? 'Moderator' : 'Participant')
    return {
      role, speaker, personaName: speaker,
      variantId: t.variantId ?? null,
      phase: t.phase || null,
      text: t.text || '',
      intentLabel: role === 'persona' ? (t.intentLabel || undefined) : undefined,
    }
  })
  return { transcript, perVariant }
}

// ---- Deterministic FULL moderated focus-group transcript (no API key) ----
function fn(p) { return (p.name || 'Participant').split(' ')[0] }

function personaScores(p, v, base) {
  const r = rng(hash(p.id + v.id))
  const lift = p.archetype === 'core' ? 12 : p.archetype === 'skeptical' ? -16 : 0
  const s = clampInt(base.sentiment + lift + (r() * 16 - 8), 8, 96)
  return { s, warm: s > 62, cool: s < 42, r }
}
function intentFor(p, v, base) {
  const { s } = personaScores(p, v, base)
  if (p.archetype === 'skeptical') return s > 70 ? 'might apply' : 'would not apply'
  return s > 60 ? 'would apply' : s > 40 ? 'might apply' : 'would not apply'
}

function impressionLine(p, v) {
  const vp = (v.valueProp || 'the offer').toLowerCase()
  const A = {
    core: [
      `Okay, honestly? My first reaction's pretty positive. “${v.headline}” — that's clear, it's not trying to be cute about it. And ${vp} is basically the thing I actually care about, so yeah, you've got my attention.`,
      `You know what, that's kind of refreshing. So many of these are all flash and no substance, but this one feels like it's actually telling me something real. I'd read more, for sure.`,
      `Hmm. I like it more than I expected to, if I'm being real. It gets to ${vp} right away instead of burying it, and it kind of feels like it's for someone like me. That doesn't happen often.`,
    ],
    adjacent: [
      `I mean… it's fine? The headline's clear enough, I'll give it that. But I've heard “${vp}” like a hundred times, so part of me is just like, okay, prove it. I'm curious but I'm not sold.`,
      `My gut says “maybe.” It reads clean, no complaints there. I just — I'd want to know what's actually behind it before I let myself get excited, you know?`,
      `It's not bad. It caught my eye, which honestly is more than most of them manage. But I'm holding off until I see the details, because a headline's the easy part.`,
    ],
    skeptical: [
      `See, my very first thought is “okay, what's the catch.” Anything that leads with “${vp}” usually has a fee or a rate hiding in the fine print somewhere. I've been burned, so I read these sideways.`,
      `Yeah, that's exactly the kind of line that makes me suspicious. “${v.headline}” sounds great — too great, almost. Nobody hands you something for nothing, that's just not how banks work.`,
      `My guard goes straight up, I'm not gonna lie. I'm not saying it's a scam. I'm saying show me the fine print first, then show me the nice headline.`,
    ],
  }
  return pick(A[p.archetype] || A.adjacent, rng(hash(p.id + v.id + 'imp')))
}
function trustLine(p, v) {
  const obj = (p.keyObjection || 'hidden fees').toLowerCase()
  const benefit = (v.valueProp || 'the benefit').toLowerCase()
  const A = {
    core: [`Do I believe it? Yeah, mostly. It's Capital One, it's not some name I've never heard of, so I'll give it the benefit of the doubt and read the terms as I go.`,
      `It doesn't set off any alarm bells for me, honestly. I'd trust it enough to actually start the application and check the details along the way.`],
    adjacent: [`I half-believe it, if I'm being real. Like, “${benefit}” is doing a lot of heavy lifting in that one sentence. What's the trade-off? There's always a trade-off somewhere.`,
      `I want to believe it. But I'd need to see the actual numbers — the rate, the fees, all of it — before I fully buy in. Words are cheap, right?`],
    skeptical: [`No. Not at face value, no way. There's always something — a fee that kicks in, a rate that jumps after a few months. My whole thing is ${obj}, and until somebody actually addresses that, I'm out.`,
      `See, this is what I'm talking about. It sounds too good to be true, so I just assume it is until it's proven otherwise. Call me cynical, I've earned it.`,
      `Honestly my objection's pretty simple — it's ${obj}. That's the first thing I'd be looking for, and I don't see it answered here, so I'm skeptical.`],
  }
  return pick(A[p.archetype] || A.adjacent, rng(hash(p.id + v.id + 'trust')))
}
function compLine(p, v, misread) {
  if (misread) {
    return p.financialLiteracy === 'low'
      ? `Wait, hold on — so the zero percent, that's just… forever, right? Once I've got the card the rate stays low? …No? Okay, see, that's not jumping out at me at all, I totally read it as permanent.`
      : `Hmm, let me make sure I've got this. Does the rate go up to something higher after the intro thing, or is the low one the regular rate? Honestly, reading it quick, I'm not a hundred percent sure.`
  }
  return p.financialLiteracy === 'high'
    ? `For me it's pretty clear — there's an intro period, then it moves to a variable go-to APR based on your credit, and the fee is whatever they state. That part I follow fine.`
    : `I think I get the gist? There's an intro period and then a normal rate, and I'd definitely double-check the fee before signing up. But yeah, roughly, I'm with it.`
}
function objectionLine(p, v) {
  const obj = (p.keyObjection || 'hidden fees').toLowerCase()
  const benefit = (v.valueProp || 'the benefit').toLowerCase()
  const A = {
    core: [`Honestly, the only thing that'd stop me is if I dug into the terms and found ${obj} was actually true. Short of that, I'm pretty much there.`,
      `Not a ton of hesitation for me, to be honest. Maybe just confirming there's no surprise fee waiting, and then I'm comfortable.`],
    adjacent: [`What holds me back is ${obj}, plain and simple. Clear that one thing up for me and I'm probably in.`,
      `I'd hesitate until I could actually see how “${benefit}” pays off for me specifically. Like — what's in it for my situation, not just in general?`],
    skeptical: [`My hesitation? Honestly, all of it. ${obj}, what the rate does after the intro, whether the rewards have some cap buried in there — I'd want every bit of that spelled out before I'd touch it.`,
      `I'm not applying until somebody shows me there's no penalty hiding in here. ${obj} — that's my line, and I don't cross it on a promise.`],
  }
  return pick(A[p.archetype] || A.adjacent, rng(hash(p.id + v.id + 'obj')))
}
function intentLineText(p, v, label) {
  if (label === 'would apply') return `Yeah, for me it's a “probably.” I'd apply, assuming the terms actually match the pitch — and the one thing that'd push me to a “definitely” is just seeing the fees laid out plainly up front.`
  if (label === 'would not apply') return `Honestly? “Probably not,” for me. I'd need a much clearer guarantee on the fees before I'd move on it — right now there's too much I'm guessing at.`
  return `I'm a solid “maybe.” I'm genuinely interested, I am, but I'd want to put it side by side with my current card first before I commit to anything.`
}
// A coherent reaction to another participant — stance matches the speaker's own archetype.
function crossTalkLine(a, otherName, v) {
  const benefit = (v.valueProp || 'the benefit').toLowerCase()
  const obj = (a.keyObjection || 'the fees').toLowerCase()
  const banks = {
    skeptical: [
      `See, I hear ${otherName}, I do — but I'm not there. They're looking at the upside; I'm still stuck on what's not being said about ${obj}.`,
      `Respectfully, I've gotta push back on ${otherName} a bit. It's easy to like the headline. I just don't trust it until the fine print backs it up.`,
    ],
    core: [
      `Yeah, honestly I'm with ${otherName} on this one. Same gut reaction — it feels straight with me, and that counts for a lot these days.`,
      `No, ${otherName} kind of nailed it for me too. I'd rather have something clear like this than a flashier pitch I can't actually trust.`,
    ],
    adjacent: [
      `I'm sort of half-and-half with ${otherName}. I get the appeal, I really do — I just want to see how “${benefit}” plays out for me before I land anywhere.`,
      `I see what ${otherName} means, but I'm more on the fence than that. It's promising, sure — but “promising” and “proven” aren't the same thing, are they?`,
    ],
  }
  return pick(banks[a.archetype] || banks.adjacent, rng(hash(a.id + v.id + 'ct')))
}

const MOD = {
  open: (n, prod) => `Alright, thanks so much for being here, everyone — really appreciate you giving us your time. I'm your moderator today. Over the next little while we're going to look at a few ${prod} concepts together, and all I'm after is your honest, gut-level reactions. There are genuinely no right or wrong answers here, and nothing you say leaves this room, so please don't hold back. Let's warm up easy: when a credit-card offer pops up in your feed, how do you usually feel about it? Just a word or two.`,
  introInvite: (name) => `${name}, you want to kick us off?`,
  present: (v, i) => `Great, thank you for that. Okay, let's put the ${i === 0 ? 'first' : 'next'} concept up on the screen. The headline reads: “${v.headline},” and the whole thing's built around ${(v.valueProp || 'its core benefit').toLowerCase()}. Take a second, really look at it — and just tell me, what's the very first thing that goes through your head?`,
  probeTrust: `Okay, let me push on that a little. Be straight with me here — do you actually believe it? Does anything about it feel too good to be true, like there's a catch you're not seeing?`,
  probeComp: `Let me slow us down for a sec, because I want to make sure we're all reading this the same way. In your own words — no wrong answers — what happens to the interest rate after any intro period? And is there a fee in there?`,
  clarify: `Okay, thank you for saying that out loud — and honestly that's a really important one to flag, because you're not alone in reading it that way. Just so we're all clear: the intro rate isn't permanent. After the intro period it moves to a variable go-to APR, and the fee is spelled out in the terms. And that distinction is a big deal, because it changes what you'd actually pay down the line.`,
  probeObj: `So let's get into it — what would actually stop you from applying? Where's the hesitation for you, honestly?`,
  push: (a, b) => `${a}, I saw you nodding while ${b} was talking — do you agree with that, or are you seeing it a bit differently?`,
  agree: (other) => `Yeah, I'm with ${other} on this, actually — same instinct. `,
  disagree: (other) => `See, I'd push back on ${other} a little, respectfully. I don't think it's as clear-cut as that. `,
  transition: `That's really helpful, all of it — thank you. Alright, let's switch gears and look at the next one.`,
  compare: `Okay, last big one. Now that you've seen both of them side by side, I want to go around the room — which one actually speaks to you more, and be honest about why. Don't overthink it, just gut.`,
  compareLine: (p, v) => p.archetype === 'skeptical'
    ? `If you're making me choose… I guess “${v.name}.” And only because it felt a little less like it was hiding something. Faint praise, I know.`
    : `“${v.name}” for me, no real contest. It just felt like it was actually talking to my situation, where the other one kind of washed over me.`,
  closeAsk: `Alright, last thing and then I'll let you all go — I promise. Quick go-around: on a scale from “definitely not” to “definitely,” how likely are you, realistically, to actually apply? And give me the one thing that would bump you up a notch.`,
  close: `That is genuinely, genuinely useful — every bit of it. Thank you all so much for your time and your honesty today. Really.`,
}

function syntheticFocus({ personas, variants, campaign, lengthMins = 15, groupDynamics = true }) {
  // --- perVariant signal (same model as before) ---
  const perVariant = variants.map((v) => {
    const r = rng(hash(v.id + 'fg'))
    const sentiment = clampInt(45 + r() * 45, 10, 95)
    const trust = clampInt(sentiment - 5 + r() * 20 - 10, 10, 95)
    const comprehension = clampInt(60 + r() * 35, 25, 99)
    const intentScore = clampInt(sentiment * 0.7 + r() * 15, 5, 85)
    const gaps = comprehension < 70 ? [{ term: 'APR after intro period', issue: 'Several personas assumed the intro rate was permanent.' }] : []
    return {
      variantId: v.id, sentiment, trust, comprehension, intentScore,
      themes: ['Clarity of value prop', sentiment > 60 ? 'Trust in terms' : 'Skepticism about fees', 'Relevance to my situation'],
      standoutReactions: [sentiment > 65 ? 'Resonated with budget-conscious members' : 'Felt generic to several members'],
      objections: ['Worried about fees after the intro', 'Wants proof it helps their credit'],
      comprehensionGaps: gaps,
    }
  })
  const transcript = buildModeratedTranscript({ personas, variants, campaign, perVariant, lengthMins, groupDynamics })
  return { transcript, perVariant }
}

// Builds a full, realistic moderated focus-group transcript from already-computed
// perVariant signal. Exported so seed demos can reuse it with their own numbers.
export function buildModeratedTranscript({ personas, variants, campaign = {}, perVariant, lengthMins = 15, groupDynamics = true }) {
  const prod = (PRODUCTS_BY_ID[campaign.product]?.name || 'credit-card').toLowerCase()
  const long = lengthMins === 30
  const cast = personas.slice(0, Math.min(personas.length, long ? 8 : 6))
  const transcript = []
  const push = (role, speaker, text, extra = {}) => transcript.push({ role, speaker, personaName: speaker, variantId: extra.variantId ?? null, phase: extra.phase || null, text, intentLabel: extra.intentLabel })
  const baseOf = (v) => perVariant.find((x) => x.variantId === v.id) || { sentiment: 55, comprehension: 70, intentScore: 50 }

  // --- OPENING ---
  push('moderator', 'Moderator', MOD.open(cast.length, prod), { phase: 'Opening' })
  const introCast = long ? cast : cast.slice(0, Math.min(cast.length, 4))
  const INTRO = {
    skeptical: [
      `Honestly? Skeptical. I assume there's a catch until I see the fine print.`,
      `Wary — I've been burned before, so my default is "what aren't they telling me?"`,
      `I usually scroll right past them. They all sound the same and I don't trust the promises.`,
    ],
    core: [
      (p) => `I actually pay attention to them — I'm always looking for ${(p.goals || 'a better deal').toLowerCase()}.`,
      () => `Pretty open, honestly. If the offer's good and clear, I'll read the whole thing.`,
      () => `Interested, generally. I like comparing what's out there before I commit.`,
    ],
    adjacent: [
      `Depends on the offer. Most I ignore, but a good one will get me to read.`,
      `Mixed — I don't seek them out, but I'll stop if the headline actually says something.`,
      `Cautiously curious. I'll look, but I need it to feel relevant to me.`,
    ],
  }
  const introSeen = {}
  introCast.forEach((p, i) => {
    if (i === 0) push('moderator', 'Moderator', MOD.introInvite(fn(p)), { phase: 'Opening' })
    const bank = INTRO[p.archetype] || INTRO.adjacent
    const k = (introSeen[p.archetype] = (introSeen[p.archetype] ?? -1) + 1)
    const entry = bank[k % bank.length]
    push('persona', p.name, typeof entry === 'function' ? entry(p) : entry, { phase: 'Opening' })
  })

  // --- PER-VARIANT DISCUSSION ---
  variants.forEach((v, vi) => {
    const base = baseOf(v)
    const phaseTag = `Concept ${String.fromCharCode(65 + vi)}`
    push('moderator', 'Moderator', MOD.present(v, vi), { variantId: v.id, phase: phaseTag })

    // First impressions — most of the room
    const impressionCast = long ? cast : cast.slice(0, 5)
    impressionCast.forEach((p) => push('persona', p.name, impressionLine(p, v), { variantId: v.id, phase: `${phaseTag} · First impressions` }))

    // Group dynamics: the moderator invites someone to react, then another chimes in
    if (groupDynamics && impressionCast.length >= 3) {
      const a = impressionCast[2], other = impressionCast[0]
      push('moderator', 'Moderator', MOD.push(fn(a), fn(other)), { variantId: v.id, phase: `${phaseTag} · First impressions` })
      push('persona', a.name, crossTalkLine(a, fn(other), v), { variantId: v.id, phase: `${phaseTag} · First impressions` })
      if (impressionCast.length >= 4) {
        const b = impressionCast[3]
        push('persona', b.name, crossTalkLine(b, fn(a), v), { variantId: v.id, phase: `${phaseTag} · First impressions` })
      }
    }

    // Trust probe
    push('moderator', 'Moderator', MOD.probeTrust, { variantId: v.id, phase: `${phaseTag} · Trust` })
    const trustCast = (long ? cast : cast.slice(0, 4)).filter((p) => p.archetype !== 'core' || rng(hash(p.id + 'tc'))() > 0.4)
    ;(trustCast.length ? trustCast : cast.slice(0, 3)).forEach((p) => push('persona', p.name, trustLine(p, v), { variantId: v.id, phase: `${phaseTag} · Trust` }))

    // Comprehension probe — surfaces the misread when comprehension is low
    push('moderator', 'Moderator', MOD.probeComp, { variantId: v.id, phase: `${phaseTag} · Comprehension` })
    const misreader = cast.find((p) => p.financialLiteracy === 'low') || cast.find((p) => p.archetype === 'skeptical') || cast[cast.length - 1]
    const compCast = long ? cast.slice(0, 4) : cast.slice(0, 3)
    compCast.forEach((p) => {
      const misread = base.comprehension < 70 && p === misreader
      push('persona', p.name, compLine(p, v, misread), { variantId: v.id, phase: `${phaseTag} · Comprehension` })
    })
    if (base.comprehension < 70) push('moderator', 'Moderator', MOD.clarify, { variantId: v.id, phase: `${phaseTag} · Comprehension` })

    // Objections probe
    push('moderator', 'Moderator', MOD.probeObj, { variantId: v.id, phase: `${phaseTag} · Objections` })
    const objCast = long ? cast.slice(0, 5) : cast.slice(0, 3)
    objCast.forEach((p) => push('persona', p.name, objectionLine(p, v), { variantId: v.id, phase: `${phaseTag} · Objections` }))

    // Deeper dig (long sessions): moderator asks what would move a "no" to a "yes"
    if (long) {
      push('moderator', 'Moderator', `Say I could fix one thing. What's the single change that would move you from a "no" or a "maybe" to a "yes"?`, { variantId: v.id, phase: `${phaseTag} · Objections` })
      cast.slice(0, 4).forEach((p) => {
        const obj = (p.keyObjection || 'the fees').toLowerCase()
        const line = p.archetype === 'skeptical'
          ? `Put the actual numbers right next to the promise — show me ${obj} can't bite me, and I'd reconsider.`
          : p.archetype === 'core'
            ? `Honestly not much — maybe just a line confirming there's no surprise on ${obj} and I'm in.`
            : `If it spelled out exactly how "${(v.valueProp || 'the benefit').toLowerCase()}" applies to someone like me, that'd tip me over.`
        push('persona', p.name, line, { variantId: v.id, phase: `${phaseTag} · Objections` })
      })
    }

    if (vi < variants.length - 1) push('moderator', 'Moderator', MOD.transition, { phase: phaseTag })
  })

  // --- COMPARISON ---
  if (variants.length >= 2) {
    push('moderator', 'Moderator', MOD.compare, { phase: 'Comparison' })
    const compareCast = long ? cast : cast.slice(0, 5)
    compareCast.forEach((p) => {
      const r = rng(hash(p.id + 'cmp'))
      const choice = variants[Math.floor(r() * variants.length)]
      push('persona', p.name, MOD.compareLine(p, choice), { variantId: choice.id, phase: 'Comparison' })
    })
  }

  // --- CLOSING intent round ---
  push('moderator', 'Moderator', MOD.closeAsk, { phase: 'Closing' })
  cast.forEach((p) => {
    const top = [...variants].sort((a, b) => baseOf(b).intentScore - baseOf(a).intentScore)[0]
    const label = intentFor(p, top, baseOf(top))
    push('persona', p.name, intentLineText(p, top, label), { variantId: top.id, phase: 'Closing', intentLabel: label })
  })
  push('moderator', 'Moderator', MOD.close, { phase: 'Closing' })

  return transcript
}

// ---------- tiny utils ----------
function num(v, d) { const n = Number(v); return Number.isFinite(n) ? clampInt(n, 0, 100) : d }
function fieldMax(channel, key) { const f = channel.fields.find((x) => x.key === key); return f ? f.max : 200 }
function trunc(s, max) { if (!s) return ''; s = String(s).trim(); return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s }
function splitCounts(n, dist) {
  const core = Math.round(n * dist.core)
  const adjacent = Math.round(n * dist.adjacent)
  const skeptical = Math.max(0, n - core - adjacent)
  return { core, adjacent, skeptical }
}
