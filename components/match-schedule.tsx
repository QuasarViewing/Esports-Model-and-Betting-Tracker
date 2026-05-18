'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar, Clock, Trophy } from 'lucide-react'
import { getUpcomingMatches, getTournaments } from '@/lib/upcoming-matches'

interface UpcomingMatch {
  team1: string
  team2: string
  date: string
  time?: string
  tournament: string
  bestOf?: number
  stream?: string
  game: string
}

interface Tournament {
  name: string
  tier: string
  startDate: string
  endDate?: string
  prizePool?: string
  location?: string
  status: 'upcoming' | 'ongoing' | 'completed'
  game: string
  liquipediaUrl?: string
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

export function MatchSchedule() {
  const [game, setGame] = useState<'dota2' | 'lol' | 'csgo' | 'valorant'>('dota2')
  const [view, setView] = useState<'matches' | 'tournaments'>('matches')

  // Use seeded data as default, with API fallback
  const seedMatches = getUpcomingMatches(game)
  const seedTournaments = getTournaments(game)

  const { data: apiMatches, isLoading: matchesLoading } = useSWR<UpcomingMatch[]>(
    view === 'matches' ? `/api/liquipedia/schedule?game=${game}&limit=15` : null,
    fetcher,
    { revalidateOnFocus: true, revalidateOnReconnect: true }
  )

  const { data: apiTournaments, isLoading: tournamentsLoading } = useSWR<Tournament[]>(
    view === 'tournaments' ? `/api/liquipedia/tournaments?game=${game}&status=ongoing` : null,
    fetcher,
    { revalidateOnFocus: true, revalidateOnReconnect: true }
  )

  // Use API data if available, otherwise use seeded data
  const matches = apiMatches && apiMatches.length > 0 ? apiMatches : seedMatches
  const tournaments = apiTournaments && apiTournaments.length > 0 ? apiTournaments : seedTournaments
  const isLoading = view === 'matches' ? matchesLoading : tournamentsLoading

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    } catch {
      return dateStr
    }
  }

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return ''
    try {
      const [hours, minutes] = timeStr.split(':')
      const hour = parseInt(hours)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour % 12 || 12
      return `${displayHour}:${minutes} ${ampm} UTC`
    } catch {
      return timeStr
    }
  }

  const getTierColor = (tier: string) => {
    const tierLower = tier.toLowerCase()
    if (tierLower.includes('1') || tierLower.includes('s-tier') || tierLower.includes('major')) {
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    }
    if (tierLower.includes('2') || tierLower.includes('a-tier')) {
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    }
    if (tierLower.includes('3') || tierLower.includes('b-tier')) {
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    }
    return 'bg-muted text-muted-foreground'
  }

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-chart-1" />
            Match Schedule
          </CardTitle>
          <div className="flex gap-2">
            <Select value={view} onValueChange={(v) => setView(v as 'matches' | 'tournaments')}>
              <SelectTrigger className="w-[130px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="matches">Matches</SelectItem>
                <SelectItem value="tournaments">Tournaments</SelectItem>
              </SelectContent>
            </Select>
            <Select value={game} onValueChange={setGame}>
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dota2">Dota 2</SelectItem>
                <SelectItem value="csgo">CS2</SelectItem>
                <SelectItem value="lol">LoL</SelectItem>
                <SelectItem value="valorant">Valorant</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {view === 'matches' && (
          <>
            {matchesLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))
            ) : matches && matches.length > 0 ? (
              matches.map((match, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30 hover:border-border/60 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-foreground">{match.team1}</span>
                      <span className="text-muted-foreground text-sm">vs</span>
                      <span className="font-medium text-foreground">{match.team2}</span>
                      {match.bestOf && (
                        <Badge variant="outline" className="text-xs">
                          Bo{match.bestOf}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Trophy className="h-3 w-3" />
                        {match.tournament}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-foreground">
                      {formatDate(match.date)}
                    </div>
                    {match.time && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                        <Clock className="h-3 w-3" />
                        {formatTime(match.time)}
                      </div>
                    )}
                    {match.stream && (
                      <a
                        href={match.stream}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-chart-1 hover:underline flex items-center gap-1 justify-end mt-1"
                      >
                        <Tv className="h-3 w-3" />
                        Watch
                      </a>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No upcoming matches found
              </div>
            )}
          </>
        )}

        {view === 'tournaments' && (
          <>
            {tournamentsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))
            ) : tournaments && tournaments.length > 0 ? (
              tournaments.map((tournament, index) => (
                <div
                  key={index}
                  className="p-4 rounded-lg bg-background/50 border border-border/30 hover:border-border/60 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-foreground">{tournament.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={getTierColor(tournament.tier)}>
                          {tournament.tier}
                        </Badge>
                        <Badge variant="outline" className={
                          tournament.status === 'ongoing' 
                            ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                            : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                        }>
                          {tournament.status}
                        </Badge>
                      </div>
                    </div>
                    {tournament.prizePool && (
                      <div className="text-right">
                        <span className="text-sm font-medium text-chart-1">
                          {tournament.prizePool}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(tournament.startDate)}
                      {tournament.endDate && ` - ${formatDate(tournament.endDate)}`}
                    </span>
                    {tournament.location && (
                      <span>{tournament.location}</span>
                    )}
                  </div>
                  {tournament.liquipediaUrl && (
                    <a
                      href={tournament.liquipediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-chart-1 hover:underline mt-2 inline-block"
                    >
                      View on Liquipedia
                    </a>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No tournaments found
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
