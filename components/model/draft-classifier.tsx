'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'

interface ArchetypeWeights {
  aggro: number
  midrange: number
  control: number
  combo: number
  split: number
}

interface DraftClassification {
  primary: string
  secondary: string | null
  weights: ArchetypeWeights
  confidence: number
  timingPeak: string
  heroBreakdown: { heroId: number; weights: ArchetypeWeights }[]
}

interface ClassifyResult {
  radiant: DraftClassification
  dire: DraftClassification
  matchup: { teamAWinProb: number; timingAdvantage: string }
  radiantCombo: { combo_score: number; comeback_factor: number; key_combos: { heroes: number[]; reason: string }[] }
  direCombo: { combo_score: number; comeback_factor: number; key_combos: { heroes: number[]; reason: string }[] }
  overallAdvantage: string
}

const ARCHETYPE_COLORS: Record<string, string> = {
  aggro: 'text-red-400',
  midrange: 'text-yellow-400',
  control: 'text-blue-400',
  combo: 'text-purple-400',
  split: 'text-green-400',
}

export function DraftClassifier() {
  const [radiantHeroes, setRadiantHeroes] = useState(['', '', '', '', ''])
  const [direHeroes, setDireHeroes] = useState(['', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ClassifyResult | null>(null)

  async function classify() {
    const rHeroes = radiantHeroes.map(Number).filter(h => h > 0)
    const dHeroes = direHeroes.map(Number).filter(h => h > 0)
    if (rHeroes.length === 0 || dHeroes.length === 0) return

    setLoading(true)
    try {
      const res = await fetch('/api/model/classify-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ radiantHeroes: rHeroes, direHeroes: dHeroes }),
      })
      if (res.ok) setResult(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <Card className="stat-card bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Draft Archetype Classifier</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Radiant Hero IDs</p>
              <div className="grid grid-cols-5 gap-1">
                {radiantHeroes.map((h, i) => (
                  <Input
                    key={i}
                    className="bg-background text-xs h-8"
                    placeholder={`${i + 1}`}
                    value={h}
                    onChange={e => {
                      const heroes = [...radiantHeroes]
                      heroes[i] = e.target.value
                      setRadiantHeroes(heroes)
                    }}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Dire Hero IDs</p>
              <div className="grid grid-cols-5 gap-1">
                {direHeroes.map((h, i) => (
                  <Input
                    key={i}
                    className="bg-background text-xs h-8"
                    placeholder={`${i + 1}`}
                    value={h}
                    onChange={e => {
                      const heroes = [...direHeroes]
                      heroes[i] = e.target.value
                      setDireHeroes(heroes)
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <Button onClick={classify} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Classify Drafts
          </Button>
        </CardContent>
      </Card>

      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ArchetypeCard
            title="Radiant"
            classification={result.radiant}
            combo={result.radiantCombo}
            color="text-chart-1"
          />
          <ArchetypeCard
            title="Dire"
            classification={result.dire}
            combo={result.direCombo}
            color="text-destructive"
          />

          <Card className="stat-card bg-card/50 md:col-span-2">
            <CardContent className="pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Matchup</span>
                <span className="font-mono text-sm">
                  Radiant {(result.matchup.teamAWinProb * 100).toFixed(1)}% - {((1 - result.matchup.teamAWinProb) * 100).toFixed(1)}% Dire
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Timing</span>
                <span className="text-sm">{result.matchup.timingAdvantage}</span>
              </div>
              <div className="text-center">
                <Badge variant="outline" className="text-sm">{result.overallAdvantage}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function ArchetypeCard({
  title,
  classification,
  combo,
  color,
}: {
  title: string
  classification: DraftClassification
  combo: ClassifyResult['radiantCombo']
  color: string
}) {
  return (
    <Card className="stat-card bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className={`text-sm font-medium ${color}`}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold capitalize ${ARCHETYPE_COLORS[classification.primary] ?? ''}`}>
            {classification.primary}
          </span>
          {classification.secondary && (
            <span className={`text-sm capitalize ${ARCHETYPE_COLORS[classification.secondary] ?? ''}`}>
              / {classification.secondary}
            </span>
          )}
        </div>

        {/* Archetype weights as bars */}
        <div className="space-y-1">
          {(['aggro', 'midrange', 'control', 'combo', 'split'] as const).map(arch => (
            <div key={arch} className="flex items-center gap-2">
              <span className="text-xs w-16 capitalize text-muted-foreground">{arch}</span>
              <div className="flex-1 h-2 rounded bg-secondary overflow-hidden">
                <div
                  className={`h-full rounded ${
                    arch === classification.primary ? 'bg-chart-1' : 'bg-muted-foreground/50'
                  }`}
                  style={{ width: `${classification.weights[arch] * 100}%` }}
                />
              </div>
              <span className="text-xs font-mono w-10 text-right">
                {(classification.weights[arch] * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 text-xs">
          <Badge variant="outline">Peak: {classification.timingPeak}</Badge>
          <Badge variant="outline">Conf: {(classification.confidence * 100).toFixed(0)}%</Badge>
        </div>

        {/* Combo synergies */}
        {combo.key_combos.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Combos</p>
            {combo.key_combos.map((c, i) => (
              <p key={i} className="text-xs text-purple-400">
                {c.reason}
              </p>
            ))}
          </div>
        )}

        <div className="flex gap-2 text-xs">
          <span className="text-muted-foreground">Combo: {combo.combo_score.toFixed(2)}</span>
          <span className="text-muted-foreground">Comeback: {combo.comeback_factor.toFixed(2)}x</span>
        </div>
      </CardContent>
    </Card>
  )
}
