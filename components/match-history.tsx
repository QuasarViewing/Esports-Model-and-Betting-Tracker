'use client'

import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { History, Trophy } from 'lucide-react'

interface MatchHistoryProps {
  teamName: string
  game: 'dota2' | 'lol' | 'csgo' | 'valorant'
  limit?: number
}

interface MatchResult {
  opponent_name: string
  result: 'win' | 'loss' | 'draw'
  score: string
  match_date: string
  tournament: string
}

const fetcher = (url: string) => fetch(url).then(r => r.ok ? r.json() : null)

export function MatchHistory({ teamName, game, limit = 10 }: MatchHistoryProps) {
  const { data: matches, isLoading, error } = useSWR<MatchResult[]>(
    `/api/liquipedia/matches?team=${encodeURIComponent(teamName)}&game=${game}&limit=${limit}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  if (isLoading) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4" />
            Recent Matches
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (error || !matches || matches.length === 0) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4" />
            Recent Matches
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent matches found
          </p>
        </CardContent>
      </Card>
    )
  }

  // Calculate form stats
  const recentWins = matches.filter(m => m.result === 'win').length
  const recentLosses = matches.filter(m => m.result === 'loss').length
  const winStreak = matches.findIndex(m => m.result !== 'win')
  const loseStreak = matches.findIndex(m => m.result !== 'loss')
  const currentStreak = winStreak === -1 ? matches.length : winStreak > 0 ? winStreak : (loseStreak === -1 ? -matches.length : -loseStreak)

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4" />
            Recent Matches
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs bg-chart-1/10 text-chart-1 border-chart-1/20">
              {recentWins}W
            </Badge>
            <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20">
              {recentLosses}L
            </Badge>
            {currentStreak !== 0 && (
              <Badge 
                variant="outline" 
                className={cn(
                  'text-xs',
                  currentStreak > 0 ? 'bg-chart-1/10 text-chart-1 border-chart-1/20' : 'bg-destructive/10 text-destructive border-destructive/20'
                )}
              >
                {currentStreak > 0 ? `${currentStreak}W streak` : `${Math.abs(currentStreak)}L streak`}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {matches.map((match, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center justify-between p-2 rounded-lg transition-colors',
                match.result === 'win' && 'bg-chart-1/5 hover:bg-chart-1/10',
                match.result === 'loss' && 'bg-destructive/5 hover:bg-destructive/10',
                match.result === 'draw' && 'bg-muted/50 hover:bg-muted'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-8 h-8 rounded flex items-center justify-center text-xs font-bold',
                  match.result === 'win' && 'bg-chart-1/20 text-chart-1',
                  match.result === 'loss' && 'bg-destructive/20 text-destructive',
                  match.result === 'draw' && 'bg-muted text-muted-foreground'
                )}>
                  {match.result === 'win' ? 'W' : match.result === 'loss' ? 'L' : 'D'}
                </div>
                <div>
                  <p className="font-medium text-sm">vs {match.opponent_name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Trophy className="h-3 w-3" />
                    {match.tournament}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-medium">{match.score}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(match.match_date).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
