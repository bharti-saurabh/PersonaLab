import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { DEFAULT_RULEPACK } from '../data/complianceRules.js'
import { buildSeedState } from '../data/seed.js'

const STORAGE_KEY = 'persona-lab-state-v1'

// ---- project factory ----
export function newProject(name = 'Untitled Campaign') {
  return {
    id: `proj-${Math.random().toString(36).slice(2, 9)}`,
    name,
    createdAt: new Date().toISOString(),
    currentStep: 1,
    maxStepReached: 1,
    campaign: { product: '', objective: '', channels: [] },
    target: { segments: [], custom: [] },
    creative: { variants: [], screenResults: [] },
    panel: { personas: [], distribution: { core: 0.6, adjacent: 0.25, skeptical: 0.15 }, size: 12, surveySize: 250 },
    focusGroup: null, // { transcript, perVariant, groupDynamics, redTeam }
    survey: { instrument: [], results: null },
    recommendation: null,
    abTest: null,
    calibration: '',
  }
}

function defaultState() {
  return {
    version: 1,
    settings: { provider: 'anthropic', apiKey: '', model: 'claude-sonnet-4-6', baseURL: '', temperature: 0.8 },
    activeProjectId: null,
    projects: [],
    rulepack: DEFAULT_RULEPACK,
    auditLog: [],
    libraries: { targetingProfiles: {}, panels: {} },
  }
}

function init() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && parsed.projects) return parsed
    }
  } catch { /* ignore */ }
  // First run — seed two complete example projects.
  const seeded = buildSeedState(defaultState())
  return seeded
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } }
    case 'SELECT_PROJECT':
      return { ...state, activeProjectId: action.id }
    case 'CREATE_PROJECT': {
      const p = action.project
      return { ...state, projects: [...state.projects, p], activeProjectId: p.id }
    }
    case 'DELETE_PROJECT': {
      const projects = state.projects.filter((p) => p.id !== action.id)
      const activeProjectId = state.activeProjectId === action.id ? (projects[0]?.id || null) : state.activeProjectId
      return { ...state, projects, activeProjectId }
    }
    case 'DUPLICATE_PROJECT': {
      const src = state.projects.find((p) => p.id === action.id)
      if (!src) return state
      const copy = { ...structuredCloneSafe(src), id: `proj-${Math.random().toString(36).slice(2, 9)}`, name: `${src.name} (copy)`, createdAt: new Date().toISOString() }
      return { ...state, projects: [...state.projects, copy], activeProjectId: copy.id }
    }
    case 'UPDATE_PROJECT': {
      const projects = state.projects.map((p) => (p.id === action.id ? deepMerge(p, action.patch) : p))
      return { ...state, projects }
    }
    case 'REPLACE_PROJECT': {
      const projects = state.projects.map((p) => (p.id === action.id ? action.project : p))
      return { ...state, projects }
    }
    case 'SET_RULEPACK':
      return { ...state, rulepack: action.rulepack }
    case 'ADD_AUDIT':
      return { ...state, auditLog: [...state.auditLog, ...(Array.isArray(action.entries) ? action.entries : [action.entries])] }
    case 'CLEAR_AUDIT':
      return { ...state, auditLog: [] }
    case 'SAVE_TARGETING_PROFILE': {
      const { productId, profile } = action
      const list = state.libraries.targetingProfiles[productId] || []
      return { ...state, libraries: { ...state.libraries, targetingProfiles: { ...state.libraries.targetingProfiles, [productId]: [...list.filter((x) => x.id !== profile.id), profile] } } }
    }
    case 'SAVE_PANEL': {
      const { productId, panel } = action
      const list = state.libraries.panels[productId] || []
      return { ...state, libraries: { ...state.libraries, panels: { ...state.libraries.panels, [productId]: [...list.filter((x) => x.id !== panel.id), panel] } } }
    }
    case 'RESET_ALL':
      return buildSeedState(defaultState())
    default:
      return state
  }
}

const StoreCtx = createContext(null)

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, init)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* quota */ }
  }, [state])

  const actions = useMemo(() => ({
    setSettings: (patch) => dispatch({ type: 'SET_SETTINGS', patch }),
    selectProject: (id) => dispatch({ type: 'SELECT_PROJECT', id }),
    createProject: (name) => { const project = newProject(name); dispatch({ type: 'CREATE_PROJECT', project }); return project },
    deleteProject: (id) => dispatch({ type: 'DELETE_PROJECT', id }),
    duplicateProject: (id) => dispatch({ type: 'DUPLICATE_PROJECT', id }),
    updateProject: (id, patch) => dispatch({ type: 'UPDATE_PROJECT', id, patch }),
    replaceProject: (id, project) => dispatch({ type: 'REPLACE_PROJECT', id, project }),
    setRulepack: (rulepack) => dispatch({ type: 'SET_RULEPACK', rulepack }),
    addAudit: (entries) => dispatch({ type: 'ADD_AUDIT', entries }),
    clearAudit: () => dispatch({ type: 'CLEAR_AUDIT' }),
    saveTargetingProfile: (productId, profile) => dispatch({ type: 'SAVE_TARGETING_PROFILE', productId, profile }),
    savePanel: (productId, panel) => dispatch({ type: 'SAVE_PANEL', productId, panel }),
    resetAll: () => dispatch({ type: 'RESET_ALL' }),
  }), [])

  const value = useMemo(() => ({ state, actions }), [state])
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

// Convenience: the active project + a bound updater.
export function useProject() {
  const { state, actions } = useStore()
  const project = state.projects.find((p) => p.id === state.activeProjectId) || null
  const update = (patch) => { if (project) actions.updateProject(project.id, patch) }
  return { project, update, settings: state.settings, store: state, actions }
}

// ---- helpers ----
function deepMerge(target, patch) {
  if (Array.isArray(patch) || patch === null || typeof patch !== 'object') return patch
  const out = { ...target }
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target && typeof target[k] === 'object' && !Array.isArray(target[k]) && target[k] !== null) {
      out[k] = deepMerge(target[k], v)
    } else {
      out[k] = v
    }
  }
  return out
}

function structuredCloneSafe(obj) {
  try { return structuredClone(obj) } catch { return JSON.parse(JSON.stringify(obj)) }
}
