'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tags, TrendingUp, TrendingDown } from 'lucide-react'
import type { TagPerformance } from '@/lib/parse-bets'

interface RoiByTagProps {
  profitByTag: TagPerformance[]
}

export function RoiByTag({ profitByTag }: RoiByTagProps) {
  const tags = profitByTag.filter(t => t.betCount > 0)
  const maxAbsProfit = Math.max(...tags.map(t => Math.abs(t.profit)), 1)

  return (
    <Card className="stat-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Tags className="h-5 w-5 text-primary" />
          ROI by Tag
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {tags.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-sm text-muted-foreground">No tagged bets yet</p>
            <p className="text-xs text-muted-foreground">
              Tag bets on import to surface where your edge actually lives.
            </p>
          </div>
        ) : (
          tags.map(t => {
            const positive = t.roi >= 0
            const isUntagged = t.tag === 'untagged'
            return (
              <div
                key={t.tag}
                className={`p-3 rounded-lg ${
                  positive ? 'bg-chart-1/10 border-l-2 border-chart-1' : 'bg-destructive/10 border-l-2 border-destructive'
                } ${isUntagged ? 'opacity-70' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs uppercase">
                      {t.tag}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {t.betCount} bets · {t.winCount}W-{t.lossCount}L · ${t.totalStaked.toFixed(0)} staked
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-mono font-bold flex items-center gap-1 ${positive ? 'text-chart-1' : 'text-destructive'}`}>
                      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {positive ? '+' : ''}
                      {t.roi.toFixed(1)}% ROI
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 overflow-hidden rounded-full bg-secondary/50">
                    <div
                      className={`h-full ${positive ? 'bg-chart-1' : 'bg-destructive'} rounded-full transition-all duration-500`}
                      style={{ width: `${(Math.abs(t.profit) / maxAbsProfit) * 100}%` }}
                    />
                  </div>
                  <span className={`text-xs font-mono ${positive ? 'text-chart-1' : 'text-destructive'}`}>
                    {positive ? '+' : ''}${t.profit.toFixed(2)}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono w-16 text-right">
                    {t.winRate.toFixed(0)}% WR
                  </span>
                </div>
              </div>
            )
          })
        )}
        {tags.length > 0 && (
          <p className="text-xs text-muted-foreground border-t border-border/30 pt-3">
            Sorted by ROI. The tag with the worst ROI is leaking money — investigate what those bets have in common.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
