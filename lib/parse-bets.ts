import crypto from 'crypto'

export interface ParsedBet {
  id: string
  hash: string
  type: 'win' | 'loss' | 'pending' | 'cashed_out'
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
  // Vig/Edge metrics
  impliedProbability: number      // 1/odds as percentage
  estimatedOpponentOdds: number   // Calculated using sport-specific vig
  breakEvenWinRate: number        // Win rate needed to break even
  noVigProbability: number        // Fair probability without bookmaker margin
  vigAmount: number               // How much vig affects this bet
  manualOpponentOdds?: number     // User can override
  estimatedEdge?: number          // If user provides their probability estimate
}

export interface ParsedTransaction {
  id: string
  hash: string
  type: 'deposit' | 'withdrawal'
  date: Date
  dateString: string
  timeString: string
  amount: number
  balanceAfter: number
}

export interface ImportResult {
  bets: ParsedBet[]
  transactions: ParsedTransaction[]
  duplicateBets: ParsedBet[]
  duplicateTransactions: ParsedTransaction[]
  newBets: ParsedBet[]
  newTransactions: ParsedTransaction[]
}

export interface BettingStats {
  totalBets: number
  totalWins: number
  totalLosses: number
  pendingBets: number
  winRate: number
  totalStaked: number
  totalProfit: number
  roi: number
  averageOdds: number
  averageStake: number
  biggestWin: number
  biggestLoss: number
  currentStreak: { type: 'win' | 'loss'; count: number }
  profitByGame: Record<string, { profit: number; bets: number; wins: number }>
  profitByDay: { date: string; profit: number; cumulative: number }[]
  impliedProbabilityVsActual: number
  pendingStake: number
}

const DOTA_TEAMS = [
  'Tundra', 'Team Liquid', 'Team Falcons',
  'Xtreme Gaming', 'PARIVISION', 'PlayTime', 'GamerLegion', 'Aurora',
  'Virtus.pro', 'VP', 'Vici Gaming', 'FURIA', 'ex-HEROIC', 'REKONIX',
  'Gaimin Gladiators', '9Pandas', 'OG', 'Quest', 'Entity', 'Nigma',
  // Note: BetBoom, Navi, Spirit, Cloud9 play both Dota and CS - handled separately
]

// Teams that ONLY play Dota (for disambiguation)
const DOTA_ONLY_TEAMS = [
  'Tundra', 'Team Falcons', 'Xtreme Gaming', 'PARIVISION', 'PlayTime', 
  'Aurora', 'Virtus.pro', 'VP', 'REKONIX', 'Gaimin Gladiators', '9Pandas', 
  'OG', 'Quest', 'Entity', 'Nigma', 'ex-HEROIC'
]

// Teams that ONLY play CS (for disambiguation)  
const CSGO_ONLY_TEAMS = [
  'FaZe', 'Astralis', 'ENCE', 'Heroic', 'MOUZ', 'Complexity', 'BIG', 
  'NIP', 'Ninjas in Pyjamas', 'Monte', 'Eternal Fire', 'SAW', 'Imperial', 'paiN'
]

// Multi-game orgs that play both Dota and CS
const DOTA_CS_SHARED = ['Natus Vincere', 'Navi', 'BetBoom', 'Spirit', 'Team Spirit', 
  'Cloud9', 'GamerLegion', 'FURIA', 'Liquid', 'Team Liquid', 'Vitality', 'G2']

const LOL_TEAMS = [
  'T1', 'Gen.G', 'DRX', 'KT Rolster', 'Hanwha Life', 'HLE', 'LOUD', '100 Thieves',
  'Shopify Rebellion', 'Disguised', 'MIBR', 'JDG', 'Weibo', 'Top Esports', 'TES',
  'Bilibili', 'LNG', 'NRG', 'Cloud9', 'FlyQuest', 'Fnatic', 'G2', 'MAD Lions',
  'SK Gaming', 'Rogue', 'Team Vitality'
]

const LOL_REGION_TEAMS: Record<string, string[]> = {
  'LCK': ['T1', 'Gen.G', 'DRX', 'KT Rolster', 'Hanwha Life', 'HLE', 'Dplus', 'Kwangdong Freecs', 'OK BRION', 'Nongshim'],
  'LPL': ['JDG', 'Weibo', 'Top Esports', 'TES', 'Bilibili', 'LNG', 'Royal Never Give Up', 'EDward Gaming'],
  'LEC': ['Fnatic', 'G2', 'MAD Lions', 'SK Gaming', 'Rogue', 'Team Vitality', 'Excel', 'Astralis'],
  'LCS': ['100 Thieves', 'Cloud9', 'FlyQuest', 'NRG', 'Dignitas', 'Immortals', 'Team Liquid']
}

const CSGO_TEAMS = [
  'Navi', 'Natus Vincere', 'FaZe', 'G2 Esports', 'Vitality', 'Astralis', 'ENCE', 
  'Heroic', 'MOUZ', 'Complexity', 'BIG', 'NIP', 'Ninjas in Pyjamas',
  'BetBoom', 'BetBoom Team', 'Spirit', 'Team Spirit', 'Monte', 'GamerLegion',
  'Cloud9', 'Liquid', 'FURIA', 'paiN', 'Imperial', 'Eternal Fire', 'SAW'
]

const VALORANT_TEAMS = [
  'MIBR', 'LOUD', 'Sentinels', 'NRG', '100 Thieves', '100T', 'Cloud9', 'C9',
  'Evil Geniuses', 'EG', 'XSET', 'OpTic', 'The Guard', 'Version1', 'V1',
  'Paper Rex', 'PRX', 'DRX', 'T1', 'Gen.G', 'Zeta Division', 'FNATIC', 'FNC',
  'Team Liquid', 'TL', 'Natus Vincere', 'NAVI', 'FUT Esports', 'KRU', 'Leviatán',
  'Team Heretics', 'Karmine Corp', 'KC', 'BBL Esports', 'EDward Gaming', 'EDG',
  'Bilibili Gaming', 'Trace Esports', 'Talon Esports', 'Global Esports', 'GE'
]

// Sport-specific vig percentages based on Tab's actual margins
const VIG_BY_GAME: Record<string, number> = {
  'dota2': 7.5,
  'lol': 7.5,
  'csgo': 7.5,
  'valorant': 8,
  'other': 9
}

// Calculate vig metrics for a bet
function calculateVigMetrics(odds: number, game: string = 'other'): {
  impliedProbability: number
  estimatedOpponentOdds: number
  breakEvenWinRate: number
  noVigProbability: number
  vigAmount: number
} {
  const vigPercent = VIG_BY_GAME[game] || 9
  
  // Implied probability from odds (as percentage)
  const impliedProbability = (1 / odds) * 100
  
  // Assuming market has X% vig, calculate opponent odds
  // Total implied = 100% + vig
  // Opponent implied = (100 + vig) - your implied
  const totalImplied = 100 + vigPercent
  const opponentImplied = totalImplied - impliedProbability
  const estimatedOpponentOdds = opponentImplied > 0 ? 100 / opponentImplied : 1.01
  
  // No-vig (fair) probability - remove the margin proportionally
  const noVigProbability = (impliedProbability / totalImplied) * 100
  
  // Break-even win rate accounting for vig
  const breakEvenWinRate = impliedProbability
  
  // How much vig affects this specific bet (in %)
  const vigAmount = impliedProbability - noVigProbability
  
  return { impliedProbability, estimatedOpponentOdds, breakEvenWinRate, noVigProbability, vigAmount }
}

function generateHash(date: string, time: string, match: string, odds: number, stake: number): string {
  const str = `${date}|${time}|${match}|${odds}|${stake}`
  return crypto.createHash('md5').update(str).digest('hex').substring(0, 16)
}

function generateTxHash(date: string, time: string, type: string, amount: number): string {
  const str = `${date}|${time}|${type}|${amount}`
  return crypto.createHash('md5').update(str).digest('hex').substring(0, 16)
}

function detectGame(match: string, selection: string): 'dota2' | 'lol' | 'csgo' | 'valorant' | 'other' {
  const text = `${match} ${selection}`.toLowerCase()
  
  // VALORANT CHECK - MOVED FIRST (BEFORE LoL)
  // Check if both teams are Valorant teams
  const valorantTeams = ['mibr', 'loud', '100 thieves', '100t', 'sentinels', 'nrg', 'evil geniuses', 'eg', 
    'cloud9', 'c9', 'xset', 'optic', 'the guard', 'version1', 'v1', 'paper rex', 'prx', 
    'drx', 't1', 'gen.g', 'zeta division', 'fnatic', 'fnc', 'team liquid', 'tl', 
    'natus vincere', 'navi', 'fut esports', 'kru', 'leviatán', 'team heretics', 
    'karmine corp', 'kc', 'bbl esports', 'edward gaming', 'edg', 'bilibili gaming', 
    'trace esports', 'talon esports', 'global esports', 'ge']
  
  const matchLower = match.toLowerCase()
  const teamA = matchLower.split(' vs ')[0]?.trim() || ''
  const teamB = matchLower.split(' vs ')[1]?.trim().split('(')[0]?.trim() || ''
  
  const teamAIsValorant = valorantTeams.some(t => teamA.includes(t) || t.includes(teamA))
  const teamBIsValorant = valorantTeams.some(t => teamB.includes(t) || t.includes(teamB))
  
  if (teamAIsValorant && teamBIsValorant) {
    return 'valorant'
  }
  
  // Check for Valorant-specific terms (rounds bets)
  const hasRoundsBet = /under\s*\d+\.?\d*|over\s*\d+\.?\d*|rounds/i.test(selection)
  if (hasRoundsBet && (teamAIsValorant || teamBIsValorant)) {
    return 'valorant'
  }
  
  // Check for EXCLUSIVE Dota teams
  for (const team of DOTA_ONLY_TEAMS) {
    if (text.includes(team.toLowerCase())) return 'dota2'
  }
  
  // Check for EXCLUSIVE CS teams
  for (const team of CSGO_ONLY_TEAMS) {
    if (text.includes(team.toLowerCase())) return 'csgo'
  }
  
  // Check LoL regional league teams - NOW AFTER VALORANT CHECK
  for (const [, teams] of Object.entries(LOL_REGION_TEAMS)) {
    for (const team of teams) {
      if (text.includes(team.toLowerCase())) return 'lol'
    }
  }
  
  // For teams that play both Dota and CS (BetBoom vs Navi)
  const sharedTeamsInMatch = DOTA_CS_SHARED.filter(team => text.includes(team.toLowerCase()))
  
  if (sharedTeamsInMatch.length >= 2) {
    if (selection.toLowerCase().includes('map') || selection.toLowerCase().includes('game')) {
      return 'csgo'
    }
    return 'csgo'
  }
  
  if (sharedTeamsInMatch.length === 1) {
    for (const team of DOTA_ONLY_TEAMS) {
      if (text.includes(team.toLowerCase())) return 'dota2'
    }
    for (const team of CSGO_ONLY_TEAMS) {
      if (text.includes(team.toLowerCase())) return 'csgo'
    }
    return 'other'
  }
  
  // Check remaining LoL teams
  for (const team of LOL_TEAMS) {
    if (text.includes(team.toLowerCase())) return 'lol'
  }
  
  // If one team is Valorant, prefer Valorant
  if (teamAIsValorant || teamBIsValorant) {
    return 'valorant'
  }
  
  return 'other'
}

function detectLoLRegion(match: string, selection: string): string | null {
  const text = `${match} ${selection}`.toLowerCase()
  
  for (const [region, teams] of Object.entries(LOL_REGION_TEAMS)) {
    for (const team of teams) {
      if (text.includes(team.toLowerCase())) return region
    }
  }
  return null
}

function detectTournament(match: string, selection: string, game: string): string {
  const text = `${match} ${selection}`.toLowerCase()
  
  if (game === 'lol') {
    const region = detectLoLRegion(match, selection)
    if (region) return region
  }
  
  if (text.includes('dreamleague')) return 'DreamLeague Season 29'
  if (text.includes('blast')) return 'BLAST'
  if (text.includes('ti') || text.includes('international')) return 'The International'
  if (text.includes('esl')) return 'ESL'
  if (text.includes('msi')) return 'MSI'
  if (text.includes('worlds')) return 'Worlds'
  
  return game === 'dota2' ? 'DreamLeague Season 29' : 'Unknown'
}

function detectBetType(selection: string): 'winner' | 'game_winner' | 'handicap' | 'over_under' | 'other' {
  const lower = selection.toLowerCase()
  if (lower.includes('handicap') || /[+-]\d+\.?\d*/.test(lower)) return 'handicap'
  if (lower.includes('over') || lower.includes('under')) return 'over_under'
  if (lower.includes('game') && lower.includes('winner')) return 'game_winner'
  if (lower.includes('winner') || lower.includes('2-way')) return 'winner'
  return 'winner'
}

function parseDate(dateStr: string): Date {
  // Format: "18/05/2612:22PM" or "18/05/26 12:22PM"
  // Date is DD/MM/YY, Time is H:MM AM/PM or HH:MM AM/PM
  const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2})\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (match) {
    const [, day, month, year, hours, minutes, period] = match
    let h = parseInt(hours)
    const isPM = period.toUpperCase() === 'PM'
    const isAM = period.toUpperCase() === 'AM'
    
    // Convert 12-hour to 24-hour format correctly
    if (isPM && h !== 12) {
      h += 12  // 1PM-11PM -> 13-23
    } else if (isAM && h === 12) {
      h = 0    // 12AM -> 0
    }
    // Note: 12PM stays as 12, 1AM-11AM stay as 1-11
    
    const d = parseInt(day)
    const m = parseInt(month) - 1  // JS months are 0-indexed
    const y = 2000 + parseInt(year)
    
    console.log('[v0] parseDate input:', dateStr, '-> day:', d, 'month:', m+1, 'year:', y, 'hour:', h, 'min:', minutes)
    
    return new Date(y, m, d, h, parseInt(minutes))
  }
  console.log('[v0] parseDate FAILED to match:', dateStr)
  return new Date()
}

function parseDateString(dateStr: string): { datePart: string; timePart: string } {
  // Format: "18/05/2612:22PM" - date runs directly into time without space
  // The date is DD/MM/YY (8 chars) and time is H:MMAM/PM or HH:MMAM/PM
  
  // Try to extract date (first 8 chars for DD/MM/YY format)
  const dateMatch = dateStr.match(/^(\d{1,2}\/\d{1,2}\/\d{2})/)
  if (dateMatch) {
    const datePart = dateMatch[1]
    const rest = dateStr.slice(datePart.length).trim()
    // Rest should be time like "12:22PM" or "9:45AM" - don't require end of string anchor
    const timeMatch = rest.match(/^(\d{1,2}:\d{2}\s*(?:AM|PM))/i)
    if (timeMatch) {
      return { datePart, timePart: timeMatch[1] }
    }
    // If no proper time found, return what we have
    return { datePart, timePart: rest || '' }
  }
  return { datePart: dateStr, timePart: '' }
}

export function parseBettingData(rawText: string): { bets: ParsedBet[]; transactions: ParsedTransaction[] } {
  const lines = rawText.trim().split('\n').map(l => l.trim()).filter(l => l)
  const bets: ParsedBet[] = []
  const transactions: ParsedTransaction[] = []
  
  // Track seen bets by their unique signature to handle the duplicate pending/settled issue
  const seenBets = new Map<string, ParsedBet>()
  
  let i = 0
  while (i < lines.length) {
    // Check if we have enough lines for a bet entry (9 lines)
    if (i + 8 >= lines.length) {
      i++
      continue
    }
    
    // DETECT FORMAT: Check if line 0 is a TYPE or a DATE
    // Format A (TYPE FIRST): Win/Loss, date, match, selection, eventDate, odds, stake, profit, balance
    // Format B (TYPE LAST): date, match, selection, eventDate, odds, stake, profit, balance, Win/Loss
    const firstLine = lines[i]?.toLowerCase() || ''
    const isTypeFirst = ['win', 'loss', 'pending', 'cashed out', 'stake'].includes(firstLine)
    
    let typeLine: string
    let dateStr: string
    let match: string
    let selection: string
    let eventDate: string
    let oddsStr: string
    let stakeStr: string
    let profitStr: string
    let balanceStr: string
    
    if (isTypeFirst) {
      // Format A: type is first
      typeLine = lines[i]?.toLowerCase() || ''
      dateStr = lines[i + 1] || ''
      match = lines[i + 2] || ''
      selection = lines[i + 3] || ''
      eventDate = lines[i + 4] || ''
      oddsStr = lines[i + 5] || ''
      stakeStr = lines[i + 6] || ''
      profitStr = lines[i + 7] || ''
      balanceStr = lines[i + 8] || ''
    } else {
      // Format B: type is last
      dateStr = lines[i] || ''
      match = lines[i + 1] || ''
      selection = lines[i + 2] || ''
      eventDate = lines[i + 3] || ''
      oddsStr = lines[i + 4] || ''
      stakeStr = lines[i + 5] || ''
      profitStr = lines[i + 6] || ''
      balanceStr = lines[i + 7] || ''
      typeLine = lines[i + 8]?.toLowerCase() || ''
    }
    
    // Check if this looks like a valid bet entry
    if (['win', 'loss', 'pending', 'cashed out', 'stake'].includes(typeLine)) {
      
      // SKIP PENDING BETS - we only want settled bets (win/loss)
      if (typeLine === 'stake' || typeLine === 'pending') {
        i += 9  // Skip this entry
        continue
      }
      
      const { datePart, timePart } = parseDateString(dateStr)
      const odds = parseFloat(oddsStr) || 0
      const stake = Math.abs(parseFloat(stakeStr.replace(/[^0-9.-]/g, '') || '0'))
      const balance = parseFloat(balanceStr.replace(/[^0-9.-]/g, '') || '0')
      
      // Determine actual status and profit/loss based on the TYPE LINE (which is authoritative)
      let actualType: ParsedBet['type']
      let profitLoss = 0
      
      // The typeLine tells us definitively if it's a win or loss
      if (typeLine === 'loss') {
        actualType = 'loss'
        profitLoss = -stake  // Loss = negative stake
      } else if (typeLine === 'win') {
        actualType = 'win'
        // For wins, profit = displayed value (total return) - stake
        const displayedValue = parseFloat(profitStr.replace(/[^0-9.-]/g, '') || '0')
        profitLoss = displayedValue - stake
      } else if (typeLine === 'cashed out') {
        actualType = 'cashed_out'
        const displayedValue = parseFloat(profitStr.replace(/[^0-9.-]/g, '') || '0')
        profitLoss = displayedValue - stake
      } else {
        // Shouldn't reach here since we filtered pending above
        actualType = 'pending'
        profitLoss = 0
      }
      
      if (match && odds > 0 && stake > 0) {
        const game = detectGame(match, selection)
        const hash = generateHash(datePart, timePart, match, odds, stake)
        const vigMetrics = calculateVigMetrics(odds, game)
        
        const betSignature = `${datePart}|${timePart}|${match}|${selection}|${odds}|${stake}`
        
        const bet: ParsedBet = {
          id: `bet-${Date.now()}-${i}`,
          hash,
          type: actualType,
          date: parseDate(dateStr),
          dateString: datePart,
          timeString: timePart,
          match,
          selection,
          eventDate,
          odds,
          stake,
          profitLoss,
          balance,
          game,
          tournament: detectTournament(match, selection, game),
          isLive: match.toLowerCase().includes('live'),
          betType: detectBetType(selection),
          impliedProbability: vigMetrics.impliedProbability,
          estimatedOpponentOdds: vigMetrics.estimatedOpponentOdds,
          breakEvenWinRate: vigMetrics.breakEvenWinRate,
          noVigProbability: vigMetrics.noVigProbability,
          vigAmount: vigMetrics.vigAmount
        }
        
        // If we've seen this bet before, keep the settled version
        const existing = seenBets.get(betSignature)
        if (existing) {
          if (actualType !== 'pending' && existing.type === 'pending') {
            seenBets.set(betSignature, bet)
          }
        } else {
          seenBets.set(betSignature, bet)
        }
      }
      
      i += 9  // Move to next entry
    } else if (typeLine === 'withdraw' || typeLine === 'deposit') {
      // Transaction - but these also have type at end!
      // Skip for now - focus on bets first
      i += 8
    } else {
      // Not a valid entry type, move forward
      i++
    }
  }
  
  return {
    bets: Array.from(seenBets.values()).sort((a, b) => b.date.getTime() - a.date.getTime()),
    transactions: transactions.sort((a, b) => b.date.getTime() - a.date.getTime())
  }
}

export function checkDuplicates(
  newBets: ParsedBet[],
  newTransactions: ParsedTransaction[],
  existingHashes: Set<string>,
  existingTxHashes: Set<string>
): ImportResult {
  const duplicateBets: ParsedBet[] = []
  const uniqueBets: ParsedBet[] = []
  const duplicateTransactions: ParsedTransaction[] = []
  const uniqueTransactions: ParsedTransaction[] = []
  
  for (const bet of newBets) {
    if (existingHashes.has(bet.hash)) {
      duplicateBets.push(bet)
    } else {
      uniqueBets.push(bet)
    }
  }
  
  for (const tx of newTransactions) {
    if (existingTxHashes.has(tx.hash)) {
      duplicateTransactions.push(tx)
    } else {
      uniqueTransactions.push(tx)
    }
  }
  
  return {
    bets: newBets,
    transactions: newTransactions,
    duplicateBets,
    duplicateTransactions,
    newBets: uniqueBets,
    newTransactions: uniqueTransactions
  }
}

export function calculateStats(bets: ParsedBet[]): BettingStats {
  const settledBets = bets.filter(b => b.type === 'win' || b.type === 'loss' || b.type === 'cashed_out')
  const pendingBets = bets.filter(b => b.type === 'pending')
  const wins = settledBets.filter(b => b.type === 'win' || (b.type === 'cashed_out' && b.profitLoss > 0))
  const losses = settledBets.filter(b => b.type === 'loss')
  
  const totalStaked = settledBets.reduce((sum, b) => sum + b.stake, 0)
  const pendingStake = pendingBets.reduce((sum, b) => sum + b.stake, 0)
  
  // Calculate total profit
  const totalProfit = settledBets.reduce((sum, b) => {
    if (b.type === 'win') return sum + b.profitLoss
    if (b.type === 'cashed_out') return sum + b.profitLoss
    if (b.type === 'loss') return sum + b.profitLoss // profitLoss is negative for losses
    return sum
  }, 0)
  
  const avgOdds = settledBets.length > 0
    ? settledBets.reduce((sum, b) => sum + b.odds, 0) / settledBets.length
    : 0
  
  // Calculate profit by game
  const profitByGame: Record<string, { profit: number; bets: number; wins: number }> = {}
  settledBets.forEach(b => {
    if (!profitByGame[b.game]) profitByGame[b.game] = { profit: 0, bets: 0, wins: 0 }
    profitByGame[b.game].bets++
    profitByGame[b.game].profit += b.profitLoss
    if (b.type === 'win' || (b.type === 'cashed_out' && b.profitLoss > 0)) {
      profitByGame[b.game].wins++
    }
  })
  
  // Calculate profit by day
  const profitByDayMap = new Map<string, number>()
  settledBets.forEach(b => {
    const day = b.dateString
    if (!profitByDayMap.has(day)) profitByDayMap.set(day, 0)
    profitByDayMap.set(day, profitByDayMap.get(day)! + b.profitLoss)
  })
  
  let cumulative = 0
  const profitByDay = Array.from(profitByDayMap.entries())
    .sort((a, b) => {
      // Date format is DD/MM/YY - need to properly convert to sortable date
      const partsA = a[0].split('/')
      const partsB = b[0].split('/')
      // Convert DD/MM/YY to YYYY-MM-DD for proper sorting
      const dateA = new Date(2000 + parseInt(partsA[2]), parseInt(partsA[1]) - 1, parseInt(partsA[0]))
      const dateB = new Date(2000 + parseInt(partsB[2]), parseInt(partsB[1]) - 1, parseInt(partsB[0]))
      return dateA.getTime() - dateB.getTime()
    })
    .map(([date, profit]) => {
      cumulative += profit
      return { date, profit, cumulative }
    })
  
  // Current streak
  let streakType: 'win' | 'loss' = 'win'
  let streakCount = 0
  const sortedSettled = [...settledBets].sort((a, b) => b.date.getTime() - a.date.getTime())
  for (let i = 0; i < sortedSettled.length; i++) {
    const bet = sortedSettled[i]
    const isWin = bet.type === 'win' || (bet.type === 'cashed_out' && bet.profitLoss > 0)
    if (i === 0) {
      streakType = isWin ? 'win' : 'loss'
      streakCount = 1
    } else if ((isWin && streakType === 'win') || (!isWin && streakType === 'loss')) {
      streakCount++
    } else {
      break
    }
  }
  
  // Biggest win/loss
  const biggestWin = Math.max(...wins.map(b => b.profitLoss), 0)
  const biggestLoss = Math.abs(Math.min(...losses.map(b => b.profitLoss), 0))
  
  // Implied probability vs actual
  const impliedProb = settledBets.length > 0
    ? settledBets.reduce((sum, b) => sum + (1 / b.odds), 0) / settledBets.length
    : 0
  const actualWinRate = settledBets.length > 0 ? wins.length / settledBets.length : 0
  
  return {
    totalBets: settledBets.length,
    totalWins: wins.length,
    totalLosses: losses.length,
    pendingBets: pendingBets.length,
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
    impliedProbabilityVsActual: (actualWinRate - impliedProb) * 100,
    pendingStake
  }
}
