'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'

interface ProfitChartProps {
  profitByDay: { date: string; profit: number; cumulative: number }[]
}

export function ProfitChart({ profitByDay }: ProfitChartProps) {
  const data = profitByDay.map(d => ({
    ...d,
    displayDate: d.date.replace(/\/26$/, '').replace(/\//g, '/'),
  }))

  if (data.length === 0) {
    return (
      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle className="text-lg">Profit Over Time</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[300px] items-center justify-center">
          <p className="text-muted-foreground">Not enough data to display chart</p>
        </CardContent>
      </Card>
    )
  }

  const minValue = Math.min(...data.map(d => d.cumulative))
  const maxValue = Math.max(...data.map(d => d.cumulative))
  const yDomain = [Math.floor(minValue - 20), Math.ceil(maxValue + 20)]

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Cumulative Profit</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.72 0.19 142)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.72 0.19 142)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="displayDate"
                stroke="oklch(0.6 0 0)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="oklch(0.6 0 0)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={yDomain}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'oklch(0.14 0.006 260)',
                  border: '1px solid oklch(0.25 0.008 260)',
                  borderRadius: '8px',
                  color: 'oklch(0.95 0 0)',
                }}
                labelStyle={{ color: 'oklch(0.6 0 0)' }}
                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cumulative P/L']}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="oklch(0.72 0.19 142)"
                strokeWidth={2}
                fill="url(#profitGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
