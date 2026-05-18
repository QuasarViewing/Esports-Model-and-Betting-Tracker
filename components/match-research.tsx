'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TeamInfo } from '@/components/team-info'
import { HeadToHead } from '@/components/head-to-head'
import { MatchHistory } from '@/components/match-history'
import { Search, Swords } from 'lucide-react'

const games = [
  { value: 'dota2', label: 'Dota 2' },
  { value: 'lol', label: 'League of Legends' },
  { value: 'csgo', label: 'Counter-Strike' },
  { value: 'valorant', label: 'Valorant' }
]

export function MatchResearch() {
  const [team1, setTeam1] = useState('')
  const [team2, setTeam2] = useState('')
  const [game, setGame] = useState<'dota2' | 'lol' | 'csgo' | 'valorant'>('dota2')
  const [searchTeams, setSearchTeams] = useState<{ team1: string; team2: string; game: 'dota2' | 'lol' | 'csgo' | 'valorant' } | null>(null)

  const handleSearch = () => {
    if (team1.trim() && team2.trim()) {
      setSearchTeams({ team1: team1.trim(), team2: team2.trim(), game })
    }
  }

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" />
            Match Research
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Team 1 (e.g., Team Spirit)"
              value={team1}
              onChange={(e) => setTeam1(e.target.value)}
              className="flex-1"
            />
            <div className="flex items-center justify-center">
              <Swords className="h-4 w-4 text-muted-foreground" />
            </div>
            <Input
              placeholder="Team 2 (e.g., Natus Vincere)"
              value={team2}
              onChange={(e) => setTeam2(e.target.value)}
              className="flex-1"
            />
            <Select value={game} onValueChange={(v) => setGame(v as typeof game)}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {games.map(g => (
                  <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleSearch} disabled={!team1.trim() || !team2.trim()}>
              <Search className="h-4 w-4 mr-2" />
              Research
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {searchTeams && (
        <div className="space-y-6">
          {/* Head to Head */}
          <HeadToHead team1={searchTeams.team1} team2={searchTeams.team2} game={searchTeams.game} />

          {/* Team Info Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TeamInfo teamName={searchTeams.team1} game={searchTeams.game} />
            <TeamInfo teamName={searchTeams.team2} game={searchTeams.game} />
          </div>

          {/* Match Histories */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MatchHistory teamName={searchTeams.team1} game={searchTeams.game} limit={5} />
            <MatchHistory teamName={searchTeams.team2} game={searchTeams.game} limit={5} />
          </div>
        </div>
      )}

      {!searchTeams && (
        <div className="text-center py-12 text-muted-foreground">
          <Swords className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Enter two team names to research a matchup</p>
          <p className="text-sm mt-2">Get H2H records, recent form, and team info</p>
        </div>
      )}
    </div>
  )
}
