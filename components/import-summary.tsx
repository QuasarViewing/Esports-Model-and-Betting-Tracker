'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { type ImportResult } from '@/lib/parse-bets'
import { CheckCircle2, AlertTriangle, X, Copy, ArrowDownUp } from 'lucide-react'

interface ImportSummaryProps {
  result: ImportResult
  onClose: () => void
}

export function ImportSummary({ result, onClose }: ImportSummaryProps) {
  const totalBets = result.bets.length
  const totalTx = result.transactions.length
  const newBets = result.newBets.length
  const newTx = result.newTransactions.length
  const dupBets = result.duplicateBets.length
  const dupTx = result.duplicateTransactions.length

  const hasNew = newBets > 0 || newTx > 0
  const hasDuplicates = dupBets > 0 || dupTx > 0

  return (
    <Card className="stat-card border-primary/30">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2">
          {hasNew ? (
            <CheckCircle2 className="h-5 w-5 text-chart-1" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-warning" />
          )}
          Import Complete
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryBox 
            label="Total Parsed" 
            value={totalBets + totalTx} 
            sublabel={`${totalBets} bets, ${totalTx} tx`}
          />
          <SummaryBox 
            label="New Imported" 
            value={newBets + newTx} 
            sublabel={`${newBets} bets, ${newTx} tx`}
            variant="success"
          />
          <SummaryBox 
            label="Duplicates Skipped" 
            value={dupBets + dupTx} 
            sublabel={`${dupBets} bets, ${dupTx} tx`}
            variant={hasDuplicates ? 'warning' : 'default'}
          />
          <SummaryBox 
            label="Win/Loss/Pending" 
            value={`${result.newBets.filter(b => b.type === 'win').length}/${result.newBets.filter(b => b.type === 'loss').length}/${result.newBets.filter(b => b.type === 'pending').length}`}
            sublabel="from new bets"
          />
        </div>

        {/* New Bets */}
        {newBets > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-chart-1 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              New Bets Imported ({newBets})
            </h4>
            <ScrollArea className="h-[150px]">
              <div className="space-y-1">
                {result.newBets.map((bet) => (
                  <div 
                    key={bet.id}
                    className={`flex items-center justify-between p-2 rounded text-sm ${
                      bet.type === 'win' ? 'bg-chart-1/10' :
                      bet.type === 'loss' ? 'bg-destructive/10' :
                      'bg-warning/10'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Badge 
                        variant="outline" 
                        className={`text-xs shrink-0 ${
                          bet.type === 'win' ? 'border-chart-1/50 text-chart-1' :
                          bet.type === 'loss' ? 'border-destructive/50 text-destructive' :
                          'border-warning/50 text-warning'
                        }`}
                      >
                        {bet.type}
                      </Badge>
                      <span className="truncate">{bet.match}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-muted-foreground">${bet.stake.toFixed(2)} @ {bet.odds}</span>
                      <span className={`font-mono font-medium ${
                        bet.type === 'win' ? 'text-chart-1' :
                        bet.type === 'loss' ? 'text-destructive' :
                        'text-muted-foreground'
                      }`}>
                        {bet.type === 'pending' ? '-' : bet.profitLoss >= 0 ? `+$${bet.profitLoss.toFixed(2)}` : `-$${Math.abs(bet.profitLoss).toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* New Transactions */}
        {newTx > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-chart-1 flex items-center gap-2">
              <ArrowDownUp className="h-4 w-4" />
              New Transactions Imported ({newTx})
            </h4>
            <div className="space-y-1">
              {result.newTransactions.map((tx) => (
                <div 
                  key={tx.id}
                  className={`flex items-center justify-between p-2 rounded text-sm ${
                    tx.type === 'deposit' ? 'bg-chart-1/10' : 'bg-destructive/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        tx.type === 'deposit' ? 'border-chart-1/50 text-chart-1' : 'border-destructive/50 text-destructive'
                      }`}
                    >
                      {tx.type}
                    </Badge>
                    <span className="text-muted-foreground">{tx.dateString} {tx.timeString}</span>
                  </div>
                  <span className={`font-mono font-medium ${
                    tx.type === 'deposit' ? 'text-chart-1' : 'text-destructive'
                  }`}>
                    {tx.type === 'deposit' ? '+' : '-'}${tx.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Duplicate Bets */}
        {dupBets > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-warning flex items-center gap-2">
              <Copy className="h-4 w-4" />
              Duplicate Bets Skipped ({dupBets})
            </h4>
            <ScrollArea className="h-[120px]">
              <div className="space-y-1">
                {result.duplicateBets.map((bet) => (
                  <div 
                    key={bet.id}
                    className="flex items-center justify-between p-2 rounded text-sm bg-warning/5 text-muted-foreground"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Badge variant="outline" className="text-xs border-warning/30 text-warning shrink-0">
                        duplicate
                      </Badge>
                      <span className="truncate">{bet.match}</span>
                    </div>
                    <span className="shrink-0">{bet.dateString} {bet.timeString}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <p className="text-xs text-muted-foreground">
              These bets were already imported previously and have been skipped to avoid duplicates.
            </p>
          </div>
        )}

        {/* Duplicate Transactions */}
        {dupTx > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-warning flex items-center gap-2">
              <Copy className="h-4 w-4" />
              Duplicate Transactions Skipped ({dupTx})
            </h4>
            <div className="space-y-1">
              {result.duplicateTransactions.map((tx) => (
                <div 
                  key={tx.id}
                  className="flex items-center justify-between p-2 rounded text-sm bg-warning/5 text-muted-foreground"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs border-warning/30 text-warning">
                      duplicate
                    </Badge>
                    <span className="capitalize">{tx.type}</span>
                  </div>
                  <span>${tx.amount.toFixed(2)} on {tx.dateString}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No new data message */}
        {!hasNew && (
          <div className="text-center py-4">
            <AlertTriangle className="h-8 w-8 text-warning mx-auto mb-2" />
            <p className="text-muted-foreground">
              All entries in this import already exist in your database.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SummaryBox({ 
  label, 
  value, 
  sublabel,
  variant = 'default'
}: { 
  label: string
  value: number | string
  sublabel?: string
  variant?: 'default' | 'success' | 'warning'
}) {
  return (
    <div className={`p-3 rounded-lg ${
      variant === 'success' ? 'bg-chart-1/10 ring-1 ring-chart-1/30' :
      variant === 'warning' ? 'bg-warning/10 ring-1 ring-warning/30' :
      'bg-secondary/50'
    }`}>
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold font-mono ${
        variant === 'success' ? 'text-chart-1' :
        variant === 'warning' ? 'text-warning' :
        ''
      }`}>
        {value}
      </p>
      {sublabel && (
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      )}
    </div>
  )
}
