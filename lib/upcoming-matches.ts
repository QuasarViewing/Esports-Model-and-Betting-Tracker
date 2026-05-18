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
  // Dream League Season 29
  {
    id: 'dl29-1',
    team1: 'Liquid',
    team2: 'Tundra',
    tournament: 'Dream League Season 29',
    date: '2026-05-18',
    time: '14:00 UTC',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  {
    id: 'dl29-2',
    team1: 'Team Spirit',
    team2: 'OG',
    tournament: 'Dream League Season 29',
    date: '2026-05-18',
    time: '17:00 UTC',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  {
    id: 'dl29-3',
    team1: 'Entity',
    team2: 'Gaimin Gladiators',
    tournament: 'Dream League Season 29',
    date: '2026-05-18',
    time: '20:00 UTC',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  {
    id: 'dl29-4',
    team1: 'PARIVISION',
    team2: 'Xtreme Gaming',
    tournament: 'Dream League Season 29',
    date: '2026-05-19',
    time: '09:00 UTC',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  {
    id: 'dl29-5',
    team1: 'Fnatic',
    team2: 'Blacklist',
    tournament: 'Dream League Season 29',
    date: '2026-05-19',
    time: '12:00 UTC',
    bestOf: 3,
    tier: 'tier-2',
    status: 'scheduled'
  },
  // TI Qualifiers EU
  {
    id: 'tiqu-eu-1',
    team1: 'Team Liquid',
    team2: 'Alliance',
    tournament: 'The International 2026 Qualifier EU',
    date: '2026-05-20',
    time: '15:00 UTC',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  {
    id: 'tiqu-eu-2',
    team1: 'OG',
    team2: 'Team Secret',
    tournament: 'The International 2026 Qualifier EU',
    date: '2026-05-20',
    time: '18:00 UTC',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  // TI Qualifiers CN
  {
    id: 'tiqu-cn-1',
    team1: 'Xtreme Gaming',
    team2: 'Vici Gaming',
    tournament: 'The International 2026 Qualifier CN',
    date: '2026-05-19',
    time: '11:00 UTC',
    bestOf: 3,
    tier: 'tier-1',
    status: 'scheduled'
  },
  {
    id: 'tiqu-cn-2',
    team1: 'PARIVISION',
    team2: 'Ehome',
    tournament: 'The International 2026 Qualifier CN',
    date: '2026-05-21',
    time: '10:00 UTC',
    bestOf: 3,
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
    startDate: '2026-05-18',
    endDate: '2026-05-26',
    prizePool: '$500,000',
    status: 'ongoing',
    region: 'International'
  },
  {
    id: 'tiqu2026',
    name: 'The International 2026 Qualifiers',
    tier: 'Tier 1',
    game: 'dota2',
    startDate: '2026-05-18',
    endDate: '2026-05-25',
    prizePool: 'TBA',
    status: 'ongoing',
    region: 'Multiple'
  },
  {
    id: 'lima',
    name: 'Lima Major 2026',
    tier: 'Tier 1',
    game: 'dota2',
    startDate: '2026-06-05',
    endDate: '2026-06-15',
    prizePool: '$1,000,000',
    status: 'upcoming',
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
