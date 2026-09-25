'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Swords, ChevronDown, ChevronUp, X } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DotaHero {
  id: number
  name: string            // "npc_dota_hero_marci"
  localized_name: string  // "Marci"
}

interface TeamInput {
  teamId: string
  name: string
  eloRating: number | null
  recentForm: string
  side: 'radiant' | 'dire'
  heroes: (number | null)[]   // hero IDs, null = empty slot
}

interface PredResult {
  teamAProbability: number
  teamBProbability: number
  layers: {
    elo: { teamAProb: number; ratingA: number; ratingB: number }
    h2h: { adjustment: number; matches: number }
    side: { adjustment: number }
    roster: { adjustmentA: number; adjustmentB: number }
    fatigue: { adjustmentA: number; adjustmentB: number }
    draft?: {
      archetypeA: { primary: string }
      archetypeB: { primary: string }
      archetypeMatchup: number
      comfortA: number
      comfortB: number
      comboSynergyA: number
      comboSynergyB: number
      laneAdvantage: number
    }
    patchAge: { confidence: number }
    tournament: { multiplier: number }
  }
  edge?: {
    bookmakerImpliedA: number
    modelProbA: number
    edgePercent: number
    kellyStake: number
    halfKellyStake: number
    recommendation: string
  }
  confidence: number
  dataQuality: string
  warnings: string[]
}

const RECOMMENDATION_COLORS: Record<string, string> = {
  strong_bet: 'bg-green-600 text-white',
  value_bet: 'bg-cyan-600 text-white',
  lean: 'bg-yellow-600 text-white',
  pass: 'bg-gray-600 text-white',
  avoid: 'bg-red-600 text-white',
}

function heroImgUrl(hero: DotaHero): string {
  const short = hero.name.replace('npc_dota_hero_', '')
  return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${short}.png`
}

// ---------------------------------------------------------------------------
// HeroPicker — searchable combobox for a single slot
// ---------------------------------------------------------------------------

function HeroPicker({
  allHeroes,
  selectedId,
  usedIds,
  onSelect,
  onClear,
  slotLabel,
}: {
  allHeroes: DotaHero[]
  selectedId: number | null
  usedIds: Set<number>
  onSelect: (id: number) => void
  onClear: () => void
  slotLabel: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedHero = selectedId != null
    ? allHeroes.find(h => h.id === selectedId) ?? null
    : null

  const filtered = query.trim()
    ? allHeroes.filter(h =>
        h.localized_name.toLowerCase().includes(query.toLowerCase()) &&
        !usedIds.has(h.id),
      )
    : allHeroes.filter(h => !usedIds.has(h.id))

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleSelect(hero: DotaHero) {
    onSelect(hero.id)
    setQuery('')
    setOpen(false)
  }

  // If a hero is selected, show the portrait chip
  if (selectedHero) {
    return (
      <div className="relative group">
        <div className="flex items-center gap-1.5 rounded-md border border-border/50 bg-secondary/30 px-1.5 py-1 h-9">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImgUrl(selectedHero)}
            alt={selectedHero.localized_name}
            className="h-6 w-auto rounded-sm"
          />
          <span className="text-xs truncate flex-1">{selectedHero.localized_name}</span>
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        placeholder={slotLabel}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        className="bg-secondary/30 border-border/50 text-xs h-9"
        autoComplete="off"
      />

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-56 rounded-md border border-border/50 bg-popover shadow-lg">
          <ScrollArea className="max-h-52">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">No heroes found</p>
            ) : (
              <div className="py-1">
                {filtered.slice(0, 40).map(hero => (
                  <button
                    key={hero.id}
                    type="button"
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-secondary/60 transition-colors"
                    onClick={() => handleSelect(hero)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={heroImgUrl(hero)}
                      alt={hero.localized_name}
                      className="h-5 w-auto rounded-sm shrink-0"
                    />
                    <span className="truncate">{hero.localized_name}</span>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// HeroSlots — 5 hero pickers for one team
// ---------------------------------------------------------------------------

function HeroSlots({
  allHeroes,
  heroes,
  allUsedIds,
  onChange,
}: {
  allHeroes: DotaHero[]
  heroes: (number | null)[]
  allUsedIds: Set<number>
  onChange: (heroes: (number | null)[]) => void
}) {
  const posLabels = ['Pos 1', 'Pos 2', 'Pos 3', 'Pos 4', 'Pos 5']

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1.5">Draft (optional)</p>
      <div className="space-y-1.5">
        {heroes.map((heroId, i) => (
          <HeroPicker
            key={i}
            allHeroes={allHeroes}
            selectedId={heroId}
            usedIds={allUsedIds}
            slotLabel={posLabels[i]}
            onSelect={id => {
              const next = [...heroes]
              next[i] = id
              onChange(next)
            }}
            onClear={() => {
              const next = [...heroes]
              next[i] = null
              onChange(next)
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// QuickPredict
// ---------------------------------------------------------------------------

export function QuickPredict() {
  const [allHeroes, setAllHeroes] = useState<DotaHero[]>([])

  const [teamA, setTeamA] = useState<TeamInput>({
    teamId: '', name: '', eloRating: null, recentForm: '', side: 'radiant',
    heroes: [null, null, null, null, null],
  })
  const [teamB, setTeamB] = useState<TeamInput>({
    teamId: '', name: '', eloRating: null, recentForm: '', side: 'dire',
    heroes: [null, null, null, null, null],
  })
  const [oddsA, setOddsA] = useState('')
  const [oddsB, setOddsB] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<PredResult | null>(null)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [teamASearch, setTeamASearch] = useState('')
  const [teamBSearch, setTeamBSearch] = useState('')
  const [searchingA, setSearchingA] = useState(false)
  const [searchingB, setSearchingB] = useState(false)

  // Fetch hero list once on mount
  useEffect(() => {
    let cancel = false
    async function load() {
      try {
        const res = await fetch('/api/model/heroes')
        if (res.ok && !cancel) {
          const data: DotaHero[] = await res.json()
          setAllHeroes(data.sort((a, b) => a.localized_name.localeCompare(b.localized_name)))
        }
      } catch { /* ignore */ }
    }
    load()
    return () => { cancel = true }
  }, [])

  // Compute all used hero IDs across both teams to prevent duplicates
  const allUsedIds = new Set<number>()
  for (const id of teamA.heroes) { if (id != null) allUsedIds.add(id) }
  for (const id of teamB.heroes) { if (id != null) allUsedIds.add(id) }

  const setTeamAHeroes = useCallback((heroes: (number | null)[]) => {
    setTeamA(prev => ({ ...prev, heroes }))
  }, [])

  const setTeamBHeroes = useCallback((heroes: (number | null)[]) => {
    setTeamB(prev => ({ ...prev, heroes }))
  }, [])

  async function searchTeam(name: string, side: 'A' | 'B') {
    if (side === 'A') setSearchingA(true)
    else setSearchingB(true)

    try {
      const res = await fetch(`/api/model/team-info?teamName=${encodeURIComponent(name)}`)
      if (res.ok) {
        const data = await res.json()
        const teamData: TeamInput = {
          teamId: String(data.team?.team_id ?? ''),
          name: data.team?.name ?? name,
          eloRating: data.team?.rating ?? null,
          recentForm: '',
          side: side === 'A' ? 'radiant' : 'dire',
          heroes: [null, null, null, null, null],
        }
        if (side === 'A') setTeamA(prev => ({ ...teamData, heroes: prev.heroes }))
        else setTeamB(prev => ({ ...teamData, heroes: prev.heroes }))
      }
    } catch { /* ignore */ }

    if (side === 'A') setSearchingA(false)
    else setSearchingB(false)
  }

  async function predict() {
    if (!teamA.teamId || !teamB.teamId) return
    setIsLoading(true)
    setResult(null)

    try {
      const heroesA = teamA.heroes.filter((h): h is number => h != null)
      const heroesB = teamB.heroes.filter((h): h is number => h != null)

      const body: Record<string, unknown> = {
        teamA: { teamId: Number(teamA.teamId), name: teamA.name, side: teamA.side },
        teamB: { teamId: Number(teamB.teamId), name: teamB.name, side: teamB.side },
      }

      if (heroesA.length > 0) body.heroesA = heroesA
      if (heroesB.length > 0) body.heroesB = heroesB
      if (oddsA) body.bookmakerOddsA = parseFloat(oddsA)
      if (oddsB) body.bookmakerOddsB = parseFloat(oddsB)

      const res = await fetch('/api/model/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        setResult(await res.json())
      }
    } catch { /* ignore */ }

    setIsLoading(false)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Team A */}
      <Card className="stat-card bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-chart-1">
            Team A {teamA.side === 'radiant' ? '(Radiant)' : '(Dire)'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Search team..."
              value={teamASearch}
              onChange={e => setTeamASearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchTeam(teamASearch, 'A')}
              className="bg-background"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => searchTeam(teamASearch, 'A')}
              disabled={searchingA}
            >
              {searchingA ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Find'}
            </Button>
          </div>

          {teamA.name && (
            <div className="text-sm">
              <p className="font-medium">{teamA.name}</p>
              <p className="text-muted-foreground">
                ID: {teamA.teamId}
                {teamA.eloRating && ` | Rating: ${teamA.eloRating}`}
              </p>
            </div>
          )}

          <HeroSlots
            allHeroes={allHeroes}
            heroes={teamA.heroes}
            allUsedIds={allUsedIds}
            onChange={setTeamAHeroes}
          />

          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => setTeamA(prev => ({ ...prev, side: prev.side === 'radiant' ? 'dire' : 'radiant' }))}
          >
            Switch to {teamA.side === 'radiant' ? 'Dire' : 'Radiant'}
          </Button>
        </CardContent>
      </Card>

      {/* Center: Results + Controls */}
      <Card className="stat-card bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-center">Prediction</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Odds A"
              value={oddsA}
              onChange={e => setOddsA(e.target.value)}
              className="bg-background text-sm"
            />
            <Input
              placeholder="Odds B"
              value={oddsB}
              onChange={e => setOddsB(e.target.value)}
              className="bg-background text-sm"
            />
          </div>

          <Button
            className="w-full"
            onClick={predict}
            disabled={isLoading || !teamA.teamId || !teamB.teamId}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Swords className="h-4 w-4 mr-2" />
            )}
            Predict
          </Button>

          {result && (
            <div className="space-y-4">
              {/* Win Probabilities */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-mono text-chart-1">
                    {(result.teamAProbability * 100).toFixed(1)}%
                  </span>
                  <span className="font-mono text-destructive">
                    {(result.teamBProbability * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 rounded-full bg-secondary flex overflow-hidden">
                  <div
                    className="bg-chart-1 transition-all duration-700"
                    style={{ width: `${result.teamAProbability * 100}%` }}
                  />
                  <div
                    className="bg-destructive transition-all duration-700"
                    style={{ width: `${result.teamBProbability * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{teamA.name || 'Team A'}</span>
                  <span>{teamB.name || 'Team B'}</span>
                </div>
              </div>

              {/* Confidence + Quality */}
              <div className="flex gap-2 justify-center">
                <Badge variant="outline" className="text-xs">
                  Confidence: {(result.confidence * 100).toFixed(0)}%
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Data: {result.dataQuality}
                </Badge>
              </div>

              {/* Edge */}
              {result.edge && (
                <div className="rounded-md border p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Edge</span>
                    <span className={`font-mono ${result.edge.edgePercent > 0 ? 'text-chart-1' : 'text-destructive'}`}>
                      {result.edge.edgePercent > 0 ? '+' : ''}{result.edge.edgePercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Half Kelly</span>
                    <span className="font-mono">{(result.edge.halfKellyStake * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-center">
                    <Badge className={RECOMMENDATION_COLORS[result.edge.recommendation] ?? 'bg-gray-600'}>
                      {result.edge.recommendation.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="space-y-1">
                  {result.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-yellow-500">{w}</p>
                  ))}
                </div>
              )}

              {/* Breakdown toggle */}
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => setShowBreakdown(!showBreakdown)}
              >
                {showBreakdown ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                {showBreakdown ? 'Hide' : 'Show'} Breakdown
              </Button>

              {showBreakdown && (
                <div className="space-y-1 text-xs font-mono">
                  <Row label="Elo Base" value={`${(result.layers.elo.teamAProb * 100).toFixed(1)}%`} sub={`${result.layers.elo.ratingA} vs ${result.layers.elo.ratingB}`} />
                  <Row label="H2H" value={fmtAdj(result.layers.h2h.adjustment)} sub={`${result.layers.h2h.matches} matches`} />
                  <Row label="Side" value={fmtAdj(result.layers.side.adjustment)} />
                  <Row label="Roster A/B" value={`${fmtAdj(result.layers.roster.adjustmentA)} / ${fmtAdj(result.layers.roster.adjustmentB)}`} />
                  <Row label="Fatigue A/B" value={`${fmtAdj(result.layers.fatigue.adjustmentA)} / ${fmtAdj(result.layers.fatigue.adjustmentB)}`} />
                  {result.layers.draft && (
                    <>
                      <Row label="Archetype" value={`${capitalize(result.layers.draft.archetypeA.primary)} vs ${capitalize(result.layers.draft.archetypeB.primary)}`} />
                      <Row label="Arch. Matchup" value={`${(result.layers.draft.archetypeMatchup * 100).toFixed(1)}%`} />
                      <Row label="Comfort A/B" value={`${result.layers.draft.comfortA.toFixed(2)} / ${result.layers.draft.comfortB.toFixed(2)}`} />
                      <Row label="Combo A/B" value={`${result.layers.draft.comboSynergyA.toFixed(2)} / ${result.layers.draft.comboSynergyB.toFixed(2)}`} />
                      <Row label="Lane Adv." value={fmtAdj(result.layers.draft.laneAdvantage)} />
                    </>
                  )}
                  <Row label="Patch Conf." value={`${(result.layers.patchAge.confidence * 100).toFixed(0)}%`} />
                  <Row label="Tournament" value={`×${result.layers.tournament.multiplier.toFixed(2)}`} />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team B */}
      <Card className="stat-card bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-destructive">
            Team B {teamB.side === 'radiant' ? '(Radiant)' : '(Dire)'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Search team..."
              value={teamBSearch}
              onChange={e => setTeamBSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchTeam(teamBSearch, 'B')}
              className="bg-background"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => searchTeam(teamBSearch, 'B')}
              disabled={searchingB}
            >
              {searchingB ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Find'}
            </Button>
          </div>

          {teamB.name && (
            <div className="text-sm">
              <p className="font-medium">{teamB.name}</p>
              <p className="text-muted-foreground">
                ID: {teamB.teamId}
                {teamB.eloRating && ` | Rating: ${teamB.eloRating}`}
              </p>
            </div>
          )}

          <HeroSlots
            allHeroes={allHeroes}
            heroes={teamB.heroes}
            allUsedIds={allUsedIds}
            onChange={setTeamBHeroes}
          />

          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => setTeamB(prev => ({ ...prev, side: prev.side === 'radiant' ? 'dire' : 'radiant' }))}
          >
            Switch to {teamB.side === 'radiant' ? 'Dire' : 'Radiant'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex justify-between items-center py-0.5 border-b border-border/30">
      <span className="text-muted-foreground">{label}</span>
      <div className="text-right">
        <span>{value}</span>
        {sub && <span className="text-muted-foreground ml-1">({sub})</span>}
      </div>
    </div>
  )
}

function fmtAdj(n: number): string {
  const pct = (n * 100).toFixed(1)
  return n >= 0 ? `+${pct}%` : `${pct}%`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
