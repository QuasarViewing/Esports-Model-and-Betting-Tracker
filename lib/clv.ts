// Closing line value: how much better a price you took than the market closed at.
// Positive means you beat the close — you backed it at longer odds than the
// line settled on. Kept separate from the server action so it can be tested.

export function clvPercent(placementOdds: number, closingOdds: number | null): number | null {
  if (closingOdds === null || closingOdds <= 1 || placementOdds <= 1) return null
  return (placementOdds / closingOdds - 1) * 100
}
