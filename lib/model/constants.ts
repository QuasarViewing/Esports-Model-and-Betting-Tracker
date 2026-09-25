export const DEFAULT_ELO = 1500
export const K_FACTOR_NEW = 40
export const K_FACTOR_ESTABLISHED = 24
export const K_FACTOR_THRESHOLD = 30
export const ELO_DIVISOR = 400

export const CURRENT_PATCH = '7.40b'

export const PATCH_RELEASE_DATES: Record<string, string> = {
  '7.36':  '2024-09-17',
  '7.36c': '2024-10-04',
  '7.37':  '2024-12-19',
  '7.37d': '2025-01-16',
  '7.37e': '2025-02-06',
  '7.38':  '2025-03-06',
  '7.39':  '2025-04-23',
  '7.40':  '2025-06-18',
  '7.40b': '2025-07-09',
}

// OpenDota team IDs for TI 2026 participants.
export const TI_2026_TEAMS: Record<string, number> = {
  'Team Spirit': 7119388,
  'TEAM VISION': 9572001,
  'Team Yandex': 9823272,
  'Team Liquid': 2163,
  'Team Falcons': 9247354,
  'LGD Gaming': 10150538,
  'Natus Vincere': 36,
  'OG': 2586976,
  'Nigma Galaxy': 10136357,
  'GamerLegion': 9964962,
  'HULIGANI': 10149530,
  'Vici Gaming': 726228,
  'Iron Wing': 10150413,
  'BoomBoys': 8255888,
  'Team Resilience': 5017210,
}

export const TEAM_ALIASES: Record<number, number> = {
  8291895: 10150413,   // Tundra Esports → Iron Wing
  10182357: 10150413,  // 1win/1w → Iron Wing
  9131584: 8255888,    // BB Team (BetBoom) → BoomBoys
}
