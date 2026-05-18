'use client'

import { Card, CardContent } from '@/components/ui/card'
import type { BetStats } from '@/lib/parse-bets'
import { TrendingUp, TrendingDown, Target, DollarSign, Percent, Award, BarChart3, Flame, Zap } from 'lucide-react'

interface StatsCardsProps {
  stats: BetStats
  truePL?: number  // Override totalProfit with actual balance-based P/L
  detailed?: boolean
}

export function StatsCards({ stats, truePL, detailed = false }: StatsCardsProps) {
  const displayProfit = truePL !== undefined ? truePL : stats.totalProfit
  const isProfit = displayProfit >= 0
  const requiredWinRate = stats.averageOdds > 0 ? (100 / stats.averageOdds) : 0
  const edge = stats.winRate - requiredWinRate
  const displayROI = stats.totalStaked > 0 ? (displayProfit / stats.totalStaked) * 100 : 0

  const baseCards = (
    <>
      <Card className="stat-card group">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Net Profit/Loss</p>
              <p className={`text-2xl font-bold font-mono ${isProfit ? 'text-chart-1 text-glow-green' : 'text-destructive text-glow-red'}`}>
                {isProfit ? '+' : ''}${displayProfit.toFixed(2)}
              </p>
            </div>
            <div className={`rounded-xl p-2.5 transition-all group-hover:scale-110 ${isProfit ? 'bg-chart-1/10' : 'bg-destructive/10'}`}>
              {isProfit ? (
                <TrendingUp className="h-5 w-5 text-chart-1" />
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
      <Card className="stat-card group">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">ROI</p>
              <p className={`text-2xl font-bold font-mono ${displayROI >= 0 ? 'text-chart-1' : 'text-destructive'}`}>
                {displayROI >= 0 ? '+' : ''}{displayROI.toFixed(1)}%
              </p>
            </div>
            <div className={`rounded-xl p-2.5 transition-all group-hover:scale-110 ${displayROI >= 0 ? 'bg-chart-1/10' : 'bg-destructive/10'}`}>
              <Percent className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Return on investment
          </p>
        </CardContent>
      </Card>

      {/* Win Rate */}
      <Card className="stat-card group">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Win Rate</p>
              <p className={`text-2xl font-bold font-mono ${stats.winRate > requiredWinRate ? 'text-chart-1' : 'text-foreground'}`}>
                {stats.winRate.toFixed(1)}%
              </p>
            </div>
            <div className="rounded-xl bg-secondary p-2.5 transition-all group-hover:scale-110">
              <Target className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {stats.winCount}W - {stats.lossCount}L of {stats.totalBets} bets
          </p>
        </CardContent>
      </Card>

      {/* Average Odds */}
      <Card className="stat-card group">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Odds</p>
              <p className="text-2xl font-bold font-mono text-foreground">
                {stats.averageOdds.toFixed(2)}
              </p>
            </div>
            <div className="rounded-xl bg-secondary p-2.5 transition-all group-hover:scale-110">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Requires {requiredWinRate.toFixed(1)}% to break even
          </p>
        </CardContent>
      </Card>
    </>
  )

  const detailedCards = detailed && (
    <>
      {/* Average Stake */}
      <Card className="stat-card group">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Stake</p>
              <p className="text-2xl font-bold font-mono text-foreground">
                ${stats.averageStake.toFixed(2)}
              </p>
            </div>
            <div className="rounded-xl bg-secondary p-2.5 transition-all group-hover:scale-110">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Per bet average
          </p>
        </CardContent>
      </Card>

      {/* Pending Bets */}
      <Card className="stat-card group">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold font-mono text-foreground">
                {stats.pendingBets}
              </p>
            </div>
            <div className="rounded-xl bg-secondary p-2.5 transition-all group-hover:scale-110">
              <Award className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            ${stats.pendingStake.toFixed(2)} at risk
          </p>
        </CardContent>
      </Card>

      {/* Current Streak */}
      <Card className={`stat-card group ${stats.currentStreak.type === 'win' && stats.currentStreak.count >= 3 ? 'ring-1 ring-chart-1/30' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current Streak</p>
              <p className={`text-2xl font-bold font-mono ${stats.currentStreak.type === 'win' ? 'text-chart-1' : 'text-destructive'}`}>
                {stats.currentStreak.count} {stats.currentStreak.type === 'win' ? 'W' : 'L'}
                {stats.currentStreak.type === 'win' && stats.currentStreak.count >= 3 && ' 🔥'}
              </p>
            </div>
            <div className={`rounded-xl p-2.5 transition-all group-hover:scale-110 ${stats.currentStreak.type === 'win' ? 'bg-chart-1/10' : 'bg-destructive/10'}`}>
              {stats.currentStreak.type === 'win' && stats.currentStreak.count >= 3 ? (
                <Flame className={`h-5 w-5 text-chart-1`} />
              ) : (
                <Zap className={`h-5 w-5 ${stats.currentStreak.type === 'win' ? 'text-chart-1' : 'text-destructive'}`} />
              )}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {stats.currentStreak.type === 'win' ? 'Winning' : 'Losing'} streak
          </p>
        </CardContent>
      </Card>

      {/* Edge vs Market */}
      <Card className="stat-card group">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Edge vs Market</p>
              <p className={`text-2xl font-bold font-mono ${edge >= 0 ? 'text-chart-1' : 'text-destructive'}`}>
                {edge >= 0 ? '+' : ''}{edge.toFixed(1)}%
              </p>
            </div>
            <div className={`rounded-xl p-2.5 transition-all group-hover:scale-110 ${edge >= 0 ? 'bg-chart-1/10' : 'bg-destructive/10'}`}>
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Win rate vs implied probability
          </p>
        </CardContent>
      </Card>

      {/* Pending */}
      <Card className={`stat-card group ${stats.pendingBets > 0 ? 'ring-1 ring-warning/30' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending Bets</p>
              <p className={`text-2xl font-bold font-mono ${stats.pendingBets > 0 ? 'text-warning' : 'text-foreground'}`}>
                {stats.pendingBets}
              </p>
            </div>
            <div className={`rounded-xl p-2.5 transition-all group-hover:scale-110 ${stats.pendingBets > 0 ? 'bg-warning/10' : 'bg-secondary'}`}>
              <Clock className="h-5 w-5 text-warning" />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            ${stats.pendingStake.toFixed(2)} at risk
          </p>
        </CardContent>
      </Card>
    </>
  )

  return (
    <div className={`grid gap-4 ${detailed ? 'sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
      {baseCards}
      {detailedCards}
    </div>
  )
}
