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
      console.error('[v0] PANDASCORE_API_KEY not set')
      return []
    }

    // PandaScore uses game-specific endpoints with /running for live matches
    const gameSlugMap: Record<GameType, string> = {
      dota2: 'dota2',
      lol: 'lol',
      csgo: 'csgo',
      valorant: 'valorant'
    }

    // Use game-specific running matches endpoint
    const url = `https://api.pandascore.co/${gameSlugMap[game]}/matches/running?per_page=20`
    console.log('[v0] Fetching live matches from:', url)

    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'authorization': `Bearer ${apiKey}`
      }
    })

    console.log('[v0] PandaScore response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[v0] PandaScore live matches error:', response.status, errorText)
      return []
    }

    const data = await response.json()
    console.log('[v0] PandaScore returned matches:', data?.length || 0)
    
    return (data || []).map((match: any) => ({
      id: match.id,
      team1: match.opponents?.[0]?.opponent?.name || 'TBD',
      team2: match.opponents?.[1]?.opponent?.name || 'TBD',
      score1: match.opponents?.[0]?.score || 0,
      score2: match.opponents?.[1]?.score || 0,
      status: 'live',
      tournament: match.serie?.full_name || match.league?.name || 'Unknown',
      game,
      livestreams: match.livestreams || []
    }))
  } catch (error) {
    console.error('[v0] Error fetching live matches:', error)
    return []
  }
}

// Get team records/stats
export async function getTeamRecord(teamName: string, game: GameType): Promise<TeamRecord | null> {
  try {
    const apiKey = process.env.PANDASCORE_API_KEY
    if (!apiKey) {
      console.error('[v0] PANDASCORE_API_KEY not set')
      return null
    }

    const gameMap: Record<GameType, string> = {
      dota2: 'dota-2',
      lol: 'league-of-legends',
      csgo: 'counter-strike',
      valorant: 'valorant'
    }

    // Search for team
    const searchResponse = await fetch(
      `https://api.pandascore.co/${gameMap[game]}/teams?filter[name]=${encodeURIComponent(teamName)}&per_page=1`,
      {
        headers: {
          'accept': 'application/json',
          'authorization': `Bearer ${apiKey}`
        }
      }
    )

    if (!searchResponse.ok) return null

    const teams = await searchResponse.json()
    if (!teams || teams.length === 0) return null

    const team = teams[0]
    const teamId = team.id

    // Get team matches
    const matchesResponse = await fetch(
      `https://api.pandascore.co/${gameMap[game]}/teams/${teamId}/matches?per_page=20&sort=-scheduled_at`,
      {
        headers: {
          'accept': 'application/json',
          'authorization': `Bearer ${apiKey}`
        }
      }
    )

    if (!matchesResponse.ok) {
      return {
        teamId: team.id,
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
      const isTeam1 = match.opponents?.[0]?.opponent?.id === teamId
      const score1 = match.opponents?.[0]?.score || 0
      const score2 = match.opponents?.[1]?.score || 0
      const opponent = isTeam1 ? match.opponents?.[1]?.opponent?.name : match.opponents?.[0]?.opponent?.name
      
      let result: 'win' | 'loss' | 'draw' = 'draw'
      if (isTeam1) {
        if (score1 > score2) {
          result = 'win'
          wins++
        } else if (score1 < score2) {
          result = 'loss'
          losses++
        } else {
          draws++
        }
      } else {
        if (score2 > score1) {
          result = 'win'
          wins++
        } else if (score2 < score1) {
          result = 'loss'
          losses++
        } else {
          draws++
        }
      }

      recentMatches.push({
        opponent: opponent || 'Unknown',
        result,
        date: match.scheduled_at || new Date().toISOString(),
        tournament: match.serie?.full_name || 'Unknown'
      })
    }

    const totalMatches = wins + losses + draws
    const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0

    return {
      teamId,
      teamName: team.name,
      wins,
      losses,
      draws,
      winRate,
      recentMatches
    }
  } catch (error) {
    console.error('[v0] Error fetching team record:', error)
    return null
  }
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
    console.error('[v0] Error fetching live frames:', error)
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
        console.error('[v0] Error parsing WebSocket message:', e)
      }
    }

    ws.onerror = (error) => {
      console.error('[v0] WebSocket error:', error)
    }

    return ws
  } catch (error) {
    console.error('[v0] Error creating WebSocket:', error)
    return null
  }
}
