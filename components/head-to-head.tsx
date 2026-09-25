'use client'

import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Swords, TrendingUp, Calendar } from 'lucide-react'

interface HeadToHeadProps {
  team1: string
  team2: string
  game: 'dota2' | 'lol' | 'csgo' | 'valorant'
}

interface H2HData {
  team1_name: string
  team2_name: string
  team1_wins: number
  team2_wins: number
  draws: number
  last_met?: string
}

const fetcher = (url: string) => fetch(url).then(r => r.ok ? r.json() : null)

export function HeadToHead({ team1, team2, game }: HeadToHeadProps) {
  const { data, isLoading, error } = useSWR<H2HData>(
    `/api/pandascore/h2h?team1=${encodeURIComponent(team1)}&team2=${encodeURIComponent(team2)}&game=${game}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  if (isLoading) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Swords className="h-4 w-4" />
            Head-to-Head
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-8 w-20" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Swords className="h-4 w-4" />
            Head-to-Head
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No H2H data available
          </p>
        </CardContent>
      </Card>
    )
  }

  // Normalize data to match team1/team2 order from props
  const [t1Sorted, t2Sorted] = [team1, team2].sort()
  const isSwapped = t1Sorted !== team1
  const t1Wins = isSwapped ? data.team2_wins : data.team1_wins
  const t2Wins = isSwapped ? data.team1_wins : data.team2_wins
  const totalMatches = t1Wins + t2Wins + data.draws

  const t1Percentage = totalMatches > 0 ? (t1Wins / totalMatches) * 100 : 50
  const t2Percentage = totalMatches > 0 ? (t2Wins / totalMatches) * 100 : 50

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Swords className="h-4 w-4" />
            Head-to-Head
          </CardTitle>
          {data.last_met && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Last met: {new Date(data.last_met).toLocaleDateString()}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Team names and scores */}
        <div className="flex items-center justify-between">
          <div className="text-left">
            <p className="font-semibold text-sm">{team1}</p>
            <p className={cn(
              'text-2xl font-bold',
              t1Wins > t2Wins ? 'text-chart-1' : t1Wins < t2Wins ? 'text-muted-foreground' : 'text-foreground'
            )}>
              {t1Wins}
            </p>
          </div>
          
          <div className="text-center">
            <Badge variant="outline" className="text-xs">
              {totalMatches} {totalMatches === 1 ? 'match' : 'matches'}
            </Badge>
            {data.draws > 0 && (
              <p className="text-xs text-muted-foreground mt-1">{data.draws} draws</p>
            )}
          </div>
          
          <div className="text-right">
            <p className="font-semibold text-sm">{team2}</p>
            <p className={cn(
              'text-2xl font-bold',
              t2Wins > t1Wins ? 'text-chart-1' : t2Wins < t1Wins ? 'text-muted-foreground' : 'text-foreground'
            )}>
              {t2Wins}
            </p>
          </div>
        </div>

        {/* Win percentage bar */}
        {totalMatches > 0 && (
          <div className="space-y-1">
            <div className="flex h-2 rounded-full overflow-hidden bg-muted">
              <div 
                className="bg-chart-1 transition-all duration-500"
                style={{ width: `${t1Percentage}%` }}
              />
              {data.draws > 0 && (
                <div 
                  className="bg-muted-foreground/50"
                  style={{ width: `${(data.draws / totalMatches) * 100}%` }}
                />
              )}
              <div 
                className="bg-chart-2 transition-all duration-500"
                style={{ width: `${t2Percentage}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t1Percentage.toFixed(0)}%</span>
              <span>{t2Percentage.toFixed(0)}%</span>
            </div>
          </div>
        )}

        {/* Advantage indicator */}
        {totalMatches >= 3 && (
          <div className={cn(
            'flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm',
            t1Wins > t2Wins ? 'bg-chart-1/10 text-chart-1' : 
            t2Wins > t1Wins ? 'bg-chart-2/10 text-chart-2' : 
            'bg-muted text-muted-foreground'
          )}>
            <TrendingUp className="h-4 w-4" />
            {t1Wins > t2Wins ? (
              <span><strong>{team1}</strong> leads the H2H</span>
            ) : t2Wins > t1Wins ? (
              <span><strong>{team2}</strong> leads the H2H</span>
            ) : (
              <span>Even record</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
