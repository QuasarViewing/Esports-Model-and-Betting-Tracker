'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface Prediction {
  id: string
  created_at: string
  team_a_name: string | null
  team_b_name: string | null
  model_probability: number | null
  bookmaker_odds_a: number | null
  edge: number | null
  recommended_stake_pct: number | null
  draft_archetype_a: string | null
  draft_archetype_b: string | null
  actual_winner: string | null
  correct: boolean | null
}

export function PredictionHistory() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [filter, setFilter] = useState<'all' | 'correct' | 'incorrect' | 'pending'>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/model/predictions')
        if (res.ok) {
          const data = await res.json()
          setPredictions(data.predictions ?? [])
        }
      } catch { /* ignore */ }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = predictions.filter(p => {
    if (filter === 'correct') return p.correct === true
    if (filter === 'incorrect') return p.correct === false
    if (filter === 'pending') return p.actual_winner == null
    return true
  })

  if (loading) {
    return (
      <Card className="stat-card bg-card/50">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="stat-card bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Recent Predictions</CardTitle>
          <div className="flex gap-1">
            {(['all', 'correct', 'incorrect', 'pending'] as const).map(f => (
              <Button
                key={f}
                variant={filter === f ? 'default' : 'ghost'}
                size="sm"
                className="text-xs h-7"
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No predictions yet. Use Quick Predict to generate predictions.
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm border-b border-border/30 py-2">
                <div>
                  <span className="font-medium">{p.team_a_name ?? '?'}</span>
                  <span className="text-muted-foreground mx-1">vs</span>
                  <span className="font-medium">{p.team_b_name ?? '?'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">
                    {p.model_probability != null ? `${(p.model_probability * 100).toFixed(0)}%` : '—'}
                  </span>
                  {p.edge != null && (
                    <span className={`font-mono text-xs ${p.edge > 0 ? 'text-chart-1' : 'text-destructive'}`}>
                      {p.edge > 0 ? '+' : ''}{p.edge.toFixed(1)}%
                    </span>
                  )}
                  {p.correct === true && <Badge className="bg-chart-1 text-xs">W</Badge>}
                  {p.correct === false && <Badge variant="destructive" className="text-xs">L</Badge>}
                  {p.actual_winner == null && <Badge variant="outline" className="text-xs">Pending</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
