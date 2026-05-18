'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown, Minus, Users, MapPin, Trophy, ExternalLink } from 'lucide-react'
import { TeamRecord } from '@/components/team-record'
import { cn } from '@/lib/utils'

interface TeamInfoProps {
  teamName: string
  game: 'dota2' | 'lol' | 'csgo' | 'valorant'
  compact?: boolean
}

interface TeamData {
  name: string
  short_name?: string
  region?: string
  logo_url?: string
  win_rate?: number
  recent_form?: string[]
  liquipedia_url?: string
}

const fetcher = (url: string) => fetch(url).then(r => r.ok ? r.json() : null)

const gameColors: Record<string, string> = {
  dota2: 'bg-red-500/10 text-red-400 border-red-500/20',
  lol: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  csgo: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  valorant: 'bg-pink-500/10 text-pink-400 border-pink-500/20'
}

const gameNames: Record<string, string> = {
  dota2: 'Dota 2',
  lol: 'League of Legends',
  csgo: 'Counter-Strike',
  valorant: 'Valorant'
}

export function TeamInfo({ teamName, game, compact = false }: TeamInfoProps) {
  const { data: team, isLoading, error } = useSWR<TeamData>(
    `/api/liquipedia/team?name=${encodeURIComponent(teamName)}&game=${game}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  if (isLoading) {
    return compact ? (
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
    ) : (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !team) {
    return compact ? (
      <span className="text-muted-foreground text-sm">{teamName}</span>
    ) : null
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {team.logo_url && (
          <img src={team.logo_url} alt={team.name} className="h-6 w-6 object-contain" />
        )}
        <span className="font-medium">{team.short_name || team.name}</span>
        {team.recent_form && team.recent_form.length > 0 && (
          <div className="flex gap-0.5">
            {team.recent_form.slice(0, 5).map((result, i) => (
              <span
                key={i}
                className={cn(
                  'w-4 h-4 rounded-sm flex items-center justify-center text-[10px] font-bold',
                  result === 'W' && 'bg-chart-1/20 text-chart-1',
                  result === 'L' && 'bg-destructive/20 text-destructive',
                  result === 'D' && 'bg-muted text-muted-foreground'
                )}
              >
                {result}
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {team.logo_url ? (
              <img src={team.logo_url} alt={team.name} className="h-12 w-12 object-contain" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                <Users className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div>
              <CardTitle className="text-lg">{team.name}</CardTitle>
              {team.short_name && team.short_name !== team.name && (
                <p className="text-sm text-muted-foreground">{team.short_name}</p>
              )}
            </div>
          </div>
          <Badge variant="outline" className={cn('text-xs', gameColors[game])}>
            {gameNames[game]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4 text-sm">
          {team.region && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {team.region}
            </div>
          )}
          {team.win_rate !== undefined && (
            <div className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <span className={cn(
                'font-medium',
                team.win_rate >= 50 ? 'text-chart-1' : 'text-destructive'
              )}>
                {team.win_rate.toFixed(1)}% WR
              </span>
            </div>
          )}
          {team.liquipedia_url && (
            <a
              href={team.liquipedia_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Liquipedia
            </a>
          )}
        </div>

        {team.recent_form && team.recent_form.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Recent Form</p>
            <div className="flex gap-1">
              {team.recent_form.slice(0, 10).map((result, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-6 h-6 rounded flex items-center justify-center text-xs font-bold',
                    result === 'W' && 'bg-chart-1/20 text-chart-1',
                    result === 'L' && 'bg-destructive/20 text-destructive',
                    result === 'D' && 'bg-muted text-muted-foreground'
                  )}
                >
                  {result}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Team Record Stats */}
        <div className="pt-2 border-t border-border/30">
          <TeamRecord teamName={team.name} game={game} />
        </div>
      </CardContent>
    </Card>
  )
}
