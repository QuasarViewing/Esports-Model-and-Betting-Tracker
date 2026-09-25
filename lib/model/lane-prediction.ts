import { getHeroMatchups as getHeroMatchupsDb } from '@/lib/model-db'
import { getHeroMatchups as getHeroMatchupsOD } from '@/lib/opendota'
import type { HeroMatchup } from '@/lib/model-db'
import type { OpenDotaHeroMatchup } from '@/lib/opendota'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HeroPosition {
  heroId: number
  position: number
  accountId?: number
}

export interface LanePrediction {
  safelane_advantage: number
  mid_advantage: number
  offlane_advantage: number
  overall_lane_score: number
  lane_adjustment: number
}

type MatchupCache = Map<number, { db: HeroMatchup[]; od: OpenDotaHeroMatchup[] }>

// ---------------------------------------------------------------------------
// Lane matchup prediction
// ---------------------------------------------------------------------------

export async function predictLaneOutcomes(
  radiantHeroes: HeroPosition[],
  direHeroes: HeroPosition[],
): Promise<LanePrediction> {
  const allHeroIds = new Set([
    ...radiantHeroes.map(h => h.heroId),
    ...direHeroes.map(h => h.heroId),
  ])

  const cache: MatchupCache = new Map()
  await Promise.all([...allHeroIds].map(async (heroId) => {
    const [db, od] = await Promise.all([
      getHeroMatchupsDb(heroId),
      getHeroMatchupsOD(heroId),
    ])
    cache.set(heroId, { db, od })
  }))

  const rByPos = groupByPosition(radiantHeroes)
  const dByPos = groupByPosition(direHeroes)

  const safelane = evaluateLane(
    [...(rByPos[1] ?? []), ...(rByPos[5] ?? [])],
    [...(dByPos[3] ?? []), ...(dByPos[4] ?? [])],
    cache,
  )

  const mid = evaluateLane(rByPos[2] ?? [], dByPos[2] ?? [], cache)

  const offlane = evaluateLane(
    [...(rByPos[3] ?? []), ...(rByPos[4] ?? [])],
    [...(dByPos[1] ?? []), ...(dByPos[5] ?? [])],
    cache,
  )

  const overall_lane_score =
    (safelane * 0.35 + mid * 0.35 + offlane * 0.30)

  const lane_adjustment = Math.max(-0.08, Math.min(0.08, overall_lane_score * 0.08))

  return {
    safelane_advantage: round3(safelane),
    mid_advantage: round3(mid),
    offlane_advantage: round3(offlane),
    overall_lane_score: round3(overall_lane_score),
    lane_adjustment: round3(lane_adjustment),
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function groupByPosition(heroes: HeroPosition[]): Record<number, number[]> {
  const result: Record<number, number[]> = {}
  for (const h of heroes) {
    if (!result[h.position]) result[h.position] = []
    result[h.position].push(h.heroId)
  }
  return result
}

function evaluateLane(
  teamAHeroes: number[],
  teamBHeroes: number[],
  cache: MatchupCache,
): number {
  if (teamAHeroes.length === 0 || teamBHeroes.length === 0) return 0

  let totalAdvantage = 0
  let pairCount = 0

  for (const aHero of teamAHeroes) {
    for (const bHero of teamBHeroes) {
      const wr = getMatchupWinRate(aHero, bHero, cache)
      totalAdvantage += (wr - 0.5) * 2
      pairCount++
    }
  }

  return pairCount > 0 ? Math.max(-1, Math.min(1, totalAdvantage / pairCount)) : 0
}

function getMatchupWinRate(heroA: number, heroB: number, cache: MatchupCache): number {
  const cached = cache.get(heroA)
  if (cached) {
    const dbEntry = cached.db.find(m => m.opponent_hero_id === heroB)
    if (dbEntry && dbEntry.games > 20) return dbEntry.win_rate

    const odEntry = cached.od.find(m => m.hero_id === heroB)
    if (odEntry && odEntry.games_played > 20) {
      return odEntry.wins / odEntry.games_played
    }
  }

  return 0.5
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}
