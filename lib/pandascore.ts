// PandaScore API Service for esports match data
// Provides live match schedules, tournaments, and results

const PANDASCORE_BASE = 'https://api.pandascore.co'

export interface PandaScoreMatch {
  id: number
  name: string
  scheduled_at: string
  status: string
  videogame: {
    name: string
  }
  league: {
    name: string
  }
  opponents: Array<{
    opponent: {
      name: string
      image_url: string
    }
    score: number | null
  }>
}

export interface PandaScoreTournament {
  id: number
  name: string
  start_date: string
  end_date: string
  slug: string
  videogame: {
    name: string
  }
}

interface FetchOptions {
  params?: Record<string, string | number>
}

async function pandascoreRequest(path: string, options: FetchOptions = {}) {
  const url = new URL(`${PANDASCORE_BASE}${path}`)
  
  // Add custom params
  if (options.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value))
    })
  }

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${process.env.PANDASCORE_API_KEY || ''}`
      },
    })

    if (!response.ok) {
      console.error(`[v0] PandaScore API error: ${response.status}`)
      return []
    }

    const data = await response.json()
    return Array.isArray(data) ? data : data.results || []
  } catch (error) {
    console.error('[v0] PandaScore fetch error:', error)
    return []
  }
}

// Get upcoming matches for a specific game
export async function getUpcomingMatchesPandaScore(game: 'dota2' | 'lol' | 'csgo' | 'valorant', limit = 20) {
  const gameMap = {
    dota2: 'dota-2',
    lol: 'league-of-legends',
    csgo: 'counter-strike-2',
    valorant: 'valorant'
  }

  const gameName = gameMap[game]
  
  try {
    const matches = await pandascoreRequest('/matches', {
      params: {
        'filter[status]': 'upcoming',
        'sort': '-scheduled_at',
        'per_page': limit,
        'page': 1
      }
    })

    // Filter by game if response includes multiple games
    const filtered = Array.isArray(matches) 
      ? matches.filter((m: any) => m.videogame?.name?.toLowerCase().includes(gameName))
      : []

    if (filtered.length === 0) {
      console.log(`[v0] No upcoming matches found for ${game}, using fallback data`)
      return []
    }

    return filtered.map((match: PandaScoreMatch) => ({
      id: match.id.toString(),
      team1: match.opponents?.[0]?.opponent?.name || 'TBD',
      team2: match.opponents?.[1]?.opponent?.name || 'TBD',
      tournament: match.league?.name || 'Unknown',
      date: new Date(match.scheduled_at).toLocaleDateString(),
      time: new Date(match.scheduled_at).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'UTC',
        hour12: false
      }) + ' UTC',
      bestOf: 3,
      tier: 'tier-1',
      status: match.status
    }))
  } catch (error) {
    console.log(`[v0] PandaScore matches fetch failed, using fallback`)
    return []
  }
}

// Get running tournaments
export async function getTournamentsPandaScore(game: 'dota2' | 'lol' | 'csgo' | 'valorant', status = 'ongoing') {
  try {
    const tournaments = await pandascoreRequest('/tournaments', {
      params: {
        'sort': '-start_date',
        'per_page': 10,
        'page': 1
      }
    })

    // Filter by game and status
    const now = new Date()
    const filtered = (Array.isArray(tournaments) ? tournaments : []).filter((t: any) => {
      const startDate = new Date(t.start_date)
      const endDate = new Date(t.end_date)
      
      if (status === 'upcoming') return startDate > now
      if (status === 'ongoing') return startDate <= now && endDate >= now
      if (status === 'completed') return endDate < now
      return true
    })

    if (filtered.length === 0) {
      console.log(`[v0] No ${status} tournaments found`)
      return []
    }

    return filtered.map((t: PandaScoreTournament) => ({
      id: t.id.toString(),
      name: t.name,
      tier: t.tier || 'Tier 2',
      game: 'dota2',
      startDate: new Date(t.start_date).toLocaleDateString(),
      endDate: new Date(t.end_date).toLocaleDateString(),
      prizePool: t.prize_pool ? `$${t.prize_pool.toLocaleString()}` : 'TBA',
      status: status,
      region: t.region || 'International'
    }))
  } catch (error) {
    console.log(`[v0] PandaScore tournaments fetch failed`)
    return []
  }
}

// Get team information
export async function getTeamInfo(teamName: string, game: 'dota2' | 'lol' | 'csgo' | 'valorant') {
  try {
    const gameMap: Record<string, string> = {
      dota2: 'dota-2',
      lol: 'league-of-legends',
      csgo: 'counter-strike-2',
      valorant: 'valorant'
    }

    const response = await pandascoreRequest('/teams', {
      params: {
        'search[name]': teamName,
        'per_page': 10,
        'page': 1
      }
    })

    if (!Array.isArray(response) || response.length === 0) {
      console.log(`[v0] Team ${teamName} not found in PandaScore`)
      return null
    }

    // Find exact match or closest match
    const team = response.find((t: any) => t.name.toLowerCase() === teamName.toLowerCase()) || response[0]

    return {
      name: team.name,
      abbreviation: team.acronym || team.name.substring(0, 3).toUpperCase(),
      region: team.region || 'International',
      image_url: team.image_url,
      win_rate: team.win_rate || 0,
      id: team.id.toString()
    }
  } catch (error) {
    console.log(`[v0] PandaScore team info fetch failed for ${teamName}`)
    return null
  }
}
