-- Bootstrap confidence intervals on the ablation deltas. A point estimate on a
-- few thousand matches cannot separate a weak signal from resampling noise, so
-- every delta now carries an interval and a three-way verdict.

alter table backtest_runs
  add column if not exists bootstrap_samples integer,
  add column if not exists inconclusive_layers text[],
  add column if not exists dropped_layers text[];

alter table backtest_ablations
  add column if not exists ci_low numeric(10,7),
  add column if not exists ci_high numeric(10,7),
  add column if not exists verdict text;

alter table backtest_ablations
  drop constraint if exists backtest_ablations_verdict_check;

alter table backtest_ablations
  add constraint backtest_ablations_verdict_check
  check (verdict is null or verdict in ('keep', 'drop', 'inconclusive'));
