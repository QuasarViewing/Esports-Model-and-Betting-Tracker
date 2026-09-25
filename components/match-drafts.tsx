'use client'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import { ChevronDown, ChevronRight, Ban } from 'lucide-react'
import type { SimpleMatch, HeroMeta } from '@/lib/stratz'

const heroFetcher = (url: string) => fetch(url).then(r => r.ok ? r.json() : [])

interface MatchDraftsProps {
  matches: SimpleMatch[]
  focusTeamName: string
  opposingTeamName: string
  limit?: number
}

export function MatchDrafts({ matches, focusTeamName, opposingTeamName, limit = 10 }: MatchDraftsProps) {
  const { data: heroes } = useSWR<HeroMeta[]>('/api/stratz/heroes', heroFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60 * 60 * 1000,
  })
  const [openId, setOpenId] = useState<number | null>(null)

  const heroById = useMemo(() => {
    const map = new Map<number, HeroMeta>()
    for (const h of heroes ?? []) map.set(h.id, h)
    return map
  }, [heroes])

  if (matches.length === 0) {
    return <p className="text-xs text-muted-foreground py-3">No recent matches with draft data.</p>
  }

  const shown = matches.slice(0, limit)

  return (
    <div className="space-y-1">
      {shown.map(match => {
        const expanded = openId === match.id
        const date = match.startDateTime > 0 ? new Date(match.startDateTime * 1000).toLocaleDateString() : '—'
        const duration = match.durationSeconds > 0 ? `${Math.round(match.durationSeconds / 60)}m` : ''

        return (
          <div key={match.id} className="rounded-md border border-border/40 overflow-hidden">
            <button
              onClick={() => setOpenId(expanded ? null : match.id)}
              className="w-full px-3 py-2 flex items-center gap-2 text-left text-sm hover:bg-secondary/30 transition-colors"
            >
              {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
              <span className={`font-mono font-bold text-xs w-6 ${match.won ? 'text-chart-1' : 'text-destructive'}`}>
                {match.won ? 'W' : 'L'}
              </span>
              <span className="flex-1 truncate">
                vs <span className="font-medium">{match.opposingTeamName ?? 'Unknown'}</span>
              </span>
              <span className="text-xs text-muted-foreground hidden sm:inline truncate max-w-[180px]">
                {match.league}
              </span>
              <span className="text-xs text-muted-foreground font-mono">{duration}</span>
              <span className="text-xs text-muted-foreground font-mono w-20 text-right">{date}</span>
            </button>

            {expanded && (
              <div className="px-3 py-3 bg-secondary/20 border-t border-border/40 space-y-3">
                <DraftSide
                  label={match.isRadiant ? `${focusTeamName} (Radiant)` : `${opposingTeamName} (Radiant)`}
                  isFocusSide={match.isRadiant}
                  picks={match.pickBans.filter(pb => pb.isRadiant && pb.isPick).sort((a, b) => a.order - b.order)}
                  bans={match.pickBans.filter(pb => pb.isRadiant && !pb.isPick).sort((a, b) => a.order - b.order)}
                  heroById={heroById}
                />
                <DraftSide
                  label={match.isRadiant ? `${opposingTeamName} (Dire)` : `${focusTeamName} (Dire)`}
                  isFocusSide={!match.isRadiant}
                  picks={match.pickBans.filter(pb => !pb.isRadiant && pb.isPick).sort((a, b) => a.order - b.order)}
                  bans={match.pickBans.filter(pb => !pb.isRadiant && !pb.isPick).sort((a, b) => a.order - b.order)}
                  heroById={heroById}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function DraftSide({
  label,
  isFocusSide,
  picks,
  bans,
  heroById,
}: {
  label: string
  isFocusSide: boolean
  picks: { heroId: number; order: number }[]
  bans: { heroId: number; order: number }[]
  heroById: Map<number, HeroMeta>
}) {
  return (
    <div className={`rounded p-2 ${isFocusSide ? 'bg-primary/5 ring-1 ring-primary/20' : 'bg-background/40'}`}>
      <p className="text-xs text-muted-foreground mb-2 font-medium">{label}</p>
      <div className="flex flex-wrap gap-1.5 items-start">
        {picks.map((pb, i) => (
          <HeroChip key={`p-${i}`} heroId={pb.heroId} hero={heroById.get(pb.heroId)} kind="pick" />
        ))}
        {bans.length > 0 && <div className="w-px h-8 bg-border/60 mx-1" />}
        {bans.map((pb, i) => (
          <HeroChip key={`b-${i}`} heroId={pb.heroId} hero={heroById.get(pb.heroId)} kind="ban" />
        ))}
      </div>
    </div>
  )
}

function HeroChip({ heroId, hero, kind }: { heroId: number; hero: HeroMeta | undefined; kind: 'pick' | 'ban' }) {
  // Steam's CDN is the most reliable source for hero portraits — STRATZ's CDN flakes on some heroes.
  const imgUrl = hero ? `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${hero.shortName}.png` : null
  return (
    <div
      className={`relative rounded overflow-hidden ${
        kind === 'ban' ? 'opacity-60 grayscale ring-1 ring-destructive/40' : 'ring-1 ring-border/60'
      }`}
      title={hero?.displayName ?? `Hero #${heroId}`}
    >
      {imgUrl ? (
        <img src={imgUrl} alt={hero?.displayName ?? ''} className="h-9 w-16 object-cover" />
      ) : (
        <div className="h-9 w-16 bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
          #{heroId}
        </div>
      )}
      {kind === 'ban' && (
        <Ban className="absolute top-0.5 right-0.5 h-3 w-3 text-destructive" />
      )}
    </div>
  )
}
