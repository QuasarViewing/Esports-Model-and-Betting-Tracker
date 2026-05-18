'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { ParsedBet } from '@/lib/parse-bets'
import { ScrollArea } from '@/components/ui/scroll-area'

interface BetsTableProps {
  bets: ParsedBet[]
  title?: string
  showFilters?: boolean
}

const gameColors: Record<string, string> = {
  dota2: 'bg-[oklch(0.6_0.18_25/0.15)] text-[oklch(0.7_0.18_25)] border-[oklch(0.6_0.18_25/0.3)]',
  lol: 'bg-[oklch(0.65_0.15_230/0.15)] text-[oklch(0.75_0.15_230)] border-[oklch(0.65_0.15_230/0.3)]',
  csgo: 'bg-[oklch(0.7_0.12_55/0.15)] text-[oklch(0.8_0.12_55)] border-[oklch(0.7_0.12_55/0.3)]',
  valorant: 'bg-chart-5/15 text-chart-5 border-chart-5/30',
  other: 'bg-muted text-muted-foreground border-muted',
}

const gameLabels: Record<string, string> = {
  dota2: 'Dota 2',
  lol: 'LoL',
  csgo: 'CS2',
  valorant: 'Valorant',
  other: 'Other',
}

const gameBorderClass: Record<string, string> = {
  dota2: 'game-dota',
  lol: 'game-lol',
  csgo: 'game-csgo',
  valorant: '',
  other: '',
}

function getStatusBadge(type: ParsedBet['type']) {
  switch (type) {
    case 'win':
      return <Badge className="bg-chart-1/20 text-chart-1 border border-chart-1/30 font-medium">Win</Badge>
    case 'loss':
      return <Badge className="bg-destructive/20 text-destructive border border-destructive/30 font-medium">Loss</Badge>
    case 'pending':
      return <Badge className="bg-warning/20 text-warning border border-warning/30 font-medium animate-pulse">Pending</Badge>
    case 'cashed_out':
      return <Badge className="bg-chart-3/20 text-chart-3 border border-chart-3/30 font-medium">Cashed Out</Badge>
    default:
      return <Badge variant="outline">{type}</Badge>
  }
}

export function BetsTable({ bets, title = 'Bet History', showFilters = false }: BetsTableProps) {
  // Sort bets by date descending (most recent first)
  const sortedBets = [...bets].sort((a, b) => b.date.getTime() - a.date.getTime())

  if (sortedBets.length === 0) {
    return (
      <Card className="stat-card">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">No bets to display</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="stat-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="text-muted-foreground">Date</TableHead>
                <TableHead className="text-muted-foreground">Game</TableHead>
                <TableHead className="text-muted-foreground">Match</TableHead>
                <TableHead className="text-muted-foreground hidden md:table-cell">Selection</TableHead>
                <TableHead className="text-right text-muted-foreground">Odds</TableHead>
                <TableHead className="text-right text-muted-foreground hidden lg:table-cell" title="Your odds implied probability">Implied</TableHead>
                <TableHead className="text-right text-muted-foreground hidden lg:table-cell" title="Fair probability without bookmaker margin">Fair %</TableHead>
                <TableHead className="text-right text-muted-foreground hidden xl:table-cell" title="Estimated opponent odds">Opp.</TableHead>
                <TableHead className="text-right text-muted-foreground">Stake</TableHead>
                <TableHead className="text-right text-muted-foreground">P/L</TableHead>
                <TableHead className="text-center text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedBets.map((bet) => (
                <TableRow 
                  key={bet.id} 
                  className={`border-border/30 hover:bg-secondary/30 transition-colors ${gameBorderClass[bet.game] || ''}`}
                >
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    <div>{bet.dateString}</div>
                    <div className="text-xs opacity-70">{bet.timeString}</div>
                  </TableCell>
                  <TableCell>
                    {bet.game !== 'other' && (
                      <Badge variant="outline" className={`text-xs ${gameColors[bet.game]}`}>
                        {gameLabels[bet.game]}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <div className="truncate font-medium text-foreground">
                      {bet.match}
                    </div>
                    {bet.isLive && (
                      <Badge className="mt-1 bg-destructive/20 text-destructive text-xs animate-pulse">LIVE</Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground hidden md:table-cell">
                    {bet.selection}
                  </TableCell>
                  <TableCell className="text-right font-mono text-foreground">
                    {bet.odds > 0 ? bet.odds.toFixed(2) : '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground text-sm hidden lg:table-cell">
                    {bet.impliedProbability?.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm hidden lg:table-cell">
                    <span className="text-chart-1" title={`Vig: ${bet.vigAmount?.toFixed(1)}%`}>
                      {bet.noVigProbability?.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground text-sm hidden xl:table-cell">
                    {bet.estimatedOpponentOdds?.toFixed(2) || '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-foreground">
                    ${bet.stake.toFixed(2)}
                  </TableCell>
                  <TableCell className={`text-right font-mono font-bold ${
                    bet.type === 'win' || (bet.type === 'cashed_out' && bet.profitLoss > 0)
                      ? 'text-chart-1'
                      : bet.type === 'loss'
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  }`}>
                    {bet.type === 'win' && `+$${bet.profitLoss.toFixed(2)}`}
                    {bet.type === 'loss' && `-$${Math.abs(bet.profitLoss).toFixed(2)}`}
                    {bet.type === 'cashed_out' && `+$${bet.profitLoss.toFixed(2)}`}
                    {bet.type === 'pending' && '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(bet.type)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
