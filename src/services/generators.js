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
        system: 'You are a professional market-research moderator running a REALISTIC, full-length synthetic focus group for a regulated credit-card issuer. Produce an actual moderated discussion transcript: the moderator opens, sets ground rules, presents each concept, and actively moderates — asking open questions, follow-up probes, inviting quieter participants by name, surfacing agreement and disagreement between participants, checking comprehension of material terms, and closing with an apply-intent go-around. Personas speak in character (use their voice, archetype, and key objection). Paraphrase; never fabricate quotes attributed to real people. CRITICAL: when a persona misreads a material term (APR, fees, deposit, intro period), show it in the dialogue and have the moderator gently clarify — that misread is both a conversion risk and a compliance signal.',
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
// =====================================================================
export async function buildSurvey({ settings, focusGroup, variants }) {
  if (hasKey(settings)) {
    try {
      const themes = focusGroup?.perVariant?.flatMap((v) => v.themes) || []
      const data = await callLLMJson({
        settings,
        temperature: 0.5,
        system: 'You design quantitative survey instruments for credit-card creative testing. Build items grounded in the focus-group themes.',
        prompt: `Focus-group themes: ${JSON.stringify(themes.slice(0, 12))}.
Variants: ${JSON.stringify(variants.map((v) => ({ id: v.id, name: v.name })))}
Return a JSON array of survey items. Types: "likert" (appeal, 5-pt), "comprehension" (with options + correctIndex), "maxdiff" (value-prop forced choice), "intent" (apply intent 5-pt), "open". Each item: {id,type,text,options?,correctIndex?}. Include 1-2 comprehension checks on material terms (APR/fees).`,
      })
      return (Array.isArray(data) ? data : data.items || []).map((q, i) => ({ id: q.id || `q${i + 1}`, ...q }))
    } catch (e) { /* fall back */ }
  }
  return defaultSurvey(variants)
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
  return { n, perVariant: perVariant.map(({ _score, ...rest }) => rest), ranking }
}

// =====================================================================
// RECOMMENDATION (Step 7)
// =====================================================================
export async function recommend({ settings, focusGroup, survey, variants, target }) {
  const segs = target.segments.map((id) => getSegment(id, target.custom)).filter(Boolean)
  const ranked = [...survey.perVariant].sort((a, b) => b.prefShare - a.prefShare)
  const winner = ranked[0]
  const winnerVar = variants.find((v) => v.id === winner.variantId)
  const margin = winner.prefShare - (ranked[1]?.prefShare ?? 0)
  const confidence = margin >= 18 ? 'high' : margin >= 8 ? 'moderate' : 'low'

  const segmentBreakdown = segs.map((s) => {
    let best = null, bestShare = -1
    survey.perVariant.forEach((v) => {
      const seg = v.bySegment.find((b) => b.segment === s.name)
      if (seg && seg.prefShare > bestShare) { bestShare = seg.prefShare; best = v.variantId }
    })
    const bv = variants.find((v) => v.id === best)
    return { segment: s.name, preferredVariantId: best, preferredVariant: bv?.name, prefShare: bestShare, why: `${s.name} responds to ${bv?.valueProp || bv?.name} — aligned to their motivation (${s.motivation}).` }
  })

  if (hasKey(settings)) {
    try {
      const data = await callLLMJson({
        settings,
        temperature: 0.4,
        system: 'You are a marketing-science lead. Give a crisp, honest recommendation. Synthetic results are directional, not definitive — say so.',
        prompt: `Winner by preference share: ${winnerVar?.name} (${winner.prefShare}% vs runner-up ${ranked[1]?.prefShare ?? 0}%).
Target: ${briefOf(target)}
Focus-group per-variant: ${JSON.stringify(focusGroup?.perVariant || [])}
Survey per-variant: ${JSON.stringify(survey.perVariant)}
Return JSON: {"rationale": "...", "intersectionalFit": "how well the winner serves the combined target vs each component segment", "improvements": ["..."], "predictedPrefShare": ${winner.prefShare}, "confidence": "${confidence}"}`,
      })
      return { winnerId: winner.variantId, predictedPrefShare: winner.prefShare, confidence: data.confidence || confidence, rationale: data.rationale, intersectionalFit: data.intersectionalFit, improvements: data.improvements || [], segmentBreakdown }
    } catch (e) { /* fall back */ }
  }

  const gaps = focusGroup?.perVariant?.find((v) => v.variantId === winner.variantId)?.comprehensionGaps || []
  return {
    winnerId: winner.variantId,
    predictedPrefShare: winner.prefShare,
    confidence,
    rationale: `${winnerVar?.name} leads on predicted preference share (${winner.prefShare}%, a ${margin}-pt margin over the runner-up) and scores highest on combined sentiment, trust, and apply-intent. It speaks to the target's core motivation while keeping required terms clear.`,
    intersectionalFit: `The winner serves the combined target ${briefOf(target).split('.')[0]}. It is strongest with ${segmentBreakdown[0]?.segment}; watch ${segmentBreakdown[segmentBreakdown.length - 1]?.segment}, where the margin is thinner.`,
    improvements: [
      gaps.length ? `Close the comprehension gap on ${gaps[0].term}: ${gaps[0].issue}` : 'Tighten the value prop in the first line for paid-social truncation.',
      'Make the APR/fee disclosure even more prominent to lift trust among skeptical members.',
      'Test a benefit-led headline variant against the current angle in the real A/B test.',
    ],
    segmentBreakdown,
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
      `Honestly, my first reaction is positive — “${v.headline}” is clear and it speaks to ${vp} right away.`,
      `I like it. It feels like it's actually for someone like me, and ${vp} is exactly what I care about.`,
      `That headline lands for me. I'd at least want to read more, which is more than I can say for most card ads.`,
    ],
    adjacent: [
      `It's fine — the headline is clear enough, though I'd want to know what's behind ${vp} before I get excited.`,
      `My gut says “okay, maybe.” It reads clean, but I've seen a lot of cards promise ${vp}.`,
      `Neutral, leaning curious. “${v.headline}” gets my attention but I'm reserving judgment.`,
    ],
    skeptical: [
      `My very first thought is “what's the catch?” Anything that leads with ${vp} usually has a fee hiding somewhere.`,
      `I'm immediately suspicious. “${v.headline}” sounds nice, but nice is how they get you.`,
      `I read that and my guard goes up. Show me the fine print before you show me ${vp}.`,
    ],
  }
  return pick(A[p.archetype] || A.adjacent, rng(hash(p.id + v.id + 'imp')))
}
function trustLine(p, v) {
  const A = {
    core: [`I'm inclined to believe it, honestly. Capital One's a known name, so I'd give it the benefit of the doubt.`,
      `It doesn't feel scammy to me. I'd trust it enough to apply and read the terms as I go.`],
    adjacent: [`I half-believe it. I'd want to see the actual numbers before I fully buy in.`,
      `It's believable, but “${(v.valueProp || 'the benefit').toLowerCase()}” is doing a lot of work. What's the trade-off?`],
    skeptical: [`No, I don't believe it — not at face value. There's always a fee or a rate that kicks in later.`,
      `This is exactly the kind of thing that sounds too good to be true, so I assume it is until proven otherwise.`,
      `My objection is simple: ${(p.keyObjection || 'hidden fees').toLowerCase()}. Until that's addressed, I'm out.`],
  }
  return pick(A[p.archetype] || A.adjacent, rng(hash(p.id + v.id + 'trust')))
}
function compLine(p, v, misread) {
  if (misread) {
    return p.financialLiteracy === 'low'
      ? `So the 0% — that's just forever, right? Once I have the card the rate stays low? (assumes the intro APR is permanent)`
      : `Wait — does the intro rate become a higher APR after a while, or is the low rate the ongoing one? It's not jumping out at me.`
  }
  return p.financialLiteracy === 'high'
    ? `I read it as: intro period, then a variable go-to APR based on creditworthiness, and the annual fee is what it says. That part's clear to me.`
    : `I think I get it — there's an intro period and then a regular rate, and I'd double-check the fee before applying.`
}
function objectionLine(p, v) {
  const obj = (p.keyObjection || 'hidden fees').toLowerCase()
  const A = {
    core: [`The one thing that'd stop me is if ${obj} turned out to be true once I read the terms.`,
      `Not much hesitation for me — maybe just confirming there's no surprise fee.`],
    adjacent: [`What holds me back is ${obj}. Clear that up and I'm probably in.`,
      `I'd hesitate until I saw how “${(v.valueProp || 'the benefit').toLowerCase()}” actually pays off for me specifically.`],
    skeptical: [`My hesitation is everything — ${obj}, the rate after the intro, whether the rewards have caps. All of it.`,
      `I won't apply until someone shows me there's no penalty buried in here. ${obj} is my line.`],
  }
  return pick(A[p.archetype] || A.adjacent, rng(hash(p.id + v.id + 'obj')))
}
function intentLineText(p, v, label) {
  if (label === 'would apply') return `For me it's a “probably” — I'd apply, assuming the terms match the pitch.`
  if (label === 'would not apply') return `Honestly, “probably not.” It'd take a clearer guarantee on the fees before I'd move.`
  return `I'm a “might.” Interested, but I'd need to compare it against my current card first.`
}

const MOD = {
  open: (n, prod) => `Thanks for being here, everyone. I'm your moderator. Over the next little while we'll look at a few ${prod} concepts and I want your honest, gut-level reactions — there are no right or wrong answers, and nothing you say leaves this room. Let's warm up: in a sentence, how do you generally feel when a credit-card offer shows up in your feed?`,
  introInvite: (name) => `${name}, want to kick us off?`,
  present: (v, i) => `Great, thank you. Let's put up the ${i === 0 ? 'first' : i === 1 ? 'next' : 'next'} concept. The headline reads: “${v.headline}.” It's built around ${(v.valueProp || 'its core benefit').toLowerCase()}. Take a second — what's the very first thing that goes through your head?`,
  probeTrust: `Let me push on that. Be honest with me — do you actually believe it? Does anything here feel too good to be true, like there's a catch?`,
  probeComp: `I want to make sure we're all reading this the same way. In your own words: what happens to the interest rate after any intro period, and is there a fee?`,
  clarify: `Good — and that's an important one to flag. To be clear, the intro rate isn't permanent; after the intro period it moves to a variable go-to APR, and the fee is disclosed in the terms. That distinction matters a lot for what you'd actually pay.`,
  probeObj: `So what would actually stop you from applying? Where's the hesitation?`,
  push: (a, b) => `${a}, ${b} just made a point you seemed to react to — do you agree, or do you see it differently?`,
  agree: (other) => `I'm with ${other} on this, actually — same instinct.`,
  disagree: (other) => `I'd push back on ${other} a little. I don't think it's as clear-cut as that.`,
  transition: `Really helpful, thank you. Let's switch gears to the next concept.`,
  compare: `Now that you've all seen both, I want to go around: which one actually speaks to you more, and why? Be specific.`,
  compareLine: (p, v) => p.archetype === 'skeptical'
    ? `If I had to pick, “${v.name}” — only because it felt slightly less like it was hiding something.`
    : `“${v.name}” for me. It just felt more like it was talking to my situation.`,
  closeAsk: `Last thing, and then I'll let you go. Going around the room: on a scale from “definitely not” to “definitely,” how likely are you to actually apply — and what's the one thing that would move you up a notch?`,
  close: `That is genuinely useful. Thank you all for your time and your candor today.`,
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
  introCast.forEach((p, i) => {
    if (i === 0) push('moderator', 'Moderator', MOD.introInvite(fn(p)), { phase: 'Opening' })
    const bank = INTRO[p.archetype] || INTRO.adjacent
    const entry = bank[i % bank.length]
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

    // Group dynamics: one agrees, one pushes back
    if (groupDynamics && impressionCast.length >= 3) {
      const a = impressionCast[2], other = impressionCast[0]
      push('moderator', 'Moderator', MOD.push(fn(a), fn(other)), { variantId: v.id, phase: `${phaseTag} · First impressions` })
      const r = rng(hash(a.id + v.id + 'gd'))
      push('persona', a.name, (r() > 0.5 ? MOD.agree(fn(other)) + ' ' + impressionLine(a, v) : MOD.disagree(fn(other)) + ' ' + trustLine(a, v)), { variantId: v.id, phase: `${phaseTag} · First impressions` })
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

function defaultSurvey(variants) {
  return [
    { id: 'q1', type: 'likert', text: 'How appealing is this offer to you?', scale: ['Not at all', 'Slightly', 'Moderately', 'Very', 'Extremely'] },
    { id: 'q2', type: 'comprehension', text: 'After the intro period, the APR on this card is…', options: ['0% forever', 'A variable go-to APR based on creditworthiness', 'Always 9.99%', 'There is no APR'], correctIndex: 1 },
    { id: 'q3', type: 'comprehension', text: 'The annual fee for this card is…', options: ['$0', '$95', 'Not stated', 'Refundable'], correctIndex: 0 },
    { id: 'q4', type: 'maxdiff', text: 'Which value prop matters most to you?', options: variants.map((v) => v.valueProp || v.name) },
    { id: 'q5', type: 'intent', text: 'How likely are you to apply?', scale: ['Definitely not', 'Probably not', 'Might', 'Probably', 'Definitely'] },
    { id: 'q6', type: 'open', text: 'What, if anything, gives you pause about applying?' },
  ]
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
