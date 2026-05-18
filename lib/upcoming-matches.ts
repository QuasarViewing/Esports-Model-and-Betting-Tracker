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
  // Dream League Season 29 - Upper Bracket Quarterfinals (May 19)
  {
    id: 'dl29-ubqf-1',
    team1: 'Team Falcons',
    team2: 'Natus Vincere',
    tournament: 'Dream League Season 29 - Playoffs',
    date: '2026-05-19',
    time: '10:00 UTC',
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
    time: '13:30 UTC',
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
    time: '13:30 UTC',
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
    time: '17:00 UTC',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  // Lower Bracket Round 1 (May 20)
  {
    id: 'dl29-lbr1-1',
    team1: 'Virtus.pro',
    team2: 'Vici Gaming',
    tournament: 'Dream League Season 29 - Playoffs',
    date: '2026-05-20',
    time: '10:00 UTC',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  {
    id: 'dl29-lbr1-2',
    team1: 'GamerLegion',
    team2: 'ex-HEROIC',
    tournament: 'Dream League Season 29 - Playoffs',
    date: '2026-05-20',
    time: '13:30 UTC',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  // Upper Bracket Semifinals (May 21)
  {
    id: 'dl29-ubsf-1',
    team1: 'TBD',
    team2: 'TBD',
    tournament: 'Dream League Season 29 - Playoffs',
    date: '2026-05-21',
    time: '13:30 UTC',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  {
    id: 'dl29-ubsf-2',
    team1: 'TBD',
    team2: 'TBD',
    tournament: 'Dream League Season 29 - Playoffs',
    date: '2026-05-21',
    time: '17:00 UTC',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  // Upper Bracket Final (May 23)
  {
    id: 'dl29-ubf',
    team1: 'TBD',
    team2: 'TBD',
    tournament: 'Dream League Season 29 - Playoffs',
    date: '2026-05-23',
    time: '13:30 UTC',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  // Grand Final (May 24)
  {
    id: 'dl29-gf',
    team1: 'TBD',
    team2: 'TBD',
    tournament: 'Dream League Season 29 - Playoffs',
    date: '2026-05-24',
    time: '14:00 UTC',
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
