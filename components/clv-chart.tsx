'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts'
import { Target, TrendingUp, TrendingDown } from 'lucide-react'
import type { ClvStats } from '@/lib/parse-bets'

interface ClvChartProps {
  clv: ClvStats
}

export function ClvChart({ clv }: ClvChartProps) {
  const data = clv.clvByDay.map(d => {
    const parts = d.date.split('/')
    const sortKey = parts.length === 3
      ? `20${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
      : d.date
    const displayDate = parts.length === 3 ? `${parts[1]}/${parts[0]}` : d.date
    return { ...d, sortKey, displayDate }
  }).sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  const isPositive = clv.avgClvPct >= 0

  if (clv.bets === 0) {
    return (
      <Card className="stat-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-primary" />
            Closing Line Value
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 py-8 text-center">
          <p className="text-sm text-muted-foreground">No closing odds recorded yet</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            In the History tab, click the CLV column on settled bets and enter the closing odds (last
            market consensus before the match started). Positive CLV means you bet at better odds than
            the market settled on — the best long-term signal you're sharp.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="stat-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-primary" />
            Closing Line Value
          </CardTitle>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
            isPositive ? 'bg-chart-1/10 text-chart-1' : 'bg-destructive/10 text-destructive'
          }`}>
            {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            <span className="font-mono text-sm font-bold">
              {isPositive ? '+' : ''}{clv.avgClvPct.toFixed(2)}% avg · {clv.bets} bets
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="displayDate" stroke="oklch(0.4 0 0)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.4 0 0)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v.toFixed(1)}%`} />
              <ReferenceLine y={0} stroke="oklch(0.3 0 0)" strokeDasharray="3 3" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'oklch(0.12 0.015 240)',
                  border: '1px solid oklch(0.22 0.015 240)',
                  borderRadius: '8px',
                  color: 'oklch(0.95 0 0)',
                }}
                labelStyle={{ color: 'oklch(0.55 0 0)' }}
                formatter={(value: number, name: string) => {
                  const label = name === 'cumulative' ? 'Running avg CLV' : 'Day avg CLV'
                  return [`${value.toFixed(2)}%`, label]
                }}
              />
              <Line type="monotone" dataKey="avgClv" stroke="oklch(0.65 0.15 230)" strokeWidth={1.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="cumulative" stroke="oklch(0.72 0.16 155)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground border-t border-border/30 pt-3 mt-3">
          Green line = running average across all bets. Blue = per-day average. Sustained positive CLV (&gt;+2% over 50+ bets) is the surest sign of a real edge — even when raw P/L is on a cold streak.
        </p>
      </CardContent>
    </Card>
  )
}
