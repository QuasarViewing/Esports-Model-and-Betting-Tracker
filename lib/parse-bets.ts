import { createHash } from 'crypto'

export interface ParsedBet {
  id: string
  hash: string
  type: 'win' | 'loss' | 'pending' | 'cashed_out'
  date: string
  dateString: string
  timeString: string
  match: string
  selection: string
  eventDate: string
  odds: number
  stake: number
  profitLoss: number
  balance: number
  game: 'dota2' | 'lol' | 'csgo' | 'valorant'
  tournament: string
  isLive: boolean
  betType: string
  impliedProbability: number
  estimatedOpponentOdds: number
  breakEvenWinRate: number
  noVigProbability: number
  vigAmount: number
}

export interface ParsedTransaction {
  id: string
  hash: string
  type: 'deposit' | 'withdrawal'
  date: string
  dateString: string
  timeString: string
  amount: number
  balanceAfter: number
}

export interface ImportResult {
  newBets: ParsedBet[]
  newTransactions: ParsedTransaction[]
  duplicateBets: ParsedBet[]
  duplicateTransactions: ParsedTransaction[]
  bets: ParsedBet[]
  transactions: ParsedTransaction[]
}

export interface BetStats {
  totalProfit: number
  totalBets: number
  winCount: number
  lossCount: number
  winRate: number
  averageOdds: number
  averageStake: number
  totalStaked: number
  profitByDay: { date: string; profit: number; cumulative: number }[]
  profitByGame: { game: string; profit: number; betCount: number; winRate: number }[]
  currentStreak: { type: 'win' | 'loss'; count: number }
  pendingBets: number
  pendingStake: number
}

function parseDate(dateString: string): string {
  // Expected format: "18/05/2612:22PM" or "18/05/26 12:22PM"
  // Return as "18/05/26" for consistency
  const match = dateString.match(/(\d{1,2})\/(\d{1,2})\/(\d{2})/)
  if (match) {
    return `${match[1]}/${match[2]}/${match[3]}`
  }
  return dateString
}

function detectGame(match: string, selection: string): 'dota2' | 'lol' | 'csgo' | 'valorant' {
  const lower = `${match} ${selection}`.toLowerCase()
  
  if (lower.includes('dota') || lower.includes('tundra') || lower.includes('spirit') || lower.includes('falcons') || lower.includes('liquid') || lower.includes('natus')) return 'dota2'
  if (lower.includes('lol') || lower.includes('league') || lower.includes('100 thieves') || lower.includes('fnatic') || lower.includes('g2') || lower.includes('mad lions')) return 'lol'
  if (lower.includes('cs') || lower.includes('counter') || lower.includes('strike') || lower.includes('vitality') || lower.includes('faze') || lower.includes('heroic')) return 'csgo'
  if (lower.includes('valorant') || lower.includes('loud') || lower.includes('sentinels') || lower.includes('furia')) return 'valorant'
  
  return 'dota2'
}

function detectTournament(match: string, selection: string, game: string): string {
  return 'Unknown Tournament'
}

function detectBetType(selection: string): string {
  if (selection.includes('winner') || selection.includes('Winner')) return '2-Way'
  if (selection.includes('over') || selection.includes('under') || selection.includes('Over') || selection.includes('Under')) return 'O/U'
  if (selection.includes('handicap') || selection.includes('Game')) return 'Handicap/Game'
  return 'Other'
}

export function parseBettingData(rawText: string): { bets: ParsedBet[]; transactions: ParsedTransaction[] } {
  const lines = rawText.trim().split('\n').map(l => l.trim()).filter(l => l)
  const bets: ParsedBet[] = []
  const transactions: ParsedTransaction[] = []
  
  // Check if data is tab-separated (new format) or old line-based format
  const isTabSeparated = lines.some(line => line.includes('\t'))
  
  if (isTabSeparated) {
    // New tab-separated format from betting site export
    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      const parts = line.split('\t').map(p => p.trim())
      
      if (parts.length < 9) {
        i++
        continue
      }
      
      const [status, dateStr, timeStr, type, betDetails, oddsStr, stakeStr, amountStr, balanceStr] = parts
      
      // Skip header row
      if (status.toLowerCase() === 'status' || status === '') {
        i++
        continue
      }
      
      // Combine date and time
      const fullDateTime = `${dateStr}${timeStr.replace(/\s/g, '')}`
      
      // Handle transactions (deposits/withdrawals)
      if (status.toLowerCase() === 'withdraw') {
        const amount = parseFloat(amountStr.replace(/[$\-\s]/g, '')) || 0
        const balance = parseFloat(balanceStr.replace(/[$\-\s]/g, '')) || 0
        
        const tx: ParsedTransaction = {
          id: createHash('sha256').update(`withdrawal-${fullDateTime}-${Math.abs(amount)}`).digest('hex').slice(0, 8),
          hash: createHash('sha256').update(`withdrawal-${fullDateTime}-${Math.abs(amount)}`).digest('hex'),
          type: 'withdrawal',
          date: parseDate(fullDateTime),
          dateString: dateStr,
          timeString: timeStr,
          amount: Math.abs(amount),
          balanceAfter: balance
        }
        transactions.push(tx)
      } else if (status.toLowerCase() === 'deposit') {
        const amount = parseFloat(amountStr.replace(/[$\-\s]/g, '')) || 0
        const balance = parseFloat(balanceStr.replace(/[$\-\s]/g, '')) || 0
        
        const tx: ParsedTransaction = {
          id: createHash('sha256').update(`deposit-${fullDateTime}-${amount}`).digest('hex').slice(0, 8),
          hash: createHash('sha256').update(`deposit-${fullDateTime}-${amount}`).digest('hex'),
          type: 'deposit',
          date: parseDate(fullDateTime),
          dateString: dateStr,
          timeString: timeStr,
          amount,
          balanceAfter: balance
        }
        transactions.push(tx)
      } else {
        // Handle bets
        const betType = status.toLowerCase() === 'win' ? 'win' 
          : status.toLowerCase() === 'loss' ? 'loss'
          : status.toLowerCase() === 'stake' ? 'pending'
          : status.toLowerCase() === 'cashed out' ? 'cashed_out'
          : 'pending'
        
        const odds = parseFloat(oddsStr) || 0
        const stake = parseFloat(stakeStr.replace(/[$\-\s]/g, '')) || 0
        const profitAmount = parseFloat(amountStr.replace(/[$\-\s]/g, '')) || 0
        const balance = parseFloat(balanceStr.replace(/[$\-\s]/g, '')) || 0
        
        const match = betDetails
        const selection = type
        const game = detectGame(match, selection)
        
        const bet: ParsedBet = {
          id: createHash('sha256').update(`${fullDateTime}-${match}-${selection}-${stake}`).digest('hex').slice(0, 8),
          hash: createHash('sha256').update(`${fullDateTime}-${match}-${selection}-${stake}`).digest('hex'),
          type: betType,
          date: parseDate(fullDateTime),
          dateString: dateStr,
          timeString: timeStr,
          match,
          selection,
          eventDate: '',
          odds: odds || 1,
          stake,
          profitLoss: profitAmount,
          balance,
          game,
          tournament: detectTournament(match, selection, game),
          isLive: false,
          betType: detectBetType(selection),
          impliedProbability: odds > 0 ? (1 / odds) * 100 : 0,
          estimatedOpponentOdds: odds > 0 ? (1 / ((1 / odds) - 0.05)) : 0,
          breakEvenWinRate: odds > 0 ? (1 / odds) * 100 : 0,
          noVigProbability: 0,
          vigAmount: 0
        }
        
        bets.push(bet)
      }
      
      i++
    }
  }
  
  return { bets, transactions }
}

export function calculateStats(bets: ParsedBet[]): BetStats {
  if (!bets || bets.length === 0) {
    return {
      totalProfit: 0,
      totalBets: 0,
      winCount: 0,
      lossCount: 0,
      winRate: 0,
      averageOdds: 0,
      averageStake: 0,
      totalStaked: 0,
      profitByDay: [],
      profitByGame: [],
      currentStreak: { type: 'win', count: 0 },
      pendingBets: 0,
      pendingStake: 0
    }
  }

  const settledBets = bets.filter(b => b.type === 'win' || b.type === 'loss')
  const pendingBets = bets.filter(b => b.type === 'pending')
  
  const totalProfit = settledBets.reduce((sum, b) => sum + b.profitLoss, 0)
  const winCount = settledBets.filter(b => b.type === 'win').length
  const lossCount = settledBets.filter(b => b.type === 'loss').length
  const winRate = settledBets.length > 0 ? (winCount / settledBets.length) * 100 : 0
  const averageOdds = settledBets.length > 0 ? settledBets.reduce((sum, b) => sum + b.odds, 0) / settledBets.length : 0
  const totalStaked = settledBets.reduce((sum, b) => sum + b.stake, 0)
  const averageStake = settledBets.length > 0 ? totalStaked / settledBets.length : 0
  const pendingStake = pendingBets.reduce((sum, b) => sum + b.stake, 0)

  // Profit by day
  const profitByDayMap = new Map<string, number>()
  settledBets.forEach(bet => {
    const day = bet.date
    if (typeof day === 'string') {
      profitByDayMap.set(day, (profitByDayMap.get(day) || 0) + bet.profitLoss)
    }
  })

  let cumulativeProfit = 0
  const profitByDay = Array.from(profitByDayMap.entries())
    .filter(([date]) => typeof date === 'string' && date.length > 0)
    .sort((a, b) => {
      try {
        const dateA = typeof a[0] === 'string' ? a[0].split('/').reverse().join('-') : '1900-01-01'
        const dateB = typeof b[0] === 'string' ? b[0].split('/').reverse().join('-') : '1900-01-01'
        return new Date(dateA).getTime() - new Date(dateB).getTime()
      } catch {
        return 0
      }
    })
    .map(([date, profit]) => {
      cumulativeProfit += profit
      return { date, profit, cumulative: cumulativeProfit }
    })

  // Profit by game
  const profitByGameMap = new Map<string, { profit: number; count: number; wins: number }>()
  settledBets.forEach(bet => {
    const game = bet.game
    const entry = profitByGameMap.get(game) || { profit: 0, count: 0, wins: 0 }
    entry.profit += bet.profitLoss
    entry.count += 1
    if (bet.type === 'win') entry.wins += 1
    profitByGameMap.set(game, entry)
  })

  const profitByGame = Array.from(profitByGameMap.entries()).map(([game, { profit, count, wins }]) => ({
    game,
    profit,
    betCount: count,
    winRate: count > 0 ? (wins / count) * 100 : 0
  }))

  // Calculate current streak
  let currentStreak: { type: 'win' | 'loss'; count: number } = { type: 'win', count: 0 }
  for (let i = settledBets.length - 1; i >= 0; i--) {
    const bet = settledBets[i]
    if (i === settledBets.length - 1) {
      currentStreak.type = bet.type === 'win' ? 'win' : 'loss'
      currentStreak.count = 1
    } else {
      const prevBet = settledBets[i + 1]
      const currentType = bet.type === 'win' ? 'win' : 'loss'
      if (currentType === currentStreak.type) {
        currentStreak.count++
      } else {
        break
      }
    }
  }

  return {
    totalProfit,
    totalBets: settledBets.length,
    winCount,
    lossCount,
    winRate,
    averageOdds,
    averageStake,
    totalStaked,
    profitByDay,
    profitByGame,
    currentStreak,
    pendingBets: pendingBets.length,
    pendingStake
  }
}

export function checkDuplicates(
  newBets: ParsedBet[],
  newTransactions: ParsedTransaction[],
  existingBetHashes: Set<string>,
  existingTxHashes: Set<string>
): ImportResult {
  const newBetsFiltered = newBets.filter(b => !existingBetHashes.has(b.hash))
  const duplicateBets = newBets.filter(b => existingBetHashes.has(b.hash))
  
  const newTxFiltered = newTransactions.filter(tx => !existingTxHashes.has(tx.hash))
  const duplicateTx = newTransactions.filter(tx => existingTxHashes.has(tx.hash))
  
  return {
    newBets: newBetsFiltered,
    newTransactions: newTxFiltered,
    duplicateBets,
    duplicateTransactions: duplicateTx,
    bets: newBetsFiltered,
    transactions: newTxFiltered
  }
}
