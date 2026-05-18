// Liquipedia API Service
// Fetches team info, match history, H2H, and tournament data

const LIQUIPEDIA_API_BASE = {
  dota2: 'https://liquipedia.net/dota2/api.php',
  lol: 'https://liquipedia.net/leagueoflegends/api.php',
  csgo: 'https://liquipedia.net/counterstrike/api.php',
  valorant: 'https://liquipedia.net/valorant/api.php',
}

const USER_AGENT = 'EsportsBetTracker/1.0 (contact@example.com)'

export type GameType = 'dota2' | 'lol' | 'csgo' | 'valorant'

export interface TeamInfo {
  name: string
  shortName: string
  region: string
  logo?: string
  roster: PlayerInfo[]
  recentForm: string[] // W/L results
  winRate: number
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
  teams: string[]
  status: 'upcoming' | 'ongoing' | 'completed'
  game: GameType
}

export interface LiveMatch {
  team1: string
  team2: string
  score: string
  tournament: string
  startTime: string
  streamUrl?: string
  game: GameType
}

// Helper to make API requests to Liquipedia
async function fetchLiquipedia(game: GameType, params: Record<string, string>): Promise<unknown> {
  const baseUrl = LIQUIPEDIA_API_BASE[game]
  const url = new URL(baseUrl)
  
  // Liquipedia uses MediaWiki API
  url.searchParams.set('action', 'parse')
  url.searchParams.set('format', 'json')
  url.searchParams.set('origin', '*')
  
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
    },
    next: { revalidate: 3600 } // Cache for 1 hour
  })

  if (!response.ok) {
    throw new Error(`Liquipedia API error: ${response.status}`)
  }

  return response.json()
}

// Fetch team info from Liquipedia
export async function getTeamInfo(teamName: string, game: GameType): Promise<TeamInfo | null> {
  try {
    // Normalize team name for wiki page title
    const pageName = teamName.replace(/ /g, '_')
    
    const data = await fetchLiquipedia(game, {
      page: pageName,
      prop: 'wikitext',
    }) as { parse?: { wikitext?: { '*': string } } }

    if (!data.parse?.wikitext) {
      return null
    }

    const wikitext = data.parse.wikitext['*']
    
    // Parse the wikitext to extract team info
    // This is a simplified parser - real implementation would be more robust
    const teamInfo = parseTeamWikitext(wikitext, teamName, game)
    
    return teamInfo
  } catch (error) {
    console.error(`Error fetching team info for ${teamName}:`, error)
    return null
  }
}

// Parse team wikitext to extract structured data
function parseTeamWikitext(wikitext: string, teamName: string, game: GameType): TeamInfo {
  const roster: PlayerInfo[] = []
  
  // Extract roster from {{TeamCard}} or similar templates
  const rosterMatch = wikitext.match(/\{\{TeamCard[\s\S]*?\}\}/gi)
  if (rosterMatch) {
    // Parse roster entries
    const playerMatches = wikitext.matchAll(/\|p\d+=([^|}\n]+)/gi)
    for (const match of playerMatches) {
      if (match[1]?.trim()) {
        roster.push({
          name: match[1].trim(),
          role: 'Player'
        })
      }
    }
  }

  // Extract region
  const regionMatch = wikitext.match(/\|region\s*=\s*([^|}\n]+)/i)
  const region = regionMatch?.[1]?.trim() || 'Unknown'

  // Extract short name
  const shortMatch = wikitext.match(/\|short\s*=\s*([^|}\n]+)/i)
  const shortName = shortMatch?.[1]?.trim() || teamName

  return {
    name: teamName,
    shortName,
    region,
    roster,
    recentForm: [],
    winRate: 0,
    lastUpdated: new Date()
  }
}

// Fetch recent match results for a team
export async function getTeamMatchHistory(teamName: string, game: GameType, limit: number = 10): Promise<MatchResult[]> {
  try {
    const pageName = `${teamName.replace(/ /g, '_')}/Results`
    
    const data = await fetchLiquipedia(game, {
      page: pageName,
      prop: 'wikitext',
    }) as { parse?: { wikitext?: { '*': string } } }

    if (!data.parse?.wikitext) {
      // Try alternate page format
      return []
    }

    const wikitext = data.parse.wikitext['*']
    const matches = parseMatchHistory(wikitext, teamName, game)
    
    return matches.slice(0, limit)
  } catch (error) {
    console.error(`Error fetching match history for ${teamName}:`, error)
    return []
  }
}

// Parse match history from wikitext
function parseMatchHistory(wikitext: string, teamName: string, game: GameType): MatchResult[] {
  const matches: MatchResult[] = []
  
  // Look for MatchList or similar templates
  const matchRegex = /\{\{MatchMaps[\s\S]*?\}\}/gi
  const matchEntries = wikitext.match(matchRegex) || []
  
  for (const entry of matchEntries) {
    const opponentMatch = entry.match(/\|opponent\s*=\s*([^|}\n]+)/i)
    const scoreMatch = entry.match(/\|score\s*=\s*([^|}\n]+)/i)
    const dateMatch = entry.match(/\|date\s*=\s*([^|}\n]+)/i)
    const tournamentMatch = entry.match(/\|tournament\s*=\s*([^|}\n]+)/i)
    
    if (opponentMatch) {
      const score = scoreMatch?.[1]?.trim() || '0-0'
      const [team1Score, team2Score] = score.split('-').map(s => parseInt(s.trim()) || 0)
      
      matches.push({
        date: dateMatch?.[1]?.trim() || 'Unknown',
        opponent: opponentMatch[1].trim(),
        result: team1Score > team2Score ? 'win' : team1Score < team2Score ? 'loss' : 'draw',
        score,
        tournament: tournamentMatch?.[1]?.trim() || 'Unknown',
        game
      })
    }
  }
  
  return matches
}

// Get head-to-head record between two teams
export async function getHeadToHead(team1: string, team2: string, game: GameType): Promise<HeadToHead> {
  const [team1History, team2History] = await Promise.all([
    getTeamMatchHistory(team1, game, 50),
    getTeamMatchHistory(team2, game, 50)
  ])
  
  // Find matches between the two teams
  const h2hMatches = team1History.filter(m => 
    m.opponent.toLowerCase().includes(team2.toLowerCase()) ||
    team2.toLowerCase().includes(m.opponent.toLowerCase())
  )
  
  let team1Wins = 0
  let team2Wins = 0
  let draws = 0
  
  for (const match of h2hMatches) {
    if (match.result === 'win') team1Wins++
    else if (match.result === 'loss') team2Wins++
    else draws++
  }
  
  return {
    team1,
    team2,
    team1Wins,
    team2Wins,
    draws,
    matches: h2hMatches,
    lastMet: h2hMatches[0]?.date
  }
}

// Fetch ongoing/upcoming tournaments
export async function getTournaments(game: GameType, status: 'upcoming' | 'ongoing' | 'all' = 'all'): Promise<Tournament[]> {
  try {
    // Fetch the tournaments portal page
    const pageName = game === 'dota2' ? 'Portal:Tournaments' : 
                     game === 'lol' ? 'Portal:Tournaments' :
                     game === 'csgo' ? 'Portal:Tournaments' : 'Portal:Tournaments'
    
    const data = await fetchLiquipedia(game, {
      page: pageName,
      prop: 'wikitext',
    }) as { parse?: { wikitext?: { '*': string } } }

    if (!data.parse?.wikitext) {
      return []
    }

    const wikitext = data.parse.wikitext['*']
    const tournaments = parseTournaments(wikitext, game)
    
    if (status === 'all') return tournaments
    return tournaments.filter(t => t.status === status)
  } catch (error) {
    console.error(`Error fetching tournaments for ${game}:`, error)
    return []
  }
}

// Parse tournaments from wikitext
function parseTournaments(wikitext: string, game: GameType): Tournament[] {
  const tournaments: Tournament[] = []
  
  // Look for tournament templates
  const tournamentRegex = /\{\{TournamentCard[\s\S]*?\}\}/gi
  const entries = wikitext.match(tournamentRegex) || []
  
  for (const entry of entries) {
    const nameMatch = entry.match(/\|name\s*=\s*([^|}\n]+)/i)
    const tierMatch = entry.match(/\|tier\s*=\s*([^|}\n]+)/i)
    const dateMatch = entry.match(/\|sdate\s*=\s*([^|}\n]+)/i)
    const endDateMatch = entry.match(/\|edate\s*=\s*([^|}\n]+)/i)
    const prizeMatch = entry.match(/\|prizepool\s*=\s*([^|}\n]+)/i)
    
    if (nameMatch) {
      const startDate = dateMatch?.[1]?.trim() || ''
      const endDate = endDateMatch?.[1]?.trim() || ''
      const now = new Date()
      const start = startDate ? new Date(startDate) : now
      const end = endDate ? new Date(endDate) : now
      
      let status: 'upcoming' | 'ongoing' | 'completed' = 'upcoming'
      if (start <= now && end >= now) status = 'ongoing'
      else if (end < now) status = 'completed'
      
      tournaments.push({
        name: nameMatch[1].trim(),
        tier: tierMatch?.[1]?.trim() || 'Unknown',
        startDate,
        endDate,
        prizePool: prizeMatch?.[1]?.trim(),
        teams: [],
        status,
        game
      })
    }
  }
  
  return tournaments
}

// Get team form (last N results as W/L/D string)
export function calculateTeamForm(matches: MatchResult[]): { form: string[]; winRate: number } {
  const lastMatches = matches.slice(0, 10)
  const form = lastMatches.map(m => 
    m.result === 'win' ? 'W' : m.result === 'loss' ? 'L' : 'D'
  )
  
  const wins = form.filter(r => r === 'W').length
  const winRate = lastMatches.length > 0 ? (wins / lastMatches.length) * 100 : 0
  
  return { form, winRate }
}

// Normalize team name for matching
export function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/esports?|gaming|team|clan/gi, '')
    .trim()
}

// Find team in Liquipedia by searching
export async function searchTeam(query: string, game: GameType): Promise<string[]> {
  try {
    const baseUrl = LIQUIPEDIA_API_BASE[game]
    const url = new URL(baseUrl)
    
    url.searchParams.set('action', 'opensearch')
    url.searchParams.set('search', query)
    url.searchParams.set('limit', '10')
    url.searchParams.set('namespace', '0')
    url.searchParams.set('format', 'json')
    url.searchParams.set('origin', '*')

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      return []
    }

    const data = await response.json() as [string, string[]]
    return data[1] || []
  } catch (error) {
    console.error(`Error searching for ${query}:`, error)
    return []
  }
}
