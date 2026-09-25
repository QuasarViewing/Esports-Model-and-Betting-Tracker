import { getTeamMatches, getTeamPlayers, getTeamInfo } from '@/lib/opendota'
import { getTeamRating, getTeamH2H, upsertTeamH2H } from '@/lib/model-db'
import { CURRENT_PATCH, PATCH_RELEASE_DATES } from './constants'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface H2HResult {
  teamA_wins: number
  teamB_wins: number
  total_matches: number
  h2h_adjustment: number
}

export interface SideAdvantage {
  radiant_wr: number
  dire_wr: number
  side_adjustment: number
}

export interface RosterStability {
  games_with_current_roster: number
  stability_score: number
  stability_adjustment: number
}

export interface FatigueResult {
  games_last_24h: number
  games_last_48h: number
  fatigue_adjustment: number
}

export interface PatchAgeInfo {
  days_since_patch: number
  meta_stability: 'volatile' | 'settling' | 'stable'
  model_confidence_modifier: number
}

// ---------------------------------------------------------------------------
// Head-to-Head
// ---------------------------------------------------------------------------

export async function getHeadToHead(
  teamAId: number,
  teamBId: number,
): Promise<H2HResult> {
  const cached = await getTeamH2H(teamAId, teamBId)
  const isALower = teamAId < teamBId

  if (cached) {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const cacheTime = new Date(cached.updated_at).getTime()
    if (cacheTime > oneWeekAgo) {
      const teamA_wins = isALower ? cached.team1_wins : cached.team2_wins
      const teamB_wins = isALower ? cached.team2_wins : cached.team1_wins
      const total = teamA_wins + teamB_wins
      return {
        teamA_wins,
        teamB_wins,
        total_matches: total,
        h2h_adjustment: computeH2HAdjustment(teamA_wins, total),
      }
    }
  }

  // Fetch from OpenDota — find matches where they played each other
  const matchesA = await getTeamMatches(teamAId, 100)
  const h2hMatches = matchesA.filter(m => m.opposing_team_id === teamBId)

  let aWins = 0
  let bWins = 0
  for (const m of h2hMatches) {
    const teamAWon = (m.radiant && m.radiant_win) || (!m.radiant && !m.radiant_win)
    if (teamAWon) aWins++
    else bWins++
  }

  const total = aWins + bWins

  // Cache to DB
  await upsertTeamH2H(teamAId, teamBId, {
    team1_wins: isALower ? aWins : bWins,
    team2_wins: isALower ? bWins : aWins,
    last_match_date: h2hMatches.length > 0
      ? new Date(Math.max(...h2hMatches.map(m => m.start_time)) * 1000).toISOString()
      : null,
  })

  return {
    teamA_wins: aWins,
    teamB_wins: bWins,
    total_matches: total,
    h2h_adjustment: computeH2HAdjustment(aWins, total),
  }
}

// The pure layer formulas live here and are exported so the walk-forward
// backtest scores the same arithmetic production uses, rather than a copy of it.

export function computeH2HAdjustment(teamAWins: number, total: number): number {
  if (total < 3) return 0
  const raw = ((teamAWins / total) - 0.5) * 0.15
  return Math.max(-0.10, Math.min(0.10, raw))
}

export function computeSideAdjustment(
  sideWins: number,
  sideLosses: number,
  overallWinRate: number,
): number {
  const sideGames = sideWins + sideLosses
  if (sideGames < 20) return 0
  const raw = (sideWins / sideGames - overallWinRate) * 0.5
  return Math.max(-0.05, Math.min(0.05, raw))
}

export function computeFatigueAdjustment(gamesLast24h: number, gamesLast48h: number): number {
  let adjustment = 0
  if (gamesLast24h >= 5) adjustment = -0.05
  else if (gamesLast24h >= 3) adjustment = -0.03
  else if (gamesLast24h >= 1) adjustment = -0.01

  if (gamesLast48h >= 8) adjustment -= 0.03

  return Math.max(-0.08, adjustment)
}

// ---------------------------------------------------------------------------
// Map Side Advantage
// ---------------------------------------------------------------------------

export async function getMapSideAdvantage(
  teamId: number,
  side: 'radiant' | 'dire',
): Promise<SideAdvantage> {
  const rating = await getTeamRating(teamId)
  if (!rating) return { radiant_wr: 0.5, dire_wr: 0.5, side_adjustment: 0 }

  const radiantGames = (rating.radiant_wins ?? 0) + (rating.radiant_losses ?? 0)
  const direGames = (rating.dire_wins ?? 0) + (rating.dire_losses ?? 0)

  const radiant_wr = radiantGames > 0 ? (rating.radiant_wins ?? 0) / radiantGames : 0.5
  const dire_wr = direGames > 0 ? (rating.dire_wins ?? 0) / direGames : 0.5

  const totalGames = (rating.wins ?? 0) + (rating.losses ?? 0)
  const overall_wr = totalGames > 0 ? (rating.wins ?? 0) / totalGames : 0.5

  const side_adjustment = side === 'radiant'
    ? computeSideAdjustment(rating.radiant_wins ?? 0, rating.radiant_losses ?? 0, overall_wr)
    : computeSideAdjustment(rating.dire_wins ?? 0, rating.dire_losses ?? 0, overall_wr)

  return { radiant_wr, dire_wr, side_adjustment }
}

// ---------------------------------------------------------------------------
// Roster Stability
// ---------------------------------------------------------------------------

export async function getRosterStability(teamId: number): Promise<RosterStability> {
  const players = await getTeamPlayers(teamId)
  if (!players || players.length === 0) {
    return { games_with_current_roster: 0, stability_score: 0.5, stability_adjustment: 0 }
  }

  const currentMembers = players.filter(p => p.is_current_team_member)
  const gamesWithCurrent = currentMembers.length > 0
    ? Math.min(...currentMembers.map(p => p.games_played))
    : 0

  let stability_score: number
  let stability_adjustment: number

  if (gamesWithCurrent < 15) {
    stability_score = gamesWithCurrent / 15 * 0.3
    stability_adjustment = -0.05
  } else if (gamesWithCurrent < 50) {
    stability_score = 0.3 + ((gamesWithCurrent - 15) / 35) * 0.4
    stability_adjustment = 0
  } else {
    stability_score = 0.7 + Math.min((gamesWithCurrent - 50) / 100, 0.3)
    stability_adjustment = 0.02
  }

  return {
    games_with_current_roster: gamesWithCurrent,
    stability_score: Math.min(1, stability_score),
    stability_adjustment,
  }
}

// ---------------------------------------------------------------------------
// Tournament Stage
// ---------------------------------------------------------------------------

const STAGE_MULTIPLIERS: Record<string, number> = {
  open_qualifier: 0.97,
  qualifier: 0.98,
  group_stage: 1.0,
  elimination: 1.02,
  grand_final: 1.03,
}

export function getTournamentStageMultiplier(stage: string): number {
  return STAGE_MULTIPLIERS[stage] ?? 1.0
}

// ---------------------------------------------------------------------------
// Schedule Fatigue
// ---------------------------------------------------------------------------

export async function getScheduleFatigue(
  teamId: number,
  currentMatchTime: string,
): Promise<FatigueResult> {
  const matches = await getTeamMatches(teamId, 50)
  const now = new Date(currentMatchTime).getTime() / 1000

  let games_last_24h = 0
  let games_last_48h = 0

  for (const m of matches) {
    const elapsed = now - m.start_time
    if (elapsed < 0) continue
    if (elapsed <= 86400) { games_last_24h++; games_last_48h++ }
    else if (elapsed <= 172800) { games_last_48h++ }
  }

  return {
    games_last_24h,
    games_last_48h,
    fatigue_adjustment: computeFatigueAdjustment(games_last_24h, games_last_48h),
  }
}

// ---------------------------------------------------------------------------
// Patch Age
// ---------------------------------------------------------------------------

export function getPatchAge(): PatchAgeInfo {
  const releaseStr = PATCH_RELEASE_DATES[CURRENT_PATCH]
  const releaseDate = releaseStr ? new Date(releaseStr) : new Date()
  const days_since_patch = Math.floor((Date.now() - releaseDate.getTime()) / (86400 * 1000))

  let meta_stability: 'volatile' | 'settling' | 'stable'
  let model_confidence_modifier: number

  if (days_since_patch <= 7) {
    meta_stability = 'volatile'
    model_confidence_modifier = 0.8
  } else if (days_since_patch <= 21) {
    meta_stability = 'settling'
    model_confidence_modifier = 0.9
  } else {
    meta_stability = 'stable'
    model_confidence_modifier = 1.0
  }

  return { days_since_patch, meta_stability, model_confidence_modifier }
}
