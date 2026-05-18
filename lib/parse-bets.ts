export interface ParsedBet {
  id: string
  type: 'win' | 'loss' | 'stake' | 'withdraw' | 'deposit' | 'cashed_out' | 'pending'
  date: Date
  dateString: string
  timeString: string
  match: string
  selection: string
  eventDate: string
  odds: number
  stake: number
  profitLoss: number
  balance: number
  game: 'dota2' | 'lol' | 'csgo' | 'valorant' | 'other'
  tournament: string
  isLive: boolean
  betType: 'winner' | 'game_winner' | 'handicap' | 'over_under' | 'other'
}

export interface BettingStats {
  totalBets: number
  totalWins: number
  totalLosses: number
  winRate: number
  totalStaked: number
  totalProfit: number
  roi: number
  averageOdds: number
  averageStake: number
  biggestWin: number
  biggestLoss: number
  currentStreak: { type: 'win' | 'loss'; count: number }
  profitByGame: Record<string, number>
  profitByDay: { date: string; profit: number; cumulative: number }[]
  impliedProbabilityVsActual: number
}

const DOTA_TEAMS = [
  'Tundra', 'Natus Vincere', 'Na\'Vi', 'Team Liquid', 'Team Spirit', 'Team Falcons',
  'Xtreme Gaming', 'BetBoom', 'PARIVISION', 'PlayTime', 'GamerLegion', 'Aurora',
  'Virtus.pro', 'VP', 'Cloud9', 'Vici Gaming', 'FURIA', 'ex-HEROIC', 'REKONIX'
]

const LOL_TEAMS = [
  'T1', 'Gen.G', 'DRX', 'KT Rolster', 'Hanwha Life', 'HLE', 'LOUD', '100 Thieves',
  'Shopify Rebellion', 'Disguised', 'MIBR'
]

const CSGO_TEAMS = [
  'Navi', 'FaZe', 'G2', 'Vitality', 'Astralis', 'ENCE', 'Heroic', 'Cloud9'
]

function detectGame(match: string, selection: string): 'dota2' | 'lol' | 'csgo' | 'valorant' | 'other' {
  const text = `${match} ${selection}`.toLowerCase()
  
  for (const team of DOTA_TEAMS) {
    if (text.toLowerCase().includes(team.toLowerCase())) return 'dota2'
  }
  
  for (const team of LOL_TEAMS) {
    if (text.toLowerCase().includes(team.toLowerCase())) return 'lol'
  }
  
  for (const team of CSGO_TEAMS) {
    if (text.toLowerCase().includes(team.toLowerCase())) return 'csgo'
  }
  
  if (text.includes('valorant')) return 'valorant'
  
  return 'dota2' // Default to dota2 since that's what the user plays
}

function detectTournament(match: string): string {
  if (match.toLowerCase().includes('dreamleague')) return 'DreamLeague Season 29'
  if (match.toLowerCase().includes('lck')) return 'LCK'
  if (match.toLowerCase().includes('lpl')) return 'LPL'
  if (match.toLowerCase().includes('lcs')) return 'LCS'
  return 'DreamLeague Season 29' // Default tournament
}

function detectBetType(selection: string): 'winner' | 'game_winner' | 'handicap' | 'over_under' | 'other' {
  const lower = selection.toLowerCase()
  if (lower.includes('handicap') || lower.includes('+') || lower.includes('-')) return 'handicap'
  if (lower.includes('over') || lower.includes('under')) return 'over_under'
  if (lower.includes('game') && lower.includes('winner')) return 'game_winner'
  if (lower.includes('winner')) return 'winner'
  return 'other'
}

export function parseBettingData(rawText: string): ParsedBet[] {
  const lines = rawText.trim().split('\n')
  const bets: ParsedBet[] = []
  
  let i = 0
  while (i < lines.length) {
    const typeLine = lines[i]?.trim().toLowerCase()
    
    if (!typeLine) {
      i++
      continue
    }
    
    // Detect transaction type
    let type: ParsedBet['type'] | null = null
    if (typeLine === 'win') type = 'win'
    else if (typeLine === 'loss') type = 'loss'
    else if (typeLine === 'stake') type = 'stake'
    else if (typeLine === 'withdraw') type = 'withdraw'
    else if (typeLine === 'deposit') type = 'deposit'
    else if (typeLine === 'cashed out') type = 'cashed_out'
    else if (typeLine === 'pending') type = 'pending'
    
    if (!type) {
      i++
      continue
    }
    
    // Parse the data based on type
    if (type === 'withdraw' || type === 'deposit') {
      // Format: type, date, "Withdrawal/Deposit", status, -, amount, balance change, balance
      const dateStr = lines[i + 1]?.trim() || ''
      const amount = parseFloat(lines[i + 5]?.replace(/[^0-9.-]/g, '') || '0')
      const balanceChange = parseFloat(lines[i + 6]?.replace(/[^0-9.-]/g, '') || '0')
      const balance = parseFloat(lines[i + 7]?.replace(/[^0-9.-]/g, '') || '0')
      
      const [datePart, timePart] = dateStr.split(/(?=\d{1,2}:\d{2}(?:AM|PM))/i)
      
      bets.push({
        id: `${type}-${dateStr}-${i}`,
        type,
        date: parseDate(dateStr),
        dateString: datePart?.trim() || dateStr,
        timeString: timePart?.trim() || '',
        match: type === 'withdraw' ? 'Withdrawal' : 'Deposit',
        selection: '',
        eventDate: '',
        odds: 0,
        stake: Math.abs(amount),
        profitLoss: balanceChange,
        balance,
        game: 'other',
        tournament: '',
        isLive: false,
        betType: 'other'
      })
      
      i += 8
    } else {
      // Bet format: type, date, match, selection, eventDate, odds, stake, profit, balance
      const dateStr = lines[i + 1]?.trim() || ''
      const match = lines[i + 2]?.trim() || ''
      const selection = lines[i + 3]?.trim() || ''
      const eventDate = lines[i + 4]?.trim() || ''
      const odds = parseFloat(lines[i + 5]?.trim() || '0')
      const stake = parseFloat(lines[i + 6]?.replace(/[^0-9.-]/g, '') || '0')
      const profitLoss = parseFloat(lines[i + 7]?.replace(/[^0-9.-]/g, '') || '0')
      const balance = parseFloat(lines[i + 8]?.replace(/[^0-9.-]/g, '') || '0')
      
      const [datePart, timePart] = dateStr.split(/(?=\d{1,2}:\d{2}(?:AM|PM))/i)
      
      if (match && odds > 0) {
        bets.push({
          id: `${type}-${dateStr}-${match}-${i}`,
          type,
          date: parseDate(dateStr),
          dateString: datePart?.trim() || dateStr,
          timeString: timePart?.trim() || '',
          match,
          selection,
          eventDate,
          odds,
          stake: Math.abs(stake),
          profitLoss,
          balance,
          game: detectGame(match, selection),
          tournament: detectTournament(match),
          isLive: match.toLowerCase().includes('live'),
          betType: detectBetType(selection)
        })
      }
      
      i += 9
    }
  }
  
  return bets.reverse() // Return in chronological order
}

function parseDate(dateStr: string): Date {
  // Format: "18/05/262:03PM" -> parse to Date
  const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2})(\d{1,2}):(\d{2})(AM|PM)/i)
  if (match) {
    let [, day, month, year, hours, minutes, period] = match
    let h = parseInt(hours)
    if (period.toUpperCase() === 'PM' && h !== 12) h += 12
    if (period.toUpperCase() === 'AM' && h === 12) h = 0
    return new Date(2000 + parseInt(year), parseInt(month) - 1, parseInt(day), h, parseInt(minutes))
  }
  return new Date()
}

export function calculateStats(bets: ParsedBet[]): BettingStats {
  const settledBets = bets.filter(b => b.type === 'win' || b.type === 'loss' || b.type === 'cashed_out')
  const wins = settledBets.filter(b => b.type === 'win' || (b.type === 'cashed_out' && b.profitLoss > 0))
  const losses = settledBets.filter(b => b.type === 'loss')
  
  const totalStaked = settledBets.reduce((sum, b) => sum + b.stake, 0)
  const totalProfit = settledBets.reduce((sum, b) => {
    if (b.type === 'win') return sum + (b.profitLoss - b.stake)
    if (b.type === 'cashed_out') return sum + b.profitLoss
    if (b.type === 'loss') return sum - b.stake
    return sum
  }, 0)
  
  const avgOdds = settledBets.length > 0
    ? settledBets.reduce((sum, b) => sum + b.odds, 0) / settledBets.length
    : 0
  
  // Calculate profit by game
  const profitByGame: Record<string, number> = {}
  settledBets.forEach(b => {
    if (!profitByGame[b.game]) profitByGame[b.game] = 0
    if (b.type === 'win') profitByGame[b.game] += (b.profitLoss - b.stake)
    else if (b.type === 'loss') profitByGame[b.game] -= b.stake
    else if (b.type === 'cashed_out') profitByGame[b.game] += b.profitLoss
  })
  
  // Calculate profit by day
  const profitByDayMap = new Map<string, number>()
  settledBets.forEach(b => {
    const day = b.dateString.split(/\d{1,2}:\d{2}/)[0]?.trim() || b.dateString
    if (!profitByDayMap.has(day)) profitByDayMap.set(day, 0)
    if (b.type === 'win') profitByDayMap.set(day, profitByDayMap.get(day)! + (b.profitLoss - b.stake))
    else if (b.type === 'loss') profitByDayMap.set(day, profitByDayMap.get(day)! - b.stake)
    else if (b.type === 'cashed_out') profitByDayMap.set(day, profitByDayMap.get(day)! + b.profitLoss)
  })
  
  let cumulative = 0
  const profitByDay = Array.from(profitByDayMap.entries()).map(([date, profit]) => {
    cumulative += profit
    return { date, profit, cumulative }
  })
  
  // Current streak
  let streakType: 'win' | 'loss' = 'win'
  let streakCount = 0
  for (let i = settledBets.length - 1; i >= 0; i--) {
    const bet = settledBets[i]
    const isWin = bet.type === 'win' || (bet.type === 'cashed_out' && bet.profitLoss > 0)
    if (i === settledBets.length - 1) {
      streakType = isWin ? 'win' : 'loss'
      streakCount = 1
    } else if ((isWin && streakType === 'win') || (!isWin && streakType === 'loss')) {
      streakCount++
    } else {
      break
    }
  }
  
  // Biggest win/loss
  const biggestWin = Math.max(...wins.map(b => b.type === 'win' ? b.profitLoss - b.stake : b.profitLoss), 0)
  const biggestLoss = Math.max(...losses.map(b => b.stake), 0)
  
  // Implied probability vs actual
  const impliedProb = settledBets.length > 0
    ? settledBets.reduce((sum, b) => sum + (1 / b.odds), 0) / settledBets.length
    : 0
  const actualWinRate = settledBets.length > 0 ? wins.length / settledBets.length : 0
  
  return {
    totalBets: settledBets.length,
    totalWins: wins.length,
    totalLosses: losses.length,
    winRate: settledBets.length > 0 ? (wins.length / settledBets.length) * 100 : 0,
    totalStaked,
    totalProfit,
    roi: totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0,
    averageOdds: avgOdds,
    averageStake: settledBets.length > 0 ? totalStaked / settledBets.length : 0,
    biggestWin,
    biggestLoss,
    currentStreak: { type: streakType, count: streakCount },
    profitByGame,
    profitByDay,
    impliedProbabilityVsActual: actualWinRate - impliedProb
  }
}
