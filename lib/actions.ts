'use server'

import { createClient } from '@/lib/supabase/server'
import type { ParsedBet, ParsedTransaction } from '@/lib/parse-bets'

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
  manual_opponent_odds: number | null
  estimated_edge: number | null
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

export async function getExistingHashes(): Promise<{ betHashes: Set<string>; txHashes: Set<string> }> {
  const supabase = await createClient()
  
  const [betsResult, txResult] = await Promise.all([
    supabase.from('bets').select('bet_hash'),
    supabase.from('transactions').select('tx_hash')
  ])
  
  const betHashes = new Set<string>((betsResult.data || []).map(b => b.bet_hash))
  const txHashes = new Set<string>((txResult.data || []).map(t => t.tx_hash))
  
  return { betHashes, txHashes }
}

export async function saveBets(bets: ParsedBet[]): Promise<{ inserted: number; errors: string[] }> {
  const supabase = await createClient()
  const errors: string[] = []
  let inserted = 0
  
  for (const bet of bets) {
    const { error } = await supabase.from('bets').insert({
      bet_hash: bet.hash,
      date: bet.date.toISOString().split('T')[0],
      time: bet.timeString || null,
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
      manual_opponent_odds: bet.manualOpponentOdds || null,
      estimated_edge: bet.estimatedEdge || null
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

export async function saveTransactions(transactions: ParsedTransaction[]): Promise<{ inserted: number; errors: string[] }> {
  const supabase = await createClient()
  const errors: string[] = []
  let inserted = 0
  
  for (const tx of transactions) {
    const { error } = await supabase.from('transactions').insert({
      tx_hash: tx.hash,
      type: tx.type,
      amount: tx.amount,
      bookmaker: 'Tab',
      method: null,
      date: tx.date.toISOString().split('T')[0],
      time: tx.timeString || null,
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
