-- Model tables for Dota 2 betting prediction system.
-- All tables use IF NOT EXISTS so re-running is a no-op.

CREATE TABLE IF NOT EXISTS team_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id integer NOT NULL,
  team_name text NOT NULL,
  elo_rating float DEFAULT 1500,
  matches_played integer DEFAULT 0,
  wins integer DEFAULT 0,
  losses integer DEFAULT 0,
  last_match_date timestamptz,
  patch text,
  patch_wins integer DEFAULT 0,
  patch_losses integer DEFAULT 0,
  radiant_wins integer DEFAULT 0,
  radiant_losses integer DEFAULT 0,
  dire_wins integer DEFAULT 0,
  dire_losses integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(team_id)
);

CREATE TABLE IF NOT EXISTS player_hero_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id bigint NOT NULL,
  player_name text,
  hero_id integer NOT NULL,
  hero_name text,
  games_played integer DEFAULT 0,
  wins integer DEFAULT 0,
  win_rate float DEFAULT 0,
  avg_kills float DEFAULT 0,
  avg_deaths float DEFAULT 0,
  avg_assists float DEFAULT 0,
  avg_gpm float DEFAULT 0,
  avg_xpm float DEFAULT 0,
  avg_hero_damage float DEFAULT 0,
  avg_tower_damage float DEFAULT 0,
  comfort_score float DEFAULT 0,
  last_played timestamptz,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(account_id, hero_id)
);

CREATE TABLE IF NOT EXISTS hero_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_id integer NOT NULL,
  hero_name text NOT NULL,
  patch text,
  pro_win_rate float,
  pro_pick_rate float,
  pro_ban_rate float,
  immortal_win_rate float,
  immortal_pick_rate float,
  avg_duration_win float,
  avg_duration_loss float,
  timing_profile text,
  archetype_weights jsonb,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(hero_id, patch)
);

CREATE TABLE IF NOT EXISTS hero_matchups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_id integer NOT NULL,
  opponent_hero_id integer NOT NULL,
  games integer DEFAULT 0,
  wins integer DEFAULT 0,
  win_rate float DEFAULT 0,
  patch text,
  data_source text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(hero_id, opponent_hero_id, patch)
);

CREATE TABLE IF NOT EXISTS hero_synergies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_id_1 integer NOT NULL,
  hero_id_2 integer NOT NULL,
  games integer DEFAULT 0,
  wins integer DEFAULT 0,
  win_rate float DEFAULT 0,
  synergy_score float DEFAULT 0,
  patch text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(hero_id_1, hero_id_2, patch)
);

CREATE TABLE IF NOT EXISTS hero_pair_timing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_id_1 integer NOT NULL,
  hero_id_2 integer NOT NULL,
  same_team boolean NOT NULL,
  avg_game_duration float,
  win_rate_pre_25 float,
  win_rate_25_35 float,
  win_rate_35_plus float,
  games integer DEFAULT 0,
  patch text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(hero_id_1, hero_id_2, same_team, patch)
);

CREATE TABLE IF NOT EXISTS team_head_to_head (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id_1 integer NOT NULL,
  team_id_2 integer NOT NULL,
  team1_wins integer DEFAULT 0,
  team2_wins integer DEFAULT 0,
  last_match_date timestamptz,
  matches jsonb,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(team_id_1, team_id_2)
);
-- Enforce canonical ordering: team_id_1 < team_id_2
ALTER TABLE team_head_to_head DROP CONSTRAINT IF EXISTS team_h2h_ordering;
ALTER TABLE team_head_to_head ADD CONSTRAINT team_h2h_ordering CHECK (team_id_1 < team_id_2);

CREATE TABLE IF NOT EXISTS model_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id text,
  team_a_id integer,
  team_a_name text,
  team_b_id integer,
  team_b_name text,
  model_probability float,
  bookmaker_odds_a float,
  bookmaker_odds_b float,
  bookmaker_implied_a float,
  edge float,
  recommended_stake_pct float,
  draft_archetype_a text,
  draft_archetype_b text,
  heroes_a jsonb,
  heroes_b jsonb,
  player_comfort_avg_a float,
  player_comfort_avg_b float,
  actual_winner text,
  correct boolean,
  created_at timestamptz DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_team_ratings_team_id ON team_ratings(team_id);
CREATE INDEX IF NOT EXISTS idx_player_hero_stats_account ON player_hero_stats(account_id);
CREATE INDEX IF NOT EXISTS idx_player_hero_stats_hero ON player_hero_stats(hero_id);
CREATE INDEX IF NOT EXISTS idx_hero_meta_patch ON hero_meta(patch);
CREATE INDEX IF NOT EXISTS idx_hero_matchups_hero ON hero_matchups(hero_id);
CREATE INDEX IF NOT EXISTS idx_hero_synergies_hero1 ON hero_synergies(hero_id_1);
CREATE INDEX IF NOT EXISTS idx_hero_pair_timing_heroes ON hero_pair_timing(hero_id_1, hero_id_2);
CREATE INDEX IF NOT EXISTS idx_team_h2h_teams ON team_head_to_head(team_id_1, team_id_2);
CREATE INDEX IF NOT EXISTS idx_model_predictions_created ON model_predictions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_predictions_match ON model_predictions(match_id);
