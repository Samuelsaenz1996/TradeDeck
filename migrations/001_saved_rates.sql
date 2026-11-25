-- Saved rates: a contractor's standing per-unit rates, so quote #2 doesn't
-- re-ask for the numbers they entered on quote #1.
--
-- Shape: { "<trade>": { "<material variant>": { "<fieldId>": <number> } } }
-- e.g.  { "siding": { "Vinyl": { "sidingMaterialRate": 3.25,
--                                "sidingInstallRate": 2.75,
--                                "sidingWasteFactor": 10 } } }
--
-- Nested by material because a siding contractor's vinyl rate and their fiber
-- cement rate are different numbers. Trades with no material selector use "_".
-- One jsonb column rather than a column per rate, so adding a trade later needs
-- no further migration.

alter table public.profiles
  add column if not exists saved_rates jsonb not null default '{}'::jsonb;

comment on column public.profiles.saved_rates is
  'Contractor standing rates: {trade: {materialVariant: {fieldId: number}}}. Seeds the pricing panel on new quotes.';
