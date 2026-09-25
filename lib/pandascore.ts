// PandaScore API Service for esports match data
// Provides live match schedules, tournaments, and results

const PANDASCORE_BASE = 'https://api.pandascore.co'

export type GameType = 'dota2' | 'lol' | 'csgo' | 'valorant'

// PandaScore game slugs used in URL paths (e.g. /dota2/matches/upcoming)
const GAME_SLUG: Record<GameType, string> = {
  dota2: 'dota2',
  lol: 'lol',
  csgo: 'csgo',
  valorant: 'valorant',
}

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
  tier?: string
  prize_pool?: string | number
  region?: string
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
      console.error(`PandaScore API error: ${response.status}`)
      return []
    }

    const data = await response.json()
    return Array.isArray(data) ? data : data.results || []
  } catch (error) {
    console.error('PandaScore fetch error:', error)
    return []
  }
}

// Get upcoming matches for a specific game
export async function getUpcomingMatchesPandaScore(game: GameType, limit = 20) {
  try {
    const matches = await pandascoreRequest(`/${GAME_SLUG[game]}/matches/upcoming`, {
      params: {
        'sort': 'scheduled_at',
        'per_page': limit,
        'page': 1,
      },
    })

    const filtered = Array.isArray(matches) ? matches : []

    if (filtered.length === 0) {
      console.log(`No upcoming matches found for ${game}, using fallback data`)
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
    console.log(`PandaScore matches fetch failed, using fallback`)
    return []
  }
}

// Get running tournaments
export async function getTournamentsPandaScore(game: GameType, status = 'ongoing') {
  try {
    // PandaScore uses begin_at/end_at, and we need enough results to filter client-side
    const tournaments = await pandascoreRequest(`/${GAME_SLUG[game]}/tournaments`, {
      params: {
        'sort': '-begin_at',
        'per_page': 50,
        'page': 1,
      },
    })

    // Filter by status using correct PandaScore field names (begin_at / end_at)
    const now = new Date()
    const filtered = (Array.isArray(tournaments) ? tournaments : []).filter((t: any) => {
      const startDate = new Date(t.begin_at)
      const endDate = t.end_at ? new Date(t.end_at) : null

      if (status === 'upcoming') return startDate > now
      if (status === 'ongoing') return startDate <= now && (!endDate || endDate >= now)
      if (status === 'completed') return endDate && endDate < now
      return true
    })

    if (filtered.length === 0) {
      console.log(`No ${status} tournaments found for ${game}`)
      return []
    }

    // Map tier letters to readable names
    const tierMap: Record<string, string> = {
      s: 'S-Tier', a: 'Tier 1', b: 'Tier 2', c: 'Tier 3', d: 'Tier 4',
    }

    return filtered.map((t: any) => {
      // Build a meaningful name from league + serie + tournament name
      const league = t.league?.name || ''
      const serie = t.serie?.full_name || ''
      const stage = t.name || ''
      // e.g. "The International 2026 - Group Stage"
      const fullName = serie
        ? `${league} ${serie}${stage && stage !== serie ? ` - ${stage}` : ''}`
        : `${league}${stage ? ` - ${stage}` : ''}`

      return {
        id: t.id.toString(),
        name: fullName.trim() || stage,
        tier: tierMap[t.tier] || t.tier || 'Tier 2',
        game,
        startDate: new Date(t.begin_at).toLocaleDateString(),
        endDate: t.end_at ? new Date(t.end_at).toLocaleDateString() : 'TBA',
        prizePool: t.prizepool ? `$${t.prizepool}` : 'TBA',
        status,
        region: t.region || 'International',
      }
    })
  } catch (error) {
    console.log(`PandaScore tournaments fetch failed for ${game}`)
    return []
  }
}

const VIDEOGAME_ID: Record<GameType, number> = {
  dota2: 4,
  lol: 1,
  csgo: 3,
  valorant: 26,
}

// Get team information
export async function getTeamInfo(teamName: string, game: GameType) {
  try {
    const response = await pandascoreRequest('/teams', {
      params: {
        'filter[videogame_id]': VIDEOGAME_ID[game],
        'search[name]': teamName,
        'per_page': 10,
        'page': 1,
      },
    })

    if (!Array.isArray(response) || response.length === 0) {
      console.log(`Team ${teamName} not found in PandaScore`)
      return null
    }

    const team = response.find((t: any) => t.name?.toLowerCase() === teamName.toLowerCase()) || response[0]

    // Pandascore's team payload doesn't carry win_rate; team-record.tsx computes it from match history.
    // location is a 2-letter country code ("RU"), which is the closest thing to "region".
    return {
      name: team.name,
      abbreviation: team.acronym || team.name.substring(0, 3).toUpperCase(),
      region: team.location || 'Unknown',
      image_url: team.image_url,
      win_rate: null,
      id: team.id.toString(),
    }
  } catch (error) {
    console.log(`PandaScore team info fetch failed for ${teamName}`)
    return null
  }
}
