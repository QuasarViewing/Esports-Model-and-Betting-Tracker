import { getHeroMeta, upsertHeroMeta } from '@/lib/model-db'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PatchHeroImpact {
  heroName: string
  heroId: number
  impactLevel: 'minor' | 'significant' | 'major'
  reasoning: string
  currentWinRate?: number
}

export interface PatchAnalysis {
  buffed_heroes: PatchHeroImpact[]
  nerfed_heroes: PatchHeroImpact[]
  indirect_winners: PatchHeroImpact[]
  indirect_losers: PatchHeroImpact[]
  meta_predictions: { prediction: string; confidence: string; reasoning: string }[]
  archetype_shifts: { archetype: string; direction: 'stronger' | 'weaker'; reasoning: string }[]
  broken_combos: { heroes: string[]; reasoning: string }[]
}

export interface PatchPrediction {
  id: string
  patch_version: string
  prediction_type: string
  hero_id: number | null
  predicted_direction: string
  predicted_impact: string
  actual_win_rate_change: number | null
  correct: boolean | null
  created_at: string
}

export interface ValidationResult {
  total: number
  correct: number
  incorrect: number
  pending: number
  accuracy: number
  details: {
    heroName: string
    heroId: number
    predicted: string
    actual: string
    winRateChange: number
    correct: boolean
  }[]
}

// ---------------------------------------------------------------------------
// Analyze patch notes using Claude API
// ---------------------------------------------------------------------------

export async function analyzePatch(patchNotes: string): Promise<PatchAnalysis> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set')
  }

  const metas = await getHeroMeta()
  const metaSummary = metas
    .filter(m => m.immortal_win_rate != null)
    .map(m => `${m.hero_name} (id:${m.hero_id}): WR ${((m.immortal_win_rate ?? 0.5) * 100).toFixed(1)}%`)
    .join('\n')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: 'You are a Dota 2 analyst. Analyze these patch notes and predict which heroes and strategies will become stronger or weaker. Focus on changes that will affect competitive/pro play. Consider item interactions, hero ability synergies, map changes, and indirect effects. Respond in JSON format only. No markdown fences.',
      messages: [
        {
          role: 'user',
          content: `Patch notes:\n${patchNotes}\n\nCurrent hero meta (Immortal+ bracket):\n${metaSummary}\n\nReturn JSON with these fields:\n- buffed_heroes: [{heroName, heroId, impactLevel: "minor"|"significant"|"major", reasoning}]\n- nerfed_heroes: [{heroName, heroId, impactLevel, reasoning}]\n- indirect_winners: [{heroName, heroId, reasoning}]\n- indirect_losers: [{heroName, heroId, reasoning}]\n- meta_predictions: [{prediction, confidence, reasoning}]\n- archetype_shifts: [{archetype, direction: "stronger"|"weaker", reasoning}]\n- broken_combos: [{heroes: string[], reasoning}]`,
        },
      ],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Claude API error ${response.status}: ${text}`)
  }

  const result = await response.json()
  const content = result.content?.[0]?.text ?? '{}'

  let analysis: PatchAnalysis
  try {
    analysis = JSON.parse(content)
  } catch {
    throw new Error('Failed to parse Claude response as JSON')
  }

  // Cross-reference with current win rates
  const metaMap = new Map(metas.map(m => [m.hero_id, m]))

  for (const list of [analysis.buffed_heroes, analysis.nerfed_heroes, analysis.indirect_winners, analysis.indirect_losers]) {
    if (!list) continue
    for (const h of list) {
      const meta = metaMap.get(h.heroId)
      if (meta) h.currentWinRate = meta.immortal_win_rate ?? meta.pro_win_rate ?? undefined
    }
  }

  return analysis
}

// ---------------------------------------------------------------------------
// Store patch predictions for later validation
// ---------------------------------------------------------------------------

export async function trackPatchPredictions(
  patchVersion: string,
  analysis: PatchAnalysis,
): Promise<void> {
  const supabase = await createClient()

  const rows: Omit<PatchPrediction, 'id' | 'created_at'>[] = []

  for (const h of (analysis.buffed_heroes ?? [])) {
    rows.push({
      patch_version: patchVersion,
      prediction_type: 'buffed',
      hero_id: h.heroId,
      predicted_direction: 'up',
      predicted_impact: h.impactLevel,
      actual_win_rate_change: null,
      correct: null,
    })
  }

  for (const h of (analysis.nerfed_heroes ?? [])) {
    rows.push({
      patch_version: patchVersion,
      prediction_type: 'nerfed',
      hero_id: h.heroId,
      predicted_direction: 'down',
      predicted_impact: h.impactLevel,
      actual_win_rate_change: null,
      correct: null,
    })
  }

  for (const h of (analysis.indirect_winners ?? [])) {
    rows.push({
      patch_version: patchVersion,
      prediction_type: 'indirect_winner',
      hero_id: h.heroId,
      predicted_direction: 'up',
      predicted_impact: 'minor',
      actual_win_rate_change: null,
      correct: null,
    })
  }

  for (const h of (analysis.indirect_losers ?? [])) {
    rows.push({
      patch_version: patchVersion,
      prediction_type: 'indirect_loser',
      hero_id: h.heroId,
      predicted_direction: 'down',
      predicted_impact: 'minor',
      actual_win_rate_change: null,
      correct: null,
    })
  }

  if (rows.length > 0) {
    await supabase.from('patch_predictions').insert(rows)
  }
}

// ---------------------------------------------------------------------------
// Validate predictions against actual results
// ---------------------------------------------------------------------------

export async function validatePatchPredictions(
  patchVersion: string,
): Promise<ValidationResult> {
  const supabase = await createClient()

  const { data: predictions } = await supabase
    .from('patch_predictions')
    .select('*')
    .eq('patch_version', patchVersion)

  if (!predictions || predictions.length === 0) {
    return { total: 0, correct: 0, incorrect: 0, pending: 0, accuracy: 0, details: [] }
  }

  const metas = await getHeroMeta()
  const metaMap = new Map(metas.map(m => [m.hero_id, m]))

  let correct = 0
  let incorrect = 0
  let pending = 0
  const details: ValidationResult['details'] = []

  for (const pred of predictions) {
    const meta = metaMap.get(pred.hero_id)
    if (!meta || meta.immortal_win_rate == null) {
      pending++
      continue
    }

    const currentWr = meta.immortal_win_rate
    const wrChange = currentWr - 0.5
    const isUp = wrChange > 0.01
    const isDown = wrChange < -0.01

    const predictedUp = pred.predicted_direction === 'up'
    const isCorrect = (predictedUp && isUp) || (!predictedUp && isDown)

    if (isCorrect) correct++
    else incorrect++

    details.push({
      heroName: meta.hero_name,
      heroId: pred.hero_id,
      predicted: pred.predicted_direction,
      actual: isUp ? 'up' : isDown ? 'down' : 'neutral',
      winRateChange: wrChange,
      correct: isCorrect,
    })

    // Update the record
    await supabase
      .from('patch_predictions')
      .update({ actual_win_rate_change: wrChange, correct: isCorrect })
      .eq('id', pred.id)
  }

  return {
    total: predictions.length,
    correct,
    incorrect,
    pending,
    accuracy: (correct + incorrect) > 0 ? correct / (correct + incorrect) : 0,
    details,
  }
}
