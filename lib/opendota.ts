// OpenDota API client — Dota 2 team match history, hero meta, parsed match detail.
// Free tier: 50k requests/month, 60/min. Anonymous calls work at a lower quota.
// Optional OPENDOTA_API_KEY env var unlocks the full quota.

const OPENDOTA_BASE = 'https://api.opendota.com/api'

export interface OpenDotaTeam {
  team_id: number
  rating: number
  wins: number
  losses: number
  last_match_time: number
  name: string
  tag: string
  logo_url: string | null
}

export interface OpenDotaTeamMatch {
  match_id: number
  radiant_win: boolean
  radiant_score: number
  dire_score: number
  radiant: boolean
  duration: number
  start_time: number
  leagueid: number
  league_name: string
  cluster: number
  opposing_team_id: number | null
  opposing_team_name: string | null
  opposing_team_logo: string | null
}

// Skill-bracket pick/win counts come back as keys like `1_pick`, `7_win`, etc.
// They're not typed individually here — access via `stats[`${bracket}_pick`]` and cast if needed.
export interface OpenDotaHeroStats {
  id: number
  name: string
  localized_name: string
  primary_attr: string
  attack_type: string
  roles: string[]
  pro_pick: number
  pro_win: number
  pro_ban: number
  turbo_picks: number
  turbo_wins: number
}

export interface OpenDotaTeamHero {
  hero_id: number
  localized_name: string
  games_played: number
  wins: number
}

export interface OpenDotaPickBan {
  is_pick: boolean
  hero_id: number
  team: number
  order: number
}

export interface OpenDotaMatchPlayer {
  account_id: number | null
  personaname: string | null
  hero_id: number
  kills: number
  deaths: number
  assists: number
  gold_per_min: number
  xp_per_min: number
  last_hits: number
  denies: number
  isRadiant: boolean
}

export interface OpenDotaMatchDetail {
  match_id: number
  radiant_win: boolean
  duration: number
  start_time: number
  league?: { name: string; tier: number }
  picks_bans: OpenDotaPickBan[] | null
  players: OpenDotaMatchPlayer[]
  radiant_team?: { team_id: number; name: string }
  dire_team?: { team_id: number; name: string }
  version: number | null
}

async function opendotaRequest<T>(path: string): Promise<T | null> {
  const url = new URL(`${OPENDOTA_BASE}${path}`)
  const apiKey = process.env.OPENDOTA_API_KEY
  if (apiKey) url.searchParams.set('api_key', apiKey)

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      console.error(`[opendota] ${response.status} on ${path}`)
      return null
    }

    return (await response.json()) as T
  } catch (error) {
    console.error(`[opendota] fetch error on ${path}:`, error)
    return null
  }
}

// Resolve a team name to an OpenDota team_id. Exact match preferred, then tag, then substring.
export async function findTeamId(teamName: string): Promise<number | null> {
  const teams = await opendotaRequest<OpenDotaTeam[]>('/teams')
  if (!teams) return null

  const lower = teamName.toLowerCase().trim()
  const exact = teams.find(t => t.name?.toLowerCase() === lower)
  if (exact) return exact.team_id

  const byTag = teams.find(t => t.tag?.toLowerCase() === lower)
  if (byTag) return byTag.team_id

  const partial = teams.find(t => t.name?.toLowerCase().includes(lower))
  return partial?.team_id ?? null
}

export async function getTeamMatches(teamId: number, limit = 20): Promise<OpenDotaTeamMatch[]> {
  const matches = await opendotaRequest<OpenDotaTeamMatch[]>(`/teams/${teamId}/matches`)
  if (!matches) return []
  return matches.slice(0, limit)
}

// Single call returns every hero with pro + skill-bracket pick/win counts.
export async function getHeroStats(): Promise<OpenDotaHeroStats[]> {
  const stats = await opendotaRequest<OpenDotaHeroStats[]>('/heroStats')
  return stats ?? []
}

// Which heroes this team plays most, with their win rate on each.
export async function getTeamHeroes(teamId: number): Promise<OpenDotaTeamHero[]> {
  const heroes = await opendotaRequest<OpenDotaTeamHero[]>(`/teams/${teamId}/heroes`)
  return heroes ?? []
}

// Full match detail — picks/bans, per-player KDA/GPM/XPM, items.
// `version === null` means the match hasn't been parsed yet (pro matches usually auto-parse).
export async function getMatchDetail(matchId: number): Promise<OpenDotaMatchDetail | null> {
  return opendotaRequest<OpenDotaMatchDetail>(`/matches/${matchId}`)
}

// ---------------------------------------------------------------------------
// Model-facing functions — used by the betting prediction model, not the UI.
// ---------------------------------------------------------------------------

export interface OpenDotaTeamInfo {
  team_id: number
  rating: number
  wins: number
  losses: number
  last_match_time: number
  name: string
  tag: string
  logo_url: string | null
}

export interface OpenDotaTeamPlayer {
  account_id: number
  name: string
  games_played: number
  wins: number
  is_current_team_member: boolean
}

export interface OpenDotaPlayerHero {
  hero_id: number
  last_played: number
  games: number
  win: number
  with_games: number
  with_win: number
  against_games: number
  against_win: number
}

export interface OpenDotaPlayerRecentMatch {
  match_id: number
  hero_id: number
  kills: number
  deaths: number
  assists: number
  gold_per_min: number
  xp_per_min: number
  duration: number
  start_time: number
}

export interface OpenDotaHeroMatchup {
  hero_id: number
  games_played: number
  wins: number
}

export interface OpenDotaHero {
  id: number
  name: string
  localized_name: string
  primary_attr: string
  attack_type: string
  roles: string[]
}

export async function getTeamInfo(teamId: number): Promise<OpenDotaTeamInfo | null> {
  return opendotaRequest<OpenDotaTeamInfo>(`/teams/${teamId}`)
}

export async function getTeamPlayers(teamId: number): Promise<OpenDotaTeamPlayer[]> {
  const players = await opendotaRequest<OpenDotaTeamPlayer[]>(`/teams/${teamId}/players`)
  return players ?? []
}

export async function getPlayerHeroes(accountId: number): Promise<OpenDotaPlayerHero[]> {
  const heroes = await opendotaRequest<OpenDotaPlayerHero[]>(`/players/${accountId}/heroes`)
  return heroes ?? []
}

export async function getPlayerRecentMatches(accountId: number, limit = 20): Promise<OpenDotaPlayerRecentMatch[]> {
  const matches = await opendotaRequest<OpenDotaPlayerRecentMatch[]>(`/players/${accountId}/recentMatches`)
  return (matches ?? []).slice(0, limit)
}

export async function getHeroMatchups(heroId: number): Promise<OpenDotaHeroMatchup[]> {
  const matchups = await opendotaRequest<OpenDotaHeroMatchup[]>(`/heroes/${heroId}/matchups`)
  return matchups ?? []
}

let heroListCache: OpenDotaHero[] | null = null

export async function getHeroes(): Promise<OpenDotaHero[]> {
  if (heroListCache) return heroListCache
  const heroes = await opendotaRequest<OpenDotaHero[]>('/heroes')
  if (heroes && heroes.length > 0) heroListCache = heroes
  return heroes ?? []
}
