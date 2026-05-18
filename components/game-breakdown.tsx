'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { BettingStats } from '@/lib/parse-bets'

interface GameBreakdownProps {
  profitByGame: Record<string, number>
  stats: BettingStats
}

const gameLabels: Record<string, string> = {
  dota2: 'Dota 2',
  lol: 'League of Legends',
  csgo: 'Counter-Strike 2',
  valorant: 'Valorant',
  other: 'Other',
}

const gameColors: Record<string, string> = {
  dota2: 'bg-chart-1',
  lol: 'bg-chart-3',
  csgo: 'bg-chart-4',
  valorant: 'bg-chart-5',
  other: 'bg-muted',
}

export function GameBreakdown({ profitByGame, stats }: GameBreakdownProps) {
  const games = Object.entries(profitByGame).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  const maxProfit = Math.max(...games.map(([, profit]) => Math.abs(profit)), 1)

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Performance by Game</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {games.length === 0 ? (
          <p className="text-center text-muted-foreground">No game data available</p>
        ) : (
          games.map(([game, profit]) => (
            <div key={game} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{gameLabels[game] || game}</span>
                <span className={`font-mono ${profit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {profit >= 0 ? '+' : ''}{profit.toFixed(2)}
                </span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className={`absolute h-full ${profit >= 0 ? gameColors[game] : 'bg-destructive'} rounded-full transition-all`}
                  style={{ width: `${(Math.abs(profit) / maxProfit) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}

        {/* Additional Stats */}
        <div className="mt-6 border-t border-border/50 pt-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Edge vs Market</span>
            <span className={`font-mono ${stats.impliedProbabilityVsActual >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {stats.impliedProbabilityVsActual >= 0 ? '+' : ''}{(stats.impliedProbabilityVsActual * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Required Win Rate</span>
            <span className="font-mono text-foreground">
              {(100 / stats.averageOdds).toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Actual Win Rate</span>
            <span className={`font-mono ${stats.winRate > (100 / stats.averageOdds) ? 'text-primary' : 'text-destructive'}`}>
              {stats.winRate.toFixed(1)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
