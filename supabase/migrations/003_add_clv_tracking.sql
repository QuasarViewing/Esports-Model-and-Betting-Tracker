-- Phase 3: CLV (closing line value) tracking.
-- odds_at_placement is the odds we paid; closing_odds is the market consensus at match start;
-- clv_pct = (odds_at_placement / closing_odds - 1) * 100. Positive = beat the market.

ALTER TABLE bets ADD COLUMN IF NOT EXISTS odds_at_placement numeric(8, 3);
ALTER TABLE bets ADD COLUMN IF NOT EXISTS closing_odds numeric(8, 3);
ALTER TABLE bets ADD COLUMN IF NOT EXISTS clv_pct numeric(8, 4);

-- Backfill odds_at_placement from existing odds for rows that predate this column.
UPDATE bets SET odds_at_placement = odds WHERE odds_at_placement IS NULL;

CREATE INDEX IF NOT EXISTS bets_clv_idx ON bets (clv_pct) WHERE clv_pct IS NOT NULL;
