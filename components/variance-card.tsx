'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, TrendingDown, Flame } from 'lucide-react'
import type { VarianceStats } from '@/lib/parse-bets'

interface VarianceCardProps {
  variance: VarianceStats
}

export function VarianceCard({ variance }: VarianceCardProps) {
  const {
    maxDrawdown,
    maxDrawdownPct,
    longestLosingStreak,
    longestWinningStreak,
    expectedMaxLosingStreak,
    plDistribution,
  } = variance

  const maxBucketCount = Math.max(...plDistribution.map(b => b.count), 1)
  const streakDelta = longestLosingStreak - expectedMaxLosingStreak
  const streakVerdict =
    expectedMaxLosingStreak === 0
      ? null
      : streakDelta >= 2
        ? { label: 'unlucky', tone: 'text-warning bg-warning/20 border-warning/30' }
        : streakDelta <= -2
          ? { label: 'lucky', tone: 'text-chart-1 bg-chart-1/20 border-chart-1/30' }
          : { label: 'on track', tone: 'text-muted-foreground bg-secondary/50 border-border' }

  return (
    <Card className="stat-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-primary" />
          Variance & Drawdown
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-destructive/10 border-l-2 border-destructive">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Max drawdown
            </p>
            <p className="font-mono font-bold text-destructive">
              -${maxDrawdown.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              {maxDrawdownPct.toFixed(1)}% off peak
            </p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/30">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Flame className="h-3 w-3" /> Longest streaks
            </p>
            <p className="font-mono font-bold">
              <span className="text-chart-1">{longestWinningStreak}W</span>
              <span className="text-muted-foreground"> / </span>
              <span className="text-destructive">{longestLosingStreak}L</span>
            </p>
            {streakVerdict && (
              <div className="mt-1">
                <Badge variant="outline" className={`text-xs ${streakVerdict.tone}`}>
                  vs expected {expectedMaxLosingStreak.toFixed(1)}L — {streakVerdict.label}
                </Badge>
              </div>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            P/L distribution (per-bet, in stake multiples)
          </p>
          <div className="space-y-1.5">
            {plDistribution.map(b => {
              const isLoss = b.max <= 0
              const isWin = b.min >= 0
              return (
                <div key={b.label} className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-muted-foreground w-20 shrink-0">{b.label}</span>
                  <div className="flex-1 h-4 rounded bg-secondary/30 overflow-hidden">
                    <div
                      className={`h-full rounded ${
                        isLoss ? 'bg-destructive/60' : isWin ? 'bg-chart-1/60' : 'bg-muted'
                      }`}
                      style={{ width: `${(b.count / maxBucketCount) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-muted-foreground w-8 text-right">{b.count}</span>
                </div>
              )
            })}
          </div>
        </div>

        <p className="text-xs text-muted-foreground border-t border-border/30 pt-3">
          Expected losing streak uses Schilling's approximation given your loss rate. Within ±2 of expected is normal variance; bigger gaps suggest sample bias or a real shift.
        </p>
      </CardContent>
    </Card>
  )
}
