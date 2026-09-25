import { createClient } from '@/lib/supabase/server'
import type { ModelPrediction } from '@/lib/model-db'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelPerformance {
  total: number
  correct: number
  incorrect: number
  pending: number
  accuracy: number
  calibration: { bucket: string; predicted: number; actual: number; count: number }[]
  avgEdgeCorrect: number
  avgEdgeIncorrect: number
  roi: number
  byConfidence: { level: string; accuracy: number; count: number }[]
}

// ---------------------------------------------------------------------------
// Record result
// ---------------------------------------------------------------------------

export async function recordResult(
  predictionId: string,
  actualWinner: 'teamA' | 'teamB',
): Promise<void> {
  const supabase = await createClient()

  const { data: pred } = await supabase
    .from('model_predictions')
    .select('model_probability')
    .eq('id', predictionId)
    .single()

  if (!pred) return

  const modelFavoredA = (pred.model_probability ?? 0.5) >= 0.5
  const correct = (actualWinner === 'teamA') === modelFavoredA

  await supabase
    .from('model_predictions')
    .update({ actual_winner: actualWinner, correct })
    .eq('id', predictionId)
}

// ---------------------------------------------------------------------------
// Model performance stats
// ---------------------------------------------------------------------------

export async function getModelPerformance(limit = 100): Promise<ModelPerformance> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('model_predictions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  const predictions = (data as ModelPrediction[] | null) ?? []
  const settled = predictions.filter(p => p.actual_winner != null)
  const pending = predictions.filter(p => p.actual_winner == null)

  const correct = settled.filter(p => p.correct === true)
  const incorrect = settled.filter(p => p.correct === false)

  const accuracy = settled.length > 0 ? correct.length / settled.length : 0

  // Calibration: bucket predictions by probability
  const buckets = [
    { label: '50-55%', lo: 0.50, hi: 0.55 },
    { label: '55-60%', lo: 0.55, hi: 0.60 },
    { label: '60-65%', lo: 0.60, hi: 0.65 },
    { label: '65-70%', lo: 0.65, hi: 0.70 },
    { label: '70-80%', lo: 0.70, hi: 0.80 },
    { label: '80%+', lo: 0.80, hi: 1.01 },
  ]

  const calibration = buckets.map(b => {
    const inBucket = settled.filter(p => {
      const prob = Math.max(p.model_probability ?? 0.5, 1 - (p.model_probability ?? 0.5))
      return prob >= b.lo && prob < b.hi
    })
    const actualWinRate = inBucket.length > 0
      ? inBucket.filter(p => p.correct === true).length / inBucket.length
      : 0
    return {
      bucket: b.label,
      predicted: (b.lo + b.hi) / 2,
      actual: actualWinRate,
      count: inBucket.length,
    }
  })

  // Average edge
  const avgEdgeCorrect = correct.length > 0
    ? correct.reduce((s, p) => s + (p.edge ?? 0), 0) / correct.length
    : 0
  const avgEdgeIncorrect = incorrect.length > 0
    ? incorrect.reduce((s, p) => s + (p.edge ?? 0), 0) / incorrect.length
    : 0

  // ROI from kelly stakes — use the odds for whichever side the model favored
  let totalStaked = 0
  let totalReturn = 0
  for (const p of settled) {
    const stake = p.recommended_stake_pct ?? 0
    if (stake <= 0) continue
    totalStaked += stake
    if (p.correct === true) {
      const modelFavoredA = (p.model_probability ?? 0.5) >= 0.5
      const odds = modelFavoredA ? p.bookmaker_odds_a : p.bookmaker_odds_b
      if (odds) totalReturn += stake * odds
    }
  }
  const roi = totalStaked > 0 ? ((totalReturn - totalStaked) / totalStaked) * 100 : 0

  // By confidence
  const confLevels = [
    { level: 'Low (<0.5)', lo: 0, hi: 0.5 },
    { level: 'Medium (0.5-0.7)', lo: 0.5, hi: 0.7 },
    { level: 'High (>0.7)', lo: 0.7, hi: 1.01 },
  ]

  const byConfidence = confLevels.map(cl => {
    const inLevel = settled.filter(p => {
      const conf = Math.abs((p.model_probability ?? 0.5) - 0.5) * 2
      return conf >= cl.lo && conf < cl.hi
    })
    return {
      level: cl.level,
      accuracy: inLevel.length > 0
        ? inLevel.filter(p => p.correct === true).length / inLevel.length
        : 0,
      count: inLevel.length,
    }
  })

  return {
    total: predictions.length,
    correct: correct.length,
    incorrect: incorrect.length,
    pending: pending.length,
    accuracy,
    calibration,
    avgEdgeCorrect,
    avgEdgeIncorrect,
    roi,
    byConfidence,
  }
}
