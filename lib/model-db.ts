'use server'

import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TeamRating {
  id: string
  team_id: number
  team_name: string
  elo_rating: number
  matches_played: number
  wins: number
  losses: number
  last_match_date: string | null
  patch: string | null
  patch_wins: number
  patch_losses: number
  radiant_wins: number
  radiant_losses: number
  dire_wins: number
  dire_losses: number
  updated_at: string
}

export interface PlayerHeroStat {
  id: string
  account_id: number
  player_name: string | null
  hero_id: number
  hero_name: string | null
  games_played: number
  wins: number
  win_rate: number
  avg_kills: number
  avg_deaths: number
  avg_assists: number
  avg_gpm: number
  avg_xpm: number
  avg_hero_damage: number
  avg_tower_damage: number
  comfort_score: number
  last_played: string | null
  updated_at: string
}

export interface HeroMeta {
  id: string
  hero_id: number
  hero_name: string
  patch: string | null
  pro_win_rate: number | null
  pro_pick_rate: number | null
  pro_ban_rate: number | null
  immortal_win_rate: number | null
  immortal_pick_rate: number | null
  avg_duration_win: number | null
  avg_duration_loss: number | null
  timing_profile: string | null
  archetype_weights: Record<string, number> | null
  updated_at: string
}

export interface HeroMatchup {
  id: string
  hero_id: number
  opponent_hero_id: number
  games: number
  wins: number
  win_rate: number
  patch: string | null
  data_source: string | null
  updated_at: string
}

export interface HeroSynergy {
  id: string
  hero_id_1: number
  hero_id_2: number
  games: number
  wins: number
  win_rate: number
  synergy_score: number
  patch: string | null
  updated_at: string
}

export interface ModelPrediction {
  id: string
  match_id: string | null
  team_a_id: number | null
  team_a_name: string | null
  team_b_id: number | null
  team_b_name: string | null
  model_probability: number | null
  bookmaker_odds_a: number | null
  bookmaker_odds_b: number | null
  bookmaker_implied_a: number | null
  edge: number | null
  recommended_stake_pct: number | null
  draft_archetype_a: string | null
  draft_archetype_b: string | null
  heroes_a: number[] | null
  heroes_b: number[] | null
  player_comfort_avg_a: number | null
  player_comfort_avg_b: number | null
  actual_winner: string | null
  correct: boolean | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Team Ratings
// ---------------------------------------------------------------------------

export async function upsertTeamRating(
  teamId: number,
  data: Partial<Omit<TeamRating, 'id' | 'team_id' | 'updated_at'>>,
): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('team_ratings')
    .upsert(
      { team_id: teamId, ...data, updated_at: new Date().toISOString() },
      { onConflict: 'team_id' },
    )
  if (error) console.error('[model-db] upsertTeamRating:', error.message)
  return !error
}

export async function getTeamRating(teamId: number): Promise<TeamRating | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('team_ratings')
    .select('*')
    .eq('team_id', teamId)
    .single()
  if (error) return null
  return data
}

// ---------------------------------------------------------------------------
// Player Hero Stats
// ---------------------------------------------------------------------------

export async function upsertPlayerHeroStat(
  accountId: number,
  heroId: number,
  data: Partial<Omit<PlayerHeroStat, 'id' | 'account_id' | 'hero_id' | 'updated_at'>>,
): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('player_hero_stats')
    .upsert(
      { account_id: accountId, hero_id: heroId, ...data, updated_at: new Date().toISOString() },
      { onConflict: 'account_id,hero_id' },
    )
  if (error) console.error('[model-db] upsertPlayerHeroStat:', error.message)
  return !error
}

export async function getPlayerHeroStats(accountId: number): Promise<PlayerHeroStat[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('player_hero_stats')
    .select('*')
    .eq('account_id', accountId)
    .order('games_played', { ascending: false })
  if (error) {
    console.error('[model-db] getPlayerHeroStats:', error.message)
    return []
  }
  return data ?? []
}

// ---------------------------------------------------------------------------
// Hero Meta
// ---------------------------------------------------------------------------

export async function upsertHeroMeta(
  heroId: number,
  patch: string,
  data: Partial<Omit<HeroMeta, 'id' | 'hero_id' | 'patch' | 'updated_at'>>,
): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('hero_meta')
    .upsert(
      { hero_id: heroId, patch, ...data, updated_at: new Date().toISOString() },
      { onConflict: 'hero_id,patch' },
    )
  if (error) console.error('[model-db] upsertHeroMeta:', error.message)
  return !error
}

export async function getHeroMeta(patch?: string): Promise<HeroMeta[]> {
  const supabase = await createClient()
  let query = supabase.from('hero_meta').select('*')
  if (patch) query = query.eq('patch', patch)
  query = query.order('hero_id', { ascending: true })
  const { data, error } = await query
  if (error) {
    console.error('[model-db] getHeroMeta:', error.message)
    return []
  }
  return data ?? []
}

// ---------------------------------------------------------------------------
// Hero Matchups
// ---------------------------------------------------------------------------

export async function upsertHeroMatchup(
  heroId: number,
  opponentHeroId: number,
  data: Partial<Omit<HeroMatchup, 'id' | 'hero_id' | 'opponent_hero_id' | 'updated_at'>>,
): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('hero_matchups')
    .upsert(
      {
        hero_id: heroId,
        opponent_hero_id: opponentHeroId,
        ...data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'hero_id,opponent_hero_id,patch' },
    )
  if (error) console.error('[model-db] upsertHeroMatchup:', error.message)
  return !error
}

export async function getHeroMatchups(heroId: number): Promise<HeroMatchup[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('hero_matchups')
    .select('*')
    .eq('hero_id', heroId)
    .order('win_rate', { ascending: false })
  if (error) {
    console.error('[model-db] getHeroMatchups:', error.message)
    return []
  }
  return data ?? []
}

// ---------------------------------------------------------------------------
// Hero Synergies
// ---------------------------------------------------------------------------

export async function getHeroSynergyPair(
  heroId1: number,
  heroId2: number,
): Promise<HeroSynergy | null> {
  const supabase = await createClient()
  const lo = Math.min(heroId1, heroId2)
  const hi = Math.max(heroId1, heroId2)
  const { data, error } = await supabase
    .from('hero_synergies')
    .select('*')
    .eq('hero_id_1', lo)
    .eq('hero_id_2', hi)
    .limit(1)
    .maybeSingle()
  if (error) return null
  return data
}

export async function upsertHeroSynergy(
  heroId1: number,
  heroId2: number,
  data: Partial<Omit<HeroSynergy, 'id' | 'hero_id_1' | 'hero_id_2' | 'updated_at'>>,
): Promise<boolean> {
  const supabase = await createClient()
  const lo = Math.min(heroId1, heroId2)
  const hi = Math.max(heroId1, heroId2)
  const { error } = await supabase
    .from('hero_synergies')
    .upsert(
      { hero_id_1: lo, hero_id_2: hi, ...data, updated_at: new Date().toISOString() },
      { onConflict: 'hero_id_1,hero_id_2,patch' },
    )
  if (error) console.error('[model-db] upsertHeroSynergy:', error.message)
  return !error
}

// ---------------------------------------------------------------------------
// Head-to-Head
// ---------------------------------------------------------------------------

export interface TeamH2H {
  id: string
  team_id_1: number
  team_id_2: number
  team1_wins: number
  team2_wins: number
  last_match_date: string | null
  matches: unknown[] | null
  updated_at: string
}

export async function getTeamH2H(
  teamA: number,
  teamB: number,
): Promise<TeamH2H | null> {
  const supabase = await createClient()
  const lo = Math.min(teamA, teamB)
  const hi = Math.max(teamA, teamB)
  const { data, error } = await supabase
    .from('team_head_to_head')
    .select('*')
    .eq('team_id_1', lo)
    .eq('team_id_2', hi)
    .maybeSingle()
  if (error) return null
  return data
}

export async function upsertTeamH2H(
  teamA: number,
  teamB: number,
  data: Partial<Omit<TeamH2H, 'id' | 'team_id_1' | 'team_id_2' | 'updated_at'>>,
): Promise<boolean> {
  const supabase = await createClient()
  const lo = Math.min(teamA, teamB)
  const hi = Math.max(teamA, teamB)
  const { error } = await supabase
    .from('team_head_to_head')
    .upsert(
      { team_id_1: lo, team_id_2: hi, ...data, updated_at: new Date().toISOString() },
      { onConflict: 'team_id_1,team_id_2' },
    )
  if (error) console.error('[model-db] upsertTeamH2H:', error.message)
  return !error
}

// ---------------------------------------------------------------------------
// Predictions
// ---------------------------------------------------------------------------

export async function logPrediction(
  prediction: Omit<ModelPrediction, 'id' | 'created_at'>,
): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase.from('model_predictions').insert(prediction)
  if (error) console.error('[model-db] logPrediction:', error.message)
  return !error
}

export async function getPredictionHistory(limit = 50): Promise<ModelPrediction[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('model_predictions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[model-db] getPredictionHistory:', error.message)
    return []
  }
  return data ?? []
}
