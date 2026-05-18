'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { parseBettingData, calculateStats, type ParsedBet } from '@/lib/parse-bets'
import { StatsCards } from './stats-cards'
import { BetsTable } from './bets-table'
import { ProfitChart } from './profit-chart'
import { GameBreakdown } from './game-breakdown'
import { ClipboardPaste, Trash2 } from 'lucide-react'

export function BettingTracker() {
  const [rawInput, setRawInput] = useState('')
  const [bets, setBets] = useState<ParsedBet[]>([])
  const [isImporting, setIsImporting] = useState(false)

  const stats = useMemo(() => calculateStats(bets), [bets])

  const handleImport = () => {
    setIsImporting(true)
    try {
      const parsed = parseBettingData(rawInput)
      setBets(parsed)
    } catch (error) {
      console.error('[v0] Error parsing bets:', error)
    }
    setIsImporting(false)
  }

  const handleClear = () => {
    setBets([])
    setRawInput('')
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setRawInput(text)
    } catch (error) {
      console.error('[v0] Failed to read clipboard:', error)
    }
  }

  const settledBets = bets.filter(b => b.type === 'win' || b.type === 'loss' || b.type === 'cashed_out')
  const pendingBets = bets.filter(b => b.type === 'stake')

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Esports Bet Tracker
            </h1>
            <p className="text-muted-foreground">
              Paste your Tab betting history to analyze your performance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary/30 text-primary">
              {settledBets.length} Settled
            </Badge>
            <Badge variant="outline" className="border-warning/30 text-warning">
              {pendingBets.length} Pending
            </Badge>
          </div>
        </div>

        {/* Import Section */}
        <Card className="border-border/50 bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Import Betting Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Textarea
                placeholder="Paste your Tab betting history here...

Example format:
Win
18/05/265:22AM
Tundra Esports vs PlayTime (Bo3)
Tundra Esports - Winner 2-way
Monday, 18 May 1:40am
1.67
$44.00
$73.48
$573.48"
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                className="min-h-[200px] bg-secondary/30 font-mono text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={handlePaste}
                variant="outline"
                className="gap-2"
              >
                <ClipboardPaste className="h-4 w-4" />
                Paste from Clipboard
              </Button>
              <Button 
                onClick={handleImport}
                disabled={!rawInput.trim() || isImporting}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isImporting ? 'Processing...' : 'Import & Analyze'}
              </Button>
              {bets.length > 0 && (
                <Button 
                  onClick={handleClear}
                  variant="destructive"
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear Data
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats & Analysis */}
        {bets.length > 0 && (
          <>
            <StatsCards stats={stats} />
            
            <div className="grid gap-6 lg:grid-cols-2">
              <ProfitChart profitByDay={stats.profitByDay} />
              <GameBreakdown profitByGame={stats.profitByGame} stats={stats} />
            </div>

            <Tabs defaultValue="all" className="w-full">
              <TabsList className="mb-4 bg-secondary/50">
                <TabsTrigger value="all">All Bets ({bets.length})</TabsTrigger>
                <TabsTrigger value="settled">Settled ({settledBets.length})</TabsTrigger>
                <TabsTrigger value="pending">Pending ({pendingBets.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="all">
                <BetsTable bets={bets} />
              </TabsContent>
              <TabsContent value="settled">
                <BetsTable bets={settledBets} />
              </TabsContent>
              <TabsContent value="pending">
                <BetsTable bets={pendingBets} />
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* Empty State */}
        {bets.length === 0 && (
          <Card className="border-dashed border-border/50 bg-card/50">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 rounded-full bg-secondary p-4">
                <ClipboardPaste className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">No betting data yet</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Copy your betting history from Tab and paste it above to see your performance metrics,
                win rate, ROI, and more.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
