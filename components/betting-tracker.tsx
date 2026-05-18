'use client'

import { useState, useMemo, useEffect } from 'react'
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
import { Transactions, type Transaction } from './transactions'
import { BankrollSummary } from './bankroll-summary'
import { ClipboardPaste, Trash2, Save, Upload } from 'lucide-react'

const STORAGE_KEY = 'esports-bet-tracker-data'

interface StoredData {
  bets: ParsedBet[]
  transactions: Transaction[]
  rawInput: string
}

export function BettingTracker() {
  const [rawInput, setRawInput] = useState('')
  const [bets, setBets] = useState<ParsedBet[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [activeTab, setActiveTab] = useState('bets')

  // Load data from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const data: StoredData = JSON.parse(stored)
        setBets(data.bets.map(b => ({ ...b, date: new Date(b.date) })))
        setTransactions(data.transactions.map(t => ({ ...t, date: new Date(t.date) })))
        setRawInput(data.rawInput || '')
      } catch (e) {
        console.error('[v0] Failed to load stored data:', e)
      }
    }
  }, [])

  // Save data to localStorage when it changes
  useEffect(() => {
    if (bets.length > 0 || transactions.length > 0) {
      const data: StoredData = { bets, transactions, rawInput }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    }
  }, [bets, transactions, rawInput])

  const stats = useMemo(() => calculateStats(bets), [bets])

  // Get current balance from the last bet if available
  const currentBalance = bets.length > 0 ? bets[bets.length - 1].balance : undefined

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
    setTransactions([])
    setRawInput('')
    localStorage.removeItem(STORAGE_KEY)
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setRawInput(text)
    } catch (error) {
      console.error('[v0] Failed to read clipboard:', error)
    }
  }

  const handleAddTransaction = (transaction: Omit<Transaction, 'id'>) => {
    const newTransaction: Transaction = {
      ...transaction,
      id: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    }
    setTransactions(prev => [newTransaction, ...prev])
  }

  const handleRemoveTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id))
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
            <Badge variant="outline" className="border-yellow-500/30 text-yellow-500">
              {pendingBets.length} Pending
            </Badge>
            <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
              {transactions.length} Transactions
            </Badge>
          </div>
        </div>

        {/* Bankroll Summary - Always visible if we have data */}
        {(bets.length > 0 || transactions.length > 0) && (
          <BankrollSummary 
            transactions={transactions} 
            stats={stats} 
            currentBalance={currentBalance}
          />
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4 bg-secondary/50">
            <TabsTrigger value="bets">Betting Data</TabsTrigger>
            <TabsTrigger value="transactions">Deposits & Withdrawals</TabsTrigger>
            <TabsTrigger value="stats">Analytics</TabsTrigger>
          </TabsList>

          {/* Betting Data Tab */}
          <TabsContent value="bets" className="space-y-6">
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
                    <Upload className="mr-2 h-4 w-4" />
                    {isImporting ? 'Processing...' : 'Import & Analyze'}
                  </Button>
                  {(bets.length > 0 || transactions.length > 0) && (
                    <Button 
                      onClick={handleClear}
                      variant="destructive"
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Clear All Data
                    </Button>
                  )}
                </div>
                {bets.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    <Save className="mr-1 inline h-3 w-3" />
                    Data is automatically saved to your browser
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Bets Table */}
            {bets.length > 0 && (
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
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-6">
            <Transactions
              transactions={transactions}
              onAddTransaction={handleAddTransaction}
              onRemoveTransaction={handleRemoveTransaction}
            />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="stats" className="space-y-6">
            {bets.length > 0 ? (
              <>
                <StatsCards stats={stats} />
                
                <div className="grid gap-6 lg:grid-cols-2">
                  <ProfitChart profitByDay={stats.profitByDay} />
                  <GameBreakdown profitByGame={stats.profitByGame} stats={stats} />
                </div>
              </>
            ) : (
              <Card className="border-dashed border-border/50 bg-card/50">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-4 rounded-full bg-secondary p-4">
                    <ClipboardPaste className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">No analytics available</h3>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    Import your betting data first to see detailed analytics and performance metrics.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
