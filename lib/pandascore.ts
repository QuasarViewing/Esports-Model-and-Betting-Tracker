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
  
  // Add API token
  url.searchParams.set('token', process.env.PANDASCORE_API_KEY || '')
  
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
    csgo: 'counter-strike',
    valorant: 'valorant'
  }

  const gameName = gameMap[game]
  
  const matches = await pandascoreRequest('/matches', {
    params: {
      'filter[videogame_title]': gameName,
      'filter[status]': 'upcoming',
      'sort': 'scheduled_at',
      'page[size]': limit
    }
  })

  return matches.map((match: PandaScoreMatch) => ({
    id: match.id.toString(),
    team1: match.opponents[0]?.opponent?.name || 'TBD',
    team2: match.opponents[1]?.opponent?.name || 'TBD',
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
}

// Get running tournaments
export async function getTournamentsPandaScore(game: 'dota2' | 'lol' | 'csgo' | 'valorant', status = 'ongoing') {
  const gameMap = {
    dota2: 'dota-2',
    lol: 'league-of-legends',
    csgo: 'counter-strike',
    valorant: 'valorant'
  }

  const gameName = gameMap[game]
  
  const tournaments = await pandascoreRequest('/tournaments', {
    params: {
      'filter[videogame_title]': gameName,
      'sort': 'start_date',
      'page[size]': 10
    }
  })

  // Filter by status (upcoming, ongoing, completed)
  const now = new Date()
  const filtered = tournaments.filter((t: PandaScoreTournament) => {
    const startDate = new Date(t.start_date)
    const endDate = new Date(t.end_date)
    
    if (status === 'upcoming') return startDate > now
    if (status === 'ongoing') return startDate <= now && endDate >= now
    if (status === 'completed') return endDate < now
    return true
  })

  return filtered.map((t: PandaScoreTournament) => ({
    id: t.id.toString(),
    name: t.name,
    tier: 'Tier 1',
    game,
    startDate: t.start_date,
    endDate: t.end_date,
    prizePool: 'TBD',
    status: new Date(t.start_date) > now ? 'upcoming' : 'ongoing',
    region: 'International'
  }))
}
