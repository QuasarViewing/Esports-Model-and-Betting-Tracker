'use server'

import { createClient } from '@/lib/supabase/server'
import type { ParsedBet, ParsedTransaction } from '@/lib/parse-bets'
import { clvPercent } from '@/lib/clv'

// Postgres `date` rejects "DD/MM/YY". Convert to ISO "YYYY-MM-DD" before insert.
// Two-digit year is treated as 20YY (we're tracking current bets, not historical pre-2000 data).
function toPgDate(dateStr: string): string | null {
  const m = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
  if (!m) return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : null
  return `20${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

// Postgres `time` rejects "9:18AM". Convert to "HH:MM:SS".
function toPgTime(timeStr: string | null): string | null {
  if (!timeStr) return null
  const m = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return /^\d{2}:\d{2}(:\d{2})?$/.test(timeStr) ? timeStr : null
  let h = parseInt(m[1], 10)
  const min = m[2]
  const ampm = m[3].toUpperCase()
  if (ampm === 'PM' && h !== 12) h += 12
  if (ampm === 'AM' && h === 12) h = 0
  return `${String(h).padStart(2, '0')}:${min}:00`
}

export interface DbBet {
  id: string
  bet_hash: string
  date: string
  time: string | null
  game: string
  match: string
  selection: string
  bet_type: string | null
  odds: number
  stake: number
  profit_loss: number | null
  status: string
  balance_after: number | null
  tournament_id: string | null
  created_at: string
  // Vig metrics
  implied_probability: number | null
  estimated_opponent_odds: number | null
  break_even_win_rate: number | null
  no_vig_probability: number | null
  vig_amount: number | null
  manual_opponent_odds: number | null
  estimated_edge: number | null
  // Phase 2: edge-by-category tagging
  tag: string | null
  // Phase 3: closing line value
  odds_at_placement: number | null
  closing_odds: number | null
  clv_pct: number | null
}

export interface DbTransaction {
  id: string
  tx_hash: string
  type: 'deposit' | 'withdrawal'
  amount: number
  bookmaker: string
  method: string | null
  date: string
  time: string | null
  balance_after: number | null
  notes: string | null
  created_at: string
}

export async function getExistingHashes(): Promise<{ betStatuses: Map<string, string>; txHashes: Set<string> }> {
  const supabase = await createClient()

  const [betsResult, txResult] = await Promise.all([
    supabase.from('bets').select('bet_hash, status'),
    supabase.from('transactions').select('tx_hash')
  ])

  const betStatuses = new Map<string, string>((betsResult.data || []).map(b => [b.bet_hash, b.status]))
  const txHashes = new Set<string>((txResult.data || []).map(t => t.tx_hash))

  return { betStatuses, txHashes }
}

export async function saveBets(bets: ParsedBet[]): Promise<{ inserted: number; errors: string[] }> {
  const supabase = await createClient()
  const errors: string[] = []
  let inserted = 0
  
  for (const bet of bets) {
    const pgDate = toPgDate(bet.date)
    if (!pgDate) {
      errors.push(`Bad date for ${bet.match}: "${bet.date}"`)
      continue
    }
    const { error } = await supabase.from('bets').insert({
      bet_hash: bet.hash,
      date: pgDate,
      time: toPgTime(bet.timeString),
      game: bet.game,
      match: bet.match,
      selection: bet.selection,
      bet_type: bet.betType,
      odds: bet.odds,
      stake: bet.stake,
      profit_loss: bet.type === 'pending' ? null : bet.profitLoss,
      status: bet.type,
      balance_after: bet.balance,
      tournament_id: null,
      // Vig metrics
      implied_probability: bet.impliedProbability,
      estimated_opponent_odds: bet.estimatedOpponentOdds,
      break_even_win_rate: bet.breakEvenWinRate,
      no_vig_probability: bet.noVigProbability,
      vig_amount: bet.vigAmount,
      manual_opponent_odds: null,
      estimated_edge: null,
      tag: bet.tag ?? null,
      odds_at_placement: bet.odds,
      closing_odds: null,
      clv_pct: null
    })
    
    if (error) {
      if (!error.message.includes('duplicate')) {
        errors.push(`Failed to save bet: ${bet.match} - ${error.message}`)
      }
    } else {
      inserted++
    }
  }
  
  return { inserted, errors }
}

// Settling a pending bet: only the outcome fields move, so manual edits the user
// made to the row (game override, tag, closing odds) survive the re-import.
export async function updateSettledBets(bets: ParsedBet[]): Promise<{ updated: number; errors: string[] }> {
  const supabase = await createClient()
  const errors: string[] = []
  let updated = 0

  for (const bet of bets) {
    const pgDate = toPgDate(bet.date)
    const { error } = await supabase
      .from('bets')
      .update({
        status: bet.type,
        profit_loss: bet.type === 'pending' ? null : bet.profitLoss,
        balance_after: bet.balance,
        ...(pgDate ? { date: pgDate, time: toPgTime(bet.timeString) } : {}),
      })
      .eq('bet_hash', bet.hash)

    if (error) errors.push(`Failed to settle bet: ${bet.match} - ${error.message}`)
    else updated++
  }

  return { updated, errors }
}

export async function saveTransactions(transactions: ParsedTransaction[]): Promise<{ inserted: number; errors: string[] }> {
  const supabase = await createClient()
  const errors: string[] = []
  let inserted = 0
  
  for (const tx of transactions) {
    const pgDate = toPgDate(tx.date)
    if (!pgDate) {
      errors.push(`Bad date for ${tx.type}: "${tx.date}"`)
      continue
    }
    const { error } = await supabase.from('transactions').insert({
      tx_hash: tx.hash,
      type: tx.type,
      amount: tx.amount,
      bookmaker: 'Tab',
      method: null,
      date: pgDate,
      time: toPgTime(tx.timeString),
      balance_after: tx.balanceAfter,
      notes: null
    })
    
    if (error) {
      if (!error.message.includes('duplicate')) {
        errors.push(`Failed to save transaction: ${tx.type} $${tx.amount} - ${error.message}`)
      }
    } else {
      inserted++
    }
  }
  
  return { inserted, errors }
}

export async function getAllBets(): Promise<DbBet[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('bets')
    .select('*')
    .order('date', { ascending: false })
    .order('time', { ascending: false })
  
  if (error) {
    console.error('Error fetching bets:', error)
    return []
  }
  
  return data || []
}

export async function getAllTransactions(): Promise<DbTransaction[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })
    .order('time', { ascending: false })
  
  if (error) {
    console.error('Error fetching transactions:', error)
    return []
  }
  
  return data || []
}

export async function updateBetStatus(betHash: string, status: string, profitLoss: number): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('bets')
    .update({ status, profit_loss: profitLoss, updated_at: new Date().toISOString() })
    .eq('bet_hash', betHash)

  return !error
}

export async function updateBetGame(
  betId: string,
  game: 'dota2' | 'lol' | 'csgo' | 'valorant',
): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('bets')
    .update({ game })
    .eq('id', betId)
  if (error) {
    console.error('updateBetGame error:', error)
    return false
  }
  return true
}

export async function updateBetTag(betId: string, tag: string | null): Promise<boolean> {
  const supabase = await createClient()
  const normalized = tag?.trim().toLowerCase() || null
  const { error } = await supabase
    .from('bets')
    .update({ tag: normalized })
    .eq('id', betId)

  return !error
}

export async function bulkUpdateBetTag(betIds: string[], tag: string | null): Promise<number> {
  if (betIds.length === 0) return 0
  const supabase = await createClient()
  const normalized = tag?.trim().toLowerCase() || null
  const { error, count } = await supabase
    .from('bets')
    .update({ tag: normalized }, { count: 'exact' })
    .in('id', betIds)

  if (error) {
    console.error('bulkUpdateBetTag error:', error)
    return 0
  }
  return count ?? 0
}

export async function updateBetClosingOdds(
  betId: string,
  closingOdds: number | null
): Promise<{ ok: boolean; clvPct: number | null }> {
  const supabase = await createClient()

  // Read odds_at_placement (fall back to odds for legacy rows) to compute CLV server-side.
  const { data: row, error: readErr } = await supabase
    .from('bets')
    .select('odds, odds_at_placement')
    .eq('id', betId)
    .single()

  if (readErr || !row) {
    console.error('updateBetClosingOdds read error:', readErr)
    return { ok: false, clvPct: null }
  }

  const placement = Number(row.odds_at_placement ?? row.odds)
  const clvPct = clvPercent(placement, closingOdds)

  const { error } = await supabase
    .from('bets')
    .update({ closing_odds: closingOdds, clv_pct: clvPct })
    .eq('id', betId)

  if (error) {
    console.error('updateBetClosingOdds write error:', error)
    return { ok: false, clvPct: null }
  }
  return { ok: true, clvPct }
}

export async function deleteBet(id: string): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase.from('bets').delete().eq('id', id)
  return !error
}

export async function deleteTransaction(id: string): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  return !error
}
