'use client'

import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown, Trophy } from 'lucide-react'

interface TeamRecordProps {
  teamName: string
  game: 'dota2' | 'lol' | 'csgo' | 'valorant'
}

interface TeamRecord {
  teamId: string
  teamName: string
  wins: number
  losses: number
  draws?: number
  winRate: number
  recentMatches: Array<{
    opponent: string
    result: 'win' | 'loss' | 'draw'
    date: string
    tournament: string
  }>
}

const fetcher = (url: string) => fetch(url).then(r => r.ok ? r.json() : null)

export function TeamRecord({ teamName, game }: TeamRecordProps) {
  const { data: record, isLoading } = useSWR<TeamRecord>(
    `/api/team/record?name=${encodeURIComponent(teamName)}&game=${game}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  if (isLoading) {
    return (
      <Card className="bg-secondary/30 border-border/50">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    )
  }

  if (!record || !record.winRate) {
    return null
  }

  const totalMatches = record.wins + record.losses + (record.draws || 0)
  const isWinningForm = record.winRate >= 50

  return (
    <Card className="bg-secondary/30 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            {record.teamName} Record
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Win Rate */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Win Rate</p>
            <p className={`text-lg font-bold ${isWinningForm ? 'text-chart-1' : 'text-destructive'}`}>
              {record.winRate.toFixed(1)}%
            </p>
          </div>
          <div className={`p-3 rounded-lg ${isWinningForm ? 'bg-chart-1/10' : 'bg-destructive/10'}`}>
            {isWinningForm ? (
              <TrendingUp className={`h-5 w-5 ${isWinningForm ? 'text-chart-1' : 'text-destructive'}`} />
            ) : (
              <TrendingDown className="h-5 w-5 text-destructive" />
            )}
          </div>
        </div>

        {/* W-L Record */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 bg-primary/10 rounded">
            <p className="text-xs text-muted-foreground">Wins</p>
            <p className="text-lg font-bold text-chart-1">{record.wins}</p>
          </div>
          <div className="text-center p-2 bg-secondary rounded">
            <p className="text-xs text-muted-foreground">
              {record.draws !== undefined ? 'Draws' : 'Total'}
            </p>
            <p className="text-lg font-bold text-muted-foreground">
              {record.draws !== undefined ? record.draws : totalMatches}
            </p>
          </div>
          <div className="text-center p-2 bg-destructive/10 rounded">
            <p className="text-xs text-muted-foreground">Losses</p>
            <p className="text-lg font-bold text-destructive">{record.losses}</p>
          </div>
        </div>

        {/* Recent Form */}
        {record.recentMatches && record.recentMatches.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Last 5 Matches</p>
            <div className="flex gap-1">
              {record.recentMatches.slice(0, 5).map((match, i) => (
                <div
                  key={i}
                  className={`w-full h-6 rounded text-xs font-bold flex items-center justify-center ${
                    match.result === 'win'
                      ? 'bg-chart-1/30 text-chart-1'
                      : match.result === 'loss'
                        ? 'bg-destructive/30 text-destructive'
                        : 'bg-secondary/50 text-muted-foreground'
                  }`}
                  title={`${match.result.toUpperCase()} vs ${match.opponent}`}
                >
                  {match.result === 'win' ? 'W' : match.result === 'loss' ? 'L' : 'D'}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
