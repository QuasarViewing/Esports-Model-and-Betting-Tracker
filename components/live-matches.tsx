'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Radio, Trophy, Zap } from 'lucide-react'

interface LiveMatch {
  id: string
  team1: string
  team2: string
  score1: number
  score2: number
  status: 'live' | 'ended'
  tournament: string
  game: string
  livestreams?: Array<{ platform: string; url: string }>
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

export function LiveMatches() {
  const [game, setGame] = useState<'dota2' | 'lol' | 'csgo' | 'valorant'>('dota2')

  const { data: liveMatches, isLoading } = useSWR<LiveMatch[]>(
    `/api/live/matches?game=${game}`,
    fetcher,
    { refreshInterval: 5000 } // Refresh every 5 seconds
  )

  const matches = liveMatches || []

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-destructive animate-pulse" />
            Live Matches
          </CardTitle>
          <Select value={game} onValueChange={setGame}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dota2">Dota 2</SelectItem>
              <SelectItem value="lol">LoL</SelectItem>
              <SelectItem value="csgo">CS2</SelectItem>
              <SelectItem value="valorant">Valorant</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        )}

        {!isLoading && matches.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No live matches currently</p>
            <p className="text-xs mt-2">Check back soon!</p>
          </div>
        )}

        {matches.length > 0 && (
          <div className="space-y-3">
            {matches.map((match) => (
              <div key={match.id} className="p-4 bg-secondary/30 rounded-lg border border-destructive/20 hover:border-destructive/40 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="destructive" className="animate-pulse">
                    <Zap className="h-3 w-3 mr-1" />
                    LIVE
                  </Badge>
                  <p className="text-xs text-muted-foreground">{match.tournament}</p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex-1 text-left">
                    <p className="font-semibold">{match.team1}</p>
                    <p className="text-xs text-muted-foreground">Team 1</p>
                  </div>

                  <div className="text-center mx-4">
                    <p className="text-3xl font-bold font-mono text-primary">
                      {match.score1}
                      <span className="text-lg text-muted-foreground mx-2">-</span>
                      {match.score2}
                    </p>
                  </div>

                  <div className="flex-1 text-right">
                    <p className="font-semibold">{match.team2}</p>
                    <p className="text-xs text-muted-foreground">Team 2</p>
                  </div>
                </div>

                {match.livestreams && match.livestreams.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/30">
                    <p className="text-xs text-muted-foreground mb-2">Watch:</p>
                    <div className="flex gap-2 flex-wrap">
                      {match.livestreams.map((stream, i) => (
                        <a
                          key={i}
                          href={stream.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-3 py-1 bg-primary/20 hover:bg-primary/30 rounded text-primary transition-colors"
                        >
                          {stream.platform}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
