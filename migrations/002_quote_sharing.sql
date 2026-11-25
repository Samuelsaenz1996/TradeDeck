-- Shareable quotes: a link the customer opens, and a record of them accepting.
--
-- Until now a quote only left the app as a client-generated PDF attached to an
-- email or a text. Nothing told the contractor whether it was opened, and the
-- customer had no way to say yes except replying in words. These columns add
-- the link and the acceptance.
--
-- share_token  unguessable; the only credential the public page needs, so it
--              is a 64-char random string, not the quote's id.
-- viewed_at    first time the customer opened the link.
-- accepted_*   who accepted, when, and the typed name they signed with.
--
-- Mirrors invoices.pay_token, which already works this way.

alter table public.quotes
  add column if not exists share_token    text,
  add column if not exists shared_at      timestamptz,
  add column if not exists viewed_at      timestamptz,
  add column if not exists accepted_at    timestamptz,
  add column if not exists accepted_name  text;

-- One quote per token, and a fast lookup for the public endpoint. Partial so
-- the many quotes that were never shared don't sit in the index.
create unique index if not exists quotes_share_token_key
  on public.quotes (share_token)
  where share_token is not null;

comment on column public.quotes.share_token is
  'Unguessable token for the public quote page at /q/<token>. Null until the contractor creates a share link.';
comment on column public.quotes.accepted_name is
  'The name the customer typed when accepting. Their assent, not a legal e-signature.';
