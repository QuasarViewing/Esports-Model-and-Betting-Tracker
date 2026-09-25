import { getEloPrediction } from './elo'
import {
  getHeadToHead,
  getMapSideAdvantage,
  getRosterStability,
  getScheduleFatigue,
  getTournamentStageMultiplier,
  getPatchAge,
} from './context'
import {
  classifyDraft,
  getArchetypeMatchup,
  getComboSynergyScore,
  inferPositions,
} from './archetypes'
import type { DraftClassification } from './archetypes'
import { getTeamDraftComfort } from '../model/player-comfort'
import { predictLaneOutcomes } from './lane-prediction'
import type { HeroPosition } from './lane-prediction'
import { logPrediction } from '@/lib/model-db'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PredictionInput {
  teamA: {
    teamId: number
    name: string
    side?: 'radiant' | 'dire'
    players?: { accountId: number; heroId: number; position?: number }[]
  }
  teamB: {
    teamId: number
    name: string
    side?: 'radiant' | 'dire'
    players?: { accountId: number; heroId: number; position?: number }[]
  }
  heroesA?: number[]
  heroesB?: number[]
  stage?: string
  matchTime?: string
  bookmakerOddsA?: number
  bookmakerOddsB?: number
}

export interface PredictionResult {
  teamAProbability: number
  teamBProbability: number

  layers: {
    elo: { teamAProb: number; ratingA: number; ratingB: number }
    h2h: { adjustment: number; matches: number }
    side: { adjustment: number }
    roster: { adjustmentA: number; adjustmentB: number }
    fatigue: { adjustmentA: number; adjustmentB: number }
    draft?: {
      archetypeA: DraftClassification
      archetypeB: DraftClassification
      archetypeMatchup: number
      comfortA: number
      comfortB: number
      comboSynergyA: number
      comboSynergyB: number
      laneAdvantage: number
    }
    patchAge: { confidence: number }
    tournament: { multiplier: number }
  }

  edge?: {
    bookmakerImpliedA: number
    modelProbA: number
    edgePercent: number
    kellyStake: number
    halfKellyStake: number
    recommendation: 'strong_bet' | 'value_bet' | 'lean' | 'pass' | 'avoid'
  }

  confidence: number
  dataQuality: 'high' | 'medium' | 'low'
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Core prediction
// ---------------------------------------------------------------------------

export async function predictMatch(input: PredictionInput): Promise<PredictionResult> {
  const warnings: string[] = []

  // a. Elo base
  const elo = await getEloPrediction(input.teamA.teamId, input.teamB.teamId)
  let prob = elo.teamAProbability

  if (elo.ratingA === 1500) warnings.push('Team A has default Elo rating (no history)')
  if (elo.ratingB === 1500) warnings.push('Team B has default Elo rating (no history)')

  // b. Head-to-head
  const h2h = await getHeadToHead(input.teamA.teamId, input.teamB.teamId)
  if (h2h.total_matches === 0) warnings.push('No head-to-head data found')

  // c. Side advantage (only when sides are known)
  //
  // Partially overlaps Elo: a team's rating is built from matches on both sides,
  // so it already contains a blend of its radiant and dire results. This term
  // adds only the deviation from that blend (radiant_wr - overall_wr), not the
  // raw side win rate, so it is not a straight double-count — but the two are
  // correlated. Kept deliberately; the ablation study decides whether it earns
  // its place on out-of-sample log-loss.
  let sideAdj = 0
  const sideA = input.teamA.side
  const sideB = input.teamB.side ?? (sideA === 'radiant' ? 'dire' : sideA === 'dire' ? 'radiant' : undefined)
  if (sideA && sideB) {
    const [sideAdvA, sideAdvB] = await Promise.all([
      getMapSideAdvantage(input.teamA.teamId, sideA),
      getMapSideAdvantage(input.teamB.teamId, sideB),
    ])
    sideAdj = sideAdvA.side_adjustment - sideAdvB.side_adjustment
  }

  // d. Roster stability
  const [rosterA, rosterB] = await Promise.all([
    getRosterStability(input.teamA.teamId),
    getRosterStability(input.teamB.teamId),
  ])
  if (rosterA.stability_adjustment === -0.05) warnings.push('Team A has a new roster')
  if (rosterB.stability_adjustment === -0.05) warnings.push('Team B has a new roster')

  // e. Fatigue
  const now = input.matchTime ?? new Date().toISOString()
  const [fatigueA, fatigueB] = await Promise.all([
    getScheduleFatigue(input.teamA.teamId, now),
    getScheduleFatigue(input.teamB.teamId, now),
  ])

  // f. Tournament stage
  const tournament = getTournamentStageMultiplier(input.stage ?? 'group_stage')

  // Apply adjustments in log-odds space
  let logOdds = Math.log(prob / (1 - prob))

  logOdds += h2h.h2h_adjustment
  logOdds += sideAdj
  logOdds += rosterA.stability_adjustment - rosterB.stability_adjustment
  logOdds += fatigueA.fatigue_adjustment - fatigueB.fatigue_adjustment
  // The stage is a property of the match, not of either team, so it must not
  // move the head-to-head probability. It feeds confidence instead (below).

  // g. Draft data
  let draftLayer: PredictionResult['layers']['draft'] | undefined

  const heroesA = input.heroesA ?? input.teamA.players?.map(p => p.heroId)
  const heroesB = input.heroesB ?? input.teamB.players?.map(p => p.heroId)

  if (heroesA && heroesB && heroesA.length > 0 && heroesB.length > 0) {
    let posA = input.teamA.players?.map(p => p.position ?? 0).filter(p => p > 0)
    let posB = input.teamB.players?.map(p => p.position ?? 0).filter(p => p > 0)

    if (!posA || posA.length !== heroesA.length) {
      posA = heroesA.length === 5 ? await inferPositions(heroesA) : undefined
    }
    if (!posB || posB.length !== heroesB.length) {
      posB = heroesB.length === 5 ? await inferPositions(heroesB) : undefined
    }

    const [archA, archB] = await Promise.all([
      classifyDraft(heroesA, posA),
      classifyDraft(heroesB, posB),
    ])

    const matchup = getArchetypeMatchup(archA.weights, archB.weights)
    const archetypeAdj = (matchup.teamAWinProb - 0.5) * 0.20

    // Player comfort
    let comfortA = 0
    let comfortB = 0

    if (input.teamA.players && input.teamA.players.length > 0) {
      const comfortResultA = await getTeamDraftComfort(
        input.teamA.players.map(p => ({ accountId: p.accountId, heroId: p.heroId })),
      )
      comfortA = comfortResultA.averageComfort
    }
    if (input.teamB.players && input.teamB.players.length > 0) {
      const comfortResultB = await getTeamDraftComfort(
        input.teamB.players.map(p => ({ accountId: p.accountId, heroId: p.heroId })),
      )
      comfortB = comfortResultB.averageComfort
    }

    const comfortAdj = Math.max(-0.08, Math.min(0.08, (comfortA - comfortB) * 0.5))

    // Combo synergy
    const [comboA, comboB] = await Promise.all([
      getComboSynergyScore(heroesA),
      getComboSynergyScore(heroesB),
    ])
    const comboAdj = Math.max(-0.05, Math.min(0.05, (comboA.combo_score - comboB.combo_score) * 0.1))

    // Lane prediction
    let laneAdj = 0
    if (posA && posB && heroesA.length === 5 && heroesB.length === 5) {
      const radiantHeroes: HeroPosition[] = heroesA.map((h, i) => ({
        heroId: h, position: posA![i],
      }))
      const direHeroes: HeroPosition[] = heroesB.map((h, i) => ({
        heroId: h, position: posB![i],
      }))
      const lanes = await predictLaneOutcomes(radiantHeroes, direHeroes)
      laneAdj = lanes.lane_adjustment
    }

    logOdds += archetypeAdj
    logOdds += comfortAdj
    logOdds += comboAdj
    logOdds += laneAdj

    draftLayer = {
      archetypeA: archA,
      archetypeB: archB,
      archetypeMatchup: matchup.teamAWinProb,
      comfortA,
      comfortB,
      comboSynergyA: comboA.combo_score,
      comboSynergyB: comboB.combo_score,
      laneAdvantage: laneAdj,
    }
  }

  // h. Patch age confidence
  const patchAge = getPatchAge()
  if (patchAge.days_since_patch > 90) {
    warnings.push(`Patch data is ${patchAge.days_since_patch} days old — update CURRENT_PATCH in constants.ts and re-run populate scripts`)
  }

  // i. Clamp final probability
  let finalProb = 1 / (1 + Math.exp(-logOdds))
  finalProb = Math.max(0.05, Math.min(0.95, finalProb))

  // Confidence
  let confidence = patchAge.model_confidence_modifier
  if (elo.ratingA === 1500 || elo.ratingB === 1500) confidence *= 0.7
  if (h2h.total_matches < 3) confidence *= 0.9
  if (!heroesA || !heroesB) confidence *= 0.85
  // Form is a better guide in high-stakes stages than in open qualifiers, where
  // stand-ins and unrated teams are common.
  confidence = Math.min(1, confidence * tournament)

  // Data quality
  let dataQuality: 'high' | 'medium' | 'low' = 'high'
  if (elo.ratingA === 1500 || elo.ratingB === 1500) dataQuality = 'low'
  else if (!heroesA || !heroesB || h2h.total_matches < 3) dataQuality = 'medium'

  // j. Edge vs bookmaker
  let edge: PredictionResult['edge'] | undefined
  if (input.bookmakerOddsA != null && input.bookmakerOddsB != null) {
    const impliedA = 1 / input.bookmakerOddsA
    const kelly = calculateKelly(finalProb, input.bookmakerOddsA)
    const edgePct = (finalProb - impliedA) * 100

    edge = {
      bookmakerImpliedA: round3(impliedA),
      modelProbA: round3(finalProb),
      edgePercent: round2(edgePct),
      kellyStake: round3(kelly.fullKelly),
      halfKellyStake: round3(kelly.halfKelly),
      recommendation: getRecommendation(edgePct, confidence),
    }
  }

  const result: PredictionResult = {
    teamAProbability: round3(finalProb),
    teamBProbability: round3(1 - finalProb),
    layers: {
      elo: { teamAProb: round3(elo.teamAProbability), ratingA: elo.ratingA, ratingB: elo.ratingB },
      h2h: { adjustment: round3(h2h.h2h_adjustment), matches: h2h.total_matches },
      side: { adjustment: round3(sideAdj) },
      roster: { adjustmentA: rosterA.stability_adjustment, adjustmentB: rosterB.stability_adjustment },
      fatigue: { adjustmentA: fatigueA.fatigue_adjustment, adjustmentB: fatigueB.fatigue_adjustment },
      draft: draftLayer,
      patchAge: { confidence: patchAge.model_confidence_modifier },
      tournament: { multiplier: tournament },
    },
    edge,
    confidence: round3(confidence),
    dataQuality,
    warnings,
  }

  // Log prediction to DB
  await logPrediction({
    match_id: null,
    team_a_id: input.teamA.teamId,
    team_a_name: input.teamA.name,
    team_b_id: input.teamB.teamId,
    team_b_name: input.teamB.name,
    model_probability: finalProb,
    bookmaker_odds_a: input.bookmakerOddsA ?? null,
    bookmaker_odds_b: input.bookmakerOddsB ?? null,
    bookmaker_implied_a: edge?.bookmakerImpliedA ?? null,
    edge: edge?.edgePercent ?? null,
    recommended_stake_pct: edge?.halfKellyStake ?? null,
    draft_archetype_a: draftLayer?.archetypeA.primary ?? null,
    draft_archetype_b: draftLayer?.archetypeB.primary ?? null,
    heroes_a: heroesA ?? null,
    heroes_b: heroesB ?? null,
    player_comfort_avg_a: draftLayer?.comfortA ?? null,
    player_comfort_avg_b: draftLayer?.comfortB ?? null,
    actual_winner: null,
    correct: null,
  })

  return result
}

// ---------------------------------------------------------------------------
// Kelly Criterion
// ---------------------------------------------------------------------------

export function calculateKelly(
  modelProb: number,
  bookmakerOdds: number,
): { fullKelly: number; halfKelly: number; quarterKelly: number } {
  if (bookmakerOdds <= 1) return { fullKelly: 0, halfKelly: 0, quarterKelly: 0 }

  const kelly = (modelProb * bookmakerOdds - 1) / (bookmakerOdds - 1)
  if (kelly <= 0) return { fullKelly: 0, halfKelly: 0, quarterKelly: 0 }

  const capped = Math.min(kelly, 0.25)
  return {
    fullKelly: round3(capped),
    halfKelly: round3(capped / 2),
    quarterKelly: round3(capped / 4),
  }
}

// ---------------------------------------------------------------------------
// Recommendation
// ---------------------------------------------------------------------------

export function getRecommendation(
  edge: number,
  confidence: number,
): 'strong_bet' | 'value_bet' | 'lean' | 'pass' | 'avoid' {
  if (edge > 15 && confidence > 0.7) return 'strong_bet'
  if (edge > 8 && confidence > 0.5) return 'value_bet'
  if (edge > 3) return 'lean'
  if (edge >= 0) return 'pass'
  return 'avoid'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
