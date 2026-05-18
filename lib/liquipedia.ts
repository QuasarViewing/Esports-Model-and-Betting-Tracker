// Liquipedia API Service
// Uses Liquipedia's Cargo API for structured esports data

const USER_AGENT = 'EsportsBetTracker/1.0 (https://github.com/esports-bet-tracker)'

// Cargo API endpoints for each game
const CARGO_API = {
  dota2: 'https://liquipedia.net/dota2/api.php',
  lol: 'https://liquipedia.net/leagueoflegends/api.php', 
  csgo: 'https://liquipedia.net/counterstrike/api.php',
  valorant: 'https://liquipedia.net/valorant/api.php',
}

export type GameType = 'dota2' | 'lol' | 'csgo' | 'valorant'

export interface TeamInfoData {
  name: string
  shortName: string
  region: string
  logoUrl?: string
  roster: PlayerInfo[]
  recentForm: string[]
  winRate: number
  liquipediaUrl?: string
  lastUpdated: Date
}

export interface PlayerInfo {
  name: string
  realName?: string
  role: string
  country?: string
  joinDate?: string
}

export interface MatchResult {
  date: string
  opponent: string
  result: 'win' | 'loss' | 'draw'
  score: string
  tournament: string
  game: GameType
}

export interface HeadToHead {
  team1: string
  team2: string
  team1Wins: number
  team2Wins: number
  draws: number
  matches: MatchResult[]
  lastMet?: string
}

export interface Tournament {
  name: string
  tier: string
  startDate: string
  endDate?: string
  prizePool?: string
  location?: string
  status: 'upcoming' | 'ongoing' | 'completed'
  game: GameType
  liquipediaUrl?: string
}

export interface UpcomingMatch {
  team1: string
  team2: string
  date: string
  time?: string
  tournament: string
  bestOf?: number
  stream?: string
  game: GameType
}

// Cargo query helper
async function cargoQuery(game: GameType, params: {
  tables: string
  fields: string
  where?: string
  orderBy?: string
  limit?: number
}): Promise<unknown[]> {
  const baseUrl = CARGO_API[game]
  const url = new URL(baseUrl)
  
  url.searchParams.set('action', 'cargoquery')
  url.searchParams.set('format', 'json')
  url.searchParams.set('origin', '*')
  url.searchParams.set('tables', params.tables)
  url.searchParams.set('fields', params.fields)
  
  if (params.where) url.searchParams.set('where', params.where)
  if (params.orderBy) url.searchParams.set('order_by', params.orderBy)
  if (params.limit) url.searchParams.set('limit', params.limit.toString())

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
      next: { revalidate: 300 } // Cache for 5 mins
    })

    if (!response.ok) {
      console.error(`[v0] Cargo API error: ${response.status}`)
      return []
    }

    const data = await response.json()
    return data.cargoquery?.map((item: { title: unknown }) => item.title) || []
  } catch (error) {
    console.error(`[v0] Cargo query failed:`, error)
    return []
  }
}

// Get team info using Cargo API
export async function getTeamInfo(teamName: string, game: GameType): Promise<TeamInfoData | null> {
  try {
    // Query team data from Cargo
    const teamData = await cargoQuery(game, {
      tables: 'Teams',
      fields: 'Name,ShortName,Region,Image,Link',
      where: `Name="${teamName}" OR ShortName="${teamName}"`,
      limit: 1
    })

    if (teamData.length === 0) {
      // Try fuzzy match
      const fuzzyData = await cargoQuery(game, {
        tables: 'Teams',
        fields: 'Name,ShortName,Region,Image,Link',
        where: `Name LIKE "%${teamName}%" OR ShortName LIKE "%${teamName}%"`,
        limit: 1
      })
      
      if (fuzzyData.length === 0) {
        return createFallbackTeamInfo(teamName, game)
      }
      
      const team = fuzzyData[0] as Record<string, string>
      return buildTeamInfo(team, game)
    }

    const team = teamData[0] as Record<string, string>
    return buildTeamInfo(team, game)
  } catch (error) {
    console.error(`[v0] Error fetching team ${teamName}:`, error)
    return createFallbackTeamInfo(teamName, game)
  }
}

function buildTeamInfo(team: Record<string, string>, game: GameType): TeamInfoData {
  const gameUrls: Record<GameType, string> = {
    dota2: 'https://liquipedia.net/dota2/',
    lol: 'https://liquipedia.net/leagueoflegends/',
    csgo: 'https://liquipedia.net/counterstrike/',
    valorant: 'https://liquipedia.net/valorant/'
  }
  
  return {
    name: team.Name || team.ShortName || 'Unknown',
    shortName: team.ShortName || team.Name || '',
    region: team.Region || 'Unknown',
    logoUrl: team.Image ? `https://liquipedia.net/commons/images/${team.Image}` : undefined,
    roster: [],
    recentForm: [],
    winRate: 0,
    liquipediaUrl: team.Link ? `${gameUrls[game]}${team.Link}` : undefined,
    lastUpdated: new Date()
  }
}

function createFallbackTeamInfo(teamName: string, game: GameType): TeamInfoData {
  // Known teams with their regions
  const knownTeams: Record<string, { region: string; shortName?: string }> = {
    'PARIVISION': { region: 'CIS', shortName: 'PARI' },
    'Team Spirit': { region: 'CIS', shortName: 'Spirit' },
    'Team Liquid': { region: 'Europe', shortName: 'Liquid' },
    'Tundra Esports': { region: 'Europe', shortName: 'Tundra' },
    'Gaimin Gladiators': { region: 'Europe', shortName: 'GG' },
    'BetBoom Team': { region: 'CIS', shortName: 'BB' },
    'Natus Vincere': { region: 'CIS', shortName: 'Navi' },
    'OG': { region: 'Europe', shortName: 'OG' },
    'Xtreme Gaming': { region: 'China', shortName: 'XG' },
    'Aurora': { region: 'CIS', shortName: 'Aurora' },
    '9Pandas': { region: 'CIS', shortName: '9P' },
    'Cloud9': { region: 'NA', shortName: 'C9' },
    'FaZe Clan': { region: 'Europe', shortName: 'FaZe' },
    'G2 Esports': { region: 'Europe', shortName: 'G2' },
    'Vitality': { region: 'Europe', shortName: 'Vita' },
    'MOUZ': { region: 'Europe', shortName: 'MOUZ' },
    'Heroic': { region: 'Europe', shortName: 'Heroic' },
    'FURIA': { region: 'SA', shortName: 'FURIA' },
    'T1': { region: 'Korea', shortName: 'T1' },
    'Gen.G': { region: 'Korea', shortName: 'GenG' },
    'JD Gaming': { region: 'China', shortName: 'JDG' },
    'Bilibili Gaming': { region: 'China', shortName: 'BLG' },
    'Sentinels': { region: 'NA', shortName: 'SEN' },
    'LOUD': { region: 'SA', shortName: 'LOUD' },
    'Paper Rex': { region: 'SEA', shortName: 'PRX' },
  }

  const normalizedName = teamName.toLowerCase()
  const match = Object.entries(knownTeams).find(([name]) => 
    name.toLowerCase().includes(normalizedName) || normalizedName.includes(name.toLowerCase())
  )

  return {
    name: teamName,
    shortName: match?.[1].shortName || teamName.split(' ')[0],
    region: match?.[1].region || 'Unknown',
    roster: [],
    recentForm: [],
    winRate: 0,
    lastUpdated: new Date()
  }
}

// Get recent match results for a team
export async function getTeamMatchHistory(teamName: string, game: GameType, limit: number = 10): Promise<MatchResult[]> {
  try {
    // Query recent matches from Cargo
    const matches = await cargoQuery(game, {
      tables: 'MatchSchedule',
      fields: 'Team1,Team2,Team1Score,Team2Score,DateTime_UTC,Tournament,BestOf',
      where: `(Team1="${teamName}" OR Team2="${teamName}") AND Winner IS NOT NULL`,
      orderBy: 'DateTime_UTC DESC',
      limit
    })

    return matches.map((match: unknown) => {
      const m = match as Record<string, string>
      const isTeam1 = m.Team1?.toLowerCase() === teamName.toLowerCase()
      const team1Score = parseInt(m.Team1Score) || 0
      const team2Score = parseInt(m.Team2Score) || 0
      
      let result: 'win' | 'loss' | 'draw' = 'draw'
      if (isTeam1) {
        result = team1Score > team2Score ? 'win' : team1Score < team2Score ? 'loss' : 'draw'
      } else {
        result = team2Score > team1Score ? 'win' : team2Score < team1Score ? 'loss' : 'draw'
      }

      return {
        date: m.DateTime_UTC?.split(' ')[0] || new Date().toISOString().split('T')[0],
        opponent: isTeam1 ? m.Team2 : m.Team1,
        result,
        score: isTeam1 ? `${team1Score}-${team2Score}` : `${team2Score}-${team1Score}`,
        tournament: m.Tournament || 'Unknown Tournament',
        game
      }
    })
  } catch (error) {
    console.error(`[v0] Error fetching matches for ${teamName}:`, error)
    return []
  }
}

// Get head-to-head data between two teams
export async function getHeadToHeadData(team1: string, team2: string, game: GameType): Promise<HeadToHead> {
  try {
    const matches = await cargoQuery(game, {
      tables: 'MatchSchedule',
      fields: 'Team1,Team2,Team1Score,Team2Score,DateTime_UTC,Tournament,Winner',
      where: `((Team1="${team1}" AND Team2="${team2}") OR (Team1="${team2}" AND Team2="${team1}")) AND Winner IS NOT NULL`,
      orderBy: 'DateTime_UTC DESC',
      limit: 20
    })

    let team1Wins = 0
    let team2Wins = 0
    let draws = 0
    const matchResults: MatchResult[] = []

    matches.forEach((match: unknown) => {
      const m = match as Record<string, string>
      const isTeam1First = m.Team1?.toLowerCase() === team1.toLowerCase()
      const winner = m.Winner?.toLowerCase()
      
      if (winner === team1.toLowerCase()) {
        team1Wins++
      } else if (winner === team2.toLowerCase()) {
        team2Wins++
      } else {
        draws++
      }

      const team1Score = parseInt(m.Team1Score) || 0
      const team2Score = parseInt(m.Team2Score) || 0

      matchResults.push({
        date: m.DateTime_UTC?.split(' ')[0] || '',
        opponent: isTeam1First ? m.Team2 : m.Team1,
        result: winner === team1.toLowerCase() ? 'win' : winner === team2.toLowerCase() ? 'loss' : 'draw',
        score: isTeam1First ? `${team1Score}-${team2Score}` : `${team2Score}-${team1Score}`,
        tournament: m.Tournament || 'Unknown',
        game
      })
    })

    return {
      team1,
      team2,
      team1Wins,
      team2Wins,
      draws,
      matches: matchResults,
      lastMet: matchResults[0]?.date
    }
  } catch (error) {
    console.error(`[v0] Error fetching H2H:`, error)
    return { team1, team2, team1Wins: 0, team2Wins: 0, draws: 0, matches: [] }
  }
}

// Get upcoming/ongoing tournaments
export async function getTournaments(game: GameType, status: 'upcoming' | 'ongoing' | 'all' = 'all'): Promise<Tournament[]> {
  try {
    const now = new Date().toISOString().split('T')[0]
    
    let whereClause = ''
    if (status === 'upcoming') {
      whereClause = `StartDate > "${now}"`
    } else if (status === 'ongoing') {
      whereClause = `StartDate <= "${now}" AND (EndDate >= "${now}" OR EndDate IS NULL)`
    }

    // Query tournaments - try different table names based on game
    const tournaments = await cargoQuery(game, {
      tables: 'Tournaments',
      fields: 'Name,Tier,StartDate,EndDate,Prizepool,Location,Liquipedia',
      where: whereClause || undefined,
      orderBy: 'StartDate DESC',
      limit: 20
    })

    return tournaments.map((t: unknown) => {
      const tournament = t as Record<string, string>
      const startDate = tournament.StartDate || ''
      const endDate = tournament.EndDate || ''
      
      let tournamentStatus: 'upcoming' | 'ongoing' | 'completed' = 'completed'
      if (startDate > now) {
        tournamentStatus = 'upcoming'
      } else if (!endDate || endDate >= now) {
        tournamentStatus = 'ongoing'
      }

      return {
        name: tournament.Name || 'Unknown Tournament',
        tier: tournament.Tier || 'Unknown',
        startDate,
        endDate: endDate || undefined,
        prizePool: tournament.Prizepool || undefined,
        location: tournament.Location || undefined,
        status: tournamentStatus,
        game,
        liquipediaUrl: tournament.Liquipedia ? `https://liquipedia.net/${game}/${tournament.Liquipedia}` : undefined
      }
    })
  } catch (error) {
    console.error(`[v0] Error fetching tournaments:`, error)
    return []
  }
}

// Get upcoming matches (schedule)
export async function getUpcomingMatches(game: GameType, limit: number = 20): Promise<UpcomingMatch[]> {
  try {
    const now = new Date().toISOString()
    
    const matches = await cargoQuery(game, {
      tables: 'MatchSchedule',
      fields: 'Team1,Team2,DateTime_UTC,Tournament,BestOf,Stream',
      where: `DateTime_UTC > "${now}" AND Team1 IS NOT NULL AND Team2 IS NOT NULL`,
      orderBy: 'DateTime_UTC ASC',
      limit
    })

    return matches.map((m: unknown) => {
      const match = m as Record<string, string>
      const dateTime = match.DateTime_UTC || ''
      const [date, time] = dateTime.split(' ')
      
      return {
        team1: match.Team1 || 'TBD',
        team2: match.Team2 || 'TBD',
        date: date || new Date().toISOString().split('T')[0],
        time: time || undefined,
        tournament: match.Tournament || 'Unknown Tournament',
        bestOf: match.BestOf ? parseInt(match.BestOf) : undefined,
        stream: match.Stream || undefined,
        game
      }
    })
  } catch (error) {
    console.error(`[v0] Error fetching upcoming matches:`, error)
    return []
  }
}

// Search for teams
export async function searchTeam(query: string, game: GameType): Promise<string[]> {
  try {
    const results = await cargoQuery(game, {
      tables: 'Teams',
      fields: 'Name',
      where: `Name LIKE "%${query}%" OR ShortName LIKE "%${query}%"`,
      limit: 10
    })

    return results.map((r: unknown) => (r as { Name: string }).Name)
  } catch (error) {
    console.error(`[v0] Error searching teams:`, error)
    return []
  }
}

// Class wrapper for API routes
export class LiquipediaAPI {
  private game: GameType

  constructor(game: GameType) {
    this.game = game
  }

  async getTeamInfo(teamName: string): Promise<TeamInfoData | null> {
    return getTeamInfo(teamName, this.game)
  }

  async getRecentMatches(teamName: string, limit: number = 10): Promise<MatchResult[]> {
    return getTeamMatchHistory(teamName, this.game, limit)
  }

  async getHeadToHead(team1: string, team2: string): Promise<HeadToHead> {
    return getHeadToHeadData(team1, team2, this.game)
  }

  async getTournaments(status: 'upcoming' | 'ongoing' | 'all' = 'all'): Promise<Tournament[]> {
    return getTournaments(this.game, status)
  }

  async getUpcomingMatches(limit: number = 20): Promise<UpcomingMatch[]> {
    return getUpcomingMatches(this.game, limit)
  }

  async search(query: string): Promise<string[]> {
    return searchTeam(query, this.game)
  }
}
