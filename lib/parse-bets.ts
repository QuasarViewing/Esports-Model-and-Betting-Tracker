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
  date: Date
  dateString: string
  timeString: string
  amount: number
  balanceAfter: number
}

export function parseBettingData(rawText: string): { bets: ParsedBet[]; transactions: ParsedTransaction[] } {
  const lines = rawText.trim().split('\n').map(l => l.trim()).filter(l => l)
  const bets: ParsedBet[] = []
  const transactions: ParsedTransaction[] = []
  
  // Detect format: tab-separated has \t, line-based has many lines per entry
  const isTabSeparated = lines.some(line => line.includes('\t'))
  
  if (isTabSeparated) {
    // Tab-separated format from betting site export
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
      if (status.toLowerCase() === 'status') {
        i++
        continue
      }
      
      const fullDateTime = `${dateStr}${timeStr.replace(/\s/g, '')}`
      
      // Handle transactions
      if (status.toLowerCase() === 'withdraw') {
        const amount = Math.abs(parseFloat(amountStr.replace(/[$-]/g, '')) || 0)
        const balance = parseFloat(balanceStr.replace(/[$-]/g, '')) || 0
        
        const tx: ParsedTransaction = {
          id: crypto.randomUUID(),
          hash: crypto.createHash('sha256').update(`withdrawal-${fullDateTime}-${amount}`).digest('hex'),
          type: 'withdrawal',
          date: parseDate(fullDateTime),
          dateString: dateStr,
          timeString: timeStr,
          amount,
          balanceAfter: balance
        }
        transactions.push(tx)
      } else if (status.toLowerCase() === 'deposit') {
        const amount = parseFloat(amountStr.replace(/[$-]/g, '')) || 0
        const balance = parseFloat(balanceStr.replace(/[$-]/g, '')) || 0
        
        const tx: ParsedTransaction = {
          id: crypto.randomUUID(),
          hash: crypto.createHash('sha256').update(`deposit-${fullDateTime}-${amount}`).digest('hex'),
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
        const stake = parseFloat(stakeStr.replace(/[$-]/g, '')) || 0
        const profitAmount = parseFloat(amountStr.replace(/[$-]/g, '')) || 0
        const balance = parseFloat(balanceStr.replace(/[$-]/g, '')) || 0
        
        const match = betDetails
        const selection = type
        const game = detectGame(match, selection)
        
        if (match && odds > 0 && stake > 0) {
          const bet: ParsedBet = {
            id: crypto.randomUUID(),
            hash: crypto.createHash('sha256').update(`${fullDateTime}-${match}-${selection}-${stake}`).digest('hex'),
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
      }
      
      i++
    }
  }
  
  return { bets, transactions }
}

function parseDate(dateString: string): Date {
  // Format: "18/05/2612:22PM" or "18/05/26 12:22PM"
  const sanitized = dateString.replace(/\s/g, '')
  
  // Extract date and time parts
  const dateMatch = sanitized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})(.*)$/)
  if (!dateMatch) return new Date()
  
  const [, day, month, year, timeStr] = dateMatch
  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})(AM|PM)?/i)
  
  let hours = timeMatch ? parseInt(timeMatch[1]) : 0
  const minutes = timeMatch ? parseInt(timeMatch[2]) : 0
  const period = timeMatch ? timeMatch[3]?.toUpperCase() : 'AM'
  
  // Convert to 24-hour format
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0
  
  const fullYear = 2000 + parseInt(year)
  return new Date(fullYear, parseInt(month) - 1, parseInt(day), hours, minutes)
}

function detectGame(match: string, selection: string): 'dota2' | 'lol' | 'csgo' | 'valorant' {
  const text = `${match} ${selection}`.toLowerCase()
  
  if (text.includes('dota') || text.includes('spirits') || text.includes('tundra') || text.includes('falcons') || text.includes('liquid') || text.includes('natus')) return 'dota2'
  if (text.includes('lol') || text.includes('league') || text.includes('100 thieves') || text.includes('loud')) return 'lol'
  if (text.includes('cs') || text.includes('counter-strike') || text.includes('furia') || text.includes('heroic')) return 'csgo'
  if (text.includes('valorant') || text.includes('faze') || text.includes('gen.g')) return 'valorant'
  
  return 'dota2' // Default to dota2
}

function detectTournament(match: string, selection: string, game: string): string {
  // Extract tournament name from match if available
  return 'Tournament'
}

function detectBetType(selection: string): string {
  const text = selection.toLowerCase()
  
  if (text.includes('over') || text.includes('under')) return 'over/under'
  if (text.includes('handicap')) return 'handicap'
  if (text.includes('game')) return 'game_winner'
  if (text.includes('map')) return 'map_winner'
  if (text.includes('round')) return 'round_winner'
  
  return 'match_winner'
}

export function calculateStats(bets: ParsedBet[]) {
  const settledBets = bets.filter(b => b.type !== 'pending')
  
  const totalBets = bets.length
  const totalWins = bets.filter(b => b.type === 'win').length
  const totalLosses = bets.filter(b => b.type === 'loss').length
  const totalStaked = bets.reduce((sum, b) => sum + b.stake, 0)
  const totalProfit = bets.reduce((sum, b) => sum + b.profitLoss, 0)
  
  const winRate = totalBets > 0 ? (totalWins / totalBets) * 100 : 0
  const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0
  const avgOdds = totalBets > 0 ? bets.reduce((sum, b) => sum + b.odds, 0) / totalBets : 0
  const avgStake = totalBets > 0 ? totalStaked / totalBets : 0
  
  // Group by game
  const profitByGame: Record<string, number> = {}
  bets.forEach(bet => {
    if (!profitByGame[bet.game]) profitByGame[bet.game] = 0
    profitByGame[bet.game] += bet.profitLoss
  })
  
  // Group by day
  const profitByDayMap = new Map<string, { profit: number; count: number }>()
  bets.forEach(bet => {
    const day = bet.dateString
    if (!profitByDayMap.has(day)) profitByDayMap.set(day, { profit: 0, count: 0 })
    const entry = profitByDayMap.get(day)!
    entry.profit += bet.profitLoss
    entry.count += 1
  })
  
  // Convert to sorted array with cumulative
  let cumulativeProfit = 0
  const profitByDay = Array.from(profitByDayMap.entries())
    .sort((a, b) => {
      const dateA = new Date(a[0].split('/').reverse().join('-'))
      const dateB = new Date(b[0].split('/').reverse().join('-'))
      return dateA.getTime() - dateB.getTime()
    })
    .map(([date, { profit, count }]) => {
      cumulativeProfit += profit
      return { date, profit, cumulative: cumulativeProfit }
    })
  
  return {
    totalBets,
    totalWins,
    totalLosses,
    winRate,
    totalStaked,
    totalProfit,
    roi,
    avgOdds,
    avgStake,
    profitByGame,
    profitByDay
  }
}

export function checkDuplicates(
  newBets: ParsedBet[],
  newTransactions: ParsedTransaction[],
  existingHashes: Set<string>,
): { uniqueBets: ParsedBet[]; uniqueTransactions: ParsedTransaction[]; duplicateCount: number } {
  let duplicateCount = 0
  
  const uniqueBets = newBets.filter(bet => {
    if (existingHashes.has(bet.hash)) {
      duplicateCount++
      return false
    }
    existingHashes.add(bet.hash)
    return true
  })
  
  const uniqueTransactions = newTransactions.filter(tx => {
    if (existingHashes.has(tx.hash)) {
      duplicateCount++
      return false
    }
    existingHashes.add(tx.hash)
    return true
  })
  
  return { uniqueBets, uniqueTransactions, duplicateCount }
}
