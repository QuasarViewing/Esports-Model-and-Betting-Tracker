'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Target } from 'lucide-react'
import type { CalibrationBucket } from '@/lib/parse-bets'

interface CalibrationCardProps {
  buckets: CalibrationBucket[]
}

const verdictStyles: Record<CalibrationBucket['verdict'], { label: string; className: string }> = {
  sharp: { label: 'sharp ✓', className: 'bg-chart-1/20 text-chart-1 border-chart-1/30' },
  fair: { label: 'fair', className: 'bg-secondary/50 text-muted-foreground border-border' },
  'over-confident': { label: 'overconfident', className: 'bg-destructive/20 text-destructive border-destructive/30' },
  'under-confident': { label: 'underconfident', className: 'bg-warning/20 text-warning border-warning/30' },
  thin: { label: 'thin sample', className: 'bg-muted/50 text-muted-foreground border-border opacity-60' },
}

export function CalibrationCard({ buckets }: CalibrationCardProps) {
  const totalBets = buckets.reduce((s, b) => s + b.betCount, 0)

  return (
    <Card className="stat-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="h-5 w-5 text-primary" />
          Calibration by Odds Bucket
        </CardTitle>
      </CardHeader>
      <CardContent>
        {totalBets === 0 ? (
          <p className="text-center py-8 text-sm text-muted-foreground">No settled bets yet</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="text-muted-foreground">Bucket</TableHead>
                  <TableHead className="text-right text-muted-foreground">Implied</TableHead>
                  <TableHead className="text-right text-muted-foreground">Actual</TableHead>
                  <TableHead className="text-right text-muted-foreground">Δ</TableHead>
                  <TableHead className="text-right text-muted-foreground">Bets</TableHead>
                  <TableHead className="text-right text-muted-foreground">Verdict</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buckets.map(b => {
                  const style = verdictStyles[b.verdict]
                  const deltaPositive = b.delta >= 0
                  return (
                    <TableRow key={b.label} className="border-border/30 hover:bg-secondary/30">
                      <TableCell className="font-mono">{b.label}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {b.betCount > 0 ? `${b.avgImplied.toFixed(1)}%` : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {b.betCount > 0 ? `${b.actualHitRate.toFixed(1)}%` : '—'}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${
                          b.betCount === 0
                            ? 'text-muted-foreground'
                            : deltaPositive
                              ? 'text-chart-1'
                              : 'text-destructive'
                        }`}
                      >
                        {b.betCount > 0 ? `${deltaPositive ? '+' : ''}${b.delta.toFixed(1)}` : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{b.betCount}</TableCell>
                      <TableCell className="text-right">
                        {b.betCount > 0 ? (
                          <Badge variant="outline" className={`text-xs ${style.className}`}>
                            {style.label}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground border-t border-border/30 pt-3 mt-3">
              Implied = avg of (1/odds). Actual = your hit rate in that bucket. Negative Δ = you took bets at worse
              odds than they were worth. Buckets with &lt;10 bets are flagged thin (variance dominates).
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
