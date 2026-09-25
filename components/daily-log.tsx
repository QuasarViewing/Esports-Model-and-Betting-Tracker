'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine, Cell } from 'recharts'
import { Calendar, TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import type { ParsedBet } from '@/lib/parse-bets'
import type { DbTransaction } from '@/lib/actions'

interface DailyLogProps {
  bets: ParsedBet[]
  transactions: DbTransaction[]
  currentBalance: number
  totalDeposits: number
  totalWithdrawals: number
}

interface DayEntry {
  date: string
  displayDate: string
  sortKey: string
  startingBalance: number
  endingBalance: number
  betsPlaced: number
  betsWon: number
  betsLost: number
  betsCashedOut: number
  betsPending: number
  pendingStake: number
  grossPL: number
  deposits: number
  withdrawals: number
  dailyROI: number
  cumulativeProfit: number
}

function isoToSortKey(iso: string): string {
  return iso
}

function isoToDisplay(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : iso
}

function isoToChartLabel(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[2]}/${m[3]}` : iso
}

export function DailyLog({ bets, transactions, currentBalance, totalDeposits, totalWithdrawals }: DailyLogProps) {
  const [chartView, setChartView] = useState<'balance' | 'profit' | 'daily'>('balance')

  const days: DayEntry[] = useMemo(() => {
    const dayMap = new Map<string, {
      betsPlaced: number
      betsWon: number
      betsLost: number
      betsCashedOut: number
      betsPending: number
      pendingStake: number
      grossPL: number
      deposits: number
      withdrawals: number
      totalStaked: number
    }>()

    const countedTypes = new Set(['win', 'loss', 'cashed_out', 'pending'])
    for (const bet of bets) {
      if (!bet.date || !countedTypes.has(bet.type)) continue
      const existing = dayMap.get(bet.date) ?? {
        betsPlaced: 0, betsWon: 0, betsLost: 0, betsCashedOut: 0,
        betsPending: 0, pendingStake: 0,
        grossPL: 0, deposits: 0, withdrawals: 0, totalStaked: 0,
      }
      existing.betsPlaced++
      if (bet.type === 'win') existing.betsWon++
      else if (bet.type === 'loss') existing.betsLost++
      else if (bet.type === 'cashed_out') existing.betsCashedOut++
      else if (bet.type === 'pending') { existing.betsPending++; existing.pendingStake += bet.stake }
      if (bet.type !== 'pending') {
        existing.grossPL += bet.profitLoss
        existing.totalStaked += bet.stake
      }
      dayMap.set(bet.date, existing)
    }

    for (const tx of transactions) {
      if (!tx.date) continue
      const existing = dayMap.get(tx.date) ?? {
        betsPlaced: 0, betsWon: 0, betsLost: 0, betsCashedOut: 0,
        betsPending: 0, pendingStake: 0,
        grossPL: 0, deposits: 0, withdrawals: 0, totalStaked: 0,
      }
      if (tx.type === 'deposit') existing.deposits += Number(tx.amount)
      else if (tx.type === 'withdrawal') existing.withdrawals += Number(tx.amount)
      dayMap.set(tx.date, existing)
    }

    const sortedDates = [...dayMap.keys()].sort()
    if (sortedDates.length === 0) return []

    const firstDeposit = transactions
      .filter(t => t.type === 'deposit')
      .sort((a, b) => a.date.localeCompare(b.date))[0]
    const initialBalance = firstDeposit ? Number(firstDeposit.amount) : 0

    const entries: DayEntry[] = []
    let runningBalance = 0
    let cumulativeProfit = 0

    for (const date of sortedDates) {
      const d = dayMap.get(date)!

      const isFirstDay = entries.length === 0
      const startingBalance = isFirstDay ? 0 : runningBalance

      const endingBalance = startingBalance + d.deposits - d.withdrawals + d.grossPL
      cumulativeProfit += d.grossPL

      const dailyROI = d.totalStaked > 0 ? (d.grossPL / d.totalStaked) * 100 : 0

      entries.push({
        date,
        displayDate: isoToDisplay(date),
        sortKey: isoToSortKey(date),
        startingBalance,
        endingBalance,
        betsPlaced: d.betsPlaced,
        betsWon: d.betsWon,
        betsLost: d.betsLost,
        betsCashedOut: d.betsCashedOut,
        betsPending: d.betsPending,
        pendingStake: d.pendingStake,
        grossPL: d.grossPL,
        deposits: d.deposits,
        withdrawals: d.withdrawals,
        dailyROI,
        cumulativeProfit,
      })

      runningBalance = endingBalance
    }

    return entries
  }, [bets, transactions])

  const chartData = useMemo(() => {
    return days.map(d => ({
      date: isoToChartLabel(d.date),
      balance: Number(d.endingBalance.toFixed(2)),
      profit: Number(d.cumulativeProfit.toFixed(2)),
      dailyPL: Number(d.grossPL.toFixed(2)),
    }))
  }, [days])

  if (days.length === 0) {
    return (
      <Card className="stat-card">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="p-4 rounded-full bg-primary/10 mb-4">
            <Calendar className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-medium mb-2">No daily data yet</h3>
          <p className="text-muted-foreground text-center max-w-sm">
            Import your betting history to see day-by-day performance breakdown.
          </p>
        </CardContent>
      </Card>
    )
  }

  const totalProfit = days[days.length - 1]?.cumulativeProfit ?? 0
  const winningDays = days.filter(d => d.grossPL > 0).length
  const losingDays = days.filter(d => d.grossPL < 0).length
  const bestDay = days.reduce((best, d) => d.grossPL > best.grossPL ? d : best, days[0])
  const worstDay = days.reduce((worst, d) => d.grossPL < worst.grossPL ? d : worst, days[0])
  const avgDailyPL = totalProfit / days.filter(d => d.betsPlaced > 0).length || 0

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard
          label="Active Days"
          value={days.filter(d => d.betsPlaced > 0).length.toString()}
          icon={<Calendar className="h-4 w-4" />}
        />
        <SummaryCard
          label="Winning Days"
          value={winningDays.toString()}
          subtitle={`${days.filter(d => d.betsPlaced > 0).length > 0 ? ((winningDays / days.filter(d => d.betsPlaced > 0).length) * 100).toFixed(0) : 0}%`}
          positive
        />
        <SummaryCard
          label="Losing Days"
          value={losingDays.toString()}
          negative
        />
        <SummaryCard
          label="Avg Daily P/L"
          value={`$${Math.abs(avgDailyPL).toFixed(2)}`}
          positive={avgDailyPL >= 0}
          negative={avgDailyPL < 0}
          prefix={avgDailyPL >= 0 ? '+' : '-'}
        />
        <SummaryCard
          label="Best Day"
          value={`+$${bestDay.grossPL.toFixed(2)}`}
          subtitle={bestDay.displayDate}
          positive
        />
        <SummaryCard
          label="Worst Day"
          value={`-$${Math.abs(worstDay.grossPL).toFixed(2)}`}
          subtitle={worstDay.displayDate}
          negative
        />
      </div>

      {/* Charts */}
      <Card className="stat-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Performance Charts</CardTitle>
            <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
              <button
                onClick={() => setChartView('balance')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  chartView === 'balance' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Balance
              </button>
              <button
                onClick={() => setChartView('profit')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  chartView === 'profit' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Cumulative P/L
              </button>
              <button
                onClick={() => setChartView('daily')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  chartView === 'daily' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Daily P/L
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[320px]">
            {chartView === 'daily' ? (
              <DailyPLChart data={chartData} />
            ) : (
              <BalanceOrProfitChart data={chartData} dataKey={chartView === 'balance' ? 'balance' : 'profit'} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Day-by-Day Table */}
      <Card className="stat-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Day-by-Day Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Start Bal</TableHead>
                  <TableHead className="text-center">Bets (W/L)</TableHead>
                  <TableHead className="text-right">P/L</TableHead>
                  <TableHead className="text-right">Deposits</TableHead>
                  <TableHead className="text-right">Withdrawals</TableHead>
                  <TableHead className="text-right">End Bal</TableHead>
                  <TableHead className="text-right">ROI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...days].reverse().map((day) => (
                  <TableRow key={day.date}>
                    <TableCell className="font-medium">{day.displayDate}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      ${day.startingBalance.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      {day.betsPlaced > 0 ? (
                        <span className="font-mono">
                          {day.betsPlaced}{' '}
                          <span className="text-xs">
                            (<span className="text-chart-1">{day.betsWon}W</span>
                            /<span className="text-destructive">{day.betsLost}L</span>
                            {day.betsCashedOut > 0 && <>/<span className="text-warning">{day.betsCashedOut}C</span></>}
                            {day.betsPending > 0 && <>/<span className="text-muted-foreground">{day.betsPending}P</span></>})
                          </span>
                          {day.pendingStake > 0 && (
                            <span className="text-xs text-muted-foreground ml-1">(${day.pendingStake.toFixed(0)} pending)</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className={`text-right font-mono font-semibold ${
                      day.grossPL > 0 ? 'text-chart-1' : day.grossPL < 0 ? 'text-destructive' : 'text-muted-foreground'
                    }`}>
                      {day.grossPL !== 0 ? (
                        <>{day.grossPL > 0 ? '+' : ''}${day.grossPL.toFixed(2)}</>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {day.deposits > 0 ? (
                        <span className="text-chart-1">+${day.deposits.toFixed(2)}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {day.withdrawals > 0 ? (
                        <span className="text-destructive">-${day.withdrawals.toFixed(2)}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      ${day.endingBalance.toFixed(2)}
                    </TableCell>
                    <TableCell className={`text-right font-mono text-sm ${
                      day.dailyROI > 0 ? 'text-chart-1' : day.dailyROI < 0 ? 'text-destructive' : 'text-muted-foreground'
                    }`}>
                      {day.betsPlaced > 0 ? (
                        <>{day.dailyROI > 0 ? '+' : ''}{day.dailyROI.toFixed(1)}%</>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({ label, value, subtitle, positive, negative, prefix, icon }: {
  label: string
  value: string
  subtitle?: string
  positive?: boolean
  negative?: boolean
  prefix?: string
  icon?: React.ReactNode
}) {
  return (
    <div className={`p-3 rounded-lg bg-secondary/50 transition-all hover:bg-secondary/70 ${
      positive ? 'ring-1 ring-chart-1/30' : ''
    } ${negative ? 'ring-1 ring-destructive/30' : ''}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-lg font-bold font-mono ${
        positive ? 'text-chart-1' : ''
      } ${negative ? 'text-destructive' : ''}`}>
        {prefix}{value}
      </p>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      )}
    </div>
  )
}

function BalanceOrProfitChart({ data, dataKey }: { data: { date: string; balance: number; profit: number }[]; dataKey: 'balance' | 'profit' }) {
  if (data.length === 0) return null

  const values = data.map(d => d[dataKey])
  const latestValue = values[values.length - 1] ?? 0
  const minValue = Math.min(...values, 0)
  const maxValue = Math.max(...values, 0)
  const padding = Math.max(Math.abs(maxValue - minValue) * 0.1, 20)

  const isPositive = dataKey === 'balance' ? true : latestValue >= 0
  const strokeColor = isPositive ? 'oklch(0.72 0.16 155)' : 'oklch(0.6 0.22 25)'
  const gradientId = `dailyLog${dataKey}Gradient`

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={strokeColor} stopOpacity={0.3} />
            <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" stroke="oklch(0.4 0 0)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis
          stroke="oklch(0.4 0 0)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          domain={[Math.floor(minValue - padding), Math.ceil(maxValue + padding)]}
          tickFormatter={(v) => `$${v}`}
        />
        {dataKey === 'profit' && <ReferenceLine y={0} stroke="oklch(0.3 0 0)" strokeDasharray="3 3" />}
        <Tooltip
          contentStyle={{
            backgroundColor: 'oklch(0.12 0.015 240)',
            border: '1px solid oklch(0.22 0.015 240)',
            borderRadius: '8px',
            color: 'oklch(0.95 0 0)',
          }}
          labelStyle={{ color: 'oklch(0.55 0 0)' }}
          itemStyle={{ color: 'oklch(0.95 0 0)' }}
          formatter={(value: number) => [`$${value.toFixed(2)}`, dataKey === 'balance' ? 'Balance' : 'Cumulative P/L']}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={strokeColor}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4, fill: strokeColor, stroke: 'oklch(0.12 0.015 240)', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function DailyPLChart({ data }: { data: { date: string; dailyPL: number }[] }) {
  if (data.length === 0) return null

  const values = data.map(d => d.dailyPL)
  const minValue = Math.min(...values, 0)
  const maxValue = Math.max(...values, 0)
  const padding = Math.max(Math.abs(maxValue - minValue) * 0.15, 10)

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <XAxis dataKey="date" stroke="oklch(0.4 0 0)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis
          stroke="oklch(0.4 0 0)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          domain={[Math.floor(minValue - padding), Math.ceil(maxValue + padding)]}
          tickFormatter={(v) => `$${v}`}
        />
        <ReferenceLine y={0} stroke="oklch(0.3 0 0)" strokeDasharray="3 3" />
        <Tooltip
          cursor={{ fill: 'oklch(0.2 0.01 240 / 0.5)' }}
          contentStyle={{
            backgroundColor: 'oklch(0.12 0.015 240)',
            border: '1px solid oklch(0.22 0.015 240)',
            borderRadius: '8px',
            color: 'oklch(0.95 0 0)',
          }}
          labelStyle={{ color: 'oklch(0.55 0 0)' }}
          itemStyle={{ color: 'oklch(0.95 0 0)' }}
          formatter={(value: number) => [`${value >= 0 ? '+' : ''}$${value.toFixed(2)}`, 'Daily P/L']}
        />
        <Bar dataKey="dailyPL" radius={[3, 3, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={index}
              fill={entry.dailyPL >= 0 ? 'oklch(0.72 0.16 155)' : 'oklch(0.6 0.22 25)'}
              fillOpacity={0.8}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
