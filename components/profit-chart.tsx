'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface ProfitChartProps {
  profitByDay: { date: string; profit: number; cumulative: number }[]
  truePLByDay?: { date: string; balance: number; cumulative: number }[]
  totalProfit?: number
}

export function ProfitChart({ profitByDay, truePLByDay, totalProfit }: ProfitChartProps) {
  // Use truePLByDay if available, otherwise use profitByDay
  const sourceData = truePLByDay && truePLByDay.length > 0 ? truePLByDay : profitByDay
  
  const data = sourceData.map(d => ({
    ...d,
    displayDate: d.date.replace(/\/26$/, '').replace(/\//g, '/'),
  }))

  if (data.length === 0) {
    return (
      <Card className="stat-card">
        <CardHeader>
          <CardTitle className="text-lg">Profit Over Time</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[300px] items-center justify-center">
          <p className="text-muted-foreground">Not enough data to display chart</p>
        </CardContent>
      </Card>
    )
  }

  // Use totalProfit if provided, otherwise use the last cumulative value from data
  const latestProfit = totalProfit !== undefined ? totalProfit : (data[data.length - 1]?.cumulative || 0)
  const minValue = Math.min(...data.map(d => d.cumulative), 0)
  const maxValue = Math.max(...data.map(d => d.cumulative), 0)
  const padding = Math.max(Math.abs(maxValue - minValue) * 0.1, 20)
  const yDomain = [Math.floor(minValue - padding), Math.ceil(maxValue + padding)]

  const isPositive = latestProfit >= 0
  const gradientId = isPositive ? 'profitGradientGreen' : 'profitGradientRed'
  const strokeColor = isPositive ? 'oklch(0.72 0.16 155)' : 'oklch(0.6 0.22 25)'
  const gradientStartColor = isPositive ? 'oklch(0.72 0.16 155)' : 'oklch(0.6 0.22 25)'

  return (
    <Card className="stat-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Cumulative Profit</CardTitle>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
            isPositive ? 'bg-chart-1/10 text-chart-1' : 'bg-destructive/10 text-destructive'
          }`}>
            {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            <span className="font-mono text-sm font-bold">
              {isPositive ? '+' : ''}${latestProfit.toFixed(2)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={gradientStartColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={gradientStartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="displayDate"
                stroke="oklch(0.4 0 0)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="oklch(0.4 0 0)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                domain={yDomain}
                tickFormatter={(value) => `$${value}`}
              />
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
                  if (name === 'cumulative') {
                    return [`$${value.toFixed(2)}`, 'Total P/L']
                  }
                  return [`$${value.toFixed(2)}`, 'Daily P/L']
                }}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke={strokeColor}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 4, fill: strokeColor, stroke: 'oklch(0.12 0.015 240)', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
