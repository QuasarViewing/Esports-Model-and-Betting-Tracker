'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, ArrowUp, ArrowDown, Minus } from 'lucide-react'

interface HeroImpact {
  heroName: string
  heroId: number
  impactLevel?: string
  reasoning: string
  currentWinRate?: number
}

interface Analysis {
  buffed_heroes: HeroImpact[]
  nerfed_heroes: HeroImpact[]
  indirect_winners: HeroImpact[]
  indirect_losers: HeroImpact[]
  meta_predictions: { prediction: string; confidence: string; reasoning: string }[]
  archetype_shifts: { archetype: string; direction: string; reasoning: string }[]
  broken_combos: { heroes: string[]; reasoning: string }[]
}

const IMPACT_COLORS: Record<string, string> = {
  major: 'bg-red-600 text-white',
  significant: 'bg-orange-600 text-white',
  minor: 'bg-yellow-600 text-white',
}

export function PatchAnalyzerUI() {
  const [patchNotes, setPatchNotes] = useState('')
  const [patchVersion, setPatchVersion] = useState('')
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function analyze() {
    if (!patchNotes.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/model/analyze-patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patchNotes, patchVersion: patchVersion || undefined }),
      })

      if (res.ok) {
        setAnalysis(await res.json())
      } else {
        const data = await res.json()
        setError(data.error ?? 'Failed to analyze')
      }
    } catch {
      setError('Network error')
    }

    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <Card className="stat-card bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Patch Note Analyzer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Patch version (e.g., 7.38)"
            value={patchVersion}
            onChange={e => setPatchVersion(e.target.value)}
            className="bg-background"
          />
          <Textarea
            placeholder="Paste full patch notes here..."
            value={patchNotes}
            onChange={e => setPatchNotes(e.target.value)}
            rows={10}
            className="bg-background font-mono text-xs"
          />
          <Button onClick={analyze} disabled={loading || !patchNotes.trim()} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {loading ? 'Analyzing...' : 'Analyze Patch'}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">
            Requires ANTHROPIC_API_KEY in .env.local
          </p>
        </CardContent>
      </Card>

      {analysis && (
        <>
          {/* Buffed Heroes */}
          <HeroList
            title="Buffed Heroes"
            heroes={analysis.buffed_heroes ?? []}
            icon={<ArrowUp className="h-4 w-4 text-chart-1" />}
          />

          {/* Nerfed Heroes */}
          <HeroList
            title="Nerfed Heroes"
            heroes={analysis.nerfed_heroes ?? []}
            icon={<ArrowDown className="h-4 w-4 text-destructive" />}
          />

          {/* Indirect Winners */}
          <HeroList
            title="Indirect Winners"
            heroes={analysis.indirect_winners ?? []}
            icon={<ArrowUp className="h-4 w-4 text-cyan-500" />}
          />

          {/* Indirect Losers */}
          <HeroList
            title="Indirect Losers"
            heroes={analysis.indirect_losers ?? []}
            icon={<ArrowDown className="h-4 w-4 text-orange-500" />}
          />

          {/* Meta Predictions */}
          {analysis.meta_predictions && analysis.meta_predictions.length > 0 && (
            <Card className="stat-card bg-card/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Meta Predictions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {analysis.meta_predictions.map((p, i) => (
                  <div key={i} className="border-b border-border/30 pb-2">
                    <p className="text-sm font-medium">{p.prediction}</p>
                    <p className="text-xs text-muted-foreground">{p.reasoning}</p>
                    <Badge variant="outline" className="text-xs mt-1">{p.confidence}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Archetype Shifts */}
          {analysis.archetype_shifts && analysis.archetype_shifts.length > 0 && (
            <Card className="stat-card bg-card/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Archetype Shifts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {analysis.archetype_shifts.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {s.direction === 'stronger' ? (
                      <ArrowUp className="h-3 w-3 text-chart-1" />
                    ) : (
                      <ArrowDown className="h-3 w-3 text-destructive" />
                    )}
                    <span className="font-medium capitalize">{s.archetype}</span>
                    <Minus className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{s.reasoning}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Broken Combos */}
          {analysis.broken_combos && analysis.broken_combos.length > 0 && (
            <Card className="stat-card bg-card/50 border-red-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-destructive">Potentially Broken Combos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {analysis.broken_combos.map((c, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-medium">{c.heroes.join(' + ')}</span>
                    <p className="text-xs text-muted-foreground">{c.reasoning}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function HeroList({ title, heroes, icon }: { title: string; heroes: HeroImpact[]; icon: React.ReactNode }) {
  if (heroes.length === 0) return null

  return (
    <Card className="stat-card bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {icon} {title} ({heroes.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {heroes.map((h, i) => (
          <div key={i} className="flex items-start justify-between text-sm border-b border-border/30 pb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{h.heroName}</span>
                {h.impactLevel && (
                  <Badge className={`text-xs ${IMPACT_COLORS[h.impactLevel] ?? ''}`}>
                    {h.impactLevel}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{h.reasoning}</p>
            </div>
            {h.currentWinRate != null && (
              <span className="text-xs font-mono text-muted-foreground ml-2">
                {(h.currentWinRate * 100).toFixed(1)}%
              </span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
