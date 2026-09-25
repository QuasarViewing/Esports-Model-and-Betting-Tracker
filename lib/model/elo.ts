import {
  DEFAULT_ELO,
  ELO_DIVISOR,
} from './constants'
import { getTeamRating } from '@/lib/model-db'
import { getTeamMatches } from '@/lib/opendota'

// ---------------------------------------------------------------------------
// Pure Elo math
// ---------------------------------------------------------------------------

export function calculateExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / ELO_DIVISOR))
}

// ---------------------------------------------------------------------------
// DB-backed prediction
// ---------------------------------------------------------------------------

export interface EloPrediction {
  teamAProbability: number
  teamBProbability: number
  ratingA: number
  ratingB: number
}

export async function getEloPrediction(
  teamAId: number,
  teamBId: number,
): Promise<EloPrediction> {
  const [ratingA, ratingB] = await Promise.all([
    getTeamRating(teamAId),
    getTeamRating(teamBId),
  ])

  const eloA = ratingA?.elo_rating ?? DEFAULT_ELO
  const eloB = ratingB?.elo_rating ?? DEFAULT_ELO

  const teamAProbability = calculateExpectedScore(eloA, eloB)

  return {
    teamAProbability,
    teamBProbability: 1 - teamAProbability,
    ratingA: eloA,
    ratingB: eloB,
  }
}

// ---------------------------------------------------------------------------
// Rating with context
// ---------------------------------------------------------------------------

export interface TeamRatingContext {
  overall_elo: number
  patch_win_rate: number
  radiant_win_rate: number
  dire_win_rate: number
  recent_form: number
  matches_played: number
  team_name: string
}

export async function getTeamRatingWithContext(
  teamId: number,
): Promise<TeamRatingContext> {
  const [rating, matches] = await Promise.all([
    getTeamRating(teamId),
    getTeamMatches(teamId, 10),
  ])

  const elo = rating?.elo_rating ?? DEFAULT_ELO
  const played = rating?.matches_played ?? 0
  const teamName = rating?.team_name ?? `Team ${teamId}`

  const patchGames = (rating?.patch_wins ?? 0) + (rating?.patch_losses ?? 0)
  const patchWinRate = patchGames > 0 ? (rating?.patch_wins ?? 0) / patchGames : 0

  const radiantGames = (rating?.radiant_wins ?? 0) + (rating?.radiant_losses ?? 0)
  const radiantWinRate = radiantGames > 0 ? (rating?.radiant_wins ?? 0) / radiantGames : 0

  const direGames = (rating?.dire_wins ?? 0) + (rating?.dire_losses ?? 0)
  const direWinRate = direGames > 0 ? (rating?.dire_wins ?? 0) / direGames : 0

  // Recent form from last 10 matches
  let recentWins = 0
  let recentTotal = 0
  for (const m of matches) {
    if (m.opposing_team_id == null) continue
    const won = (m.radiant && m.radiant_win) || (!m.radiant && !m.radiant_win)
    if (won) recentWins++
    recentTotal++
  }
  const recentForm = recentTotal > 0 ? recentWins / recentTotal : 0

  return {
    overall_elo: elo,
    patch_win_rate: patchWinRate,
    radiant_win_rate: radiantWinRate,
    dire_win_rate: direWinRate,
    recent_form: recentForm,
    matches_played: played,
    team_name: teamName,
  }
}
