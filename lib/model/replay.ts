import {
  DEFAULT_ELO,
  K_FACTOR_NEW,
  K_FACTOR_ESTABLISHED,
  K_FACTOR_THRESHOLD,
  ELO_DIVISOR,
} from './constants'
import {
  computeH2HAdjustment,
  computeSideAdjustment,
  computeFatigueAdjustment,
} from './context'
import type { NormalizedMatch } from './match-history'

// ---------------------------------------------------------------------------
// Walk-forward replay
// ---------------------------------------------------------------------------
//
// Steps through history in time order. For each match the prediction is built
// from state accumulated strictly before that match, then the match is folded
// into state. Nothing a prediction sees can postdate the match it predicts, so
// the replay is leak-free by construction rather than by convention.
//
// Only layers reconstructable from the match stream are replayed: elo, h2h,
// side and fatigue. Roster stability needs per-date roster history and the four
// draft layers need per-match picks, neither of which the team match endpoint
// carries — replaying them from today's values would leak, so they are excluded
// rather than approximated.

export const REPLAYABLE_LAYERS = ['elo', 'h2h', 'side', 'fatigue'] as const
export type ReplayLayer = (typeof REPLAYABLE_LAYERS)[number]

export interface ReplayedMatch {
  match_id: number
  start_time: number
  radiant_id: number
  dire_id: number
  radiantWon: boolean
  eloRadiant: number
  eloDire: number
  priorGamesRadiant: number
  priorGamesDire: number
  // Log-odds contribution of each layer, from the radiant team's perspective.
  contributions: Record<ReplayLayer, number>
}

interface TeamState {
  elo: number
  played: number
  wins: number
  losses: number
  radiantWins: number
  radiantLosses: number
  direWins: number
  direLosses: number
  recentTimes: number[]
}

function newTeam(): TeamState {
  return {
    elo: DEFAULT_ELO,
    played: 0,
    wins: 0,
    losses: 0,
    radiantWins: 0,
    radiantLosses: 0,
    direWins: 0,
    direLosses: 0,
    recentTimes: [],
  }
}

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / ELO_DIVISOR))
}

function gamesWithin(times: number[], now: number, seconds: number): number {
  let n = 0
  for (const t of times) {
    const elapsed = now - t
    if (elapsed >= 0 && elapsed <= seconds) n++
  }
  return n
}

function winRate(wins: number, losses: number): number {
  const total = wins + losses
  return total > 0 ? wins / total : 0.5
}

export function replayMatches(matches: NormalizedMatch[]): ReplayedMatch[] {
  const teams = new Map<number, TeamState>()
  const team = (id: number) => {
    let t = teams.get(id)
    if (!t) { t = newTeam(); teams.set(id, t) }
    return t
  }

  // Prior meetings, keyed by the lower team id first so the pair is order-free.
  const h2h = new Map<string, { lowWins: number; highWins: number }>()
  const pairKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`)

  const out: ReplayedMatch[] = []

  for (const m of matches) {
    const r = team(m.radiant_id)
    const d = team(m.dire_id)

    // --- predict from pre-match state only ---------------------------------
    const eloProb = expectedScore(r.elo, d.elo)

    const key = pairKey(m.radiant_id, m.dire_id)
    const record = h2h.get(key) ?? { lowWins: 0, highWins: 0 }
    const radiantIsLow = m.radiant_id < m.dire_id
    const radiantPriorWins = radiantIsLow ? record.lowWins : record.highWins
    const priorMeetings = record.lowWins + record.highWins

    const sideContribution =
      computeSideAdjustment(r.radiantWins, r.radiantLosses, winRate(r.wins, r.losses)) -
      computeSideAdjustment(d.direWins, d.direLosses, winRate(d.wins, d.losses))

    const fatigueContribution =
      computeFatigueAdjustment(
        gamesWithin(r.recentTimes, m.start_time, 86400),
        gamesWithin(r.recentTimes, m.start_time, 172800),
      ) -
      computeFatigueAdjustment(
        gamesWithin(d.recentTimes, m.start_time, 86400),
        gamesWithin(d.recentTimes, m.start_time, 172800),
      )

    out.push({
      match_id: m.match_id,
      start_time: m.start_time,
      radiant_id: m.radiant_id,
      dire_id: m.dire_id,
      radiantWon: m.radiant_win,
      eloRadiant: r.elo,
      eloDire: d.elo,
      priorGamesRadiant: r.played,
      priorGamesDire: d.played,
      contributions: {
        elo: Math.log(eloProb / (1 - eloProb)),
        h2h: computeH2HAdjustment(radiantPriorWins, priorMeetings),
        side: sideContribution,
        fatigue: fatigueContribution,
      },
    })

    // --- fold the result into state ----------------------------------------
    const expR = eloProb
    const kR = r.played < K_FACTOR_THRESHOLD ? K_FACTOR_NEW : K_FACTOR_ESTABLISHED
    const kD = d.played < K_FACTOR_THRESHOLD ? K_FACTOR_NEW : K_FACTOR_ESTABLISHED
    const scoreR = m.radiant_win ? 1 : 0

    r.elo = Math.round(r.elo + kR * (scoreR - expR))
    d.elo = Math.round(d.elo + kD * ((1 - scoreR) - (1 - expR)))

    if (m.radiant_win) {
      r.wins++; r.radiantWins++
      d.losses++; d.direLosses++
      if (radiantIsLow) record.lowWins++; else record.highWins++
    } else {
      r.losses++; r.radiantLosses++
      d.wins++; d.direWins++
      if (radiantIsLow) record.highWins++; else record.lowWins++
    }
    h2h.set(key, record)

    r.played++; d.played++
    r.recentTimes.push(m.start_time)
    d.recentTimes.push(m.start_time)
  }

  return out
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const PROB_FLOOR = 0.05
const PROB_CEILING = 0.95

export function probabilityFor(replayed: ReplayedMatch, layers: Iterable<ReplayLayer>): number {
  let logOdds = 0
  for (const layer of layers) logOdds += replayed.contributions[layer]
  const p = 1 / (1 + Math.exp(-logOdds))
  return Math.max(PROB_FLOOR, Math.min(PROB_CEILING, p))
}

export interface Metrics {
  matches: number
  logLoss: number
  brier: number
  accuracy: number
}

export function score(replayed: ReplayedMatch[], layers: Iterable<ReplayLayer>): Metrics {
  const active = [...layers]
  let logLoss = 0
  let brier = 0
  let correct = 0

  for (const m of replayed) {
    const p = probabilityFor(m, active)
    const outcome = m.radiantWon ? 1 : 0
    logLoss += -(outcome * Math.log(p) + (1 - outcome) * Math.log(1 - p))
    brier += (p - outcome) ** 2
    if ((p >= 0.5) === m.radiantWon) correct++
  }

  const n = replayed.length
  return {
    matches: n,
    logLoss: n > 0 ? logLoss / n : 0,
    brier: n > 0 ? brier / n : 0,
    accuracy: n > 0 ? correct / n : 0,
  }
}

export function perMatchLogLoss(
  replayed: ReplayedMatch[],
  layers: Iterable<ReplayLayer>,
): number[] {
  const active = [...layers]
  return replayed.map(m => {
    const p = probabilityFor(m, active)
    return m.radiantWon ? -Math.log(p) : -Math.log(1 - p)
  })
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

// Seeded so a run is reproducible — an interval that moves every time you look
// at it is not evidence.
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Interval {
  mean: number
  low: number
  high: number
  samples: number
}

// Percentile bootstrap on the mean. Resamples the per-match differences rather
// than rerunning the model: the two variants are scored on the same matches, so
// the comparison is paired and the pairing must survive resampling.
export function bootstrapMeanCI(
  values: number[],
  { samples = 10000, seed = 20260925, alpha = 0.05 } = {},
): Interval {
  const n = values.length
  if (n === 0) return { mean: 0, low: 0, high: 0, samples: 0 }

  const mean = values.reduce((s, v) => s + v, 0) / n
  const rand = mulberry32(seed)
  const means = new Float64Array(samples)

  for (let b = 0; b < samples; b++) {
    let total = 0
    for (let i = 0; i < n; i++) total += values[(rand() * n) | 0]
    means[b] = total / n
  }

  means.sort()
  const lo = Math.floor((alpha / 2) * samples)
  const hi = Math.min(samples - 1, Math.ceil((1 - alpha / 2) * samples) - 1)

  return { mean, low: means[lo], high: means[hi], samples }
}

// ---------------------------------------------------------------------------
// Evaluation window
// ---------------------------------------------------------------------------

export interface WindowOptions {
  // Fraction of the stream consumed purely to warm Elo up from its 1500 default.
  burnInFraction?: number
  // Both teams must have at least this many prior matches to be scored.
  minPriorGames?: number
}

export function evaluationWindow(
  replayed: ReplayedMatch[],
  opts: WindowOptions = {},
): ReplayedMatch[] {
  const { burnInFraction = 0.3, minPriorGames = 10 } = opts
  const start = Math.floor(replayed.length * burnInFraction)
  return replayed
    .slice(start)
    .filter(m => m.priorGamesRadiant >= minPriorGames && m.priorGamesDire >= minPriorGames)
}

// ---------------------------------------------------------------------------
// Ablation
// ---------------------------------------------------------------------------

export type Verdict = 'keep' | 'drop' | 'inconclusive'

export interface AblationRow {
  layer: ReplayLayer
  logLossWithout: number
  logLossDelta: number
  brierDelta: number
  ci: Interval
  verdict: Verdict
}

export interface AblationReport {
  baseline: Metrics
  eloOnly: Metrics
  rows: AblationRow[]
  keptLayers: ReplayLayer[]
  droppedLayers: ReplayLayer[]
  inconclusiveLayers: ReplayLayer[]
  bootstrapSamples: number
}

// Drops each layer in turn and measures what the full model loses by its
// absence. A positive delta means removing the layer made log-loss worse, so
// the layer was carrying signal.
//
// The point estimate alone is not evidence: on a few thousand matches these
// deltas are small enough to be resampling noise. A layer is only kept when the
// whole 95% interval sits above zero, and only dropped when it sits below —
// otherwise the honest answer is that this sample cannot tell.
export function ablate(
  replayed: ReplayedMatch[],
  { bootstrapSamples = 10000, seed = 20260925 } = {},
): AblationReport {
  const all = [...REPLAYABLE_LAYERS]
  const baseline = score(replayed, all)
  const eloOnly = score(replayed, ['elo'])
  const fullPerMatch = perMatchLogLoss(replayed, all)

  const rows: AblationRow[] = all.map(layer => {
    const without = all.filter(l => l !== layer)
    const m = score(replayed, without)
    const withoutPerMatch = perMatchLogLoss(replayed, without)
    const paired = withoutPerMatch.map((v, i) => v - fullPerMatch[i])
    const ci = bootstrapMeanCI(paired, { samples: bootstrapSamples, seed })

    const verdict: Verdict = ci.low > 0 ? 'keep' : ci.high < 0 ? 'drop' : 'inconclusive'

    return {
      layer,
      logLossWithout: m.logLoss,
      logLossDelta: m.logLoss - baseline.logLoss,
      brierDelta: m.brier - baseline.brier,
      ci,
      verdict,
    }
  })

  const of = (v: Verdict) => rows.filter(r => r.verdict === v).map(r => r.layer)

  return {
    baseline,
    eloOnly,
    rows,
    keptLayers: of('keep'),
    droppedLayers: of('drop'),
    inconclusiveLayers: of('inconclusive'),
    bootstrapSamples,
  }
}
