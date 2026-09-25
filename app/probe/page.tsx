'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, RefreshCw, CheckCircle2, XCircle, MinusCircle } from 'lucide-react'

type TestResult = {
  ok: boolean
  ms: number
  value?: unknown
  error?: string
  note?: string
}

type GroupSummary = { passed: number; total: number; ms: number }

type ProbeResponse = {
  overall: { passed: number; total: number; ok: boolean }
  summary: Record<string, GroupSummary>
  opendota: Record<string, TestResult>
  stratz: { keySet: boolean; getMatchupResearch: TestResult }
  pandascore: { keySet: boolean; getUpcomingMatches: TestResult; getTournaments: TestResult }
  parsing: Record<string, TestResult>
  database: Record<string, TestResult>
  env: Record<string, boolean>
}

export default function ProbePage() {
  const [data, setData] = useState<ProbeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProbe = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/probe', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as ProbeResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProbe()
  }, [])

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Integration Probe</h1>
            <p className="text-sm text-muted-foreground">
              Smoke-tests every external service + parser before moving to next phase.
            </p>
          </div>
          <Button onClick={fetchProbe} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Re-run
          </Button>
        </div>

        {error && (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="py-4">
              <p className="text-sm text-destructive">Probe request failed: {error}</p>
            </CardContent>
          </Card>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {data && (
          <>
            <OverallCard data={data} />
            <EnvCard env={data.env} />
            <GroupCard title="OpenDota" tests={data.opendota} summary={data.summary.opendota} />
            <GroupCard
              title="STRATZ"
              tests={{ getMatchupResearch: data.stratz.getMatchupResearch }}
              summary={data.summary.stratz}
              extra={
                data.stratz.keySet ? null : (
                  <p className="text-xs text-muted-foreground">
                    STRATZ_API_KEY not set. Register at stratz.com/api and add to .env.local.
                  </p>
                )
              }
            />
            <GroupCard
              title="PandaScore"
              tests={{
                getUpcomingMatches: data.pandascore.getUpcomingMatches,
                getTournaments: data.pandascore.getTournaments,
              }}
              summary={data.summary.pandascore}
              extra={
                data.pandascore.keySet ? null : (
                  <p className="text-xs text-muted-foreground">
                    PANDASCORE_API_KEY not set.
                  </p>
                )
              }
            />
            <GroupCard title="Parser + Stats" tests={data.parsing} summary={data.summary.parsing} />
            <GroupCard title="Database (Supabase)" tests={data.database} summary={data.summary.database} />
          </>
        )}
      </div>
    </div>
  )
}

function OverallCard({ data }: { data: ProbeResponse }) {
  const { passed, total, ok } = data.overall
  return (
    <Card className={ok ? 'border-chart-1/50 bg-chart-1/5' : 'border-destructive/50 bg-destructive/5'}>
      <CardContent className="flex items-center justify-between py-5">
        <div className="flex items-center gap-3">
          {ok ? (
            <CheckCircle2 className="h-8 w-8 text-chart-1" />
          ) : (
            <XCircle className="h-8 w-8 text-destructive" />
          )}
          <div>
            <p className="text-2xl font-bold">
              {passed} / {total} passing
            </p>
            <p className="text-sm text-muted-foreground">
              {ok ? 'All integrations green' : `${total - passed} failing — see below`}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function EnvCard({ env }: { env: Record<string, boolean> }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Environment</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {Object.entries(env).map(([k, v]) => (
          <Badge key={k} variant={v ? 'default' : 'outline'} className="font-mono">
            {k}: {v ? 'set' : 'missing'}
          </Badge>
        ))}
      </CardContent>
    </Card>
  )
}

function GroupCard({
  title,
  tests,
  summary,
  extra,
}: {
  title: string
  tests: Record<string, TestResult>
  summary: GroupSummary
  extra?: React.ReactNode
}) {
  const allPassed = summary.passed === summary.total
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant={allPassed ? 'default' : 'destructive'}>
            {summary.passed}/{summary.total} · {summary.ms}ms
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {extra}
        {Object.entries(tests).map(([name, t]) => (
          <TestRow key={name} name={name} test={t} />
        ))}
      </CardContent>
    </Card>
  )
}

function TestRow({ name, test }: { name: string; test: TestResult }) {
  const skipped = !test.ok && test.error?.startsWith('skipped:')
  const Icon = test.ok ? CheckCircle2 : skipped ? MinusCircle : XCircle
  const iconColor = test.ok ? 'text-chart-1' : skipped ? 'text-muted-foreground' : 'text-destructive'

  return (
    <details className="rounded-lg border border-border/50 bg-secondary/30 px-3 py-2 [&[open]>summary]:mb-2">
      <summary className="flex cursor-pointer items-center justify-between gap-3 list-none">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <span className="font-mono text-sm">{name}</span>
        </div>
        <div className="flex items-center gap-2">
          {test.error && !skipped && (
            <span className="text-xs text-destructive truncate max-w-xs">{test.error}</span>
          )}
          {skipped && <span className="text-xs text-muted-foreground">{test.error}</span>}
          <span className="text-xs text-muted-foreground font-mono">{test.ms}ms</span>
        </div>
      </summary>
      {(test.value !== undefined || (test.error && !skipped)) && (
        <pre className="text-xs font-mono bg-background/50 rounded p-2 overflow-auto max-h-64">
          {JSON.stringify(test.value ?? { error: test.error }, null, 2)}
        </pre>
      )}
    </details>
  )
}
