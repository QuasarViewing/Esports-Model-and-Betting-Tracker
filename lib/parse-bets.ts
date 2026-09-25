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
  tag?: string | null
  // Phase 3: CLV tracking
  oddsAtPlacement?: number | null
  closingOdds?: number | null
  clvPct?: number | null
}

export interface TagPerformance {
  tag: string
  profit: number
  betCount: number
  winCount: number
  lossCount: number
  winRate: number
  totalStaked: number
  roi: number
}

export interface CalibrationBucket {
  label: string
  minOdds: number
  maxOdds: number
  betCount: number
  avgImplied: number
  actualHitRate: number
  delta: number
  verdict: 'sharp' | 'fair' | 'over-confident' | 'under-confident' | 'thin'
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
  updatedBets: ParsedBet[]
  duplicateBets: ParsedBet[]
  duplicateTransactions: ParsedTransaction[]
  bets: ParsedBet[]
  transactions: ParsedTransaction[]
}

export interface VarianceStats {
  maxDrawdown: number
  maxDrawdownPct: number
  longestLosingStreak: number
  longestWinningStreak: number
  expectedMaxLosingStreak: number
  plDistribution: { label: string; count: number; min: number; max: number }[]
}

export interface ClvStats {
  avgClvPct: number
  bets: number
  clvByDay: { date: string; avgClv: number; cumulative: number; betCount: number }[]
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
  profitByTag: TagPerformance[]
  calibrationBuckets: CalibrationBucket[]
  variance: VarianceStats
  clv: ClvStats
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

// Best-effort auto-detection based on team name + selection text. Ambiguous orgs
// (BetBoom, Natus Vincere, Team Liquid, Cloud9...) play multiple games, so this is
// always going to be wrong sometimes — the bets table has a manual per-bet override.
function detectGame(match: string, selection: string): 'dota2' | 'lol' | 'csgo' | 'valorant' {
  const text = `${match} ${selection}`.toLowerCase()

  // Rounds-based markets only exist in CS / Valorant.
  const isRoundsMarket = /\brounds?\b.*(over|under|handicap)|total rounds?/i.test(text)

  // Pure-game team lists (current 2024-2026 rosters).
  // Multi-game orgs (Natus Vincere, BetBoom, Team Liquid, Cloud9, Virtus.pro, etc.)
  // are deliberately left out — they fall through to default.
  const DOTA2_TEAMS = [
    'team spirit', 'team falcons', 'tundra esports', 'tundra', 'parivision',
    'playtime', 'aurora', 'vici gaming', 'gamerlegion', 'xtreme gaming',
    'rekonix', 'ex-heroic', 'bb team', 'azure ray', 'tidebound', 'nigma',
    'quest esports', 'talon esports', 'execration', 'boom esports',
  ]
  const LOL_TEAMS = [
    'hanwha life', 'kt rolster', 'gen.g', 'dplus kia', 'dplus', 'dwg kia',
    'damwon', 'bilibili gaming', 'top esports', 'edward gaming', 'weibo gaming',
    'lng esports', 'fnatic', 'mad lions koi', 'team bds', 'sk gaming',
    'team heretics', 'rogue', 'excel esports',
  ]
  const VALORANT_TEAMS = [
    'loud', '100 thieves', 'mibr', 'furia', 'shopify rebellion', 'disguised',
    'sentinels', 'paper rex', 'drx', 'leviatán', 'leviatan', 'kru esports',
    '2game esports', 'g2 esports', 'team heretics',
  ]
  const CS_TEAMS = [
    'vitality', 'faze clan', 'mouz', 'mousesports', 'astralis', 'big clan',
    'ence', 'complexity', 'eternal fire', 'imperial esports', 'monte', 'falcons',
  ]

  // Word-boundary match — avoids false positives like 'cloud9'.includes('loud').
  const has = (list: string[]) => {
    for (const term of list) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp(`\\b${escaped}\\b`, 'i').test(text)) return true
    }
    return false
  }

  // Selection-based hard signal — overrides team-name guesses.
  if (isRoundsMarket) {
    return has(VALORANT_TEAMS) ? 'valorant' : 'csgo'
  }

  // Explicit single-game team hits, in priority order.
  if (has(LOL_TEAMS)) return 'lol'
  if (has(VALORANT_TEAMS)) return 'valorant'
  if (has(DOTA2_TEAMS)) return 'dota2'
  if (has(CS_TEAMS)) return 'csgo'

  // Game-name mentions as last resort.
  if (text.includes('dota')) return 'dota2'
  if (text.includes('league of legends') || text.includes(' lol ')) return 'lol'
  if (text.includes('valorant')) return 'valorant'
  if (text.includes('counter-strike') || text.includes('cs2') || text.includes('csgo')) return 'csgo'

  // Default reflects this user's actual mix — most bets are Dota 2.
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

  // Current account-activity format: one record per event, terminated by the
  // "keyboard_arrow_down" chrome the site's copy includes.
  if (lines.some(l => LEDGER_TS_RE.test(l))) {
    return parseLedger(lines)
  }

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
        const stake = parseFloat(stakeStr.replace(/[$\s]/g, '')) || 0
        // Keep the negative sign! Only strip $ and whitespace, not -
        const rawProfit = parseFloat(amountStr.replace(/[$\s]/g, '')) || 0
        const balance = parseFloat(balanceStr.replace(/[$\s]/g, '')) || 0
        // Ensure losses are negative and wins are positive
        const profitAmount = betType === 'loss' ? -Math.abs(rawProfit) : Math.abs(rawProfit)
        
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
  } else {
    // Line-per-field format — what you get when you copy-paste from the betting
    // site's history table without tabs. Each record is a run of consecutive lines:
    //   Bets (9 lines):   status / datetime / match / selection / event time / odds / stake / amount / balance
    //   Transactions (8): status / datetime / description / approval / "-" / $0.00 / amount / balance
    parseLinePerField(lines, bets, transactions)
  }

  return { bets, transactions }
}

// ---------------------------------------------------------------------------
// Account-activity ledger format
// ---------------------------------------------------------------------------
//
// Each record is a run of lines terminated by the site's own UI chrome:
//
//   24 Sep 2026, 07:32:12 NZST        24 Sep 2026, 18:39:29 NZST
//   Win                               Approved
//   Team Synapse@ 1.38                Deposit
//   +$414.00                          +$243.00
//   Winner 2-Way                      $243.00
//   $1427.84                          keyboard_arrow_down
//   Team Synapse vs Yellow Submarine (Bo3)
//   keyboard_arrow_down
//
// It is a cash-flow ledger, so a bet appears twice: a "Placed" row (stake out)
// and, only if it returned money, a settle row (return in). Losses therefore
// have no settle row — see settleUnmatched() for how they're told from pendings.

const LEDGER_TS_RE = /^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})/
const LEDGER_DAY_HEADER_RE = /^[A-Za-z]+day\s+\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}$/
const LEDGER_NOISE_RE = /^(keyboard_arrow_down|keyboard_arrow_up|expand_more|expand_less|show more|show less)$/i

// Fallback for deciding whether an unsettled stake is still live, used only when
// the event itself gives no evidence either way. See settleUnmatched().
const PENDING_WINDOW_MS = 6 * 60 * 60 * 1000

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

interface LedgerEvent {
  ms: number
  dateString: string
  timeString: string
  amount: number
  balance: number
  selection: string
  odds: number
  market: string
  match: string
  txType: 'deposit' | 'withdrawal' | null
}

function parseMoney(raw: string): number {
  const cleaned = raw.replace(/[$,+\s]/g, '')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

function parseLedgerStamp(raw: string): { ms: number; dateString: string; timeString: string } | null {
  const m = raw.match(LEDGER_TS_RE)
  if (!m) return null
  const month = MONTHS[m[2].slice(0, 3).toLowerCase()]
  if (month === undefined) return null
  const day = parseInt(m[1], 10)
  const year = parseInt(m[3], 10)
  const [h, min, sec] = [parseInt(m[4], 10), parseInt(m[5], 10), parseInt(m[6], 10)]
  return {
    ms: Date.UTC(year, month, day, h, min, sec),
    dateString: `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${String(year).slice(2)}`,
    timeString: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`,
  }
}

function parseLedgerRecord(chunk: string[]): LedgerEvent | null {
  const f = chunk.filter(l => !LEDGER_DAY_HEADER_RE.test(l))
  if (f.length < 5) return null

  const stamp = parseLedgerStamp(f[0])
  if (!stamp) return null

  // f[1] is the action word ("Placed" / "Win" / "Sent" / "Approved"), which is
  // redundant — the sign of the amount carries the same information.
  if (/^(deposit|withdrawal)$/i.test(f[2])) {
    return {
      ...stamp,
      amount: parseMoney(f[3]),
      balance: parseMoney(f[4]),
      selection: '', odds: 0, market: '', match: '',
      txType: /^deposit$/i.test(f[2]) ? 'deposit' : 'withdrawal',
    }
  }

  const at = f[2].lastIndexOf('@')
  if (at === -1) return null
  const odds = parseFloat(f[2].slice(at + 1).trim())
  if (!Number.isFinite(odds) || odds <= 0) return null

  const selection = f[2].slice(0, at).trim()
  return {
    ...stamp,
    amount: parseMoney(f[3]),
    balance: parseMoney(f[5]),
    selection,
    odds,
    market: f[4],
    // Live bets are listed without an event name.
    match: f.length > 6 ? f[6] : selection,
    txType: null,
  }
}

function parseLedger(lines: string[]): { bets: ParsedBet[]; transactions: ParsedTransaction[] } {
  const events: LedgerEvent[] = []
  let chunk: string[] = []
  for (const line of lines) {
    if (LEDGER_NOISE_RE.test(line)) {
      const ev = parseLedgerRecord(chunk)
      if (ev) events.push(ev)
      chunk = []
    } else {
      chunk.push(line)
    }
  }
  const tail = parseLedgerRecord(chunk)
  if (tail) events.push(tail)

  events.sort((a, b) => a.ms - b.ms)

  const transactions: ParsedTransaction[] = events
    .filter(e => e.txType !== null)
    .map(e => {
      const amount = Math.abs(e.amount)
      const seed = `${e.txType}-${e.dateString}${e.timeString}-${amount}`
      return {
        id: createHash('sha256').update(seed).digest('hex').slice(0, 8),
        hash: createHash('sha256').update(seed).digest('hex'),
        type: e.txType as 'deposit' | 'withdrawal',
        date: e.dateString,
        dateString: e.dateString,
        timeString: e.timeString,
        amount,
        balanceAfter: e.balance,
      }
    })

  return { bets: buildLedgerBets(events), transactions }
}

function buildLedgerBets(events: LedgerEvent[]): ParsedBet[] {
  const betEvents = events.filter(e => e.txType === null)
  const placed = betEvents.filter(e => e.amount < 0)
  const settles = betEvents.filter(e => e.amount > 0)

  const key = (e: LedgerEvent) => `${e.selection}|${e.odds}|${e.market}|${e.match}`

  const byKey = new Map<string, LedgerEvent[]>()
  for (const p of placed) {
    const k = key(p)
    const list = byKey.get(k)
    if (list) list.push(p)
    else byKey.set(k, [p])
  }

  // Pair each return with the stake that produced it. Same selection at the same
  // price can be staked more than once, so prefer the one whose full payout the
  // return actually equals before falling back to the closest earlier stake.
  const claimed = new Set<LedgerEvent>()
  const settleFor = new Map<LedgerEvent, LedgerEvent>()
  for (const s of settles) {
    const candidates = (byKey.get(key(s)) ?? []).filter(p => !claimed.has(p) && p.ms <= s.ms)
    if (candidates.length === 0) continue
    const pick =
      candidates.find(p => Math.abs(s.amount - Math.abs(p.amount) * p.odds) <= 0.05) ??
      candidates.find(p => Math.abs(s.amount - Math.abs(p.amount)) <= 0.01) ??
      candidates[candidates.length - 1]
    claimed.add(pick)
    settleFor.set(pick, s)
  }

  const newestMs = events.length > 0 ? events[events.length - 1].ms : 0

  // Latest moment each event paid anything out. If a stake on that event has no
  // return of its own but money came back from it afterwards, the event had
  // progressed past that market — so the stake lost rather than still running.
  const lastPayoutByMatch = new Map<string, number>()
  for (const s of settles) {
    const prev = lastPayoutByMatch.get(s.match)
    if (prev === undefined || s.ms > prev) lastPayoutByMatch.set(s.match, s.ms)
  }

  const settleUnmatched = (p: LedgerEvent): 'loss' | 'pending' => {
    if ((lastPayoutByMatch.get(p.match) ?? -Infinity) > p.ms) return 'loss'
    // Nothing on this event ever paid out, so fall back to age: an old stake is
    // a match where every bet lost, a recent one is probably still running.
    return newestMs - p.ms <= PENDING_WINDOW_MS ? 'pending' : 'loss'
  }

  const bets: { bet: ParsedBet; sortMs: number }[] = []

  for (const p of placed) {
    const stake = Math.abs(p.amount)
    const settle = settleFor.get(p)

    let type: ParsedBet['type']
    let profitLoss: number
    let at = p

    if (settle) {
      // A return equal to the stake is a void/refund, not a win — skip it so it
      // can't distort win rate or ROI.
      if (Math.abs(settle.amount - stake) <= 0.01) continue
      const fullPayout = Math.abs(settle.amount - stake * p.odds) <= 0.05
      type = fullPayout ? 'win' : 'cashed_out'
      profitLoss = settle.amount - stake
      at = settle
    } else {
      type = settleUnmatched(p)
      profitLoss = type === 'loss' ? -stake : 0
    }

    // Hashed on the placement, never the outcome, so re-importing the same bet
    // once it settles updates the existing row instead of inserting a second one.
    const seed = `${p.dateString}${p.timeString}|${p.selection}|${p.odds}|${p.market}|${p.match}|${stake}`
    const hash = createHash('sha256').update(seed).digest('hex')
    const game = detectGame(p.match, `${p.selection} ${p.market}`)

    bets.push({
      sortMs: at.ms,
      bet: {
        id: hash.slice(0, 8),
        hash,
        type,
        // Dated by settlement when settled, so daily P/L lines up with the
        // balance the ledger reports for that day.
        date: at.dateString,
        dateString: at.dateString,
        timeString: at.timeString,
        match: p.match,
        selection: `${p.selection} · ${p.market}`,
        eventDate: '',
        odds: p.odds,
        stake,
        profitLoss,
        balance: at.balance,
        game,
        tournament: detectTournament(p.match, p.selection, game),
        isLive: p.match === p.selection,
        betType: detectBetType(p.market),
        impliedProbability: (1 / p.odds) * 100,
        estimatedOpponentOdds: 1 / ((1 / p.odds) - 0.05),
        breakEvenWinRate: (1 / p.odds) * 100,
        noVigProbability: 0,
        vigAmount: 0,
      },
    })
  }

  // Rest of the codebase assumes newest-first.
  return bets.sort((a, b) => b.sortMs - a.sortMs).map(b => b.bet)
}

function parseLinePerField(
  lines: string[],
  bets: ParsedBet[],
  transactions: ParsedTransaction[],
) {
  // 'stake' rows are pending-bet placeholders — we only import settled outcomes.
  // The settled row (win/loss/cashed out) carries the final P/L; importing the
  // stake row too would double-count and create hash collisions across pending+settled.
  const BET_STATUSES = new Set(['win', 'loss', 'cashed out'])
  const SKIP_STATUSES = new Set(['stake'])
  const TX_STATUSES = new Set(['withdraw', 'deposit'])

  let i = 0
  while (i < lines.length) {
    const status = lines[i].toLowerCase()

    if (TX_STATUSES.has(status)) {
      if (i + 7 >= lines.length) { i++; continue }
      const dateTime = lines[i + 1]
      const amountStr = lines[i + 6]
      const balanceStr = lines[i + 7]

      const dm = dateTime.match(/^(\d{1,2}\/\d{1,2}\/\d{2})(.+)$/)
      if (!dm) { i++; continue }
      const dateStr = dm[1]
      const timeStr = dm[2].trim()
      const fullDateTime = `${dateStr}${timeStr}`

      const rawAmount = parseFloat(amountStr.replace(/[$,\s]/g, '')) || 0
      const balance = parseFloat(balanceStr.replace(/[$,\s]/g, '')) || 0
      const txType: ParsedTransaction['type'] = status === 'deposit' ? 'deposit' : 'withdrawal'
      const amount = Math.abs(rawAmount)

      const tx: ParsedTransaction = {
        id: createHash('sha256').update(`${txType}-${fullDateTime}-${amount}`).digest('hex').slice(0, 8),
        hash: createHash('sha256').update(`${txType}-${fullDateTime}-${amount}`).digest('hex'),
        type: txType,
        date: parseDate(fullDateTime),
        dateString: dateStr,
        timeString: timeStr,
        amount,
        balanceAfter: balance,
      }
      transactions.push(tx)
      i += 8
      continue
    }

    if (SKIP_STATUSES.has(status)) {
      // Pending-bet placeholder — same 9-line shape, just skip the whole record.
      i += 9
      continue
    }

    if (BET_STATUSES.has(status)) {
      if (i + 8 >= lines.length) { i++; continue }
      const dateTime = lines[i + 1]
      const matchStr = lines[i + 2]
      const selectionStr = lines[i + 3]
      const eventDate = lines[i + 4]
      const oddsStr = lines[i + 5]
      const stakeStr = lines[i + 6]
      const amountStr = lines[i + 7]
      const balanceStr = lines[i + 8]

      const dm = dateTime.match(/^(\d{1,2}\/\d{1,2}\/\d{2})(.+)$/)
      if (!dm) { i++; continue }
      const dateStr = dm[1]
      const timeStr = dm[2].trim()
      const fullDateTime = `${dateStr}${timeStr}`

      const odds = parseFloat(oddsStr) || 0
      const stake = parseFloat(stakeStr.replace(/[$,\s]/g, '')) || 0
      const rawProfit = parseFloat(amountStr.replace(/[$,\s]/g, '')) || 0
      const balance = parseFloat(balanceStr.replace(/[$,\s]/g, '')) || 0

      const betType: ParsedBet['type'] =
        status === 'win' ? 'win' :
        status === 'loss' ? 'loss' :
        status === 'cashed out' ? 'cashed_out' :
        'win'

      // Net P/L (the amount column is cash-flow, not net):
      //   win/cashed_out: amount column is gross return → net = return - stake
      //   loss:           amount column is $0.00 (stake was deducted on the earlier "stake" row) → net = -stake
      let profitLoss = 0
      if (betType === 'win' || betType === 'cashed_out') profitLoss = rawProfit - stake
      else if (betType === 'loss') profitLoss = -stake

      const game = detectGame(matchStr, selectionStr)

      // Include odds in the hash — you sometimes hedge the same selection at two
      // different prices in the same minute, which would otherwise collide.
      const hashInput = `${fullDateTime}-${matchStr}-${selectionStr}-${stake}-${odds}`

      const bet: ParsedBet = {
        id: createHash('sha256').update(hashInput).digest('hex').slice(0, 8),
        hash: createHash('sha256').update(hashInput).digest('hex'),
        type: betType,
        date: parseDate(fullDateTime),
        dateString: dateStr,
        timeString: timeStr,
        match: matchStr,
        selection: selectionStr,
        eventDate,
        odds: odds || 1,
        stake,
        profitLoss,
        balance,
        game,
        tournament: detectTournament(matchStr, selectionStr, game),
        isLive: false,
        betType: detectBetType(selectionStr),
        impliedProbability: odds > 0 ? (1 / odds) * 100 : 0,
        estimatedOpponentOdds: odds > 0 ? (1 / ((1 / odds) - 0.05)) : 0,
        breakEvenWinRate: odds > 0 ? (1 / odds) * 100 : 0,
        noVigProbability: 0,
        vigAmount: 0,
      }
      bets.push(bet)
      i += 9
      continue
    }

    i++
  }
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
      profitByTag: [],
      calibrationBuckets: [],
      variance: {
        maxDrawdown: 0,
        maxDrawdownPct: 0,
        longestLosingStreak: 0,
        longestWinningStreak: 0,
        expectedMaxLosingStreak: 0,
        plDistribution: []
      },
      clv: { avgClvPct: 0, bets: 0, clvByDay: [] },
      currentStreak: { type: 'win', count: 0 },
      pendingBets: 0,
      pendingStake: 0
    }
  }

  const settledBets = bets.filter(b => b.type === 'win' || b.type === 'loss' || b.type === 'cashed_out')
  const pendingBets = bets.filter(b => b.type === 'pending')
  
  const totalProfit = settledBets.reduce((sum, b) => sum + b.profitLoss, 0)
  const winCount = settledBets.filter(b => b.type === 'win' || b.type === 'cashed_out').length
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
  const profitByDay = [
    // Start at zero so the chart shows the full journey
    { date: 'Start', profit: 0, cumulative: 0 },
    ...Array.from(profitByDayMap.entries())
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
  ]

  // Profit by game
  const profitByGameMap = new Map<string, { profit: number; count: number; wins: number }>()
  settledBets.forEach(bet => {
    const game = bet.game
    const entry = profitByGameMap.get(game) || { profit: 0, count: 0, wins: 0 }
    entry.profit += bet.profitLoss
    entry.count += 1
    if (bet.type === 'win' || (bet.type === 'cashed_out' && bet.profitLoss > 0)) entry.wins += 1
    profitByGameMap.set(game, entry)
  })

  const profitByGame = Array.from(profitByGameMap.entries()).map(([game, { profit, count, wins }]) => ({
    game,
    profit,
    betCount: count,
    winRate: count > 0 ? (wins / count) * 100 : 0
  }))

  // Profit by tag — untagged bets grouped under 'untagged' so user sees their drift.
  const profitByTagMap = new Map<string, { profit: number; count: number; wins: number; losses: number; staked: number }>()
  settledBets.forEach(bet => {
    const tag = bet.tag?.trim() || 'untagged'
    const entry = profitByTagMap.get(tag) || { profit: 0, count: 0, wins: 0, losses: 0, staked: 0 }
    entry.profit += bet.profitLoss
    entry.count += 1
    entry.staked += bet.stake
    if (bet.type === 'win' || (bet.type === 'cashed_out' && bet.profitLoss > 0)) entry.wins += 1
    if (bet.type === 'loss') entry.losses += 1
    profitByTagMap.set(tag, entry)
  })

  const profitByTag: TagPerformance[] = Array.from(profitByTagMap.entries())
    .map(([tag, { profit, count, wins, losses, staked }]) => ({
      tag,
      profit,
      betCount: count,
      winCount: wins,
      lossCount: losses,
      winRate: count > 0 ? (wins / count) * 100 : 0,
      totalStaked: staked,
      roi: staked > 0 ? (profit / staked) * 100 : 0
    }))
    .sort((a, b) => b.roi - a.roi)

  // Calibration: bucket settled bets by odds, compare avg implied vs actual hit rate.
  const bucketDefs: { label: string; min: number; max: number }[] = [
    { label: '1.40-1.70', min: 1.40, max: 1.70 },
    { label: '1.70-2.00', min: 1.70, max: 2.00 },
    { label: '2.00-2.50', min: 2.00, max: 2.50 },
    { label: '2.50-3.50', min: 2.50, max: 3.50 },
    { label: '3.50+', min: 3.50, max: Infinity }
  ]

  const calibrationBuckets: CalibrationBucket[] = bucketDefs.map(({ label, min, max }) => {
    const inBucket = settledBets.filter(b => b.odds >= min && b.odds < max)
    const count = inBucket.length
    const avgImplied = count > 0 ? inBucket.reduce((s, b) => s + (b.impliedProbability || 0), 0) / count : 0
    const wins = inBucket.filter(b => b.type === 'win' || (b.type === 'cashed_out' && b.profitLoss > 0)).length
    const actualHitRate = count > 0 ? (wins / count) * 100 : 0
    const delta = actualHitRate - avgImplied

    let verdict: CalibrationBucket['verdict'] = 'thin'
    if (count >= 10) {
      if (delta >= 5) verdict = 'sharp'
      else if (delta >= -3) verdict = 'fair'
      else if (delta >= -8) verdict = 'over-confident'
      else verdict = 'over-confident'
    } else if (count > 0) {
      verdict = 'thin'
    }

    return {
      label,
      minOdds: min,
      maxOdds: max,
      betCount: count,
      avgImplied,
      actualHitRate,
      delta,
      verdict
    }
  })

  // Calculate current streak — settledBets is sorted newest-first, so index 0 is the most recent.
  let currentStreak: { type: 'win' | 'loss'; count: number } = { type: 'win', count: 0 }
  for (let i = 0; i < settledBets.length; i++) {
    const bet = settledBets[i]
    const isWin = bet.type === 'win' || (bet.type === 'cashed_out' && bet.profitLoss > 0)
    if (i === 0) {
      currentStreak.type = isWin ? 'win' : 'loss'
      currentStreak.count = 1
    } else {
      const currentType = isWin ? 'win' : 'loss'
      if (currentType === currentStreak.type) {
        currentStreak.count++
      } else {
        break
      }
    }
  }

  // Variance dashboard: max drawdown, longest streaks, expected losing streak, P/L histogram.
  // Bets are sorted newest-first in this codebase — reverse to chronological for streak/drawdown.
  const chronological = [...settledBets].reverse()

  let peakCumulative = 0
  let runningCumulative = 0
  let maxDrawdown = 0
  let peakAtMaxDD = 0
  for (const bet of chronological) {
    runningCumulative += bet.profitLoss
    if (runningCumulative > peakCumulative) peakCumulative = runningCumulative
    const dd = peakCumulative - runningCumulative
    if (dd > maxDrawdown) {
      maxDrawdown = dd
      peakAtMaxDD = peakCumulative
    }
  }
  const maxDrawdownPct = peakAtMaxDD > 0 ? (maxDrawdown / peakAtMaxDD) * 100 : 0

  let longestLosingStreak = 0
  let longestWinningStreak = 0
  let curLoss = 0
  let curWin = 0
  for (const bet of chronological) {
    const isWin = bet.type === 'win' || (bet.type === 'cashed_out' && bet.profitLoss > 0)
    if (isWin) {
      curWin++
      curLoss = 0
      if (curWin > longestWinningStreak) longestWinningStreak = curWin
    } else {
      curLoss++
      curWin = 0
      if (curLoss > longestLosingStreak) longestLosingStreak = curLoss
    }
  }

  // Schilling's approximation: E[longest run of losses in n trials] ≈
  //   log_{1/q}(n(1-q)) + γ/ln(1/q) - 0.5,  γ ≈ 0.5772
  // q = P(loss). Reasonable accuracy for n ≥ 20.
  const n = settledBets.length
  const lossProb = n > 0 ? lossCount / n : 0
  let expectedMaxLosingStreak = 0
  if (n >= 10 && lossProb > 0 && lossProb < 1) {
    const lnInvQ = Math.log(1 / lossProb)
    expectedMaxLosingStreak = Math.log(n * (1 - lossProb)) / lnInvQ + 0.5772 / lnInvQ - 0.5
    if (expectedMaxLosingStreak < 0) expectedMaxLosingStreak = 0
  }

  // P/L histogram across settled bets — buckets in dollars relative to avg stake so it scales.
  const plBucketDefs: { label: string; min: number; max: number }[] = [
    { label: '<-3x', min: -Infinity, max: -3 },
    { label: '-3x to -2x', min: -3, max: -2 },
    { label: '-2x to -1x', min: -2, max: -1 },
    { label: '-1x to 0', min: -1, max: 0 },
    { label: '0 to +1x', min: 0, max: 1 },
    { label: '+1x to +2x', min: 1, max: 2 },
    { label: '+2x to +3x', min: 2, max: 3 },
    { label: '+3x to +5x', min: 3, max: 5 },
    { label: '>+5x', min: 5, max: Infinity }
  ]
  const plDistribution = plBucketDefs.map(({ label, min, max }) => {
    const count = settledBets.filter(b => {
      const ratio = b.stake > 0 ? b.profitLoss / b.stake : 0
      return ratio >= min && ratio < max
    }).length
    return { label, count, min, max }
  })

  const variance: VarianceStats = {
    maxDrawdown,
    maxDrawdownPct,
    longestLosingStreak,
    longestWinningStreak,
    expectedMaxLosingStreak,
    plDistribution
  }

  // CLV aggregation — only bets with a recorded closing line contribute.
  const clvBets = settledBets.filter(b => typeof b.clvPct === 'number' && b.clvPct !== null) as (ParsedBet & { clvPct: number })[]
  const avgClvPct = clvBets.length > 0 ? clvBets.reduce((s, b) => s + b.clvPct, 0) / clvBets.length : 0

  const clvByDayMap = new Map<string, { sum: number; count: number }>()
  clvBets.forEach(bet => {
    const day = bet.date
    if (typeof day !== 'string' || !day) return
    const entry = clvByDayMap.get(day) || { sum: 0, count: 0 }
    entry.sum += bet.clvPct
    entry.count += 1
    clvByDayMap.set(day, entry)
  })

  let runningClvSum = 0
  let runningClvCount = 0
  const clvByDay = Array.from(clvByDayMap.entries())
    .sort((a, b) => {
      try {
        const dateA = a[0].split('/').reverse().join('-')
        const dateB = b[0].split('/').reverse().join('-')
        return new Date(dateA).getTime() - new Date(dateB).getTime()
      } catch {
        return 0
      }
    })
    .map(([date, { sum, count }]) => {
      runningClvSum += sum
      runningClvCount += count
      return {
        date,
        avgClv: sum / count,
        cumulative: runningClvCount > 0 ? runningClvSum / runningClvCount : 0,
        betCount: count
      }
    })

  const clv: ClvStats = { avgClvPct, bets: clvBets.length, clvByDay }

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
    profitByTag,
    calibrationBuckets,
    variance,
    clv,
    currentStreak,
    pendingBets: pendingBets.length,
    pendingStake
  }
}

export function checkDuplicates(
  parsedBets: ParsedBet[],
  parsedTransactions: ParsedTransaction[],
  existingBetStatuses: Map<string, string>,
  existingTxHashes: Set<string>
): ImportResult {
  const newBets: ParsedBet[] = []
  const updatedBets: ParsedBet[] = []
  const duplicateBets: ParsedBet[] = []

  for (const bet of parsedBets) {
    const stored = existingBetStatuses.get(bet.hash)
    if (stored === undefined) newBets.push(bet)
    else if (stored !== bet.type) updatedBets.push(bet)
    else duplicateBets.push(bet)
  }

  return {
    newBets,
    updatedBets,
    duplicateBets,
    newTransactions: parsedTransactions.filter(tx => !existingTxHashes.has(tx.hash)),
    duplicateTransactions: parsedTransactions.filter(tx => existingTxHashes.has(tx.hash)),
    bets: parsedBets,
    transactions: parsedTransactions,
  }
}