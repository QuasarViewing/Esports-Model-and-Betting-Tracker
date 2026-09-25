'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ParsedBet } from '@/lib/parse-bets'
import { ScrollArea } from '@/components/ui/scroll-area'
import { updateBetTag, updateBetClosingOdds, updateBetGame } from '@/lib/actions'
import { Pencil, Check, X } from 'lucide-react'

interface BetsTableProps {
  bets: ParsedBet[]
  title?: string
  showFilters?: boolean
  enableTagEdit?: boolean
  enableClvEdit?: boolean
  enableGameEdit?: boolean
  onTagChange?: (betId: string, tag: string | null) => void
  onClvChange?: (betId: string, closingOdds: number | null, clvPct: number | null) => void
  onGameChange?: (betId: string, game: ParsedBet['game']) => void
}

const UNTAGGED_SENTINEL = '__untagged__'
const ALL_SENTINEL = '__all__'

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

export function BetsTable({
  bets,
  title = 'Bet History',
  showFilters = false,
  enableTagEdit = false,
  enableClvEdit = false,
  enableGameEdit = false,
  onTagChange,
  onClvChange,
  onGameChange,
}: BetsTableProps) {
  const [tagFilter, setTagFilter] = useState<string>(ALL_SENTINEL)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [clvEditingId, setClvEditingId] = useState<string | null>(null)
  const [clvEditValue, setClvEditValue] = useState('')
  const [clvSavingId, setClvSavingId] = useState<string | null>(null)

  const uniqueTags = useMemo(() => {
    const set = new Set<string>()
    bets.forEach(b => {
      if (b.tag) set.add(b.tag)
    })
    return Array.from(set).sort()
  }, [bets])

  const filtered = useMemo(() => {
    if (tagFilter === ALL_SENTINEL) return bets
    if (tagFilter === UNTAGGED_SENTINEL) return bets.filter(b => !b.tag)
    return bets.filter(b => b.tag === tagFilter)
  }, [bets, tagFilter])

  // Sort bets by date descending (most recent first)
  const sortedBets = [...filtered].sort((a, b) => {
    const dateA = typeof a.date === 'string' ? new Date(a.date.split('/').reverse().join('-')).getTime() : new Date(a.date as any).getTime()
    const dateB = typeof b.date === 'string' ? new Date(b.date.split('/').reverse().join('-')).getTime() : new Date(b.date as any).getTime()
    return dateB - dateA
  })

  const beginEdit = (betId: string, currentTag: string | null | undefined) => {
    setEditingId(betId)
    setEditValue(currentTag ?? '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValue('')
  }

  const commitEdit = async (betId: string) => {
    const trimmed = editValue.trim()
    const nextTag = trimmed === '' ? null : trimmed.toLowerCase()
    setSavingId(betId)
    const ok = await updateBetTag(betId, nextTag)
    setSavingId(null)
    if (ok) {
      onTagChange?.(betId, nextTag)
      setEditingId(null)
      setEditValue('')
    }
  }

  const beginClvEdit = (betId: string, currentClosing: number | null | undefined) => {
    setClvEditingId(betId)
    setClvEditValue(currentClosing != null ? currentClosing.toString() : '')
  }

  const cancelClvEdit = () => {
    setClvEditingId(null)
    setClvEditValue('')
  }

  const commitClvEdit = async (betId: string) => {
    const trimmed = clvEditValue.trim()
    const parsed = trimmed === '' ? null : parseFloat(trimmed)
    const nextClosing = parsed !== null && !Number.isNaN(parsed) && parsed > 1 ? parsed : null
    setClvSavingId(betId)
    const result = await updateBetClosingOdds(betId, nextClosing)
    setClvSavingId(null)
    if (result.ok) {
      onClvChange?.(betId, nextClosing, result.clvPct)
      setClvEditingId(null)
      setClvEditValue('')
    }
  }

  if (bets.length === 0) {
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
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-lg">{title}</CardTitle>
          {uniqueTags.length > 0 && (
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="Filter by tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SENTINEL}>All tags</SelectItem>
                <SelectItem value={UNTAGGED_SENTINEL}>Untagged</SelectItem>
                {uniqueTags.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
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
                <TableHead className="text-right text-muted-foreground hidden xl:table-cell" title="Closing line value: positive = beat the market">CLV</TableHead>
                <TableHead className="text-center text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Tag</TableHead>
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
                    {enableGameEdit ? (
                      <Select
                        value={bet.game}
                        onValueChange={async (next) => {
                          const nextGame = next as ParsedBet['game']
                          if (nextGame === bet.game) return
                          const ok = await updateBetGame(bet.id, nextGame)
                          if (ok) onGameChange?.(bet.id, nextGame)
                        }}
                      >
                        <SelectTrigger className={`h-7 w-[90px] text-xs px-2 ${gameColors[bet.game] ?? ''}`} aria-label="Change game">
                          <SelectValue>{gameLabels[bet.game] ?? bet.game}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dota2">Dota 2</SelectItem>
                          <SelectItem value="lol">LoL</SelectItem>
                          <SelectItem value="csgo">CS2</SelectItem>
                          <SelectItem value="valorant">Valorant</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      (bet.game as any) !== 'other' && (
                        <Badge variant="outline" className={`text-xs ${gameColors[bet.game]}`}>
                          {gameLabels[bet.game]}
                        </Badge>
                      )
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
                  <TableCell className="text-right font-mono text-xs hidden xl:table-cell">
                    {clvEditingId === bet.id ? (
                      <div className="flex items-center gap-1 justify-end">
                        <Input
                          autoFocus
                          type="number"
                          step="0.01"
                          min="1.01"
                          placeholder="close"
                          value={clvEditValue}
                          onChange={e => setClvEditValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitClvEdit(bet.id)
                            if (e.key === 'Escape') cancelClvEdit()
                          }}
                          className="h-7 text-xs w-20"
                          disabled={clvSavingId === bet.id}
                        />
                        <button onClick={() => commitClvEdit(bet.id)} className="text-chart-1 hover:text-chart-1/70" disabled={clvSavingId === bet.id} aria-label="Save closing odds">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={cancelClvEdit} className="text-muted-foreground hover:text-foreground" disabled={clvSavingId === bet.id} aria-label="Cancel">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : bet.clvPct != null ? (
                      <button
                        onClick={() => enableClvEdit && beginClvEdit(bet.id, bet.closingOdds)}
                        className={`font-mono ${enableClvEdit ? 'cursor-pointer hover:opacity-70' : 'cursor-default'} ${
                          bet.clvPct > 0 ? 'text-chart-1' : bet.clvPct < 0 ? 'text-destructive' : 'text-muted-foreground'
                        }`}
                        title={bet.closingOdds != null ? `Close: ${bet.closingOdds.toFixed(2)}` : ''}
                      >
                        {bet.clvPct > 0 ? '+' : ''}{bet.clvPct.toFixed(2)}%
                      </button>
                    ) : enableClvEdit ? (
                      <button onClick={() => beginClvEdit(bet.id, null)} className="text-muted-foreground hover:text-foreground flex items-center gap-1 justify-end">
                        <Pencil className="h-3 w-3" />
                        close
                      </button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(bet.type)}
                  </TableCell>
                  <TableCell>
                    {editingId === bet.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitEdit(bet.id)
                            if (e.key === 'Escape') cancelEdit()
                          }}
                          list="bets-table-tag-suggestions"
                          className="h-7 text-xs w-24"
                          disabled={savingId === bet.id}
                        />
                        <button
                          onClick={() => commitEdit(bet.id)}
                          className="text-chart-1 hover:text-chart-1/70"
                          disabled={savingId === bet.id}
                          aria-label="Save"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-muted-foreground hover:text-foreground"
                          disabled={savingId === bet.id}
                          aria-label="Cancel"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : bet.tag ? (
                      <Badge
                        variant="outline"
                        className={`font-mono text-xs uppercase ${
                          enableTagEdit ? 'cursor-pointer hover:bg-secondary/50' : ''
                        }`}
                        onClick={() => enableTagEdit && beginEdit(bet.id, bet.tag)}
                      >
                        {bet.tag}
                      </Badge>
                    ) : enableTagEdit ? (
                      <button
                        onClick={() => beginEdit(bet.id, null)}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        <Pencil className="h-3 w-3" />
                        tag
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
        {enableTagEdit && (
          <datalist id="bets-table-tag-suggestions">
            {['model-edge', 'patch-read', 'gut', 'live', 'value-hunt', 'hedge', ...uniqueTags].map(t => (
              <option key={t} value={t} />
            ))}
          </datalist>
        )}
      </CardContent>
    </Card>
  )
}
