# MyTradeDeck — Project Status

Last updated: June 2, 2026 (**payments + subscriptions LIVE on Saenztech LLC**; platform migrated; one sidebar bug fix in progress)

Save this. Paste into any future Claude conversation to continue.

> Reconstructed from current code + the go-live and Stripe-account-migration session. Sanity-check tester names (placeholders) and exact IDs against your own Stripe/Supabase if you need precision. The contractor login used throughout was samuelsaenz1996@gmail.com.

---

## 🟢 Go-live: COMPLETE — both flows verified with real money on Saenztech LLC

The whole PAY epic and the subscription billing now run on the **Saenztech LLC** Stripe platform account (`acct_1Tdvgh2LuFwvqrU8`), in **live mode**. Both were proven end-to-end:

- **Payments (Connect):** real $1 invoice (#INV-1003) → hosted Checkout on the connected account → charge landed on the connected account → 1% application fee taken by the platform → Connect webhook delivered **200** → invoice auto-flipped to **paid** with "Paid on Jun 2, 2026" (`paid_at` stamped). Full PAY-A/B/C loop confirmed live.
- **Subscriptions:** Upgrade to Pro → live Checkout against the new Saenztech LLC price IDs → 100%-off coupon applied ($0) → subscription webhook delivered → `profiles.plan = 'pro'`, `subscription_status = 'active'`, fresh `cus_…` + `sub_…` written. Confirmed in Supabase.

**You are clear to announce payments to testers (was Phase 7).** Nothing blocks real use.

---

## ⚠️ The big change this session: platform moved to a NEW Stripe account

Originally everything pointed at an older Stripe account (where the *test-mode* "$49 tester" subscription lived). For business/tax reasons the platform was migrated to a brand-new **Saenztech LLC** live account. This was a real migration, not a config tweak. What moved:

- **Connect** had to be **activated** on the live Saenztech LLC account (Connect, "Platform" business model — merchants collect directly). It is NOT on by default in live mode the way it is in sandbox.
- **`STRIPE_SECRET_KEY` (Production)** → Saenztech LLC live `sk_live_…`. (It was found EMPTY on Production at the start — the original root cause of test-mode onboarding.)
- **Subscription products recreated** on Saenztech LLC: "MyTradeDeck Pro" $49/mo and "MyTradeDeck Pro (Yearly)" $490/yr → **new** `price_…` IDs → set on `STRIPE_PRICE_ID_MONTHLY` (`price_1TdxD62LuFwvqrU89lp9r6GP`) and `STRIPE_PRICE_ID_ANNUAL` (the $490 yearly price).
- **Both webhooks recreated** on Saenztech LLC with NEW signing secrets in Vercel Production:
  - Connect webhook "whimsical-rhythm" → `https://www.mytradedeck.com/api/webhooks/stripe-connect`, events from **Connected accounts**, listening to `checkout.session.completed`, secret in `STRIPE_CONNECT_WEBHOOK_SECRET`.
  - Subscription webhook "exquisite-radiance" → `https://www.mytradedeck.com/api/stripe-webhook`, events from **your account**, listening to `checkout.session.completed` + `customer.subscription.updated` + `customer.subscription.deleted`, secret in `STRIPE_WEBHOOK_SECRET`.
- The old test-mode "$49 tester" subscription did **not** need migrating — it was test data, so there was nothing real to move.

### Gotchas hit during the migration (so they're not re-learned the hard way)
- **Webhook URLs MUST use `www.`** — the apex `mytradedeck.com` 307-redirects to `www.`, and Stripe does NOT follow redirects on POST, so a non-www endpoint silently fails with **307 ERR** and invoices never flip to paid. Both endpoints are on `https://www.mytradedeck.com/...`.
- **Connect webhook must listen on Connected accounts**, not just the platform account — direct-charge events fire on the connected account.
- **Stale cross-account IDs on the prod `profiles` row** repeatedly blocked things:
  - `create-account-link` only mints a NEW account when `stripe_account_id` is NULL; a leftover (test, or old-platform) `acct_…` causes "account not connected to your platform / does not exist." Fix = clear the Connect columns, then onboard fresh.
  - `create-checkout` reused a stale `stripe_customer_id` from the old account → "No such customer." Fix = also null `stripe_customer_id` so a fresh customer is minted on the new account.
  - **The `profiles` PK is `user_id`, NOT `id`.** Early SQL failed with `column "id" does not exist`. All profile SQL keys on `WHERE user_id = (SELECT id FROM auth.users WHERE email = '...')`.
- **Live secret keys are shown only once** (at creation/roll). "No value when I edit the Vercel var" is just Vercel masking sensitive vars — not a failed save.
- **Env var changes only apply to NEW builds** — redeploy Production after editing any env var.

### Reset-to-free recipe (for re-testing the upgrade flow)
The contractor account is currently **pro** (from the live coupon test — intentionally kept). To re-test free→pro later:
```sql
UPDATE public.profiles
SET plan = 'free', stripe_subscription_id = NULL, subscription_status = NULL,
    stripe_customer_id = NULL   -- also null this or checkout 500s on the old/stale customer
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'samuelsaenz1996@gmail.com');
```

---

## 🔧 In progress: sidebar plan-card bug fix (spec written, NOT yet run in Claude Code)

**Symptom:** sidebar shows "FREE PLAN", "Unlimited / 5 quotes" (contradiction), and the "Upgrade to Pro" button even though the account is pro.

**Root cause:** `updateUsageDisplay()` runs in `init()` BEFORE `loadProfileCache()` resolves (profileCache still null → falls through to free branch), and is never re-run once the profile loads. Separately, the pro branch only set the `#quoteUsed` span to "Unlimited" but left the static second span (" / 5 quotes") untouched → "Unlimited / 5 quotes". The "FREE PLAN" label + Upgrade button were never touched by the function at all.

**Fix (spec ready to paste into Claude Code):**
1. Rewrite `updateUsageDisplay()` to drive the whole card: label (`.usage-label`), the suffix span (`#quoteUsed + span`, cleared when pro), and the upgrade button visibility. Toggles `data-i18n` attrs so a language switch doesn't clobber the pro display.
2. Re-run `updateUsageDisplay()` after `loadProfileCache()` resolves in BOTH `init()` and `updateAuthUI()` (`.then(() => updateUsageDisplay())`).
3. Added a non-destructive browser-console self-test harness `window.__testSidebar()` — saves/restores `profileCache`/`quoteUsed`/`tdLang`, asserts pro+free+language-toggle render states, logs `X/X passed`. Run it on the Preview console; expect 10/10. (It tests render logic, NOT the async timing bug — verify that one by eyeballing the real sidebar as the pro account on load.)

**Next action:** paste the spec into Claude Code → branch → Vercel Preview → run `__testSidebar()` in console + eyeball pro sidebar → merge to main.

---

## What This Is

MyTradeDeck is an AI-powered admin tool for contractors and tradespeople. Drafts bilingual (EN/ES) quotes and follow-ups, with a CRM layer (clients → jobs → quotes/follow-ups/invoices). Contractors can get paid online: send an invoice with a pay link, the client pays by card on a Stripe-hosted page, money lands in the contractor's own Stripe account; the invoice auto-marks paid via webhook.

- Pricing: Free (5 quotes/mo, server-enforced) · Pro $49/mo (annual $490) · Team $99/mo (priced, no multi-seat logic).
- Payments fee: 1% MyTradeDeck platform fee capped at $25/invoice, on top of Stripe's processing fee. Contractor is merchant of record.
- Live at https://mytradedeck.com. Goal: a high-income side project, not full-time. Long-term: Capacitor wrap for the app stores.

## Tech Stack (current)
- Frontend: single `index.html`, vanilla JS, no framework, no build step. Host path `c:\ST\GitHub\TradeDeck\TradeDeck\index.html`.
- AI: Anthropic API via `/api/generate.js` (Edge proxy), model `claude-sonnet-4-6`, SSE streaming.
- Auth: Supabase email — password (+ magic-link fallback), recovery. Dev bypass localhost-only.
- Billing: Stripe Checkout + portal (`/api/create-checkout`, `/api/create-portal`), subscription webhook → `profiles.plan`.
- Payments: Stripe Connect **Standard** accounts, **direct charges** on the connected account, platform `application_fee_amount` (1% capped $25), Stripe-**hosted** Checkout. Two separate webhooks (subscription vs Connect), separate secrets.
- Persistence: Supabase Postgres (`clients`, `quotes`, `jobs`, `followups`, `invoices`, `profiles`), 4-policy RLS on `auth.uid()`, cross-entity FKs ON DELETE SET NULL. Project `cqmctdhxticryelvhhze`.
- Storage: Supabase `logos` bucket. Email: Resend SMTP via `mail.mytradedeck.com`.
- Hosting: Vercel, auto-deploy from GitHub `main`. Domain on GoDaddy (apex 307s → www; webhook URLs must use www). PDF: html2pdf.js. API safety: $20/mo Anthropic cap.

### Vercel environment variables (Production)
- `STRIPE_SECRET_KEY` — Saenztech LLC live `sk_live_…` (Production); Preview = `sk_test`.
- `STRIPE_PRICE_ID_MONTHLY` = `price_1TdxD62LuFwvqrU89lp9r6GP` ($49/mo); `STRIPE_PRICE_ID_ANNUAL` = the $490/yr price.
- `STRIPE_WEBHOOK_SECRET` — Saenztech LLC subscription webhook secret.
- `STRIPE_CONNECT_WEBHOOK_SECRET` — Saenztech LLC Connect webhook secret.
- `PLATFORM_FEE_PERCENT` = 1 (fails open to 0% / no fee if missing); `PLATFORM_FEE_CAP_CENTS` defaults 2500 in code.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `ANTHROPIC_API_KEY`.

### Backend endpoints (/api)
`generate`; `create-checkout`; `create-portal`; `stripe-webhook` (subscription, `STRIPE_WEBHOOK_SECRET`); `connect/create-account-link`; `connect/account-status`; `invoice/create-pay-link`; `pay/[token]` (public); `pay-result` (public); `webhooks/stripe-connect` (public, Connect, `STRIPE_CONNECT_WEBHOOK_SECRET`). All Node/ESM, JWT-verify pattern, service-role Supabase client, Stripe apiVersion '2024-06-20'.

## What's Built (functional)
- Foundation, quotes, full CRM (clients/jobs/quotes/follow-ups), 10 trades / 7 pricing modes, full EN/ES, mobile drawer.
- Auth (password + magic-link + recovery), Stripe subscriptions + portal, Profile/branding.
- Archive + bulk + delete + confirmModal across all four core tables.
- Invoices: INV-A (convert-to-invoice RPC, doc view, payment tracking, PDF/email/text) + INV-B (invoices list view + nav).
- Payments collection: PAY-A (Connect onboarding) + PAY-B (hosted-Checkout direct charges + 1%/$25 fee) + PAY-C (Connect webhook → auto-mark paid). **All live and verified on Saenztech LLC.**

## What's NOT built / roadmap
| Feature | Priority | Notes |
|---|---|---|
| Sidebar plan-card fix | **High (in progress)** | Spec written + self-test harness; not yet run in Claude Code. |
| Embedded card entry on our page | Med | User wants clients to enter card on-site instead of redirect. Deferred post-go-live. Path: Stripe **Embedded Checkout** (keeps token flow + PCI posture, smallest change) over full Elements. A real, separate sprint. |
| Real Payments dashboard | Med-High | Replace MOCK_PAYMENTS/MOCK_PAYMENT_WEEKS with real invoice data (Σtotal/Σpaid/Σbalance; avg-days-to-pay now computable from `paid_at`). Last mock surface. Decide INV-B-vs-Payments merge (lean: Payments = rollup over the invoice list). |
| Test the ANNUAL checkout path | Med | Monthly proven live via coupon; annual env var confirmed but never run end-to-end. Shares the monthly code path (low risk). |
| Orphan i18n key sweep | Low | `toast.invoicePlaceholder`, `invoice.viewTitleHtml`. Deliberately deferred out of the sidebar PR to keep it focused. |
| Single-invoice topbar shows "Invoices" (plural) | Low | Cosmetic (VIEW_TOPBAR is view-keyed). |
| Auto-link follow-up to job | Low-Med | ~2-line fix in persistGeneratedFollowup. |
| PAY-C partial-payment idempotency | Low (deferred) | Keys on last stored PI; multiple online partials + replayed earlier event could double-count. Revisit if multiple online partials are enabled. |
| Extend archive to invoices | Low-Med | `invoices` has no `archived_at`. |
| Retire dev bypass | Low | localhost-gated; parked. |
| Capacitor wrap | Med | Sprint 4+. |

## Stripe cleanup state (this session)
- Promo code **`MyTradeDeckFree`** (100% off forever) — **deactivated** after the test.
- Test Pro subscription (`sub_1TdxZG2LuFwvqrU8KYglgvJ3`) on the contractor account — **intentionally kept** ($0/forever; owner uses Pro for free).
- `pay-b-preview` branch — was a rollback reference pre-go-live; safe to delete now that go-live is verified.

## Data Model (current)
clients → jobs → (quotes, followups, invoices); quotes/followups/invoices can also hang directly off a client. Invoices created from a quote via idempotent `create_invoice_from_quote` RPC. `invoices` has `pay_token` (unique), `stripe_checkout_session_id`, `stripe_payment_intent_id`, `paid_at` (stamped by PAY-C webhook). `profiles` (PK = `user_id`) has quota RPCs, plan, business/branding fields, Stripe subscription fields, and Connect fields (`stripe_account_id`, `stripe_charges_enabled`, `stripe_details_submitted`, `stripe_payouts_enabled`, `stripe_connect_updated_at`). No `archived_at` on `invoices` yet.

## Workflow preferences
Small incremental sprints. Prompts in fenced blocks for Claude Code in VS Code, 4-section format (Manual setup → Changes → Self-tests → Test plan), explicit negative constraints, "X/X passed" before deploy, functions referenced by name. Migrations as a separate SQL block BEFORE code. Multi-phase manual procedures ONE step at a time. Push to a branch → Vercel Preview → verify → merge to main.

## Open questions for next session
- Run the sidebar fix in Claude Code; verify `__testSidebar()` 10/10 + eyeball pro sidebar; merge.
- Embedded on-page card entry: schedule as its own sprint (Embedded Checkout).
- Real Payments dashboard: merge with the Invoices list or keep separate?
- Test the annual subscription path end-to-end.
- Sweep the two orphan i18n keys + the plural-topbar cosmetic in one polish pass.
- Delete `pay-b-preview`.