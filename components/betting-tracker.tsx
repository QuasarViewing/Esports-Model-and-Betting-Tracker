'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { parseBettingData, checkDuplicates, calculateStats, type ParsedBet, type ParsedTransaction, type ImportResult } from '@/lib/parse-bets'
import { getExistingHashes, saveBets, saveTransactions, getAllBets, getAllTransactions, type DbBet, type DbTransaction } from '@/lib/actions'
import { StatsCards } from './stats-cards'
import { BetsTable } from './bets-table'
import { ProfitChart } from './profit-chart'
import { GameBreakdown } from './game-breakdown'
import { ImportSummary } from './import-summary'
import { ClipboardPaste, Trash2, Upload, Loader2, Gamepad2, Zap, BarChart3, History, TrendingUp, AlertCircle, Search } from 'lucide-react'
import { MatchResearch } from './match-research'

export function BettingTracker() {
  const [rawInput, setRawInput] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [dbBets, setDbBets] = useState<DbBet[]>([])
  const [dbTransactions, setDbTransactions] = useState<DbTransaction[]>([])
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [showImportSummary, setShowImportSummary] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [error, setError] = useState<string | null>(null)

  // Load existing data from database
  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      setError(null)
      try {
        const [betsData, txData] = await Promise.all([
          getAllBets(),
          getAllTransactions()
        ])
        setDbBets(betsData)
        setDbTransactions(txData)
      } catch (err) {
        console.error('[v0] Error loading data:', err)
        setError('Failed to load data from database')
      }
      setIsLoading(false)
    }
    loadData()
  }, [])

  // Convert DB bets to ParsedBet format for stats calculation
  const allBets: ParsedBet[] = useMemo(() => dbBets.map(b => ({
    id: b.id,
    hash: b.bet_hash,
    type: b.status as ParsedBet['type'],
    date: new Date(b.date),
    dateString: b.date,
    timeString: b.time || '',
    match: b.match,
    selection: b.selection,
    eventDate: '',
    odds: Number(b.odds),
    stake: Number(b.stake),
    profitLoss: b.profit_loss ? Number(b.profit_loss) : 0,
    balance: b.balance_after ? Number(b.balance_after) : 0,
    game: b.game as ParsedBet['game'],
    tournament: '',
    isLive: false,
    betType: (b.bet_type || 'winner') as ParsedBet['betType'],
    // Vig metrics
    impliedProbability: b.implied_probability ? Number(b.implied_probability) : (1 / Number(b.odds)) * 100,
    estimatedOpponentOdds: b.estimated_opponent_odds ? Number(b.estimated_opponent_odds) : 0,
    breakEvenWinRate: b.break_even_win_rate ? Number(b.break_even_win_rate) : (1 / Number(b.odds)) * 100,
    noVigProbability: b.no_vig_probability ? Number(b.no_vig_probability) : 0,
    vigAmount: b.vig_amount ? Number(b.vig_amount) : 0
  })), [dbBets])

  const stats = useMemo(() => calculateStats(allBets), [allBets])

  const [pasteError, setPasteError] = useState<string | null>(null)

  const handlePaste = async () => {
    setPasteError(null)
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setRawInput(text)
      } else {
        setPasteError('Clipboard is empty')
      }
    } catch (err) {
      console.error('[v0] Failed to paste:', err)
      setPasteError('Clipboard access denied. Please paste manually using Ctrl+V / Cmd+V in the text area.')
    }
  }

  const handleImport = async () => {
    if (!rawInput.trim()) return
    
    setIsImporting(true)
    setError(null)
    try {
      // Parse the raw input
      const { bets: parsedBets, transactions: parsedTx } = parseBettingData(rawInput)
      
      // Get existing hashes from database
      const { betHashes, txHashes } = await getExistingHashes()
      
      // Check for duplicates
      const result = checkDuplicates(parsedBets, parsedTx, betHashes, txHashes)
      setImportResult(result)
      
      // Save new entries to database
      if (result.newBets.length > 0) {
        await saveBets(result.newBets)
      }
      if (result.newTransactions.length > 0) {
        await saveTransactions(result.newTransactions)
      }
      
      // Refresh data from database
      const [betsData, txData] = await Promise.all([
        getAllBets(),
        getAllTransactions()
      ])
      setDbBets(betsData)
      setDbTransactions(txData)
      
      // Show import summary
      setShowImportSummary(true)
      setRawInput('')
      
    } catch (err) {
      console.error('[v0] Error importing:', err)
      setError('Failed to import data. Please check the format and try again.')
    }
    setIsImporting(false)
  }

  // Helper to parse time strings (handles both "12:22PM" and "14:03:00" formats)
  const parseTimeToMinutes = (timeStr: string | null): number => {
    if (!timeStr) return 0
    // Try 12-hour format first (e.g., "12:22PM", "9:45AM")
    const match12 = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
    if (match12) {
      let hours = parseInt(match12[1])
      const minutes = parseInt(match12[2])
      const period = match12[3].toUpperCase()
      if (period === 'PM' && hours !== 12) hours += 12
      if (period === 'AM' && hours === 12) hours = 0
      return hours * 60 + minutes
    }
    // Try 24-hour format (e.g., "14:03:00")
    const match24 = timeStr.match(/(\d{1,2}):(\d{2})/)
    if (match24) {
      return parseInt(match24[1]) * 60 + parseInt(match24[2])
    }
    return 0
  }

  // Calculate bankroll info
  const totalDeposits = dbTransactions
    .filter(t => t.type === 'deposit')
    .reduce((sum, t) => sum + Number(t.amount), 0)
  const totalWithdrawals = dbTransactions
    .filter(t => t.type === 'withdrawal')
    .reduce((sum, t) => sum + Number(t.amount), 0)
  const netDeposited = totalDeposits - totalWithdrawals
  
  // Get the most recent balance from either bets or transactions (whichever is more recent)
  const lastBetBalance = dbBets.length > 0 ? Number(dbBets[0].balance_after) || 0 : 0
  const lastBetDate = dbBets.length > 0 ? dbBets[0].date : ''
  const lastBetMinutes = dbBets.length > 0 ? parseTimeToMinutes(dbBets[0].time) : 0
  
  const lastTxBalance = dbTransactions.length > 0 ? Number(dbTransactions[0].balance_after) || 0 : 0
  const lastTxDate = dbTransactions.length > 0 ? dbTransactions[0].date : ''
  const lastTxMinutes = dbTransactions.length > 0 ? parseTimeToMinutes(dbTransactions[0].time) : 0
  
  // Compare dates first, then times if same date
  let currentBalance = lastBetBalance
  if (lastTxDate > lastBetDate) {
    currentBalance = lastTxBalance
  } else if (lastTxDate === lastBetDate && lastTxMinutes > lastBetMinutes) {
    currentBalance = lastTxBalance
  }

  // True P/L is based on actual balance, not bet calculations
  // This is more accurate than summing bet profits
  const truePL = currentBalance + totalWithdrawals - totalDeposits

  // Use the cumulative profit data directly from stats
  // stats.profitByDay.cumulative already has the correct total profit value
  const truePLByDay = stats.profitByDay.map((day) => ({
    date: day.date,
    balance: day.cumulative,
    cumulative: day.cumulative
  }))

  const settledBets = allBets.filter(b => b.type === 'win' || b.type === 'loss' || b.type === 'cashed_out')
  const pendingBets = allBets.filter(b => b.type === 'pending')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your betting data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 glow-cyan">
              <Gamepad2 className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Esports Bet Tracker
              </h1>
              <p className="text-muted-foreground">
                Track your Dota 2 & LoL bets with precision
              </p>
            </div>
          </div>
          
          {stats.totalBets > 0 && (
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Net Profit</p>
                <p className={`text-2xl font-bold font-mono ${
                  truePL >= 0 ? 'text-chart-1 text-glow-green' : 'text-destructive text-glow-red'
                }`}>
                  {truePL >= 0 ? '+' : ''}${truePL.toFixed(2)}
                </p>
              </div>
              <div className="h-12 w-px bg-border" />
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">ROI</p>
                <p className={`text-2xl font-bold font-mono ${
                  truePL >= 0 ? 'text-chart-1' : 'text-destructive'
                }`}>
                  {stats.totalStaked > 0 ? (truePL >= 0 ? '+' : '') + ((truePL / stats.totalStaked) * 100).toFixed(1) : '0.0'}%
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Quick Stats Bar */}
        {stats.totalBets > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <QuickStat label="Total Bets" value={stats.totalBets.toString()} />
            <QuickStat 
              label="Win Rate" 
              value={`${stats.winRate.toFixed(1)}%`} 
              highlight={stats.winRate > 50}
            />
            <QuickStat label="Avg Odds" value={stats.averageOdds.toFixed(2)} />
            <QuickStat label="Avg Stake" value={`$${stats.averageStake.toFixed(0)}`} />
            <QuickStat 
              label="Streak" 
              value={`${stats.currentStreak.count} ${stats.currentStreak.type === 'win' ? 'W' : 'L'}`}
              highlight={stats.currentStreak.type === 'win' && stats.currentStreak.count >= 3}
              negative={stats.currentStreak.type === 'loss' && stats.currentStreak.count >= 3}
            />
            <QuickStat 
              label="Pending" 
              value={`${stats.pendingBets} bets`}
              warning={stats.pendingBets > 0}
              subtitle={stats.pendingStake > 0 ? `$${stats.pendingStake.toFixed(0)} at risk` : undefined}
            />
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="flex items-center gap-3 py-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-secondary/50 p-1">
            <TabsTrigger value="dashboard" className="gap-2 data-[state=active]:bg-card">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2 data-[state=active]:bg-card">
              <Upload className="h-4 w-4" />
              Import
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-card">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2 data-[state=active]:bg-card">
              <TrendingUp className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="research" className="gap-2 data-[state=active]:bg-card">
              <Search className="h-4 w-4" />
              Research
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {stats.totalBets > 0 ? (
              <>
                <StatsCards stats={stats} truePL={truePL} />
                <div className="grid gap-6 lg:grid-cols-2">
                  <ProfitChart profitByDay={stats.profitByDay} truePLByDay={truePLByDay} totalProfit={truePL} />
                  <GameBreakdown profitByGame={stats.profitByGame} stats={stats} />
                </div>
                <BetsTable bets={allBets.slice(0, 10)} title="Recent Bets" />
              </>
            ) : (
              <Card className="stat-card">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="p-4 rounded-full bg-primary/10 mb-4 glow-cyan">
                    <Zap className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No betting data yet</h3>
                  <p className="text-muted-foreground text-center max-w-sm mb-4">
                    Import your betting history from Tab to start tracking your esports bets
                  </p>
                  <Button onClick={() => setActiveTab('import')} className="glow-cyan">
                    Import Data
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Import Tab */}
          <TabsContent value="import" className="space-y-4">
            <Card className="stat-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardPaste className="h-5 w-5 text-primary" />
                  Import from Tab
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Copy your betting history from Tab and paste it below. The system will automatically 
                  detect bets, deposits, and withdrawals. <span className="text-primary">Duplicate entries will be identified and skipped.</span>
                </p>
                
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2 items-center">
                    <Button variant="outline" onClick={handlePaste} className="gap-2">
                      <ClipboardPaste className="h-4 w-4" />
                      Paste from Clipboard
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      or press Ctrl+V / Cmd+V in the text area below
                    </span>
                  </div>
                  {pasteError && (
                    <p className="text-sm text-warning flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      {pasteError}
                    </p>
                  )}
                </div>

                <Textarea
                  placeholder={`Paste your Tab betting history here...

The parser will automatically detect:
- Wins, Losses, Pending bets
- Deposits and Withdrawals
- Match details, odds, stakes

Duplicate bets are detected by date+time+match+odds+stake
and will be skipped if already imported.`}
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  className="min-h-[300px] font-mono text-sm bg-input"
                />

                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {rawInput.length > 0 && (
                      <span>{rawInput.split('\n').filter(l => l.trim()).length} lines pasted</span>
                    )}
                  </div>
                  <Button 
                    onClick={handleImport} 
                    disabled={isImporting || !rawInput.trim()}
                    className="gap-2"
                  >
                    {isImporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Import & Analyze
                  </Button>
                </div>
              </CardContent>
            </Card>

            {showImportSummary && importResult && (
              <ImportSummary 
                result={importResult} 
                onClose={() => setShowImportSummary(false)}
              />
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="mb-4 bg-secondary/50">
                <TabsTrigger value="all">All Bets ({allBets.length})</TabsTrigger>
                <TabsTrigger value="settled">Settled ({settledBets.length})</TabsTrigger>
                <TabsTrigger value="pending">Pending ({pendingBets.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="all">
                <BetsTable bets={allBets} title="All Betting History" />
              </TabsContent>
              <TabsContent value="settled">
                <BetsTable bets={settledBets} title="Settled Bets" />
              </TabsContent>
              <TabsContent value="pending">
                <BetsTable bets={pendingBets} title="Pending Bets" />
              </TabsContent>
            </Tabs>
            
            {dbTransactions.length > 0 && (
              <Card className="stat-card">
                <CardHeader>
                  <CardTitle>Deposits & Withdrawals</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {dbTransactions.map((tx) => (
                        <div 
                          key={tx.id}
                          className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                            tx.type === 'deposit' 
                              ? 'bg-chart-1/10 border-l-2 border-chart-1 hover:bg-chart-1/15' 
                              : 'bg-destructive/10 border-l-2 border-destructive hover:bg-destructive/15'
                          }`}
                        >
                          <div>
                            <p className="font-medium capitalize">{tx.type}</p>
                            <p className="text-sm text-muted-foreground">
                              {tx.date} {tx.time || ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`font-mono font-bold ${
                              tx.type === 'deposit' ? 'text-chart-1' : 'text-destructive'
                            }`}>
                              {tx.type === 'deposit' ? '+' : '-'}${Number(tx.amount).toFixed(2)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Bal: ${Number(tx.balance_after || 0).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            {stats.totalBets > 0 ? (
              <>
                <StatsCards stats={stats} truePL={truePL} detailed />
                <div className="grid gap-6 lg:grid-cols-2">
                  <ProfitChart profitByDay={stats.profitByDay} truePLByDay={truePLByDay} totalProfit={truePL} />
                  <GameBreakdown profitByGame={stats.profitByGame} stats={stats} />
                </div>
                
                {/* Bankroll Summary */}
                <Card className="stat-card">
                  <CardHeader>
                    <CardTitle>Bankroll Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Current Balance</p>
                        <p className="text-3xl font-bold font-mono text-primary">
                          ${currentBalance.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Total Deposited</p>
                        <p className="text-3xl font-bold font-mono text-chart-1">
                          ${totalDeposits.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Total Withdrawn</p>
                        <p className="text-3xl font-bold font-mono text-destructive">
                          ${totalWithdrawals.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">True P/L</p>
                        <p className={`text-3xl font-bold font-mono ${
                          currentBalance - netDeposited >= 0 ? 'text-chart-1 text-glow-green' : 'text-destructive text-glow-red'
                        }`}>
                          {currentBalance - netDeposited >= 0 ? '+' : ''}
                          ${(currentBalance - netDeposited).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="stat-card">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="p-4 rounded-full bg-primary/10 mb-4">
                    <TrendingUp className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No analytics available</h3>
                  <p className="text-muted-foreground text-center max-w-sm">
                    Import your betting data first to see detailed analytics and performance metrics.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Research Tab */}
          <TabsContent value="research" className="space-y-6">
            <MatchResearch />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function QuickStat({ 
  label, 
  value, 
  highlight = false,
  negative = false,
  warning = false,
  subtitle
}: { 
  label: string
  value: string
  highlight?: boolean
  negative?: boolean
  warning?: boolean
  subtitle?: string
}) {
  return (
    <div className={`p-3 rounded-lg bg-secondary/50 transition-all hover:bg-secondary/70 ${
      highlight ? 'ring-1 ring-chart-1/50' : ''
    } ${negative ? 'ring-1 ring-destructive/50' : ''} ${warning ? 'ring-1 ring-warning/50' : ''}`}>
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold font-mono ${
        highlight ? 'text-chart-1' : ''
      } ${negative ? 'text-destructive' : ''} ${warning ? 'text-warning' : ''}`}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      )}
    </div>
  )
}
