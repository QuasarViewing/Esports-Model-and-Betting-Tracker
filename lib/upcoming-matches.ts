// Seeded upcoming matches for Dota 2 events
// This data is manually maintained and will be replaced with live API calls later

export interface UpcomingMatch {
  id: string
  team1: string
  team2: string
  tournament: string
  date: string
  time: string
  bestOf: number
  tier: string
  status: 'scheduled' | 'live' | 'completed'
}

export const UPCOMING_DOTA2_MATCHES: UpcomingMatch[] = [
  // Group Stage Matches (May 18 - Currently happening)
  {
    id: 'dl29-group-1',
    team1: 'XG',
    team2: 'PTime',
    tournament: 'Dream League Season 29 - Group Stage',
    date: '2026-05-18',
    time: '04:13 UTC',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  {
    id: 'dl29-group-2',
    team1: 'XG/PTime Winner',
    team2: 'Tundra',
    tournament: 'Dream League Season 29 - Group Stage',
    date: '2026-05-18',
    time: '05:18 UTC',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  {
    id: 'dl29-group-3',
    team1: 'XG/PTime Loser',
    team2: 'Tundra',
    tournament: 'Dream League Season 29 - Group Stage',
    date: '2026-05-18',
    time: '06:23 UTC',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  // Upper Bracket Quarterfinals (May 19)
  {
    id: 'dl29-ubqf-1',
    team1: 'Team Falcons',
    team2: 'TBD',
    tournament: 'Dream League Season 29 - Playoffs',
    date: '2026-05-19',
    time: '1d 4h 13m UTC',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  {
    id: 'dl29-ubqf-2',
    team1: 'Team Spirit',
    team2: 'BetBoom Team',
    tournament: 'Dream League Season 29 - Playoffs',
    date: '2026-05-19',
    time: '1d 7h 43m UTC',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  {
    id: 'dl29-ubqf-3',
    team1: 'PARIVISION',
    team2: 'Team Liquid',
    tournament: 'Dream League Season 29 - Playoffs',
    date: '2026-05-19',
    time: 'May 19',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  {
    id: 'dl29-ubqf-4',
    team1: 'Natus Vincere',
    team2: 'Aurora Gaming',
    tournament: 'Dream League Season 29 - Playoffs',
    date: '2026-05-19',
    time: 'May 19',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  // Upper Bracket Semifinals (May 20-21)
  {
    id: 'dl29-ubsf-1',
    team1: 'TBD',
    team2: 'TBD',
    tournament: 'Dream League Season 29 - Playoffs',
    date: '2026-05-20',
    time: 'TBD',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  {
    id: 'dl29-ubsf-2',
    team1: 'TBD',
    team2: 'TBD',
    tournament: 'Dream League Season 29 - Playoffs',
    date: '2026-05-20',
    time: 'TBD',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  // Upper Bracket Final (May 22-23)
  {
    id: 'dl29-ubf',
    team1: 'TBD',
    team2: 'TBD',
    tournament: 'Dream League Season 29 - Playoffs',
    date: '2026-05-22',
    time: 'TBD',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  // Grand Final (May 24)
  {
    id: 'dl29-gf',
    team1: 'TBD',
    team2: 'TBD',
    tournament: 'Dream League Season 29 - Grand Final',
    date: '2026-05-24',
    time: 'TBD',
    bestOf: 5,
    tier: 'tier-1',
    status: 'scheduled'
  },
]

export const UPCOMING_TOURNAMENTS = [
  {
    id: 'dl29',
    name: 'Dream League Season 29',
    tier: 'Tier 1',
    game: 'dota2',
    startDate: '2026-05-13',
    endDate: '2026-05-24',
    prizePool: '$1,000,000',
    status: 'ongoing',
    region: 'International'
  },
]

export function getUpcomingMatches(game: 'dota2' | 'lol' | 'csgo' | 'valorant' = 'dota2') {
  if (game === 'dota2') {
    return UPCOMING_DOTA2_MATCHES
  }
  // Return empty array for other games until we have data
  return []
}

export function getTournaments(game: 'dota2' | 'lol' | 'csgo' | 'valorant' = 'dota2') {
  if (game === 'dota2') {
    return UPCOMING_TOURNAMENTS
  }
  return []
}
