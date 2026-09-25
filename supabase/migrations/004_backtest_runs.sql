-- Walk-forward backtest results. One row per run, one row per ablated layer.
-- Persisted server-side so the evidence survives a browser, a machine and a
-- redeploy — the point of the exercise is a durable record, not a UI cache.

create table if not exists backtest_runs (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  matches_total   integer not null,
  matches_scored  integer not null,
  burn_in_frac    numeric(4,3) not null,
  min_prior_games integer not null,
  earliest_match  timestamptz,
  latest_match    timestamptz,
  layers          text[] not null,
  kept_layers     text[] not null,
  log_loss        numeric(8,5) not null,
  brier           numeric(8,5) not null,
  accuracy        numeric(6,5) not null,
  elo_only_log_loss numeric(8,5) not null,
  notes           text
);

create table if not exists backtest_ablations (
  id                uuid primary key default gen_random_uuid(),
  run_id            uuid not null references backtest_runs(id) on delete cascade,
  layer             text not null,
  log_loss_without  numeric(8,5) not null,
  log_loss_delta    numeric(8,5) not null,
  brier_delta       numeric(8,5) not null,
  earns_place       boolean not null,
  unique (run_id, layer)
);

create index if not exists backtest_ablations_run_idx on backtest_ablations(run_id);
