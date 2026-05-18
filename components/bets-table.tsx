'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { ParsedBet } from '@/lib/parse-bets'
import { ScrollArea } from '@/components/ui/scroll-area'

interface BetsTableProps {
  bets: ParsedBet[]
}

const gameColors: Record<string, string> = {
  dota2: 'bg-chart-1/20 text-chart-1 border-chart-1/30',
  lol: 'bg-chart-3/20 text-chart-3 border-chart-3/30',
  csgo: 'bg-chart-4/20 text-chart-4 border-chart-4/30',
  valorant: 'bg-chart-5/20 text-chart-5 border-chart-5/30',
  other: 'bg-muted text-muted-foreground border-muted',
}

const gameLabels: Record<string, string> = {
  dota2: 'Dota 2',
  lol: 'LoL',
  csgo: 'CS2',
  valorant: 'Valorant',
  other: 'Other',
}

function getStatusBadge(type: ParsedBet['type']) {
  switch (type) {
    case 'win':
      return <Badge className="bg-primary/20 text-primary border border-primary/30">Win</Badge>
    case 'loss':
      return <Badge className="bg-destructive/20 text-destructive border border-destructive/30">Loss</Badge>
    case 'stake':
      return <Badge className="bg-warning/20 text-warning border border-warning/30">Pending</Badge>
    case 'cashed_out':
      return <Badge className="bg-chart-3/20 text-chart-3 border border-chart-3/30">Cashed Out</Badge>
    case 'withdraw':
      return <Badge variant="outline">Withdraw</Badge>
    case 'deposit':
      return <Badge variant="outline">Deposit</Badge>
    default:
      return <Badge variant="outline">{type}</Badge>
  }
}

export function BetsTable({ bets }: BetsTableProps) {
  // Sort bets by date descending (most recent first)
  const sortedBets = [...bets].reverse()

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Bet History</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="text-muted-foreground">Date</TableHead>
                <TableHead className="text-muted-foreground">Game</TableHead>
                <TableHead className="text-muted-foreground">Match</TableHead>
                <TableHead className="text-muted-foreground">Selection</TableHead>
                <TableHead className="text-right text-muted-foreground">Odds</TableHead>
                <TableHead className="text-right text-muted-foreground">Stake</TableHead>
                <TableHead className="text-right text-muted-foreground">P/L</TableHead>
                <TableHead className="text-center text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedBets.map((bet) => (
                <TableRow key={bet.id} className="border-border/30 hover:bg-secondary/30">
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
                  <TableCell className="max-w-[200px] truncate font-medium text-foreground">
                    {bet.match}
                    {bet.isLive && (
                      <Badge className="ml-2 bg-destructive/20 text-destructive text-xs">LIVE</Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                    {bet.selection}
                  </TableCell>
                  <TableCell className="text-right font-mono text-foreground">
                    {bet.odds > 0 ? bet.odds.toFixed(2) : '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-foreground">
                    ${bet.stake.toFixed(2)}
                  </TableCell>
                  <TableCell className={`text-right font-mono font-medium ${
                    bet.type === 'win' || (bet.type === 'cashed_out' && bet.profitLoss > 0)
                      ? 'text-primary'
                      : bet.type === 'loss'
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  }`}>
                    {bet.type === 'win' && `+$${(bet.profitLoss - bet.stake).toFixed(2)}`}
                    {bet.type === 'loss' && `-$${bet.stake.toFixed(2)}`}
                    {bet.type === 'cashed_out' && `+$${bet.profitLoss.toFixed(2)}`}
                    {bet.type === 'stake' && '-'}
                    {bet.type === 'withdraw' && `-$${bet.stake.toFixed(2)}`}
                    {bet.type === 'deposit' && `+$${bet.stake.toFixed(2)}`}
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
