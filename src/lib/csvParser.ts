/** Robust CSV parser that handles quoted fields */
export function parseCsvRows(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const headers = splitCsvLine(lines[0]).map(h =>
    h.replace(/^"|"$/g, '').trim().toLowerCase()
  )

  return lines.slice(1)
    .filter(l => l.trim())
    .map(line => {
      const cols = splitCsvLine(line)
      return Object.fromEntries(
        headers.map((h, i) => [h, (cols[i] ?? '').replace(/^"|"$/g, '').trim()])
      )
    })
    .filter(r => Object.values(r).some(v => v !== ''))
}

function splitCsvLine(line: string): string[] {
  const cols: string[] = []
  let inQ = false, cur = ''
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue }
    if (ch === ',' && !inQ) { cols.push(cur); cur = ''; continue }
    cur += ch
  }
  cols.push(cur)
  return cols
}

/** Find a column index by any of several possible header names */
export function findCol(headers: string[], ...needles: string[]): string | null {
  for (const needle of needles) {
    const found = headers.find(h => h.includes(needle.toLowerCase()))
    if (found) return found
  }
  return null
}

/** Clean a number string: strip commas, ₹, £, $ */
export function cleanNum(s: string): number {
  return parseFloat(s.replace(/[,₹£$\s]/g, '')) || 0
}
