'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { BetStats } from '@/lib/parse-bets'

interface GameBreakdownProps {
  profitByGame: { game: string; profit: number; betCount: number; winRate: number }[]
  stats: BetStats
}

const gameLabels: Record<string, string> = {
  dota2: 'Dota 2',
  lol: 'League of Legends',
  csgo: 'Counter-Strike 2',
  valorant: 'Valorant',
  other: 'Other',
}

const gameColors: Record<string, { bg: string; bar: string; border: string }> = {
  dota2: { 
    bg: 'bg-[oklch(0.6_0.18_25/0.1)]', 
    bar: 'bg-[oklch(0.6_0.18_25)]',
    border: 'border-l-[oklch(0.6_0.18_25)]'
  },
  lol: { 
    bg: 'bg-[oklch(0.65_0.15_230/0.1)]', 
    bar: 'bg-[oklch(0.65_0.15_230)]',
    border: 'border-l-[oklch(0.65_0.15_230)]'
  },
  csgo: { 
    bg: 'bg-[oklch(0.7_0.12_55/0.1)]', 
    bar: 'bg-[oklch(0.7_0.12_55)]',
    border: 'border-l-[oklch(0.7_0.12_55)]'
  },
  valorant: { 
    bg: 'bg-chart-5/10', 
    bar: 'bg-chart-5',
    border: 'border-l-chart-5'
  },
  other: { 
    bg: 'bg-muted/50', 
    bar: 'bg-muted-foreground',
    border: 'border-l-muted-foreground'
  },
}

export function GameBreakdown({ profitByGame, stats }: GameBreakdownProps) {
  const games = profitByGame
    .filter(data => data.betCount > 0)
    .sort((a, b) => Math.abs(b.profit) - Math.abs(a.profit))
  
  const maxProfit = Math.max(...games.map(data => Math.abs(data.profit)), 1)
  const requiredWinRate = stats.averageOdds > 0 ? (100 / stats.averageOdds) : 0

  return (
    <Card className="stat-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Performance by Game</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {games.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No game data available</p>
        ) : (
          games.map((data) => {
            const colors = gameColors[data.game] || gameColors.other
            const wins = Math.round((data.winRate / 100) * data.betCount)
            
            return (
              <div key={data.game} className={`p-3 rounded-lg ${colors.bg} border-l-2 ${colors.border}`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-medium text-foreground">{gameLabels[data.game] || data.game}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {data.betCount} bets ({wins}W)
                    </span>
                  </div>
                  <span className={`font-mono font-bold ${data.profit >= 0 ? 'text-chart-1' : 'text-destructive'}`}>
                    {data.profit >= 0 ? '+' : ''}${data.profit.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 overflow-hidden rounded-full bg-secondary/50">
                    <div
                      className={`h-full ${data.profit >= 0 ? colors.bar : 'bg-destructive'} rounded-full transition-all duration-500`}
                      style={{ width: `${(Math.abs(data.profit) / maxProfit) * 100}%` }}
                    />
                  </div>
                  <span className={`text-xs font-mono ${data.winRate > requiredWinRate ? 'text-chart-1' : 'text-muted-foreground'}`}>
                    {data.winRate.toFixed(0)}% WR
                  </span>
                </div>
              </div>
            )
          })
        )}

        {/* Edge Analysis */}
        <div className="mt-6 border-t border-border/50 pt-4 space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Edge Analysis</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-secondary/30">
              <p className="text-xs text-muted-foreground mb-1">Required Win Rate</p>
              <p className="font-mono font-bold text-foreground">{requiredWinRate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">to break even at {stats.averageOdds.toFixed(2)} avg odds</p>
            </div>
            
            <div className={`p-3 rounded-lg ${stats.winRate > requiredWinRate ? 'bg-chart-1/10' : 'bg-destructive/10'}`}>
              <p className="text-xs text-muted-foreground mb-1">Your Edge</p>
              <p className={`font-mono font-bold ${stats.winRate > requiredWinRate ? 'text-chart-1' : 'text-destructive'}`}>
                {stats.winRate > requiredWinRate ? '+' : ''}{(stats.winRate - requiredWinRate).toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.winRate > requiredWinRate ? 'above' : 'below'} break-even
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
