'use client'

import { Card, CardContent } from '@/components/ui/card'
import type { BettingStats } from '@/lib/parse-bets'
import { TrendingUp, TrendingDown, Target, DollarSign, Percent, Zap, Award, BarChart3 } from 'lucide-react'

interface StatsCardsProps {
  stats: BettingStats
}

export function StatsCards({ stats }: StatsCardsProps) {
  const isProfit = stats.totalProfit >= 0

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Profit/Loss */}
      <Card className="border-border/50 bg-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Net Profit/Loss</p>
              <p className={`text-2xl font-bold ${isProfit ? 'text-primary' : 'text-destructive'}`}>
                {isProfit ? '+' : ''}{stats.totalProfit.toFixed(2)}
              </p>
            </div>
            <div className={`rounded-lg p-2.5 ${isProfit ? 'bg-primary/10' : 'bg-destructive/10'}`}>
              {isProfit ? (
                <TrendingUp className="h-5 w-5 text-primary" />
              ) : (
                <TrendingDown className="h-5 w-5 text-destructive" />
              )}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            From ${stats.totalStaked.toFixed(2)} total staked
          </p>
        </CardContent>
      </Card>

      {/* ROI */}
      <Card className="border-border/50 bg-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">ROI</p>
              <p className={`text-2xl font-bold ${stats.roi >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(1)}%
              </p>
            </div>
            <div className={`rounded-lg p-2.5 ${stats.roi >= 0 ? 'bg-primary/10' : 'bg-destructive/10'}`}>
              <Percent className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Return on investment
          </p>
        </CardContent>
      </Card>

      {/* Win Rate */}
      <Card className="border-border/50 bg-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Win Rate</p>
              <p className="text-2xl font-bold text-foreground">
                {stats.winRate.toFixed(1)}%
              </p>
            </div>
            <div className="rounded-lg bg-secondary p-2.5">
              <Target className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {stats.totalWins}W - {stats.totalLosses}L of {stats.totalBets} bets
          </p>
        </CardContent>
      </Card>

      {/* Average Odds */}
      <Card className="border-border/50 bg-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Odds</p>
              <p className="text-2xl font-bold text-foreground">
                {stats.averageOdds.toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg bg-secondary p-2.5">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Implied {(100 / stats.averageOdds).toFixed(1)}% probability
          </p>
        </CardContent>
      </Card>

      {/* Average Stake */}
      <Card className="border-border/50 bg-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Stake</p>
              <p className="text-2xl font-bold text-foreground">
                ${stats.averageStake.toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg bg-secondary p-2.5">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Per bet average
          </p>
        </CardContent>
      </Card>

      {/* Biggest Win */}
      <Card className="border-border/50 bg-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Biggest Win</p>
              <p className="text-2xl font-bold text-primary">
                +${stats.biggestWin.toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Award className="h-5 w-5 text-primary" />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Best single bet
          </p>
        </CardContent>
      </Card>

      {/* Biggest Loss */}
      <Card className="border-border/50 bg-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Biggest Loss</p>
              <p className="text-2xl font-bold text-destructive">
                -${stats.biggestLoss.toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg bg-destructive/10 p-2.5">
              <TrendingDown className="h-5 w-5 text-destructive" />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Worst single bet
          </p>
        </CardContent>
      </Card>

      {/* Current Streak */}
      <Card className="border-border/50 bg-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current Streak</p>
              <p className={`text-2xl font-bold ${stats.currentStreak.type === 'win' ? 'text-primary' : 'text-destructive'}`}>
                {stats.currentStreak.count} {stats.currentStreak.type === 'win' ? 'W' : 'L'}
              </p>
            </div>
            <div className={`rounded-lg p-2.5 ${stats.currentStreak.type === 'win' ? 'bg-primary/10' : 'bg-destructive/10'}`}>
              <Zap className={`h-5 w-5 ${stats.currentStreak.type === 'win' ? 'text-primary' : 'text-destructive'}`} />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {stats.currentStreak.type === 'win' ? 'Winning' : 'Losing'} streak
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
