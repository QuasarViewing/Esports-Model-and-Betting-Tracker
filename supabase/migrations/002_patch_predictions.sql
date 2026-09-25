CREATE TABLE IF NOT EXISTS patch_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patch_version text NOT NULL,
  prediction_type text NOT NULL,
  hero_id integer,
  predicted_direction text NOT NULL,
  predicted_impact text,
  actual_win_rate_change float,
  correct boolean,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patch_predictions_version ON patch_predictions(patch_version);
CREATE INDEX IF NOT EXISTS idx_patch_predictions_hero ON patch_predictions(hero_id);
