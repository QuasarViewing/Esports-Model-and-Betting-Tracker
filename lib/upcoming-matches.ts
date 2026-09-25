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
  stream?: string
  game?: string
}

export interface UpcomingTournament {
  id: string
  name: string
  tier: string
  game: string
  startDate: string
  endDate: string
  prizePool: string
  status: 'upcoming' | 'ongoing' | 'completed'
  region: string
  location?: string
  liquipediaUrl?: string
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

export const UPCOMING_TOURNAMENTS: UpcomingTournament[] = [
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

// League of Legends Matches
export const UPCOMING_LOL_MATCHES: UpcomingMatch[] = [
  {
    id: 'lec-1',
    team1: 'G2 Esports',
    team2: 'Fnatic',
    tournament: 'LEC Summer 2026',
    date: '2026-05-18',
    time: '17:00 UTC',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  {
    id: 'lec-2',
    team1: 'MAD Lions',
    team2: 'Rogue',
    tournament: 'LEC Summer 2026',
    date: '2026-05-19',
    time: '17:00 UTC',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  {
    id: 'lec-3',
    team1: 'Excel Esports',
    team2: 'SK Gaming',
    tournament: 'LEC Summer 2026',
    date: '2026-05-19',
    time: '19:00 UTC',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
]

// Counter-Strike 2 Matches
export const UPCOMING_CS2_MATCHES: UpcomingMatch[] = [
  {
    id: 'cs2-1',
    team1: 'Vitality',
    team2: 'FaZe Clan',
    tournament: 'ESL Pro League Season 20',
    date: '2026-05-18',
    time: '18:00 UTC',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  {
    id: 'cs2-2',
    team1: 'Natus Vincere',
    team2: 'G2 Esports',
    tournament: 'ESL Pro League Season 20',
    date: '2026-05-19',
    time: '16:00 UTC',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  {
    id: 'cs2-3',
    team1: 'Liquid',
    team2: 'ENCE',
    tournament: 'ESL Pro League Season 20',
    date: '2026-05-19',
    time: '18:00 UTC',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
]

// Valorant Matches
export const UPCOMING_VALORANT_MATCHES: UpcomingMatch[] = [
  {
    id: 'val-1',
    team1: 'FaZe Clan',
    team2: 'Sentinels',
    tournament: 'VCT International 2026',
    date: '2026-05-18',
    time: '20:00 UTC',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  {
    id: 'val-2',
    team1: 'Gen.G',
    team2: 'LOUD',
    tournament: 'VCT International 2026',
    date: '2026-05-19',
    time: '19:00 UTC',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  {
    id: 'val-3',
    team1: 'Team Liquid',
    team2: 'Paper Rex',
    tournament: 'VCT International 2026',
    date: '2026-05-19',
    time: '21:00 UTC',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
]

export function getUpcomingMatches(game: 'dota2' | 'lol' | 'csgo' | 'valorant' = 'dota2') {
  switch (game) {
    case 'dota2':
      return UPCOMING_DOTA2_MATCHES
    case 'lol':
      return UPCOMING_LOL_MATCHES
    case 'csgo':
      return UPCOMING_CS2_MATCHES
    case 'valorant':
      return UPCOMING_VALORANT_MATCHES
    default:
      return []
  }
}

export function getTournaments(game: 'dota2' | 'lol' | 'csgo' | 'valorant' = 'dota2') {
  if (game === 'dota2') {
    return UPCOMING_TOURNAMENTS
  }
  // Add tournament data for other games as needed
  return []
}
