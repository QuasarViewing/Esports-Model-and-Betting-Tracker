import { TI_2026_TEAMS, TEAM_ALIASES } from './constants'

// Chronological pro match stream, deduplicated across both teams' histories and
// with predecessor org IDs folded into their current team. Shared by the ratings
// build and the walk-forward backtest so both see exactly the same matches.

export interface NormalizedMatch {
  match_id: number
  start_time: number
  radiant_id: number
  dire_id: number
  radiant_win: boolean
}

export function resolveTeamId(id: number): number {
  return TEAM_ALIASES[id] ?? id
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchJSON(url: string) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`${res.status} on ${url}`)
  return res.json()
}

export interface FetchOptions {
  cutoff: number
  requestDelayMs?: number
  onProgress?: (done: number, total: number, label: string) => void
  onError?: (label: string, err: unknown) => void
}

export async function fetchMatchHistory(opts: FetchOptions): Promise<NormalizedMatch[]> {
  const { cutoff, requestDelayMs = 1200, onProgress, onError } = opts

  const predecessors: Record<number, number[]> = {}
  for (const [oldId, newId] of Object.entries(TEAM_ALIASES)) {
    if (!predecessors[newId]) predecessors[newId] = []
    predecessors[newId].push(Number(oldId))
  }

  const targets: { fetchId: number; currentId: number; label: string }[] = []
  for (const [name, id] of Object.entries(TI_2026_TEAMS)) {
    targets.push({ fetchId: id, currentId: id, label: name })
    for (const predId of predecessors[id] ?? []) {
      targets.push({ fetchId: predId, currentId: id, label: `${name} (predecessor ${predId})` })
    }
  }

  const matchMap = new Map<number, NormalizedMatch>()

  for (let i = 0; i < targets.length; i++) {
    const { fetchId, currentId, label } = targets[i]
    onProgress?.(i + 1, targets.length, label)

    try {
      const raw: {
        match_id: number
        start_time: number
        radiant: boolean
        radiant_win: boolean
        opposing_team_id: number | null
      }[] = await fetchJSON(`https://api.opendota.com/api/teams/${fetchId}/matches`)

      for (const m of raw) {
        if (!m.opposing_team_id || m.start_time < cutoff) continue
        if (matchMap.has(m.match_id)) continue

        matchMap.set(m.match_id, {
          match_id: m.match_id,
          start_time: m.start_time,
          radiant_id: m.radiant ? currentId : resolveTeamId(m.opposing_team_id),
          dire_id: m.radiant ? resolveTeamId(m.opposing_team_id) : currentId,
          radiant_win: m.radiant_win,
        })
      }
    } catch (err) {
      onError?.(label, err)
    }

    await sleep(requestDelayMs)
  }

  return [...matchMap.values()].sort((a, b) => a.start_time - b.start_time)
}
