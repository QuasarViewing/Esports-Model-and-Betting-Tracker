import type { GameType } from './pandascore'

export interface LiveMatch {
  id: string
  team1: string
  team2: string
  score1: number
  score2: number
  status: 'live' | 'ended'
  tournament: string
  game: GameType
  duration?: number
  livestreams?: Array<{ platform: string; url: string }>
}

export interface TeamRecord {
  teamId: string
  teamName: string
  wins: number
  losses: number
  draws?: number
  winRate: number
  recentMatches: Array<{
    opponent: string
    result: 'win' | 'loss' | 'draw'
    date: string
    tournament: string
  }>
}

export interface LiveFrame {
  timestamp: number
  radiant: {
    score: number
    kills: number
    deaths: number
    gold: number
    xp: number
  }
  dire: {
    score: number
    kills: number
    deaths: number
    gold: number
    xp: number
  }
}

export interface LiveEvent {
  timestamp: number
  type: 'kill' | 'death' | 'objective' | 'roshan' | 'aegis'
  team: 'radiant' | 'dire'
  description: string
  hero?: string
}

// Get live matches from PandaScore
export async function getLiveMatches(game: GameType): Promise<LiveMatch[]> {
  try {
    const apiKey = process.env.PANDASCORE_API_KEY
    if (!apiKey) {
      console.error('PANDASCORE_API_KEY not set')
      return []
    }

    const slug = GAME_SLUG[game]
    const params = new URLSearchParams({
      per_page: '20',
    })
    const url = `https://api.pandascore.co/${slug}/matches/running?${params}`

    const response = await fetch(url, {
      headers: { accept: 'application/json', authorization: `Bearer ${apiKey}` },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('PandaScore live matches error:', response.status, errorText)
      return []
    }

    const data = await response.json()
    return (data || []).map((match: any) => ({
      id: match.id,
      team1: match.opponents?.[0]?.opponent?.name || 'TBD',
      team2: match.opponents?.[1]?.opponent?.name || 'TBD',
      score1: match.opponents?.[0]?.score || 0,
      score2: match.opponents?.[1]?.score || 0,
      status: 'live',
      tournament: match.serie?.full_name || match.league?.name || 'Unknown',
      game,
      livestreams: match.livestreams || [],
    }))
  } catch (error) {
    console.error('Error fetching live matches:', error)
    return []
  }
}

// Get team records/stats
export async function getTeamRecord(teamName: string, game: GameType): Promise<TeamRecord | null> {
  try {
    const apiKey = process.env.PANDASCORE_API_KEY
    if (!apiKey) {
      console.error('PANDASCORE_API_KEY not set')
      return null
    }

    const found = await findPandaTeam(teamName, game)
    if (!found) return null
    const teamId = found.id
    const team = { id: found.id, name: found.name }

    const matchesResponse = await fetch(
      `https://api.pandascore.co/teams/${teamId}/matches?per_page=20&sort=-scheduled_at`,
      { headers: { accept: 'application/json', authorization: `Bearer ${apiKey}` } }
    )

    if (!matchesResponse.ok) {
      return {
        teamId: String(team.id),
        teamName: team.name,
        wins: 0,
        losses: 0,
        winRate: 0,
        recentMatches: []
      }
    }

    const matches = await matchesResponse.json() || []
    
    let wins = 0
    let losses = 0
    let draws = 0
    const recentMatches = []

    for (const match of matches.slice(0, 10)) {
      if (match.status !== 'finished') continue
      const ops = match.opponents ?? []
      const opp = ops.find((o: any) => o.opponent?.id !== teamId)
      const opponentName = opp?.opponent?.name ?? 'Unknown'

      let result: 'win' | 'loss' | 'draw'
      if (match.draw) {
        result = 'draw'
        draws++
      } else if (match.winner_id === teamId) {
        result = 'win'
        wins++
      } else if (match.winner_id != null) {
        result = 'loss'
        losses++
      } else {
        continue
      }

      recentMatches.push({
        opponent: opponentName,
        result,
        date: match.scheduled_at || new Date().toISOString(),
        tournament: match.serie?.full_name || 'Unknown',
      })
    }

    const totalMatches = wins + losses + draws
    const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0

    return {
      teamId: String(teamId),
      teamName: team.name,
      wins,
      losses,
      draws,
      winRate,
      recentMatches
    }
  } catch (error) {
    console.error('Error fetching team record:', error)
    return null
  }
}

export interface H2HData {
  team1_name: string
  team2_name: string
  team1_wins: number
  team2_wins: number
  draws: number
  last_met?: string
}

// PandaScore game slugs for URL paths
const GAME_SLUG: Record<GameType, string> = {
  dota2: 'dota2',
  lol: 'lol',
  csgo: 'csgo',
  valorant: 'valorant',
}

// Numeric videogame ids — still needed for /teams endpoint which supports filter[videogame_id]
const VIDEOGAME_ID: Record<GameType, number> = {
  dota2: 4,
  lol: 1,
  csgo: 3,
  valorant: 26,
}

async function findPandaTeam(teamName: string, game: GameType): Promise<{ id: number; name: string } | null> {
  const apiKey = process.env.PANDASCORE_API_KEY
  if (!apiKey) return null

  const params = new URLSearchParams({
    'filter[videogame_id]': String(VIDEOGAME_ID[game]),
    'search[name]': teamName,
    per_page: '10',
  })
  const res = await fetch(`https://api.pandascore.co/teams?${params}`, {
    headers: { accept: 'application/json', authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) return null
  const teams = await res.json()
  if (!Array.isArray(teams) || teams.length === 0) return null

  // Prefer case-insensitive exact match; fall back to first hit.
  const lower = teamName.trim().toLowerCase()
  const exact = teams.find((t: { name: string }) => t.name?.toLowerCase() === lower)
  const best = exact ?? teams[0]
  return { id: best.id, name: best.name }
}

export async function getHeadToHeadPandaScore(
  team1: string,
  team2: string,
  game: GameType
): Promise<H2HData | null> {
  const apiKey = process.env.PANDASCORE_API_KEY
  if (!apiKey) return null

  const [a, b] = await Promise.all([findPandaTeam(team1, game), findPandaTeam(team2, game)])
  if (!a || !b) {
    return { team1_name: team1, team2_name: team2, team1_wins: 0, team2_wins: 0, draws: 0 }
  }

  const matchesRes = await fetch(
    `https://api.pandascore.co/teams/${a.id}/matches?per_page=50&sort=-scheduled_at`,
    { headers: { accept: 'application/json', authorization: `Bearer ${apiKey}` } }
  )
  if (!matchesRes.ok) {
    return { team1_name: a.name, team2_name: b.name, team1_wins: 0, team2_wins: 0, draws: 0 }
  }

  const all = (await matchesRes.json()) as Array<{
    opponents: Array<{ opponent: { id: number; name: string } }>
    results?: Array<{ team_id: number; score: number }>
    scheduled_at?: string
    end_at?: string | null
    status?: string
    winner_id?: number | null
    draw?: boolean
  }>

  let team1Wins = 0
  let team2Wins = 0
  let draws = 0
  let lastMet: string | undefined

  for (const match of all) {
    const ops = match.opponents ?? []
    if (ops.length < 2) continue
    const involvesA = ops.some(o => o.opponent?.id === a.id)
    const involvesB = ops.some(o => o.opponent?.id === b.id)
    if (!involvesA || !involvesB) continue
    if (match.status !== 'finished') continue

    if (match.draw) draws++
    else if (match.winner_id === a.id) team1Wins++
    else if (match.winner_id === b.id) team2Wins++
    else continue

    const when = match.end_at || match.scheduled_at
    if (when && (!lastMet || when > lastMet)) lastMet = when
  }

  return {
    team1_name: a.name,
    team2_name: b.name,
    team1_wins: team1Wins,
    team2_wins: team2Wins,
    draws,
    last_met: lastMet,
  }
}

export interface RecentMatchEntry {
  // Field names match what match-history.tsx reads — keep snake_case for opponent_name/match_date.
  opponent_name: string
  result: 'win' | 'loss' | 'draw'
  score: string
  match_date: string
  tournament: string
  game: GameType
}

export async function getRecentMatchesPandaScore(
  teamName: string,
  game: GameType,
  limit = 10
): Promise<RecentMatchEntry[]> {
  const apiKey = process.env.PANDASCORE_API_KEY
  if (!apiKey) return []

  const team = await findPandaTeam(teamName, game)
  if (!team) return []

  const res = await fetch(
    `https://api.pandascore.co/teams/${team.id}/matches?per_page=${limit * 2}&sort=-scheduled_at&filter[status]=finished`,
    { headers: { accept: 'application/json', authorization: `Bearer ${apiKey}` } }
  )
  if (!res.ok) return []

  const matches = (await res.json()) as Array<{
    opponents: Array<{ opponent: { id: number; name: string } }>
    results?: Array<{ team_id: number; score: number }>
    scheduled_at?: string
    end_at?: string | null
    winner_id?: number | null
    draw?: boolean
    serie?: { full_name?: string }
    league?: { name?: string }
  }>

  const out: RecentMatchEntry[] = []
  for (const m of matches) {
    const ops = m.opponents ?? []
    if (ops.length < 2) continue
    const opp = ops.find(o => o.opponent?.id !== team.id)
    if (!opp) continue

    const selfScore = m.results?.find(r => r.team_id === team.id)?.score ?? 0
    const oppScore = m.results?.find(r => r.team_id !== team.id)?.score ?? 0
    const result: 'win' | 'loss' | 'draw' = m.draw
      ? 'draw'
      : m.winner_id === team.id
        ? 'win'
        : m.winner_id == null
          ? 'draw'
          : 'loss'
    out.push({
      opponent_name: opp.opponent?.name ?? 'Unknown',
      result,
      score: `${selfScore}-${oppScore}`,
      match_date: m.end_at || m.scheduled_at || '',
      tournament: m.serie?.full_name || m.league?.name || 'Unknown',
      game,
    })
    if (out.length >= limit) break
  }

  return out
}

// Get live frames for a specific match (for detailed scoreboard)
export async function getLiveFrames(matchId: string, game: GameType): Promise<LiveFrame[]> {
  try {
    const apiKey = process.env.PANDASCORE_API_KEY
    if (!apiKey) return []

    const gameMap: Record<GameType, string> = {
      dota2: 'dota-2',
      lol: 'league-of-legends',
      csgo: 'counter-strike',
      valorant: 'valorant'
    }

    const response = await fetch(
      `https://api.pandascore.co/${gameMap[game]}/matches/${matchId}/streams`,
      {
        headers: {
          'accept': 'application/json',
          'authorization': `Bearer ${apiKey}`
        }
      }
    )

    if (!response.ok) return []

    // Note: PandaScore's detailed frame data requires WebSocket connection
    // This is a placeholder for the REST endpoint structure
    const data = await response.json()
    return data || []
  } catch (error) {
    console.error('Error fetching live frames:', error)
    return []
  }
}

// Create WebSocket connection for real-time updates
export function createLiveConnection(
  matchId: string,
  game: GameType,
  onFrame?: (frame: LiveFrame) => void,
  onEvent?: (event: LiveEvent) => void
) {
  const apiKey = process.env.PANDASCORE_API_KEY
  if (!apiKey) return null

  try {
    // WebSocket URL for PandaScore live data
    const wsUrl = `wss://streams.pandascore.co/csgo?auth_token=${apiKey}`
    const ws = new WebSocket(wsUrl)

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        // Handle frame updates
        if (data.type === 'frame' && onFrame) {
          onFrame(data.payload)
        }
        
        // Handle event updates
        if (data.type === 'event' && onEvent) {
          onEvent(data.payload)
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    return ws
  } catch (error) {
    console.error('Error creating WebSocket:', error)
    return null
  }
}
