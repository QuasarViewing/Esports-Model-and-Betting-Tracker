'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Swords, Loader2, AlertCircle, Calculator, Tag, ScrollText } from 'lucide-react'
import type { MatchupSummary, TeamStats } from '@/lib/stratz'
import { MatchDrafts } from './match-drafts'

type ErrorKind = 'not-found' | 'api'

interface DotaMatchupCardProps {
  team1: string
  team2: string
}

function StatRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className="font-mono font-medium">{value}</span>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )
}

function TeamPanel({ name, tag, stats, isFavored }: { name: string; tag: string; stats: TeamStats | null; isFavored: boolean }) {
  if (!stats) {
    return (
      <div className="rounded-lg bg-secondary/30 p-4 space-y-1">
        <p className="font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">No recent data</p>
      </div>
    )
  }
  const winRate = stats.recordWindow.wins + stats.recordWindow.losses > 0
    ? (stats.recordWindow.wins / (stats.recordWindow.wins + stats.recordWindow.losses)) * 100
    : 0
  const restWarning = stats.daysSinceLastMatch != null && stats.daysSinceLastMatch > 21

  return (
    <div className={`rounded-lg p-4 space-y-2 ${isFavored ? 'bg-chart-1/10 border-l-2 border-chart-1' : 'bg-secondary/30'}`}>
      <div className="flex items-center justify-between">
        <p className="font-medium">{name}</p>
        {tag && <Badge variant="outline" className="font-mono text-xs">{tag}</Badge>}
      </div>
      <StatRow label="Recent W-L" value={`${stats.recordWindow.wins}-${stats.recordWindow.losses}`} hint={`${winRate.toFixed(0)}% WR`} />
      <StatRow
        label="Days since last match"
        value={stats.daysSinceLastMatch != null ? `${stats.daysSinceLastMatch}d` : '—'}
        hint={restWarning ? 'rust risk' : undefined}
      />
      <StatRow label="Hero pool" value={`${stats.uniqueHeroes} heroes`} hint={stats.uniqueHeroes < 25 ? 'narrow — readable draft' : 'broad'} />
      <StatRow label="Avg match length" value={`${Math.round(stats.avgMatchDurationSec / 60)}m`} />
      {stats.topHeroes.length > 0 && (
        <div className="pt-1">
          <p className="text-xs text-muted-foreground mb-1">Top picks (hero IDs)</p>
          <div className="flex flex-wrap gap-1">
            {stats.topHeroes.map(h => (
              <Badge key={h.heroId} variant="outline" className="font-mono text-xs">
                #{h.heroId} ×{h.picks}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function DotaMatchupCard({ team1, team2 }: DotaMatchupCardProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<{ kind: ErrorKind; message: string } | null>(null)
  const [summary, setSummary] = useState<MatchupSummary | null>(null)
  const [matchedNames, setMatchedNames] = useState<{ a: string; b: string } | null>(null)

  // Edge estimator state
  const [marketOddsA, setMarketOddsA] = useState('2.00')
  const [trueWinA, setTrueWinA] = useState('55')

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      setSummary(null)
      try {
        const url = `/api/stratz/matchup?team1=${encodeURIComponent(team1)}&team2=${encodeURIComponent(team2)}`
        const res = await fetch(url)
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          if (data.error === 'team not found') {
            const missingA = !data.matchedA ? team1 : null
            const missingB = !data.matchedB ? team2 : null
            const missing = [missingA, missingB].filter(Boolean).join(' and ')
            setError({
              kind: 'not-found',
              message: `STRATZ couldn't find ${missing || 'one of the teams'}. Double-check spelling — these names must match the team's STRATZ page exactly (e.g. PARIVISION, not Paravision).`,
            })
          } else {
            setError({ kind: 'api', message: data.error || 'STRATZ request failed' })
          }
          return
        }
        setSummary(data.summary as MatchupSummary)
        setMatchedNames({ a: data.matchedA, b: data.matchedB })
      } catch (e) {
        if (!cancelled) setError({ kind: 'api', message: 'Network error fetching STRATZ data' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [team1, team2])

  const edgeMath = useMemo(() => {
    const odds = parseFloat(marketOddsA) || 0
    const winPct = parseFloat(trueWinA) || 0
    const trueProb = winPct / 100
    const impliedProb = odds > 1 ? (1 / odds) * 100 : 0
    const edge = winPct - impliedProb
    const fairOdds = trueProb > 0 ? 1 / trueProb : 0
    let kelly = 0
    if (odds > 1 && trueProb > 0 && trueProb < 1) {
      const raw = (odds * trueProb - 1) / (odds - 1)
      kelly = Math.max(0, Math.min(raw, 0.25))
    }
    return { impliedProb, edge, fairOdds, kelly, halfKelly: kelly / 2 }
  }, [marketOddsA, trueWinA])

  const h2hSuggestedTag = useMemo(() => {
    if (!summary || summary.h2h.matchCount === 0) return null
    const dominance = Math.abs(summary.h2h.aWins - summary.h2h.bWins) / summary.h2h.matchCount
    return dominance >= 0.6 ? 'h2h-trend' : 'matchup-research'
  }, [summary])

  if (loading) {
    return (
      <Card className="stat-card">
        <CardContent className="flex items-center justify-center gap-3 py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Fetching STRATZ matchup data…</span>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="stat-card border-destructive/40">
        <CardContent className="flex items-start gap-3 py-4">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm text-destructive">
            <p className="font-medium">STRATZ research unavailable</p>
            <p className="text-xs mt-1 text-muted-foreground">{error.message}</p>
            {error.kind === 'api' && (
              <p className="text-xs mt-2 text-muted-foreground">
                Set <code className="font-mono">STRATZ_API_KEY</code> in <code className="font-mono">.env.local</code> (free at stratz.com/api), then retry.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!summary || !summary.teamA || !summary.teamB) return null

  const { h2h, teamA, teamB, teamAStats, teamBStats } = summary
  const aFavoredByH2H = h2h.matchCount >= 3 && h2h.aWins > h2h.bWins
  const bFavoredByH2H = h2h.matchCount >= 3 && h2h.bWins > h2h.aWins
  const aFavoredByForm =
    teamAStats && teamBStats &&
    teamAStats.recordWindow.wins / Math.max(1, teamAStats.recordWindow.wins + teamAStats.recordWindow.losses) >
    teamBStats.recordWindow.wins / Math.max(1, teamBStats.recordWindow.wins + teamBStats.recordWindow.losses)

  return (
    <Card className="stat-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Swords className="h-5 w-5 text-primary" />
          STRATZ Matchup
        </CardTitle>
        {matchedNames && (
          <p className="text-xs text-muted-foreground">
            Matched: <span className="font-mono">{matchedNames.a}</span> vs <span className="font-mono">{matchedNames.b}</span>
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {/* H2H */}
        <div className="rounded-lg bg-secondary/30 p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Head-to-head</p>
          {h2h.matchCount === 0 ? (
            <p className="text-sm text-muted-foreground">No recent matches between these teams in STRATZ window.</p>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{teamA.name}</span>
                <span className="font-mono">
                  <span className="text-chart-1">{h2h.aWins}</span>
                  <span className="text-muted-foreground"> – </span>
                  <span className="text-destructive">{h2h.bWins}</span>
                </span>
                <span className="font-medium">{teamB.name}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{h2h.matchCount} recent meetings</p>
            </>
          )}
        </div>

        {/* Team panels */}
        <div className="grid gap-3 md:grid-cols-2">
          <TeamPanel name={teamA.name} tag={teamA.tag} stats={teamAStats} isFavored={!!(aFavoredByH2H || (!bFavoredByH2H && aFavoredByForm))} />
          <TeamPanel name={teamB.name} tag={teamB.tag} stats={teamBStats} isFavored={!!(bFavoredByH2H || (!aFavoredByH2H && !aFavoredByForm))} />
        </div>

        {/* Recent drafts */}
        <div className="rounded-lg border border-border/50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-primary" />
            <p className="font-medium text-sm">Recent drafts</p>
            <span className="text-xs text-muted-foreground">click a match to reveal picks/bans</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{teamA.name}</p>
              <MatchDrafts
                matches={summary.teamAMatches}
                focusTeamName={teamA.name}
                opposingTeamName="Opponent"
                limit={10}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{teamB.name}</p>
              <MatchDrafts
                matches={summary.teamBMatches}
                focusTeamName={teamB.name}
                opposingTeamName="Opponent"
                limit={10}
              />
            </div>
          </div>
        </div>

        {/* Edge estimator */}
        <div className="rounded-lg border border-border/50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            <p className="font-medium text-sm">Edge estimator → Kelly</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Given what you see above, what's your true win probability for <span className="font-medium">{teamA.name}</span>? Compare against bookmaker odds.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Bookmaker odds ({teamA.tag || 'A'})</Label>
              <Input type="number" step="0.01" min="1.01" value={marketOddsA} onChange={e => setMarketOddsA(e.target.value)} className="font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Your win % for {teamA.tag || 'A'}</Label>
              <Input type="number" step="0.5" min="0" max="100" value={trueWinA} onChange={e => setTrueWinA(e.target.value)} className="font-mono" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded bg-secondary/30 p-2">
              <p className="text-xs text-muted-foreground">Market implied</p>
              <p className="font-mono font-bold">{edgeMath.impliedProb.toFixed(1)}%</p>
            </div>
            <div className={`rounded p-2 ${edgeMath.edge > 0 ? 'bg-chart-1/10' : 'bg-destructive/10'}`}>
              <p className="text-xs text-muted-foreground">Your edge</p>
              <p className={`font-mono font-bold ${edgeMath.edge > 0 ? 'text-chart-1' : 'text-destructive'}`}>
                {edgeMath.edge >= 0 ? '+' : ''}{edgeMath.edge.toFixed(1)}%
              </p>
            </div>
            <div className="rounded bg-secondary/30 p-2">
              <p className="text-xs text-muted-foreground">Fair odds</p>
              <p className="font-mono font-bold">{edgeMath.fairOdds > 0 ? edgeMath.fairOdds.toFixed(2) : '—'}</p>
            </div>
          </div>
          {edgeMath.kelly > 0 && (
            <div className="rounded bg-chart-1/10 ring-1 ring-chart-1/30 p-3 text-sm">
              <p className="text-xs text-muted-foreground mb-1">Half-Kelly recommendation</p>
              <p className="font-mono font-bold text-chart-1">{(edgeMath.halfKelly * 100).toFixed(2)}% of bankroll</p>
              {h2hSuggestedTag && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Tag this bet <span className="font-mono">{h2hSuggestedTag}</span> in the import — so the ROI-by-tag card tells you later whether matchup research is actually +EV for you.
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
