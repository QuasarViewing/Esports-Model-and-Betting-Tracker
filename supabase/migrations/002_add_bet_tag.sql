-- Phase 2: bet tagging for edge-by-category analytics.
-- Adds a free-form tag column; nullable so existing rows stay valid.

ALTER TABLE bets ADD COLUMN IF NOT EXISTS tag text;

CREATE INDEX IF NOT EXISTS bets_tag_idx ON bets (tag) WHERE tag IS NOT NULL;
