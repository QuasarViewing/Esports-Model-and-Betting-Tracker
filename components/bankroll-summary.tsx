'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Wallet, TrendingUp, TrendingDown, PiggyBank, ArrowUpCircle, ArrowDownCircle, BarChart3 } from 'lucide-react'
import type { Transaction } from './transactions'
import type { BetStats } from '@/lib/parse-bets'

interface BankrollSummaryProps {
  transactions: Transaction[]
  stats: BetStats
  currentBalance?: number
}

export function BankrollSummary({ transactions, stats, currentBalance }: BankrollSummaryProps) {
  const totalDeposits = transactions
    .filter(t => t.type === 'deposit')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalWithdrawals = transactions
    .filter(t => t.type === 'withdrawal')
    .reduce((sum, t) => sum + t.amount, 0)

  const netDeposits = totalDeposits - totalWithdrawals
  const bettingProfit = stats.totalProfit
  
  // True P/L = what you can withdraw - what you deposited
  // If currentBalance provided (from Tab), use that
  // Otherwise calculate: netDeposits + bettingProfit
  const calculatedBankroll = netDeposits + bettingProfit
  const displayBankroll = currentBalance ?? calculatedBankroll
  
  // True profit: current balance - net deposits
  const trueProfit = displayBankroll - netDeposits
  
  // True ROI: profit / total deposited
  const trueROI = totalDeposits > 0 ? (trueProfit / totalDeposits) * 100 : 0

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <PiggyBank className="h-5 w-5 text-primary" />
          Bankroll Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Current Bankroll */}
          <div className="rounded-lg bg-background/50 p-4 text-center">
            <div className="mb-1 flex items-center justify-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Current Bankroll</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              ${displayBankroll.toFixed(2)}
            </p>
            {currentBalance && (
              <p className="mt-1 text-xs text-muted-foreground">From Tab balance</p>
            )}
          </div>

          {/* Net Deposited */}
          <div className="rounded-lg bg-background/50 p-4 text-center">
            <div className="mb-1 flex items-center justify-center gap-2">
              <ArrowDownCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Net Deposited</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              ${netDeposits.toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              ${totalDeposits.toFixed(0)} in / ${totalWithdrawals.toFixed(0)} out
            </p>
          </div>

          {/* True Profit */}
          <div className="rounded-lg bg-background/50 p-4 text-center">
            <div className="mb-1 flex items-center justify-center gap-2">
              {trueProfit >= 0 ? (
                <TrendingUp className="h-4 w-4 text-primary" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive" />
              )}
              <span className="text-xs text-muted-foreground">True Profit</span>
            </div>
            <p className={`text-2xl font-bold ${trueProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {trueProfit >= 0 ? '+' : ''}{trueProfit.toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Bankroll - Net Deposits
            </p>
          </div>

          {/* True ROI */}
          <div className="rounded-lg bg-background/50 p-4 text-center">
            <div className="mb-1 flex items-center justify-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">True ROI</span>
            </div>
            <p className={`text-2xl font-bold ${trueROI >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {trueROI >= 0 ? '+' : ''}{trueROI.toFixed(1)}%
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              On total deposited
            </p>
          </div>
        </div>

        {/* Breakdown Bar */}
        {totalDeposits > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex justify-between text-xs text-muted-foreground">
              <span>Breakdown</span>
              <span>{((displayBankroll / totalDeposits) * 100).toFixed(0)}% of deposits</span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-secondary">
              {trueProfit >= 0 ? (
                <>
                  <div 
                    className="bg-muted-foreground/30" 
                    style={{ width: `${Math.min((netDeposits / displayBankroll) * 100, 100)}%` }}
                  />
                  <div 
                    className="bg-primary" 
                    style={{ width: `${Math.max((trueProfit / displayBankroll) * 100, 0)}%` }}
                  />
                </>
              ) : (
                <div 
                  className="bg-destructive" 
                  style={{ width: `${Math.min((displayBankroll / netDeposits) * 100, 100)}%` }}
                />
              )}
            </div>
            <div className="mt-1 flex justify-between text-xs">
              <span className="text-muted-foreground">Net Deposits</span>
              <span className={trueProfit >= 0 ? 'text-primary' : 'text-destructive'}>
                {trueProfit >= 0 ? 'Profit' : 'Loss'}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
