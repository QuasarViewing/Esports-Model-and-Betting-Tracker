'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

interface Performance {
  total: number
  correct: number
  incorrect: number
  pending: number
  accuracy: number
  calibration: { bucket: string; predicted: number; actual: number; count: number }[]
  avgEdgeCorrect: number
  avgEdgeIncorrect: number
  roi: number
  byConfidence: { level: string; accuracy: number; count: number }[]
}

export function ModelPerformance() {
  const [perf, setPerf] = useState<Performance | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/model/backtest')
        if (res.ok) setPerf(await res.json())
      } catch { /* ignore */ }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <Card className="stat-card bg-card/50">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!perf || perf.total === 0) {
    return (
      <Card className="stat-card bg-card/50">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No predictions to analyze yet. Make some predictions first.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total" value={String(perf.total)} />
        <StatCard
          label="Accuracy"
          value={`${(perf.accuracy * 100).toFixed(1)}%`}
          color={perf.accuracy > 0.55 ? 'text-chart-1' : perf.accuracy < 0.45 ? 'text-destructive' : ''}
        />
        <StatCard
          label="ROI"
          value={`${perf.roi > 0 ? '+' : ''}${perf.roi.toFixed(1)}%`}
          color={perf.roi > 0 ? 'text-chart-1' : 'text-destructive'}
        />
        <StatCard label="Pending" value={String(perf.pending)} />
      </div>

      {/* Calibration */}
      <Card className="stat-card bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Calibration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {perf.calibration.filter(c => c.count > 0).map(c => (
              <div key={c.bucket} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-16">{c.bucket}</span>
                <div className="flex-1 h-4 rounded bg-secondary relative overflow-hidden">
                  <div
                    className="absolute h-full bg-chart-1/30 rounded"
                    style={{ width: `${c.predicted * 100}%` }}
                  />
                  <div
                    className="absolute h-full bg-chart-1 rounded"
                    style={{ width: `${c.actual * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono w-20 text-right">
                  {(c.actual * 100).toFixed(0)}% ({c.count})
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Dark bar = predicted, solid = actual win rate
          </p>
        </CardContent>
      </Card>

      {/* By Confidence */}
      <Card className="stat-card bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Accuracy by Confidence</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {perf.byConfidence.map(c => (
              <div key={c.level} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{c.level}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono">{(c.accuracy * 100).toFixed(1)}%</span>
                  <span className="text-xs text-muted-foreground">({c.count} predictions)</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edge Stats */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Avg Edge (Correct)"
          value={`+${perf.avgEdgeCorrect.toFixed(1)}%`}
          color="text-chart-1"
        />
        <StatCard
          label="Avg Edge (Incorrect)"
          value={`${perf.avgEdgeIncorrect.toFixed(1)}%`}
          color="text-destructive"
        />
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card className="stat-card bg-card/50">
      <CardContent className="pt-4 pb-3 text-center">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-xl font-mono font-bold ${color ?? ''}`}>{value}</p>
      </CardContent>
    </Card>
  )
}
