// LLM transport — calls Anthropic or OpenAI directly from the browser using a
// user-provided API key. Keys live only in app state (localStorage); nothing is
// sent anywhere except the chosen provider's API.

export const PROVIDERS = {
  anthropic: {
    label: 'Anthropic (Claude)',
    defaultModel: 'claude-sonnet-4-6',
    models: ['claude-sonnet-4-6', 'claude-opus-4-8', 'claude-haiku-4-5-20251001'],
    keyHint: 'sk-ant-…',
    defaultBaseURL: 'https://api.anthropic.com',
    baseHint: 'https://api.anthropic.com',
  },
  openai: {
    label: 'OpenAI / Compatible',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1'],
    keyHint: 'sk-…',
    defaultBaseURL: 'https://api.openai.com/v1',
    baseHint: 'https://api.openai.com/v1  (or Azure / local / proxy)',
  },
}

// Resolve the effective base URL: user override → provider default, trimmed of trailing slash.
function resolveBase(settings) {
  const provider = PROVIDERS[settings?.provider] || PROVIDERS.anthropic
  const base = (settings?.baseURL || '').trim() || provider.defaultBaseURL
  return base.replace(/\/+$/, '')
}

export class LLMError extends Error {}

// Low-level call. Returns the raw text content of the model response.
export async function callLLM({ settings, system, prompt, temperature = 0.7, maxTokens = 2400 }) {
  const { provider, apiKey, model } = settings || {}
  if (!apiKey) throw new LLMError('No API key set. Add one in Settings, or use the preloaded seed data.')

  const base = resolveBase(settings)

  if (provider === 'anthropic') {
    const res = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: model || PROVIDERS.anthropic.defaultModel,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) throw new LLMError(await errText(res))
    const data = await res.json()
    return (data.content || []).map((c) => c.text || '').join('')
  }

  if (provider === 'openai') {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model || PROVIDERS.openai.defaultModel,
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      }),
    })
    if (!res.ok) throw new LLMError(await errText(res))
    const data = await res.json()
    return data.choices?.[0]?.message?.content || ''
  }

  throw new LLMError(`Unknown provider: ${provider}`)
}

// Call expecting a JSON object/array back. Robust to code fences / prose wrappers.
export async function callLLMJson(opts) {
  const text = await callLLM({ ...opts, system: `${opts.system}\n\nRespond with ONLY valid minified JSON. No markdown, no commentary.` })
  return extractJson(text)
}

export function extractJson(text) {
  if (!text) throw new LLMError('Empty model response.')
  let t = text.trim()
  // strip ```json fences
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try { return JSON.parse(t) } catch { /* fall through */ }
  // grab the first {...} or [...] block
  const first = t.search(/[[{]/)
  const lastObj = t.lastIndexOf('}')
  const lastArr = t.lastIndexOf(']')
  const last = Math.max(lastObj, lastArr)
  if (first >= 0 && last > first) {
    const slice = t.slice(first, last + 1)
    try { return JSON.parse(slice) } catch { /* fall through */ }
  }
  throw new LLMError('Could not parse JSON from model response.')
}

async function errText(res) {
  let detail = ''
  try { const j = await res.json(); detail = j.error?.message || JSON.stringify(j) } catch { detail = await res.text() }
  return `API error ${res.status}: ${detail}`.slice(0, 400)
}

export function hasKey(settings) {
  return Boolean(settings && settings.apiKey)
}
