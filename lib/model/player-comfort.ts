import { getPlayerHeroes, getHeroes, getHeroStats } from '@/lib/opendota'
import type { OpenDotaPlayerHero } from '@/lib/opendota'
import { getHeroMetaStats } from '@/lib/stratz'
import {
  upsertPlayerHeroStat,
  getPlayerHeroStats,
  upsertHeroMeta,
  getHeroMeta,
} from '@/lib/model-db'
import type { PlayerHeroStat } from '@/lib/model-db'
import { CURRENT_PATCH } from './constants'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComfortResult {
  accountId: number
  heroId: number
  playerWinRate: number
  heroBaseline: number
  comfortScore: number
  gamesPlayed: number
  confidence: number
}

export interface PlayerComfortEntry {
  accountId: number
  heroId: number
  heroName: string | null
  comfortScore: number
  gamesPlayed: number
  playerWinRate: number
  heroBaseline: number
  confidence: number
}

export interface TeamComfortResult {
  averageComfort: number
  players: PlayerComfortEntry[]
  weakestLink: PlayerComfortEntry | null
  strongestPick: PlayerComfortEntry | null
}

// ---------------------------------------------------------------------------
// Core calculation
// ---------------------------------------------------------------------------

function confidenceMultiplier(gamesPlayed: number): number {
  if (gamesPlayed < 5) return 0.3
  if (gamesPlayed < 10) return 0.5
  if (gamesPlayed < 20) return 0.7
  if (gamesPlayed < 50) return 0.9
  return 1.0
}

export function calculateComfortScore(
  playerWinRate: number,
  heroBaselineWinRate: number,
  gamesPlayed: number,
): number {
  const raw = playerWinRate - heroBaselineWinRate
  return raw * confidenceMultiplier(gamesPlayed)
}

// ---------------------------------------------------------------------------
// Single player+hero comfort lookup
// ---------------------------------------------------------------------------

export async function getPlayerComfortOnHero(
  accountId: number,
  heroId: number,
): Promise<ComfortResult> {
  // Try cached stats from Supabase first
  const cached = await getPlayerHeroStats(accountId)
  const cachedHero = cached.find(h => h.hero_id === heroId)

  let playerWinRate: number
  let gamesPlayed: number

  if (cachedHero && cachedHero.games_played > 0) {
    playerWinRate = cachedHero.win_rate
    gamesPlayed = cachedHero.games_played
  } else {
    // Fall back to OpenDota live data
    const heroes = await getPlayerHeroes(accountId)
    const heroData = heroes.find(h => h.hero_id === heroId)
    gamesPlayed = heroData?.games ?? 0
    playerWinRate = gamesPlayed > 0 ? (heroData?.win ?? 0) / gamesPlayed : 0
  }

  const heroBaseline = await getHeroBaseline(heroId)
  const conf = confidenceMultiplier(gamesPlayed)
  const comfortScore = calculateComfortScore(playerWinRate, heroBaseline, gamesPlayed)

  return {
    accountId,
    heroId,
    playerWinRate,
    heroBaseline,
    comfortScore,
    gamesPlayed,
    confidence: conf,
  }
}

// ---------------------------------------------------------------------------
// All hero comfort scores for a player
// ---------------------------------------------------------------------------

export async function getAllPlayerComfort(
  accountId: number,
): Promise<PlayerComfortEntry[]> {
  // Try Supabase cache
  const cached = await getPlayerHeroStats(accountId)
  if (cached.length > 0) {
    return cached
      .filter(h => h.games_played > 0)
      .map(h => ({
        accountId,
        heroId: h.hero_id,
        heroName: h.hero_name,
        comfortScore: h.comfort_score,
        gamesPlayed: h.games_played,
        playerWinRate: h.win_rate,
        heroBaseline: h.win_rate - (h.comfort_score / confidenceMultiplier(h.games_played) || 0),
        confidence: confidenceMultiplier(h.games_played),
      }))
  }

  // Fall back to live OpenDota data
  const [playerHeroes, heroList] = await Promise.all([
    getPlayerHeroes(accountId),
    getHeroes(),
  ])

  const heroNameMap = new Map(heroList.map(h => [h.id, h.localized_name]))
  const baselines = await loadBaselineMap()

  return playerHeroes
    .filter(h => h.games > 0)
    .map(h => {
      const wr = h.win / h.games
      const baseline = baselines.get(h.hero_id) ?? 0.5
      const conf = confidenceMultiplier(h.games)
      return {
        accountId,
        heroId: h.hero_id,
        heroName: heroNameMap.get(h.hero_id) ?? null,
        comfortScore: calculateComfortScore(wr, baseline, h.games),
        gamesPlayed: h.games,
        playerWinRate: wr,
        heroBaseline: baseline,
        confidence: conf,
      }
    })
    .sort((a, b) => b.comfortScore - a.comfortScore)
}

// ---------------------------------------------------------------------------
// Team draft comfort
// ---------------------------------------------------------------------------

export async function getTeamDraftComfort(
  players: { accountId: number; heroId: number }[],
): Promise<TeamComfortResult> {
  const heroList = await getHeroes()
  const results = await Promise.all(
    players.map(async p => {
      const comfort = await getPlayerComfortOnHero(p.accountId, p.heroId)
      const heroName = heroList.find(h => h.id === p.heroId)?.localized_name ?? null
      return {
        accountId: p.accountId,
        heroId: p.heroId,
        heroName,
        comfortScore: comfort.comfortScore,
        gamesPlayed: comfort.gamesPlayed,
        playerWinRate: comfort.playerWinRate,
        heroBaseline: comfort.heroBaseline,
        confidence: comfort.confidence,
      } satisfies PlayerComfortEntry
    }),
  )

  const avg =
    results.length > 0
      ? results.reduce((s, r) => s + r.comfortScore, 0) / results.length
      : 0

  const sorted = [...results].sort((a, b) => a.comfortScore - b.comfortScore)

  return {
    averageComfort: avg,
    players: results,
    weakestLink: sorted[0] ?? null,
    strongestPick: sorted[sorted.length - 1] ?? null,
  }
}

// ---------------------------------------------------------------------------
// Batch: build player hero database
// ---------------------------------------------------------------------------

export async function buildPlayerHeroDatabase(
  accountIds: number[],
): Promise<{ processed: number; errors: number }> {
  const baselines = await loadBaselineMap()
  const heroList = await getHeroes()
  const heroNameMap = new Map(heroList.map(h => [h.id, h.localized_name]))

  let processed = 0
  let errors = 0

  for (const accountId of accountIds) {
    try {
      const heroes = await getPlayerHeroes(accountId)

      for (const h of heroes) {
        if (h.games === 0) continue
        const wr = h.win / h.games
        const baseline = baselines.get(h.hero_id) ?? 0.5
        const comfort = calculateComfortScore(wr, baseline, h.games)

        await upsertPlayerHeroStat(accountId, h.hero_id, {
          hero_name: heroNameMap.get(h.hero_id) ?? null,
          games_played: h.games,
          wins: h.win,
          win_rate: wr,
          comfort_score: comfort,
          last_played: h.last_played > 0
            ? new Date(h.last_played * 1000).toISOString()
            : null,
        })
      }

      processed++
    } catch {
      errors++
    }

    // Rate limit: 1 request per second for OpenDota
    await new Promise(r => setTimeout(r, 1000))
  }

  return { processed, errors }
}

// ---------------------------------------------------------------------------
// Refresh hero baselines from Stratz / OpenDota
// ---------------------------------------------------------------------------

export async function refreshHeroBaselines(): Promise<{ updated: number }> {
  const heroList = await getHeroes()
  const heroNameMap = new Map(heroList.map(h => [h.id, h.localized_name]))

  // Try Stratz first (Immortal+ bracket)
  const stratzStats = await getHeroMetaStats()

  if (stratzStats && stratzStats.length > 0) {
    let updated = 0
    // Compute total matches for pick rate calculation
    const totalMatches = stratzStats.reduce((s, h) => s + h.matchCount, 0) / 10

    for (const h of stratzStats) {
      const wr = h.matchCount > 0 ? h.winCount / h.matchCount : 0
      const pickRate = totalMatches > 0 ? h.matchCount / totalMatches : 0

      await upsertHeroMeta(h.heroId, CURRENT_PATCH, {
        hero_name: heroNameMap.get(h.heroId) ?? `Hero ${h.heroId}`,
        immortal_win_rate: wr,
        immortal_pick_rate: pickRate,
      })
      updated++
    }
    return { updated }
  }

  // Fall back to OpenDota heroStats
  const odStats = await getHeroStats()
  let updated = 0
  const totalProPicks = odStats.reduce((s, h) => s + h.pro_pick, 0) || 1
  const totalProBans = odStats.reduce((s, h) => s + h.pro_ban, 0) || 1

  for (const h of odStats) {
    const proWr = h.pro_pick > 0 ? h.pro_win / h.pro_pick : 0
    const proPickRate = h.pro_pick / totalProPicks
    const proBanRate = h.pro_ban / totalProBans

    await upsertHeroMeta(h.id, CURRENT_PATCH, {
      hero_name: h.localized_name,
      pro_win_rate: proWr,
      pro_pick_rate: proPickRate,
      pro_ban_rate: proBanRate,
    })
    updated++
  }

  return { updated }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

let baselineMapCache: { map: Map<number, number>; ts: number } | null = null
const BASELINE_CACHE_TTL = 5 * 60 * 1000

async function getHeroBaseline(heroId: number): Promise<number> {
  const map = await loadBaselineMap()
  return map.get(heroId) ?? 0.5
}

async function loadBaselineMap(): Promise<Map<number, number>> {
  if (baselineMapCache && Date.now() - baselineMapCache.ts < BASELINE_CACHE_TTL) {
    return baselineMapCache.map
  }

  const metas = await getHeroMeta(CURRENT_PATCH)
  const map = new Map<number, number>()

  if (metas.length > 0) {
    for (const m of metas) {
      map.set(m.hero_id, m.immortal_win_rate ?? m.pro_win_rate ?? 0.5)
    }
    baselineMapCache = { map, ts: Date.now() }
    return map
  }

  const odStats = await getHeroStats()
  for (const h of odStats) {
    if (h.pro_pick > 0) map.set(h.id, h.pro_win / h.pro_pick)
    else map.set(h.id, 0.5)
  }
  baselineMapCache = { map, ts: Date.now() }
  return map
}
