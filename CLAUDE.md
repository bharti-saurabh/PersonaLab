# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install      # install deps
npm run dev      # Vite dev server at http://localhost:5173 (auto-opens)
npm run build    # production build to dist/
npm run preview  # serve the production build
```

No test runner or linter is configured. There is no backend — everything runs client-side in the browser.

## What this is

**Persona Lab** — a compliance-first synthetic audience platform for credit-card marketing, **Capital One–branded** (logo at `public/capone-logo.webp`; navy `#004977` + red `#d03027` palette). An 8-step pipeline (campaign → segment → creative+compliance → personas → focus group → survey → recommendation → A/B plan) that tests creative against an LLM-simulated consumer panel. Outputs are explicitly **directional signal, not validated research** — that framing is load-bearing and appears throughout the UI (`SyntheticBanner`). Preserve it in any change.

## Architecture (the big picture)

The app is a single React tree over one global store. There is no router; navigation is a `currentStep` field on the active project.

- **State — `src/state/store.jsx`** is the single source of truth: a `useReducer` store persisted to `localStorage` (`persona-lab-state-v1`). The store holds `settings`, `projects[]`, `activeProjectId`, the editable `rulepack`, a global `auditLog`, and reusable `libraries` (targeting profiles + panels). On first run it seeds two complete example projects via `buildSeedState`.
  - `useProject()` is the primary hook every step uses: returns `{ project, update, settings, store, actions }`. `update(patch)` **deep-merges** into the active project (arrays are replaced wholesale — pass a full new array to change one).
  - `src/state/nav.js` defines the 8 `STEPS`, `stepStatus(project)` (gating — which steps are complete), and `useNav()` (`goTo/goNext/goBack`).

- **A "project"** (see `newProject()` in `store.jsx`) is the central data model. Each pipeline step reads and writes one slice: `campaign`, `target`, `creative`, `panel`, `focusGroup`, `survey`, `recommendation`, `abTest`, `calibration`. Steps persist their outputs so `stepStatus` unlocks the next step. The exact shapes are documented inline in `seed.js` (which builds fully-populated instances) — that file is the best reference for what each slice looks like when complete.

- **Data — `src/data/`** is static domain content: `segments.js` (the 4-lens segment library + `describeTarget`/`getSegment` + product affinity), `products.js` (products, objectives, channels with per-channel field character limits), `complianceRules.js` (`DEFAULT_RULEPACK` + `PROTECTED_CLASS_PROXIES`), and `seed.js` (the two demo projects, built using the real services so they stay internally consistent).

- **Services — `src/services/`** is the logic layer, all framework-agnostic:
  - `llm.js` — direct browser calls to Anthropic or any OpenAI-compatible endpoint with a user-supplied key (`callLLM`, `callLLMJson`, `hasKey`). Anthropic uses the `anthropic-dangerous-direct-browser-access` header. `settings.baseURL` overrides the provider's default host (`PROVIDERS[p].defaultBaseURL`) so Azure/proxy/local servers work; `resolveBase()` trims it and Anthropic appends `/v1/messages`, OpenAI appends `/chat/completions`.
  - `generators.js` — the high-level functions each step calls (`generateCreative`, `generatePersonas`, `runFocusGroup`, `buildSurvey`, `fieldSurvey`, `recommend`). **Each tries the LLM when a key is present and falls back to a deterministic synthesizer otherwise**, so the app always works. Quant (survey) numbers are derived from focus-group signal so qualitative and quantitative views stay coherent.
  - `compliance.js` — deterministic rule-based screening (`screenVariant`/`screenAll`, `buildAuditLog`). Runs without any API.
  - `fairness.js` — blocks custom segments that reference protected classes/proxies and produces audit refusal records.
  - `stats.js` — A/B power/sample-size math (`powerPlan`, `simulateOutcome`); self-contained `normInv`/`normCdf`.

- **UI** — `src/App.jsx` (shell: top bar with the Capital One brand lockup + project switcher, a full-width **horizontal `TopStepper`** with per-step icons and a progress line, footer) renders the active step from `src/steps/StepN*.jsx`. There is **no left sidebar** — navigation is the top stepper. Shared primitives live in `src/components/ui.jsx` (Card, Badge, RiskBadge, StatCard, SyntheticBanner, Modal, …) and `src/components/charts.jsx` (Recharts wrappers: `BarsCard`, `RadarCard`, `DonutCard`, `LineCard`). Exports (CSV/JSON/print-to-PDF) are in `src/utils/export.js`.
  - **`src/components/generate.jsx`** is the shared "generating in real time" engine used by every generative step. `useStagedGenerate()` returns `{ running, lines, run }`; `run({ steps, work, minMs })` streams the `steps` status lines into a `<GenConsole>` one-by-one while `work()` (the actual LLM/fallback call) runs in parallel, then resolves with the work's result. Wrap result items in `<Stagger i={idx}>` for the staggered fade-in (CSS `.reveal` keyed off `--i`); `ThinkingPill` is the inline button state; `useCountUp` animates headline figures. This is the established pattern — new generative steps should use it rather than a bare `busy` boolean + `Spinner`.
  - **`src/components/CreativePreview.jsx`** renders a realistic, clearly-labeled "illustrative" mockup of a variant per channel (Google RSA search ad, Meta social ad, display banner, email inbox+body, landing hero), keyed off `campaign.channels[0]`. Step 3 shows it behind an Edit/Preview toggle.

## Conventions that matter

- **Steps are self-contained**: a step pulls everything from `useProject()` / `useNav()` and persists via `update()`. Don't thread props between steps. Follow the established pattern in `Step1Campaign.jsx` and `Step3Creative.jsx`.
- **Compliance and fairness are features, not decoration.** Creative must be screenable before testing; custom segments must be fairness-checked. Don't add a code path that tests unscreened creative or lets a protected-class segment through.
- **Styling** is Tailwind utility classes plus a few component classes defined in `src/index.css` (`.card`, `.btn-primary/-accent/-ghost/-subtle/-danger`, `.input`, `.label`, `.chip`, `.reveal`, `.skeleton`). The color scale is custom: `brand` = Capital One navy, `accent` = Capital One red, plus `ink` neutrals (`tailwind.config.js`). Custom keyframes/animations (`fade-up`, `scale-in`, `shimmer`, `blink`, `bar-grow`) back the real-time feel. A `@media print` block drives PDF export — keep `no-print` on chrome you don't want in reports, and note `.reveal` animations are disabled in print.
- **Model + connection** are configurable in Settings (provider, free-text **Model**, **Base URL**, API key, temperature) because provider names/hosts drift. Don't hard-code a model or host in call sites — read them from `settings` (the new `settings.baseURL` flows through `llm.js`).
