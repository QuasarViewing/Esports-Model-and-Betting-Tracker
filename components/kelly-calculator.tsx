'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calculator, AlertTriangle, TrendingUp } from 'lucide-react'

interface KellyCalculatorProps {
  bankroll: number
}

// Kelly formula: f* = (decimal_odds * p - 1) / (decimal_odds - 1)
// where p is perceived true win probability (0-1). Returns fraction of bankroll.
function kellyFraction(odds: number, trueProb: number): number {
  if (odds <= 1 || trueProb <= 0 || trueProb >= 1) return 0
  return (odds * trueProb - 1) / (odds - 1)
}

export function KellyCalculator({ bankroll }: KellyCalculatorProps) {
  const [oddsInput, setOddsInput] = useState('2.00')
  const [trueWinInput, setTrueWinInput] = useState('55')

  const { odds, trueProb, impliedProb, edge, full, half, quarter, fullDollar, halfDollar, quarterDollar, warning } =
    useMemo(() => {
      const odds = parseFloat(oddsInput) || 0
      const trueWinPct = parseFloat(trueWinInput) || 0
      const trueProb = trueWinPct / 100
      const impliedProb = odds > 0 ? (1 / odds) * 100 : 0
      const edge = trueWinPct - impliedProb

      const fullRaw = kellyFraction(odds, trueProb)
      // Cap full Kelly at 25% — never bet more, even with massive perceived edge.
      const full = Math.max(0, Math.min(fullRaw, 0.25))
      const half = full / 2
      const quarter = full / 4

      const warning =
        odds <= 1
          ? 'Odds must be greater than 1.00'
          : trueWinPct <= 0 || trueWinPct >= 100
            ? 'Win probability must be between 0 and 100'
            : fullRaw <= 0
              ? 'Negative edge — no bet recommended'
              : fullRaw > 0.25
                ? 'Capped at 25% — raw Kelly was higher, almost certainly overconfident'
                : null

      return {
        odds,
        trueProb,
        impliedProb,
        edge,
        full,
        half,
        quarter,
        fullDollar: bankroll * full,
        halfDollar: bankroll * half,
        quarterDollar: bankroll * quarter,
        warning,
      }
    }, [oddsInput, trueWinInput, bankroll])

  return (
    <Card className="stat-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="h-5 w-5 text-primary" />
          Kelly Stake Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bankroll</Label>
            <div className="h-9 px-3 flex items-center font-mono font-bold rounded-md bg-secondary/50 text-foreground">
              ${bankroll.toFixed(2)}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="kelly-odds" className="text-xs text-muted-foreground">
              Decimal Odds
            </Label>
            <Input
              id="kelly-odds"
              type="number"
              step="0.01"
              min="1.01"
              value={oddsInput}
              onChange={e => setOddsInput(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="kelly-true" className="text-xs text-muted-foreground">
              True Win %
            </Label>
            <Input
              id="kelly-true"
              type="number"
              step="0.5"
              min="0"
              max="100"
              value={trueWinInput}
              onChange={e => setTrueWinInput(e.target.value)}
              className="font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-secondary/30">
            <p className="text-xs text-muted-foreground mb-1">Market implied</p>
            <p className="font-mono font-bold text-foreground">{impliedProb.toFixed(1)}%</p>
          </div>
          <div className={`p-3 rounded-lg ${edge > 0 ? 'bg-chart-1/10' : 'bg-destructive/10'}`}>
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Your edge
            </p>
            <p className={`font-mono font-bold ${edge > 0 ? 'text-chart-1' : 'text-destructive'}`}>
              {edge >= 0 ? '+' : ''}
              {edge.toFixed(1)}%
            </p>
          </div>
        </div>

        {warning && (
          <div className="flex items-center gap-2 text-sm text-warning bg-warning/10 rounded-lg px-3 py-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{warning}</span>
          </div>
        )}

        <div className="space-y-2">
          <StakeRow label="Full Kelly" fraction={full} dollars={fullDollar} subtitle="aggressive — high variance" />
          <StakeRow label="Half Kelly" fraction={half} dollars={halfDollar} subtitle="recommended" highlight />
          <StakeRow label="Quarter Kelly" fraction={quarter} dollars={quarterDollar} subtitle="conservative" />
        </div>

        <p className="text-xs text-muted-foreground border-t border-border/30 pt-3">
          Kelly maximizes long-term geometric growth. Half-Kelly trades a small EV cut for ~75% less variance and
          is the standard practical choice.
        </p>
      </CardContent>
    </Card>
  )
}

function StakeRow({
  label,
  fraction,
  dollars,
  subtitle,
  highlight = false,
}: {
  label: string
  fraction: number
  dollars: number
  subtitle: string
  highlight?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg ${
        highlight ? 'bg-chart-1/10 ring-1 ring-chart-1/30' : 'bg-secondary/30'
      }`}
    >
      <div>
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="text-right">
        <p className={`font-mono font-bold ${highlight ? 'text-chart-1' : 'text-foreground'}`}>
          ${dollars.toFixed(2)}
        </p>
        <p className="text-xs text-muted-foreground font-mono">{(fraction * 100).toFixed(2)}% of bankroll</p>
      </div>
    </div>
  )
}
