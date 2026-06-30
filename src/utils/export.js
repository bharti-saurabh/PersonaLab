// Export helpers — CSV / JSON downloads + print-to-PDF, all client-side.

export function downloadFile(filename, content, mime = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function toCSV(rows) {
  if (!rows || !rows.length) return ''
  const keys = Array.from(rows.reduce((set, r) => { Object.keys(r).forEach((k) => set.add(k)); return set }, new Set()))
  const esc = (v) => {
    if (v == null) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n')
}

export function exportCSV(rows, filename) {
  downloadFile(filename.endsWith('.csv') ? filename : `${filename}.csv`, toCSV(rows), 'text/csv')
}

export function exportJSON(obj, filename) {
  downloadFile(filename.endsWith('.json') ? filename : `${filename}.json`, JSON.stringify(obj, null, 2), 'application/json')
}

// Export a survey instrument to a CSV importable into Qualtrics / SurveyMonkey style tools.
export function exportSurveyCSV(instrument, filename = 'survey.csv') {
  const rows = (instrument || []).map((q, i) => ({
    order: i + 1,
    question_id: q.id,
    type: q.type,
    text: q.text,
    options: (q.options || q.scale || []).join(' | '),
    correct_answer: q.correctIndex != null && q.options ? q.options[q.correctIndex] : '',
  }))
  exportCSV(rows, filename)
}

// Trigger the browser print dialog (Save as PDF) on a printable report view.
export function printReport() {
  window.print()
}
