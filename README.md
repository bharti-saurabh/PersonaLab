# Persona Lab · Capital One

A **compliance-first synthetic audience platform** for financial-services performance marketing. Persona Lab lets a credit-card marketer pick a target segment, create or paste creative (with **live per-channel previews**), test it against an AI-simulated consumer panel (focus group + survey), get a clear recommendation, and plan the real A/B test that validates the prediction — end to end in minutes. Capital One–branded, with a real-time generation experience (streaming status + progressive reveals).

> ⚠️ **Directional signal, not validated research.** Every synthetic output simulates how an LLM models the selected audience. It is a hypothesis generator. Validate with the real A/B test (Step 8) before acting. The app says so on every results view.

## Quick start

```bash
npm install
npm run dev      # opens http://localhost:5173
```

That's it. The app loads **two fully completed example campaigns** (Student Card and Secured Card) so the whole pipeline is demoable with **zero setup and no API key**.

To power live generation, open **Settings** and configure the **LLM connection**: provider, **Base URL** (defaults to the provider's host; override it for Azure, a gateway/proxy, or a local OpenAI-compatible server), **Model** (free-text with suggestions), and **API key**. Everything is stored only in your browser (`localStorage`) and is sent only to the endpoint you choose. Without a key, the app uses deterministic synthetic fallbacks so nothing breaks.

```bash
npm run build    # production build to dist/
npm run preview  # preview the build
```

## The pipeline

1. **Campaign Setup** — product, objective, channel(s).
2. **Target Segment** — searchable library across four lenses (Value & Rewards, Credit Lifecycle, Life Stage, Mindset & Behavior); compose intersectional targets; add proprietary custom segments (auto-blocked if they encode a protected class).
3. **Creative & Compliance** — paste 2–5 variants or generate compliant ones, with a **live channel preview** (search ad, social ad, display banner, email, landing hero) behind an Edit/Preview toggle; **every variant is screened by the Compliance Engine before any testing**.
4. **Synthetic Personas** — generate an on-segment panel with controllable within-segment diversity.
5. **Focus Group** — a moderator agent runs a structured discussion; flags any **material-term misread** (conversion + compliance risk).
6. **Survey & Quant Panel** — auto-build an instrument from focus-group themes, field it to a larger panel, export for real fielding.
7. **Recommendation** — declares a winner with confidence, segment breakdowns, intersectional fit, and improvement ideas; one-click iterate-and-retest.
8. **A/B Test Planner** — hypothesis, sample size with a power calculation, duration, guardrails, and an optional simulated outcome.

## Cross-cutting

- **Compliance Engine** — configurable rulepack for fair lending (ECOA/Reg B), UDAAP, required disclosures, and prohibited claims. Risk rating + rule + rationale + suggested rewrite per variant. Exportable audit log and one-page summary.
- **Fairness & Representation Audit** — segments are behavioral/needs-based/financial-profile only; custom segments referencing protected classes or close proxies are **blocked and logged**.

## Guardrails (by design)

- Synthetic output is always labeled directional, with the methodology shown.
- No fabricated citations or quotes attributed to real people.
- Protected-class proxies are never used to improve targeting — fairness is a hard constraint.
- All data stays in app state (`localStorage`); nothing is stored externally.

## Stack

React 18 + Vite, Tailwind CSS (Capital One navy/red theme), Recharts, lucide-react. No backend. The real-time generation experience (streaming status console + staggered reveals) lives in `src/components/generate.jsx`; per-channel ad mockups in `src/components/CreativePreview.jsx`. See [CLAUDE.md](CLAUDE.md) for architecture notes.
