// STRATZ GraphQL client — Dota 2 matchup research, draft tendencies, hero meta.
// Free with STRATZ_API_KEY env var (register at stratz.com/api).
// STRATZ requires a User-Agent header on all requests.

const STRATZ_ENDPOINT = 'https://api.stratz.com/graphql'

export interface StratzPickBan {
  isPick: boolean
  heroId: number
  bannedHeroId: number | null
  order: number
  isRadiant: boolean
}

export interface StratzTeamMatch {
  id: number
  didRadiantWin: boolean
  isRadiant: boolean
  durationSeconds: number
  startDateTime: number
  leagueName: string | null
  opposingTeamId: number | null
  opposingTeamName: string | null
  pickBans: StratzPickBan[]
}

export interface StratzMatchupTeam {
  id: number
  name: string
  tag: string
  winCount: number
  lossCount: number
  lastMatchDateTime: number | null
  matches: StratzTeamMatch[]
}

export interface StratzMatchup {
  teamA: StratzMatchupTeam | null
  teamB: StratzMatchupTeam | null
}

async function stratzQuery<T>(query: string, variables: Record<string, unknown> = {}): Promise<T | null> {
  const apiKey = process.env.STRATZ_API_KEY
  if (!apiKey) {
    console.error('[stratz] STRATZ_API_KEY not set')
    return null
  }

  try {
    const response = await fetch(STRATZ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'STRATZ_API',
      },
      body: JSON.stringify({ query, variables }),
    })

    if (!response.ok) {
      console.error(`[stratz] ${response.status}`)
      return null
    }

    const json = await response.json()
    if (json.errors) {
      console.error('[stratz] graphql errors:', json.errors)
      return null
    }
    return json.data as T
  } catch (error) {
    console.error('[stratz] fetch error:', error)
    return null
  }
}

// STRATZ requires explicit pagination on team.matches — skip/take are non-nullable in TeamMatchesRequestType.
const TEAM_FRAGMENT = `
  id
  name
  tag
  winCount
  lossCount
  lastMatchDateTime
  matches(request: { skip: 0, take: 20 }) {
    id
    didRadiantWin
    durationSeconds
    startDateTime
    league { displayName }
    radiantTeam { id name }
    direTeam { id name }
    pickBans {
      isPick
      heroId
      bannedHeroId
      order
      isRadiant
    }
  }
`

export interface HeroMeta {
  id: number
  displayName: string
  shortName: string
}

let heroCache: { ts: number; data: HeroMeta[] } | null = null
const HERO_TTL_MS = 24 * 60 * 60 * 1000

// STRATZ hero metadata — cached in-process for 24h since it changes only on patch.
export async function getHeroConstants(): Promise<HeroMeta[]> {
  if (heroCache && Date.now() - heroCache.ts < HERO_TTL_MS) return heroCache.data

  const query = `
    query Heroes {
      constants {
        heroes {
          id
          displayName
          shortName
        }
      }
    }
  `
  const data = await stratzQuery<{ constants: { heroes: HeroMeta[] | null } | null }>(query)
  const heroes = data?.constants?.heroes ?? []
  heroCache = { ts: Date.now(), data: heroes }
  return heroes
}

// One round-trip: both teams + their recent matches with full pick/ban data.
// Caller can compute H2H by intersecting opposingTeamId, and hero pool from pickBans.
export async function getMatchupResearch(
  teamAId: number,
  teamBId: number,
): Promise<StratzMatchup> {
  const query = `
    query Matchup($a: Int!, $b: Int!) {
      teamA: team(teamId: $a) { ${TEAM_FRAGMENT} }
      teamB: team(teamId: $b) { ${TEAM_FRAGMENT} }
    }
  `

  const data = await stratzQuery<{
    teamA: RawStratzTeam | null
    teamB: RawStratzTeam | null
  }>(query, { a: teamAId, b: teamBId })

  if (!data) return { teamA: null, teamB: null }

  return {
    teamA: shapeTeam(data.teamA, teamAId),
    teamB: shapeTeam(data.teamB, teamBId),
  }
}

type RawStratzTeam = {
  id: number
  name: string
  tag: string
  winCount: number | null
  lossCount: number | null
  lastMatchDateTime: number | null
  matches: Array<{
    id: number
    didRadiantWin: boolean | null
    durationSeconds: number | null
    startDateTime: number | null
    league: { displayName: string | null } | null
    radiantTeam: { id: number; name: string } | null
    direTeam: { id: number; name: string } | null
    pickBans: Array<{
      isPick: boolean
      heroId: number
      bannedHeroId: number | null
      order: number
      isRadiant: boolean
    }> | null
  }> | null
}

export interface DraftSlot {
  isPick: boolean
  heroId: number
  isRadiant: boolean
  order: number
}

export interface SimpleMatch {
  id: number
  startDateTime: number
  league: string | null
  durationSeconds: number
  isRadiant: boolean
  won: boolean
  opposingTeamName: string | null
  pickBans: DraftSlot[]
}

export interface MatchupSummary {
  teamA: { id: number; name: string; tag: string } | null
  teamB: { id: number; name: string; tag: string } | null
  h2h: {
    matchCount: number
    aWins: number
    bWins: number
    matches: { id: number; aWon: boolean; startDateTime: number; league: string | null }[]
  }
  teamAStats: TeamStats | null
  teamBStats: TeamStats | null
  teamAMatches: SimpleMatch[]
  teamBMatches: SimpleMatch[]
}

export interface TeamStats {
  recordWindow: { wins: number; losses: number }
  daysSinceLastMatch: number | null
  uniqueHeroes: number
  topHeroes: { heroId: number; picks: number }[]
  avgMatchDurationSec: number
}

function computeTeamStats(team: StratzMatchupTeam): TeamStats {
  let wins = 0
  let losses = 0
  let durationTotal = 0
  let durationCount = 0
  const heroPickCount = new Map<number, number>()

  for (const m of team.matches) {
    const won = (m.isRadiant && m.didRadiantWin) || (!m.isRadiant && !m.didRadiantWin)
    if (won) wins++
    else losses++
    if (m.durationSeconds > 0) {
      durationTotal += m.durationSeconds
      durationCount++
    }
    for (const pb of m.pickBans) {
      if (pb.isPick && pb.isRadiant === m.isRadiant && pb.heroId > 0) {
        heroPickCount.set(pb.heroId, (heroPickCount.get(pb.heroId) ?? 0) + 1)
      }
    }
  }

  const daysSinceLastMatch =
    team.lastMatchDateTime != null
      ? Math.floor((Date.now() / 1000 - team.lastMatchDateTime) / 86400)
      : null

  const topHeroes = Array.from(heroPickCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([heroId, picks]) => ({ heroId, picks }))

  return {
    recordWindow: { wins, losses },
    daysSinceLastMatch,
    uniqueHeroes: heroPickCount.size,
    topHeroes,
    avgMatchDurationSec: durationCount > 0 ? Math.round(durationTotal / durationCount) : 0,
  }
}

function toSimpleMatches(team: StratzMatchupTeam): SimpleMatch[] {
  return team.matches.map(m => ({
    id: m.id,
    startDateTime: m.startDateTime,
    league: m.leagueName,
    durationSeconds: m.durationSeconds,
    isRadiant: m.isRadiant,
    won: (m.isRadiant && m.didRadiantWin) || (!m.isRadiant && !m.didRadiantWin),
    opposingTeamName: m.opposingTeamName,
    pickBans: m.pickBans.map(pb => ({
      isPick: pb.isPick,
      heroId: pb.isPick ? pb.heroId : (pb.bannedHeroId ?? 0),
      isRadiant: pb.isRadiant,
      order: pb.order,
    })),
  }))
}

export function summarizeMatchup(matchup: StratzMatchup): MatchupSummary {
  const { teamA, teamB } = matchup
  if (!teamA || !teamB) {
    return {
      teamA: teamA ? { id: teamA.id, name: teamA.name, tag: teamA.tag } : null,
      teamB: teamB ? { id: teamB.id, name: teamB.name, tag: teamB.tag } : null,
      h2h: { matchCount: 0, aWins: 0, bWins: 0, matches: [] },
      teamAStats: teamA ? computeTeamStats(teamA) : null,
      teamBStats: teamB ? computeTeamStats(teamB) : null,
      teamAMatches: teamA ? toSimpleMatches(teamA) : [],
      teamBMatches: teamB ? toSimpleMatches(teamB) : [],
    }
  }

  // H2H: matches in teamA's history where the opponent is teamB.
  const h2hRaw = teamA.matches.filter(m => m.opposingTeamId === teamB.id)
  let aWins = 0
  let bWins = 0
  const h2hMatches = h2hRaw.map(m => {
    const aWon = (m.isRadiant && m.didRadiantWin) || (!m.isRadiant && !m.didRadiantWin)
    if (aWon) aWins++
    else bWins++
    return {
      id: m.id,
      aWon,
      startDateTime: m.startDateTime,
      league: m.leagueName,
    }
  })

  return {
    teamA: { id: teamA.id, name: teamA.name, tag: teamA.tag },
    teamB: { id: teamB.id, name: teamB.name, tag: teamB.tag },
    h2h: { matchCount: h2hMatches.length, aWins, bWins, matches: h2hMatches },
    teamAStats: computeTeamStats(teamA),
    teamBStats: computeTeamStats(teamB),
    teamAMatches: toSimpleMatches(teamA),
    teamBMatches: toSimpleMatches(teamB),
  }
}

// ---------------------------------------------------------------------------
// Model-facing functions — used by the betting prediction model, not the UI.
// ---------------------------------------------------------------------------

export interface StratzHeroMetaStat {
  heroId: number
  matchCount: number
  winCount: number
}

export interface StratzHeroDryad {
  heroId2: number
  matchCount: number
  winCount: number
  winRate: number
}

export interface StratzHeroLaneStat {
  position: string
  matchCount: number
  winCount: number
  winRate: number
}

export async function getHeroMetaStats(): Promise<StratzHeroMetaStat[] | null> {
  const query = `{
    heroStats {
      stats(bracketBasicIds: [DIVINE_IMMORTAL]) {
        heroId
        matchCount
        winCount
      }
    }
  }`
  const data = await stratzQuery<{ heroStats: { stats: StratzHeroMetaStat[] | null } | null }>(query)
  return data?.heroStats?.stats ?? null
}

export async function getHeroSynergies(heroId: number): Promise<StratzHeroDryad[] | null> {
  const query = `query HeroSynergy($heroId: Short!) {
    heroStats {
      matchUp(heroId: $heroId, bracketBasicIds: [DIVINE_IMMORTAL]) {
        with {
          heroId2
          matchCount
          winCount
          winsAverage
        }
      }
    }
  }`
  const data = await stratzQuery<{
    heroStats: { matchUp: Array<{ with: Array<{ heroId2: number; matchCount: number; winCount: number; winsAverage: number }> }> | null } | null
  }>(query, { heroId })

  const entries = data?.heroStats?.matchUp?.[0]?.with
  if (!entries) return null
  return entries.map(e => ({
    heroId2: e.heroId2,
    matchCount: e.matchCount,
    winCount: e.winCount,
    winRate: e.winsAverage,
  }))
}

export async function getHeroVsMatchups(heroId: number): Promise<StratzHeroDryad[] | null> {
  const query = `query HeroVs($heroId: Short!) {
    heroStats {
      matchUp(heroId: $heroId, bracketBasicIds: [DIVINE_IMMORTAL]) {
        vs {
          heroId2
          matchCount
          winCount
          winsAverage
        }
      }
    }
  }`
  const data = await stratzQuery<{
    heroStats: { matchUp: Array<{ vs: Array<{ heroId2: number; matchCount: number; winCount: number; winsAverage: number }> }> | null } | null
  }>(query, { heroId })

  const entries = data?.heroStats?.matchUp?.[0]?.vs
  if (!entries) return null
  return entries.map(e => ({
    heroId2: e.heroId2,
    matchCount: e.matchCount,
    winCount: e.winCount,
    winRate: e.winsAverage,
  }))
}

export async function getHeroLaneStats(heroId: number): Promise<StratzHeroLaneStat[] | null> {
  const query = `query HeroLane($heroId: [Short]!) {
    heroStats {
      stats(heroIds: $heroId, bracketBasicIds: [DIVINE_IMMORTAL], groupByPosition: true) {
        position
        matchCount
        winCount
      }
    }
  }`
  const data = await stratzQuery<{
    heroStats: { stats: Array<{ position: string; matchCount: number; winCount: number }> | null } | null
  }>(query, { heroId: [heroId] })

  const entries = data?.heroStats?.stats
  if (!entries) return null
  return entries.map(e => ({
    position: e.position,
    matchCount: e.matchCount,
    winCount: e.winCount,
    winRate: e.matchCount > 0 ? e.winCount / e.matchCount : 0,
  }))
}

export interface StratzHeroTimeStat {
  heroId: number
  time: number
  matchCount: number
  winCount: number
}

export async function getHeroWinByDuration(heroId: number): Promise<StratzHeroTimeStat[] | null> {
  const query = `query HeroDuration($heroId: [Short]!) {
    heroStats {
      stats(heroIds: $heroId, bracketBasicIds: [DIVINE_IMMORTAL], groupByTime: true) {
        heroId
        time
        matchCount
        winCount
      }
    }
  }`
  const data = await stratzQuery<{
    heroStats: { stats: StratzHeroTimeStat[] | null } | null
  }>(query, { heroId: [heroId] })

  return data?.heroStats?.stats ?? null
}

// ---------------------------------------------------------------------------

function shapeTeam(raw: RawStratzTeam | null, selfId: number): StratzMatchupTeam | null {
  if (!raw) return null
  return {
    id: raw.id,
    name: raw.name,
    tag: raw.tag,
    winCount: raw.winCount ?? 0,
    lossCount: raw.lossCount ?? 0,
    lastMatchDateTime: raw.lastMatchDateTime ?? null,
    matches: (raw.matches ?? []).map(m => {
      const isRadiant = m.radiantTeam?.id === selfId
      const opposing = isRadiant ? m.direTeam : m.radiantTeam
      return {
        id: m.id,
        didRadiantWin: m.didRadiantWin ?? false,
        isRadiant,
        durationSeconds: m.durationSeconds ?? 0,
        startDateTime: m.startDateTime ?? 0,
        leagueName: m.league?.displayName ?? null,
        opposingTeamId: opposing?.id ?? null,
        opposingTeamName: opposing?.name ?? null,
        pickBans: m.pickBans ?? [],
      }
    }),
  }
}
