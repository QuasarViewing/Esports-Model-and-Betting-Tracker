'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Plus, ArrowUpCircle, ArrowDownCircle, Trash2, Wallet } from 'lucide-react'

export interface Transaction {
  id: string
  type: 'deposit' | 'withdrawal'
  amount: number
  bookmaker: string
  method: string
  date: Date
  notes: string
}

interface TransactionsProps {
  transactions: Transaction[]
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void
  onRemoveTransaction: (id: string) => void
}

const BOOKMAKERS = ['Tab', 'Sportsbet', 'Pinnacle', 'bet365', 'Betfair', 'Matchbook', 'Smarkets', 'Other']
const METHODS = ['Bank Transfer', 'Credit Card', 'Debit Card', 'PayPal', 'POLi', 'Crypto', 'Other']

export function Transactions({ transactions, onAddTransaction, onRemoveTransaction }: TransactionsProps) {
  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState<'deposit' | 'withdrawal'>('deposit')
  const [amount, setAmount] = useState('')
  const [bookmaker, setBookmaker] = useState('Tab')
  const [method, setMethod] = useState('Bank Transfer')
  const [notes, setNotes] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) return

    onAddTransaction({
      type,
      amount: parseFloat(amount),
      bookmaker,
      method,
      date: new Date(),
      notes
    })

    // Reset form
    setAmount('')
    setNotes('')
    setShowForm(false)
  }

  const totalDeposits = transactions
    .filter(t => t.type === 'deposit')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalWithdrawals = transactions
    .filter(t => t.type === 'withdrawal')
    .reduce((sum, t) => sum + t.amount, 0)

  const netDeposits = totalDeposits - totalWithdrawals

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5" />
            Deposits & Withdrawals
          </CardTitle>
          <Button
            onClick={() => setShowForm(!showForm)}
            variant={showForm ? 'secondary' : 'default'}
            size="sm"
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Transaction
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid gap-3 rounded-lg bg-secondary/30 p-4 sm:grid-cols-3">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Total Deposits</p>
            <p className="text-lg font-semibold text-primary">+${totalDeposits.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Total Withdrawals</p>
            <p className="text-lg font-semibold text-destructive">-${totalWithdrawals.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Net Deposits</p>
            <p className={`text-lg font-semibold ${netDeposits >= 0 ? 'text-foreground' : 'text-destructive'}`}>
              ${netDeposits.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Add Transaction Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border/50 bg-secondary/20 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={(v: 'deposit' | 'withdrawal') => setType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deposit">
                      <span className="flex items-center gap-2">
                        <ArrowDownCircle className="h-4 w-4 text-primary" />
                        Deposit
                      </span>
                    </SelectItem>
                    <SelectItem value="withdrawal">
                      <span className="flex items-center gap-2">
                        <ArrowUpCircle className="h-4 w-4 text-destructive" />
                        Withdrawal
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Amount ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label>Bookmaker</Label>
                <Select value={bookmaker} onValueChange={setBookmaker}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BOOKMAKERS.map(b => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                placeholder="e.g., Sign up bonus, Free bet..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-background"
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="bg-primary text-primary-foreground">
                Add {type === 'deposit' ? 'Deposit' : 'Withdrawal'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {/* Transaction History */}
        {transactions.length > 0 ? (
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {transactions.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg bg-secondary/30 p-3"
                >
                  <div className="flex items-center gap-3">
                    {t.type === 'deposit' ? (
                      <ArrowDownCircle className="h-5 w-5 text-primary" />
                    ) : (
                      <ArrowUpCircle className="h-5 w-5 text-destructive" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${t.type === 'deposit' ? 'text-primary' : 'text-destructive'}`}>
                          {t.type === 'deposit' ? '+' : '-'}${t.amount.toFixed(2)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {t.bookmaker}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t.date.toLocaleDateString()} via {t.method}
                        {t.notes && ` - ${t.notes}`}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveTransaction(t.id)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No transactions yet. Add a deposit to start tracking your bankroll.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
