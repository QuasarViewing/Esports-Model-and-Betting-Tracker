import { getHeroWinByDuration, getHeroLaneStats } from '@/lib/stratz'
import type { StratzHeroTimeStat } from '@/lib/stratz'
import { getHeroMeta, upsertHeroMeta, getHeroSynergyPair } from '@/lib/model-db'
import { CURRENT_PATCH } from './constants'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Archetype = 'aggro' | 'midrange' | 'control' | 'combo' | 'split'

export interface ArchetypeWeights {
  [key: string]: number
  aggro: number
  midrange: number
  control: number
  combo: number
  split: number
}

export interface DraftClassification {
  primary: Archetype
  secondary: Archetype | null
  weights: ArchetypeWeights
  confidence: number
  timingPeak: 'early' | 'mid' | 'late'
  heroBreakdown: { heroId: number; weights: ArchetypeWeights }[]
}

export interface MatchupResult {
  teamAWinProb: number
  timingAdvantage: string
}

export interface ComboSynergy {
  combo_score: number
  comeback_factor: number
  key_combos: { heroes: number[]; reason: string }[]
}

export interface ArchetypeMatchupResult {
  teamAArchetype: DraftClassification
  teamBArchetype: DraftClassification
  matchupModifier: number
  favoredSide: 'A' | 'B' | 'even'
  explanation: string
}

// ---------------------------------------------------------------------------
// Combo heroes (big teamfight ultimates)
// ---------------------------------------------------------------------------

const COMBO_HEROES = new Set([
  33,  // Enigma
  41,  // Faceless Void
  97,  // Magnus
  29,  // Tidehunter
  87,  // Disruptor
  55,  // Dark Seer
  83,  // Treant Protector
  110, // Phoenix
  114, // Monkey King
  129, // Mars
  5,   // Crystal Maiden
  30,  // Witch Doctor
  64,  // Jakiro
  104, // Techies
])

const AOE_HEROES = new Set([
  33, 29, 110, 129, 5, 30, 64, 114, 104, // combo heroes that also count as AoE
  74,  // Invoker
  22,  // Zeus
  25,  // Lina
  43,  // Death Prophet
  11,  // Shadow Fiend
  86,  // Rubick
  119, // Dark Willow
])

const MELEE_CARRIES = new Set([
  1,   // Anti-Mage
  8,   // Juggernaut
  19,  // Tiny
  44,  // Phantom Assassin
  70,  // Ursa
  49,  // Dragon Knight
  114, // Monkey King
  106, // Ember Spirit
])

// ---------------------------------------------------------------------------
// Split-push heroes
// ---------------------------------------------------------------------------

const SPLIT_HEROES = new Set([
  1,   // Anti-Mage
  53,  // Nature's Prophet
  34,  // Tinker
  89,  // Naga Siren
  12,  // Phantom Lancer
  113, // Arc Warden
  91,  // Io
  98,  // Timbersaw
  76,  // Outworld Destroyer
  46,  // Templar Assassin
])

// ---------------------------------------------------------------------------
// Known teamfight combo pairs
// ---------------------------------------------------------------------------

const KNOWN_COMBOS: { pair: [number, number]; reason: string }[] = [
  { pair: [41, 74],  reason: 'Chronosphere + Invoker combo' },
  { pair: [41, 77],  reason: 'Chronosphere + Skywrath' },
  { pair: [41, 30],  reason: 'Chronosphere + Death Ward' },
  { pair: [33, 74],  reason: 'Black Hole + Invoker AoE' },
  { pair: [33, 22],  reason: 'Black Hole + Zeus global' },
  { pair: [33, 30],  reason: 'Black Hole + Death Ward' },
  { pair: [33, 43],  reason: 'Black Hole + Exorcism' },
  { pair: [97, 1],   reason: 'Empower + Anti-Mage' },
  { pair: [97, 8],   reason: 'Empower + Juggernaut' },
  { pair: [97, 44],  reason: 'Empower + Phantom Assassin' },
  { pair: [97, 70],  reason: 'Empower + Ursa' },
  { pair: [55, 74],  reason: 'Vacuum + Invoker AoE' },
  { pair: [55, 33],  reason: 'Vacuum + Black Hole' },
  { pair: [55, 29],  reason: 'Vacuum + Ravage' },
  { pair: [29, 11],  reason: 'Ravage + Requiem' },
  { pair: [87, 25],  reason: 'Static Storm + Laguna' },
  { pair: [87, 74],  reason: 'Glimpse + Sunstrike' },
  { pair: [91, 19],  reason: 'Io Relocate + Tiny' },
  { pair: [91, 70],  reason: 'Io Tether + Ursa' },
]

// ---------------------------------------------------------------------------
// Hardcoded fallback weights for common pro heroes
// ---------------------------------------------------------------------------

const FALLBACK_WEIGHTS: Record<number, ArchetypeWeights> = {
  1:   { aggro: 0.05, midrange: 0.15, control: 0.30, combo: 0.00, split: 0.50 },
  2:   { aggro: 0.30, midrange: 0.40, control: 0.10, combo: 0.15, split: 0.05 },
  3:   { aggro: 0.10, midrange: 0.25, control: 0.45, combo: 0.10, split: 0.10 },
  5:   { aggro: 0.10, midrange: 0.30, control: 0.20, combo: 0.35, split: 0.05 },
  6:   { aggro: 0.50, midrange: 0.30, control: 0.05, combo: 0.10, split: 0.05 },
  8:   { aggro: 0.20, midrange: 0.35, control: 0.25, combo: 0.15, split: 0.05 },
  10:  { aggro: 0.05, midrange: 0.15, control: 0.50, combo: 0.10, split: 0.20 },
  11:  { aggro: 0.10, midrange: 0.30, control: 0.25, combo: 0.30, split: 0.05 },
  12:  { aggro: 0.05, midrange: 0.15, control: 0.35, combo: 0.05, split: 0.40 },
  14:  { aggro: 0.45, midrange: 0.35, control: 0.10, combo: 0.05, split: 0.05 },
  15:  { aggro: 0.35, midrange: 0.40, control: 0.10, combo: 0.10, split: 0.05 },
  19:  { aggro: 0.15, midrange: 0.35, control: 0.15, combo: 0.30, split: 0.05 },
  22:  { aggro: 0.10, midrange: 0.35, control: 0.15, combo: 0.30, split: 0.10 },
  25:  { aggro: 0.10, midrange: 0.25, control: 0.35, combo: 0.20, split: 0.10 },
  26:  { aggro: 0.15, midrange: 0.40, control: 0.30, combo: 0.10, split: 0.05 },
  29:  { aggro: 0.15, midrange: 0.30, control: 0.15, combo: 0.35, split: 0.05 },
  30:  { aggro: 0.20, midrange: 0.30, control: 0.10, combo: 0.35, split: 0.05 },
  33:  { aggro: 0.10, midrange: 0.20, control: 0.20, combo: 0.45, split: 0.05 },
  34:  { aggro: 0.15, midrange: 0.25, control: 0.10, combo: 0.10, split: 0.40 },
  36:  { aggro: 0.05, midrange: 0.20, control: 0.50, combo: 0.10, split: 0.15 },
  41:  { aggro: 0.05, midrange: 0.25, control: 0.25, combo: 0.40, split: 0.05 },
  43:  { aggro: 0.55, midrange: 0.25, control: 0.05, combo: 0.10, split: 0.05 },
  44:  { aggro: 0.35, midrange: 0.30, control: 0.15, combo: 0.10, split: 0.10 },
  46:  { aggro: 0.25, midrange: 0.30, control: 0.10, combo: 0.05, split: 0.30 },
  47:  { aggro: 0.40, midrange: 0.35, control: 0.10, combo: 0.10, split: 0.05 },
  49:  { aggro: 0.55, midrange: 0.30, control: 0.05, combo: 0.05, split: 0.05 },
  50:  { aggro: 0.05, midrange: 0.15, control: 0.55, combo: 0.15, split: 0.10 },
  53:  { aggro: 0.20, midrange: 0.20, control: 0.10, combo: 0.05, split: 0.45 },
  55:  { aggro: 0.10, midrange: 0.30, control: 0.15, combo: 0.40, split: 0.05 },
  67:  { aggro: 0.05, midrange: 0.15, control: 0.55, combo: 0.10, split: 0.15 },
  69:  { aggro: 0.10, midrange: 0.30, control: 0.20, combo: 0.15, split: 0.25 },
  70:  { aggro: 0.50, midrange: 0.30, control: 0.05, combo: 0.10, split: 0.05 },
  74:  { aggro: 0.20, midrange: 0.35, control: 0.30, combo: 0.10, split: 0.05 },
  77:  { aggro: 0.25, midrange: 0.35, control: 0.15, combo: 0.20, split: 0.05 },
  86:  { aggro: 0.25, midrange: 0.40, control: 0.20, combo: 0.10, split: 0.05 },
  87:  { aggro: 0.15, midrange: 0.30, control: 0.15, combo: 0.35, split: 0.05 },
  89:  { aggro: 0.05, midrange: 0.15, control: 0.35, combo: 0.05, split: 0.40 },
  91:  { aggro: 0.15, midrange: 0.30, control: 0.15, combo: 0.30, split: 0.10 },
  97:  { aggro: 0.10, midrange: 0.30, control: 0.15, combo: 0.40, split: 0.05 },
  98:  { aggro: 0.20, midrange: 0.35, control: 0.15, combo: 0.05, split: 0.25 },
  106: { aggro: 0.45, midrange: 0.30, control: 0.05, combo: 0.15, split: 0.05 },
  110: { aggro: 0.10, midrange: 0.30, control: 0.20, combo: 0.35, split: 0.05 },
  113: { aggro: 0.05, midrange: 0.15, control: 0.30, combo: 0.05, split: 0.45 },
  114: { aggro: 0.30, midrange: 0.35, control: 0.10, combo: 0.20, split: 0.05 },
  119: { aggro: 0.10, midrange: 0.35, control: 0.35, combo: 0.15, split: 0.05 },
  120: { aggro: 0.15, midrange: 0.40, control: 0.20, combo: 0.15, split: 0.10 },
  126: { aggro: 0.20, midrange: 0.40, control: 0.15, combo: 0.15, split: 0.10 },
  129: { aggro: 0.20, midrange: 0.35, control: 0.10, combo: 0.30, split: 0.05 },
  131: { aggro: 0.05, midrange: 0.20, control: 0.50, combo: 0.10, split: 0.15 },
  135: { aggro: 0.20, midrange: 0.35, control: 0.20, combo: 0.15, split: 0.10 },
  136: { aggro: 0.15, midrange: 0.40, control: 0.25, combo: 0.15, split: 0.05 },
  137: { aggro: 0.10, midrange: 0.35, control: 0.30, combo: 0.15, split: 0.10 },
  138: { aggro: 0.15, midrange: 0.40, control: 0.25, combo: 0.10, split: 0.10 },
}

// ---------------------------------------------------------------------------
// Archetype matchup matrix — win probabilities (row vs column)
// ---------------------------------------------------------------------------

const MATCHUP_MATRIX: Record<Archetype, Record<Archetype, number>> = {
  aggro:    { aggro: 0.50, midrange: 0.45, control: 0.65, combo: 0.55, split: 0.40 },
  midrange: { aggro: 0.55, midrange: 0.50, control: 0.45, combo: 0.50, split: 0.55 },
  control:  { aggro: 0.35, midrange: 0.55, control: 0.50, combo: 0.40, split: 0.50 },
  combo:    { aggro: 0.45, midrange: 0.50, control: 0.60, combo: 0.50, split: 0.45 },
  split:    { aggro: 0.60, midrange: 0.45, control: 0.50, combo: 0.55, split: 0.50 },
}

const POSITION_WEIGHTS = [0, 1.3, 1.2, 1.0, 0.8, 0.7]


// ---------------------------------------------------------------------------
// Core: get archetype weights for a single hero
// ---------------------------------------------------------------------------

export async function getHeroArchetypeWeights(
  heroId: number,
  position?: number,
): Promise<ArchetypeWeights> {
  const metas = await getHeroMeta(CURRENT_PATCH)
  const cached = metas.find(m => m.hero_id === heroId)
  if (cached?.archetype_weights) {
    const w = cached.archetype_weights as ArchetypeWeights
    if (w.aggro != null && w.midrange != null) {
      return applyPositionAdjustment(w, heroId, position)
    }
  }

  const durationData = await getHeroWinByDuration(heroId)
  if (durationData && durationData.length > 0) {
    const weights = computeFromDuration(durationData, heroId)
    const adjusted = applyPositionAdjustment(weights, heroId, position)

    await upsertHeroMeta(heroId, CURRENT_PATCH, {
      hero_name: cached?.hero_name ?? `Hero ${heroId}`,
      archetype_weights: adjusted,
      timing_profile: classifyTiming(durationData),
    })

    return adjusted
  }

  const fallback = FALLBACK_WEIGHTS[heroId] ?? defaultWeights()
  return applyPositionAdjustment(fallback, heroId, position)
}

// ---------------------------------------------------------------------------
// Draft classification with position weighting
// ---------------------------------------------------------------------------

export async function classifyDraft(
  heroIds: number[],
  positions?: number[],
): Promise<DraftClassification> {
  const breakdown: { heroId: number; weights: ArchetypeWeights }[] = []

  for (let i = 0; i < heroIds.length; i++) {
    const pos = positions?.[i]
    const weights = await getHeroArchetypeWeights(heroIds[i], pos)
    breakdown.push({ heroId: heroIds[i], weights })
  }

  const avg: ArchetypeWeights = { aggro: 0, midrange: 0, control: 0, combo: 0, split: 0 }
  let totalWeight = 0

  for (let i = 0; i < breakdown.length; i++) {
    const posWeight = positions?.[i] ? POSITION_WEIGHTS[positions[i]] ?? 1.0 : 1.0
    totalWeight += posWeight
    avg.aggro += breakdown[i].weights.aggro * posWeight
    avg.midrange += breakdown[i].weights.midrange * posWeight
    avg.control += breakdown[i].weights.control * posWeight
    avg.combo += breakdown[i].weights.combo * posWeight
    avg.split += breakdown[i].weights.split * posWeight
  }

  if (totalWeight > 0) {
    avg.aggro /= totalWeight
    avg.midrange /= totalWeight
    avg.control /= totalWeight
    avg.combo /= totalWeight
    avg.split /= totalWeight
  }

  const normalized = normalize(avg)
  const sorted = sortedArchetypes(normalized)
  const primary = sorted[0][0]
  const secondary = sorted[1][1] > 0.2 ? sorted[1][0] : null
  const confidence = sorted[0][1] - sorted[1][1]

  const timingPeak = estimateTimingPeak(primary)

  return { primary, secondary, weights: normalized, confidence, timingPeak, heroBreakdown: breakdown }
}

// ---------------------------------------------------------------------------
// Archetype matchup (pure weights → win probability)
// ---------------------------------------------------------------------------

export function getArchetypeMatchup(
  archetypeA: ArchetypeWeights,
  archetypeB: ArchetypeWeights,
): MatchupResult {
  const archetypes: Archetype[] = ['aggro', 'midrange', 'control', 'combo', 'split']
  let teamAProb = 0

  for (const a of archetypes) {
    for (const b of archetypes) {
      teamAProb += archetypeA[a] * archetypeB[b] * MATCHUP_MATRIX[a][b]
    }
  }

  const primaryA = dominantArchetype(archetypeA)
  const primaryB = dominantArchetype(archetypeB)
  const timingAdvantage = describeTimingAdvantage(primaryA, primaryB)

  return { teamAWinProb: round3(teamAProb), timingAdvantage }
}

// ---------------------------------------------------------------------------
// Archetype matchup analysis (hero IDs → full result)
// ---------------------------------------------------------------------------

export async function analyzeArchetypeMatchup(
  teamAHeroes: number[],
  teamBHeroes: number[],
  teamAPositions?: number[],
  teamBPositions?: number[],
): Promise<ArchetypeMatchupResult> {
  const [archA, archB] = await Promise.all([
    classifyDraft(teamAHeroes, teamAPositions),
    classifyDraft(teamBHeroes, teamBPositions),
  ])

  const { teamAWinProb } = getArchetypeMatchup(archA.weights, archB.weights)
  const modifier = teamAWinProb - 0.5

  const favoredSide: 'A' | 'B' | 'even' =
    modifier > 0.005 ? 'A' : modifier < -0.005 ? 'B' : 'even'

  const explanation = buildExplanation(archA, archB, modifier, favoredSide)

  return {
    teamAArchetype: archA,
    teamBArchetype: archB,
    matchupModifier: modifier,
    favoredSide,
    explanation,
  }
}

// ---------------------------------------------------------------------------
// Combo synergy scoring
// ---------------------------------------------------------------------------

export async function getComboSynergyScore(
  heroIds: number[],
): Promise<ComboSynergy> {
  const key_combos: { heroes: number[]; reason: string }[] = []
  let synergySum = 0
  let synergyCount = 0
  let comboUltCount = 0

  for (let i = 0; i < heroIds.length; i++) {
    for (let j = i + 1; j < heroIds.length; j++) {
      const a = heroIds[i]
      const b = heroIds[j]

      // Check known combo pairs
      const known = KNOWN_COMBOS.find(
        c => (c.pair[0] === a && c.pair[1] === b) ||
             (c.pair[0] === b && c.pair[1] === a),
      )
      if (known) {
        key_combos.push({ heroes: [a, b], reason: known.reason })
        comboUltCount++
      }

      // Check Magnus + any melee carry
      if (!known && ((a === 97 && MELEE_CARRIES.has(b)) || (b === 97 && MELEE_CARRIES.has(a)))) {
        key_combos.push({ heroes: [a, b], reason: 'Empower + melee carry' })
        comboUltCount++
      }

      // Check Enigma/Dark Seer + any AoE
      if (!known) {
        const setup = [33, 55, 29].includes(a) ? a : [33, 55, 29].includes(b) ? b : null
        const other = setup === a ? b : a
        if (setup && AOE_HEROES.has(other) && !key_combos.some(c => c.heroes.includes(a) && c.heroes.includes(b))) {
          key_combos.push({ heroes: [a, b], reason: 'Teamfight setup + AoE follow-up' })
          comboUltCount++
        }
      }

      // Check DB synergy data
      const dbSyn = await getHeroSynergyPair(a, b)
      if (dbSyn && dbSyn.games > 20) {
        synergySum += dbSyn.synergy_score
        synergyCount++
      }
    }
  }

  const dbSynergyAvg = synergyCount > 0 ? synergySum / synergyCount : 0
  const comboBonus = Math.min(comboUltCount * 0.15, 0.6)
  const combo_score = Math.min(1, Math.max(0, comboBonus + dbSynergyAvg * 0.4))

  // Comeback factor: teams with strong teamfight combos can win fights from behind
  const comeback_factor = 1.0 + comboUltCount * 0.15

  return { combo_score, comeback_factor, key_combos }
}

// ---------------------------------------------------------------------------
// Infer positions from hero IDs (best-guess heuristic)
// ---------------------------------------------------------------------------

export async function inferPositions(heroIds: number[]): Promise<number[]> {
  const heroLaneData: { heroId: number; positionScores: Record<number, number> }[] = []

  for (const heroId of heroIds) {
    const laneStats = await getHeroLaneStats(heroId)
    const scores: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }

    if (laneStats) {
      for (const ls of laneStats) {
        const pos = positionFromLane(ls.position)
        if (pos && ls.matchCount > 0) {
          scores[pos] = ls.matchCount
        }
      }
    }

    // If no data, use fallback heuristics from hero roles
    const total = Object.values(scores).reduce((a, b) => a + b, 0)
    if (total === 0) {
      const fb = FALLBACK_WEIGHTS[heroId]
      if (fb) {
        if (fb.split > 0.3 || fb.control > 0.4) scores[1] = 100
        else if (fb.midrange > 0.35) scores[2] = 100
        else if (fb.aggro > 0.3) scores[3] = 100
        else if (fb.combo > 0.3) scores[4] = 100
        else scores[5] = 100
      } else {
        scores[3] = 50
      }
    }

    heroLaneData.push({ heroId, positionScores: scores })
  }

  // Greedy assignment: assign positions based on strongest match count
  const assigned: number[] = new Array(heroIds.length).fill(0)
  const usedPositions = new Set<number>()

  const candidates: { heroIdx: number; pos: number; score: number }[] = []
  for (let i = 0; i < heroLaneData.length; i++) {
    for (let pos = 1; pos <= 5; pos++) {
      candidates.push({ heroIdx: i, pos, score: heroLaneData[i].positionScores[pos] ?? 0 })
    }
  }

  candidates.sort((a, b) => b.score - a.score)

  for (const c of candidates) {
    if (assigned[c.heroIdx] !== 0 || usedPositions.has(c.pos)) continue
    assigned[c.heroIdx] = c.pos
    usedPositions.add(c.pos)
    if (usedPositions.size === Math.min(5, heroIds.length)) break
  }

  // Fill any remaining with unused positions
  const allPos = [1, 2, 3, 4, 5]
  for (let i = 0; i < assigned.length; i++) {
    if (assigned[i] === 0) {
      const available = allPos.find(p => !usedPositions.has(p))
      if (available) {
        assigned[i] = available
        usedPositions.add(available)
      }
    }
  }

  return assigned
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function computeFromDuration(
  stats: StratzHeroTimeStat[],
  heroId: number,
): ArchetypeWeights {
  const sorted = [...stats].sort((a, b) => a.time - b.time)

  function bracketWinRate(minTime: number, maxTime: number): number {
    const lo = sorted.find(s => s.time === minTime)
    const hi = sorted.find(s => s.time === maxTime)
    if (!lo || !hi) return 0.5
    const games = lo.matchCount - hi.matchCount
    const wins = lo.winCount - hi.winCount
    return games > 0 ? wins / games : 0.5
  }

  const wrEarly = bracketWinRate(0, 20)
  const wrMid = bracketWinRate(20, 30)
  const wrLate = bracketWinRate(30, 35)
  const late35 = sorted.find(s => s.time === 35)
  const wrVeryLate = late35 && late35.matchCount > 0
    ? late35.winCount / late35.matchCount
    : 0.5

  const avgWr = sorted[0]?.matchCount > 0
    ? sorted[0].winCount / sorted[0].matchCount
    : 0.5

  const earlyDelta = wrEarly - avgWr
  const midDelta = wrMid - avgWr
  const lateDelta = ((wrLate - avgWr) + (wrVeryLate - avgWr)) / 2

  let aggro = Math.max(0, 0.2 + earlyDelta * 3)
  let midrange = Math.max(0, 0.2 + midDelta * 2)
  let control = Math.max(0, 0.2 + lateDelta * 3)
  let combo = COMBO_HEROES.has(heroId) ? 0.3 : 0.05
  let split = SPLIT_HEROES.has(heroId) ? 0.3 : 0.05

  return normalize({ aggro, midrange, control, combo, split })
}

function classifyTiming(stats: StratzHeroTimeStat[]): string {
  const sorted = [...stats].sort((a, b) => a.time - b.time)
  if (sorted.length === 0) return 'mid'

  const total = sorted[0]
  const avgWr = total.matchCount > 0 ? total.winCount / total.matchCount : 0.5

  const at25 = sorted.find(s => s.time === 25)
  const earlyGames = total.matchCount - (at25?.matchCount ?? 0)
  const earlyWins = total.winCount - (at25?.winCount ?? 0)
  const wrEarly = earlyGames > 0 ? earlyWins / earlyGames : avgWr

  const at35 = sorted.find(s => s.time === 35)
  const wrLate = at35 && at35.matchCount > 0 ? at35.winCount / at35.matchCount : avgWr

  if (wrEarly > avgWr + 0.02 && wrLate < avgWr - 0.01) return 'early'
  if (wrLate > avgWr + 0.02 && wrEarly < avgWr - 0.01) return 'late'
  return 'mid'
}

function applyPositionAdjustment(
  weights: ArchetypeWeights,
  heroId: number,
  position?: number,
): ArchetypeWeights {
  if (position == null) return weights
  const w = { ...weights }

  if (position === 1) {
    w.split += 0.05; w.control += 0.03; w.aggro -= 0.04; w.combo -= 0.04
  }
  if (position === 2) {
    w.midrange += 0.05; w.combo += 0.03; w.split -= 0.04; w.control -= 0.04
  }
  if (position === 3) {
    w.aggro += 0.05; w.combo += 0.03; w.split -= 0.04; w.control -= 0.04
  }
  if (position === 4 || position === 5) {
    w.combo += 0.04; w.midrange += 0.02; w.split -= 0.04; w.aggro -= 0.02
  }

  return normalize(w)
}

function normalize(w: ArchetypeWeights): ArchetypeWeights {
  w.aggro = Math.max(0, w.aggro)
  w.midrange = Math.max(0, w.midrange)
  w.control = Math.max(0, w.control)
  w.combo = Math.max(0, w.combo)
  w.split = Math.max(0, w.split)

  const sum = w.aggro + w.midrange + w.control + w.combo + w.split
  if (sum === 0) return { aggro: 0.2, midrange: 0.2, control: 0.2, combo: 0.2, split: 0.2 }

  return {
    aggro: round3(w.aggro / sum),
    midrange: round3(w.midrange / sum),
    control: round3(w.control / sum),
    combo: round3(w.combo / sum),
    split: round3(w.split / sum),
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function defaultWeights(): ArchetypeWeights {
  return { aggro: 0.2, midrange: 0.3, control: 0.2, combo: 0.15, split: 0.15 }
}

function dominantArchetype(w: ArchetypeWeights): Archetype {
  const entries: [Archetype, number][] = [
    ['aggro', w.aggro], ['midrange', w.midrange], ['control', w.control],
    ['combo', w.combo], ['split', w.split],
  ]
  entries.sort((a, b) => b[1] - a[1])
  return entries[0][0]
}

function sortedArchetypes(w: ArchetypeWeights): [Archetype, number][] {
  const entries: [Archetype, number][] = [
    ['aggro', w.aggro], ['midrange', w.midrange], ['control', w.control],
    ['combo', w.combo], ['split', w.split],
  ]
  return entries.sort((a, b) => b[1] - a[1])
}

function estimateTimingPeak(archetype: Archetype): 'early' | 'mid' | 'late' {
  if (archetype === 'aggro') return 'early'
  if (archetype === 'control' || archetype === 'split') return 'late'
  return 'mid'
}

function describeTimingAdvantage(a: Archetype, b: Archetype): string {
  const timingA = estimateTimingPeak(a)
  const timingB = estimateTimingPeak(b)
  if (timingA === timingB) return 'Even timing'
  if (timingA === 'early' && timingB === 'late') return 'Team A peaks early, Team B scales late'
  if (timingA === 'late' && timingB === 'early') return 'Team A scales late, Team B peaks early'
  return `Team A peaks ${timingA}, Team B peaks ${timingB}`
}

function positionFromLane(laneStr: string): number | null {
  const map: Record<string, number> = {
    POSITION_1: 1, POSITION_2: 2, POSITION_3: 3, POSITION_4: 4, POSITION_5: 5,
    SAFE_LANE: 1, MID_LANE: 2, OFF_LANE: 3, ROAMING: 4, JUNGLE: 4,
  }
  return map[laneStr] ?? null
}

function buildExplanation(
  archA: DraftClassification,
  archB: DraftClassification,
  modifier: number,
  favored: 'A' | 'B' | 'even',
): string {
  const pctStr = `${Math.abs(modifier * 100).toFixed(1)}%`
  const nameA = archA.primary.charAt(0).toUpperCase() + archA.primary.slice(1)
  const nameB = archB.primary.charAt(0).toUpperCase() + archB.primary.slice(1)

  if (favored === 'even') {
    return `${nameA} vs ${nameB} is a neutral matchup (±${pctStr}).`
  }

  const winner = favored === 'A' ? nameA : nameB
  const loser = favored === 'A' ? nameB : nameA
  return `${winner} draft has a ${pctStr} archetype edge over ${loser}.`
}
