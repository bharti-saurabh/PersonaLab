import { useProject } from './store.jsx'
import { Megaphone, Users, PenLine, UserCog, MessagesSquare, ClipboardList, Trophy, FlaskConical } from 'lucide-react'

// The 8-step pipeline definition (titles, icons, gating).
export const STEPS = [
  { n: 1, key: 'campaign', title: 'Campaign Setup', short: 'Campaign', icon: Megaphone },
  { n: 2, key: 'segment', title: 'Target Segment', short: 'Segment', icon: Users },
  { n: 3, key: 'creative', title: 'Creative & Compliance', short: 'Creative', icon: PenLine },
  { n: 4, key: 'personas', title: 'Synthetic Personas', short: 'Personas', icon: UserCog },
  { n: 5, key: 'focus', title: 'Focus Group', short: 'Focus Group', icon: MessagesSquare },
  { n: 6, key: 'survey', title: 'Survey & Quant Panel', short: 'Survey', icon: ClipboardList },
  { n: 7, key: 'reco', title: 'Recommendation', short: 'Recommendation', icon: Trophy },
  { n: 8, key: 'abtest', title: 'A/B Test Planner', short: 'A/B Plan', icon: FlaskConical },
]

// Whether a step has the prerequisites met to be entered / completed.
export function stepStatus(project) {
  if (!project) return {}
  const c = project.campaign, t = project.target
  return {
    1: Boolean(c.product && c.objective && c.channels.length),
    2: t.segments.length > 0 || t.custom.length > 0,
    3: project.creative.variants.length >= 2 && project.creative.screenResults.length > 0,
    4: project.panel.personas.length > 0,
    5: Boolean(project.focusGroup),
    6: Boolean(project.survey?.results),
    7: Boolean(project.recommendation),
    8: Boolean(project.abTest),
  }
}

export function useNav() {
  const { project, update } = useProject()
  const step = project?.currentStep || 1
  const goTo = (n) => update({ currentStep: n, maxStepReached: Math.max(project?.maxStepReached || 1, n) })
  const goNext = () => goTo(Math.min(8, step + 1))
  const goBack = () => goTo(Math.max(1, step - 1))
  return { step, goTo, goNext, goBack, project }
}
